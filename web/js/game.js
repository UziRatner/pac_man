// Game controller: owns the maze/entities, runs the fixed-timestep update loop,
// drives the state machine, handles collisions, scoring, lives and levels.
// Ported from the Python game.py with continuous-space collision + smooth motion.

import {
  Maze,
} from './maze.js';
import { PacMan, createGhosts } from './entities.js';
import {
  STATE_START, STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_DYING,
  STATE_LEVEL_COMPLETE, STATE_GAME_OVER,
  GHOST_CHASE, GHOST_SCATTER, GHOST_VULNERABLE, GHOST_EATEN,
  GHOST_VULNERABLE_TIME, READY_TIME, DYING_TIME, LEVEL_COMPLETE_TIME,
  PHASE_SCHEDULE, STARTING_LIVES, SCORE_DOT, SCORE_POWER_PELLET,
  SCORE_GHOST_BASE, EXTRA_LIFE_SCORE, LEVEL_SPEED_STEP, LEVEL_SPEED_CAP,
  GHOST_RELEASE, LS_HIGH_SCORE,
} from './constants.js';

const STEP = 1 / 120; // fixed simulation timestep (seconds)
const MAX_FRAME = 0.25; // clamp to avoid spiral-of-death after tab stalls

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.maze = new Maze();
    this.pacman = new PacMan(this.maze.pacmanStart);
    this.ghosts = createGhosts(this.maze);
    this.blinky = this.ghosts[0];

    this.score = 0;
    this.highScore = Number(localStorage.getItem(LS_HIGH_SCORE) || 0);
    this.lives = STARTING_LIVES;
    this.level = 1;
    this.state = STATE_START;

    this.readyTimer = 0;
    this.dyingTimer = 0;
    this.levelTimer = 0;
    this.ghostChain = 0;
    this.extraLifeGiven = false;
    this.scorePopups = [];

    this.phaseIndex = 0;
    this.phaseTimer = PHASE_SCHEDULE[0].time;
    this.globalMode = PHASE_SCHEDULE[0].mode;

    this._acc = 0;
  }

  get speedScale() {
    return Math.min(LEVEL_SPEED_CAP, 1 + (this.level - 1) * LEVEL_SPEED_STEP);
  }

  startGame() {
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.level = 1;
    this.extraLifeGiven = false;
    this.maze.reset();
    this.startRound();
    if (this.audio) this.audio.start();
  }

  startRound() {
    this.pacman = new PacMan(this.maze.pacmanStart);
    this.pacman.speedScale = this.speedScale;
    this.ghosts = createGhosts(this.maze);
    this.blinky = this.ghosts[0];
    for (const g of this.ghosts) {
      g.speedScale = this.speedScale;
      g.releaseTimer = GHOST_RELEASE[g.name];
    }
    this.resetPhases();
    this.scorePopups = [];
    this.readyTimer = READY_TIME;
    this.state = STATE_READY;
    if (this.audio) this.audio.stopSiren();
  }

  resetPositions() {
    this.pacman.reset();
    this.pacman.speedScale = this.speedScale;
    this.ghosts = createGhosts(this.maze);
    this.blinky = this.ghosts[0];
    for (const g of this.ghosts) {
      g.speedScale = this.speedScale;
      g.releaseTimer = GHOST_RELEASE[g.name];
    }
    this.resetPhases();
    this.readyTimer = READY_TIME;
    this.state = STATE_READY;
    if (this.audio) this.audio.stopSiren();
  }

  resetPhases() {
    this.phaseIndex = 0;
    this.phaseTimer = PHASE_SCHEDULE[0].time;
    this.globalMode = PHASE_SCHEDULE[0].mode;
  }

  nextLevel() {
    this.level += 1;
    this.maze.reset();
    this.startRound();
    if (this.audio) this.audio.levelComplete();
  }

  // --- Input entry points ---
  setDirection(dir) {
    if (this.state === STATE_PLAYING) this.pacman.setDirection(dir);
  }

  onTap() {
    if (this.state === STATE_START || this.state === STATE_GAME_OVER) {
      this.startGame();
    } else if (this.state === STATE_PLAYING) {
      this.state = STATE_PAUSED;
    } else if (this.state === STATE_PAUSED) {
      this.state = STATE_PLAYING;
    }
  }

  togglePause() {
    if (this.state === STATE_PLAYING) this.state = STATE_PAUSED;
    else if (this.state === STATE_PAUSED) this.state = STATE_PLAYING;
  }

  // --- Main loop driver (fixed timestep) ---
  advance(frameDt) {
    let dt = Math.min(frameDt, MAX_FRAME);
    this._acc += dt;
    while (this._acc >= STEP) {
      this.step(STEP);
      this._acc -= STEP;
    }
  }

  step(dt) {
    switch (this.state) {
      case STATE_READY:
        this.readyTimer -= dt;
        if (this.readyTimer <= 0) this.state = STATE_PLAYING;
        break;
      case STATE_PLAYING:
        this.updatePlaying(dt);
        break;
      case STATE_DYING:
        this.dyingTimer += dt;
        if (this.dyingTimer >= DYING_TIME) this.afterDeath();
        break;
      case STATE_LEVEL_COMPLETE:
        this.levelTimer -= dt;
        if (this.levelTimer <= 0) this.nextLevel();
        break;
      default:
        break;
    }
    // Age score popups regardless of state.
    for (const p of this.scorePopups) p.timer -= dt;
    this.scorePopups = this.scorePopups.filter((p) => p.timer > 0);
  }

  anyFrightened() {
    return this.ghosts.some((g) => g.state === GHOST_VULNERABLE);
  }

  updatePhase(dt) {
    // Frightened time does not advance the scatter/chase schedule.
    if (this.anyFrightened()) return;
    if (this.phaseTimer === Infinity) return;
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0 && this.phaseIndex < PHASE_SCHEDULE.length - 1) {
      this.phaseIndex += 1;
      this.globalMode = PHASE_SCHEDULE[this.phaseIndex].mode;
      this.phaseTimer = PHASE_SCHEDULE[this.phaseIndex].time;
      for (const g of this.ghosts) g.setMode(this.globalMode);
    }
  }

  updatePlaying(dt) {
    this.updatePhase(dt);

    this.pacman.update(this.maze, dt);
    this.eatPellets();

    for (const g of this.ghosts) {
      g.update(this.maze, dt, this.pacman, this.blinky, this.globalMode);
    }

    this.checkCollisions();

    // Siren follows frightened state.
    if (this.audio) {
      if (this.anyFrightened()) this.audio.startSiren();
      else this.audio.stopSiren();
    }

    if (this.maze.remainingDots() === 0) {
      this.state = STATE_LEVEL_COMPLETE;
      this.levelTimer = LEVEL_COMPLETE_TIME;
      if (this.audio) this.audio.stopSiren();
    }
  }

  eatPellets() {
    const x = this.pacman.tileX;
    const y = this.pacman.tileY;
    if (this.maze.eatDot(x, y)) {
      this.addScore(SCORE_DOT);
      if (this.audio) this.audio.chomp();
    } else if (this.maze.eatPowerPellet(x, y)) {
      this.addScore(SCORE_POWER_PELLET);
      this.ghostChain = 0;
      for (const g of this.ghosts) g.makeVulnerable(GHOST_VULNERABLE_TIME);
      if (this.audio) this.audio.powerPellet();
    }
  }

  checkCollisions() {
    const pac = this.pacman;
    for (const g of this.ghosts) {
      if (g.inHouse) continue;
      const dist = Math.hypot(g.px - pac.px, g.py - pac.py);
      if (dist >= 0.5) continue;

      if (g.state === GHOST_VULNERABLE) {
        g.eat();
        this.ghostChain += 1;
        const value = SCORE_GHOST_BASE * Math.pow(2, this.ghostChain - 1);
        this.addScore(value);
        this.scorePopups.push({ x: g.tileX, y: g.tileY, value, timer: 1.0 });
        if (this.audio) this.audio.eatGhost();
      } else if (g.state !== GHOST_EATEN) {
        this.killPacman();
        return;
      }
    }
  }

  killPacman() {
    this.pacman.dead = true;
    this.state = STATE_DYING;
    this.dyingTimer = 0;
    if (this.audio) { this.audio.stopSiren(); this.audio.death(); }
  }

  afterDeath() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.state = STATE_GAME_OVER;
      this.saveHighScore();
    } else {
      this.resetPositions();
    }
  }

  addScore(points) {
    this.score += points;
    if (this.score > this.highScore) this.highScore = this.score;
    if (!this.extraLifeGiven && this.score >= EXTRA_LIFE_SCORE) {
      this.extraLifeGiven = true;
      this.lives += 1;
    }
  }

  saveHighScore() {
    localStorage.setItem(LS_HIGH_SCORE, String(this.highScore));
  }
}
