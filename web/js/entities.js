// Pac-Man and Ghost entities. Movement is continuous (sub-tile pixel motion)
// but all turning / AI decisions happen only when an entity is centered on a
// tile — this keeps the ghost AI a faithful port of the Python version while
// rendering smoothly. Positions are stored in tile units (floats); an integer
// position means the entity is centered on that tile.

import {
  DIR_NONE, DIR_UP, DIR_LEFT, ALL_DIRECTIONS, dirEquals, dirReverse,
  GHOST_CHASE, GHOST_SCATTER, GHOST_VULNERABLE, GHOST_EATEN,
  GHOST_BLINKY, GHOST_PINKY, GHOST_INKY, GHOST_CLYDE,
  PAC_SPEED, GHOST_SPEED, GHOST_VULNERABLE_SPEED_FACTOR,
  GHOST_EATEN_SPEED_FACTOR, GHOST_TUNNEL_SPEED_FACTOR,
  GHOST_COLOR_BY_NAME,
} from './constants.js';

const EPS = 1e-6;

// Advance an entity along its current direction by `speed * dt` tile units,
// stopping at each tile center to let `decide` choose the next direction.
function stepEntity(entity, maze, dt, isGhost, isEaten, decide) {
  let budget = entity.speed * dt;
  let moved = 0;
  let guard = 0;
  while (budget > EPS && guard++ < 100) {
    const cx = Math.round(entity.px);
    const cy = Math.round(entity.py);
    const onCenter = Math.abs(entity.px - cx) < EPS && Math.abs(entity.py - cy) < EPS;

    if (onCenter) {
      entity.px = cx;
      entity.py = cy;
      decide(cx, cy);
      const nx = cx + entity.dir.x;
      const ny = cy + entity.dir.y;
      const w = maze.wrapPosition(nx, ny);
      const blocked = (entity.dir.x === 0 && entity.dir.y === 0) ||
        !maze.isWalkable(w.x, w.y, isGhost, isEaten);
      if (blocked) break;
    }

    // Distance to the next tile center along the current direction.
    let dist;
    if (entity.dir.x > 0) dist = Math.floor(entity.px) + 1 - entity.px;
    else if (entity.dir.x < 0) dist = entity.px - (Math.ceil(entity.px) - 1);
    else if (entity.dir.y > 0) dist = Math.floor(entity.py) + 1 - entity.py;
    else dist = entity.py - (Math.ceil(entity.py) - 1);
    if (dist < EPS) dist = 1;

    const move = Math.min(budget, dist);
    entity.px += entity.dir.x * move;
    entity.py += entity.dir.y * move;
    budget -= move;
    moved += move;

    // Horizontal tunnel wrap.
    if (entity.px < -EPS) entity.px += maze.width;
    else if (entity.px >= maze.width - EPS) entity.px -= maze.width;
  }
  return moved;
}

export class PacMan {
  constructor(start) {
    this.start = start;
    this.reset();
  }

  reset() {
    this.px = this.start.x;
    this.py = this.start.y;
    this.dir = { ...DIR_NONE };
    this.nextDir = { ...DIR_NONE };
    this.dead = false;
    this.speed = PAC_SPEED;
    this.speedScale = 1;
    this.mouthPhase = 0;
  }

  setDirection(dir) {
    this.nextDir = { ...dir };
  }

  get tileX() { return Math.round(this.px); }
  get tileY() { return Math.round(this.py); }
  get position() { return { x: this.tileX, y: this.tileY }; }

  // Tile a few steps ahead of Pac-Man, used by ghost targeting.
  aheadPosition(tiles) {
    return { x: this.tileX + this.dir.x * tiles, y: this.tileY + this.dir.y * tiles };
  }

  update(maze, dt) {
    if (this.dead) return;
    this.speed = PAC_SPEED * this.speedScale;
    const moved = stepEntity(this, maze, dt, false, false, (cx, cy) => {
      if (!dirEquals(this.nextDir, DIR_NONE)) {
        const w = maze.wrapPosition(cx + this.nextDir.x, cy + this.nextDir.y);
        if (maze.isWalkable(w.x, w.y)) this.dir = { ...this.nextDir };
      }
    });
    if (moved > 0) this.mouthPhase += moved;
  }
}

export class Ghost {
  constructor(name, start, scatterTarget) {
    this.name = name;
    this.start = start;
    this.scatterTarget = scatterTarget;
    this.color = GHOST_COLOR_BY_NAME[name];
    this.reset();
  }

  reset() {
    this.px = this.start.x;
    this.py = this.start.y;
    this.dir = { ...DIR_UP };
    this.state = GHOST_SCATTER;
    this.vulnerableTimer = 0;
    this.inHouse = this.name !== GHOST_BLINKY; // Blinky starts outside
    this.releaseTimer = 0;
    this.speed = GHOST_SPEED;
    if (this.name === GHOST_BLINKY) {
      this.px = this.start.x;
      this.py = this.start.y;
    }
  }

  get tileX() { return Math.round(this.px); }
  get tileY() { return Math.round(this.py); }
  get position() { return { x: this.tileX, y: this.tileY }; }

  makeVulnerable(duration) {
    if (this.state === GHOST_EATEN || this.inHouse) return;
    this.state = GHOST_VULNERABLE;
    this.vulnerableTimer = duration;
    this.dir = dirReverse(this.dir); // classic reverse on fright
  }

  eat() {
    this.state = GHOST_EATEN;
  }

  // Reverse direction when the global scatter/chase phase flips.
  setMode(mode) {
    if (this.state === GHOST_VULNERABLE || this.state === GHOST_EATEN) return;
    if (this.state !== mode) {
      this.state = mode;
      if (!this.inHouse) this.dir = dirReverse(this.dir);
    }
  }

  isFrightened() { return this.state === GHOST_VULNERABLE; }
  isEaten() { return this.state === GHOST_EATEN; }

  // Target tile for chasing — overridden per ghost.
  getTarget(pacman, blinky) {
    return pacman.position;
  }

  chooseDirection(maze, target) {
    const cx = this.tileX;
    const cy = this.tileY;
    const eaten = this.state === GHOST_EATEN;
    let moves = maze.getValidMoves(cx, cy, true, eaten, this.dir);
    if (moves.length === 0) moves = maze.getValidMoves(cx, cy, true, eaten, null);
    if (moves.length === 0) return this.dir;
    if (moves.length === 1) return moves[0];

    let best = moves[0];
    let bestDist = Infinity;
    for (const d of moves) {
      const w = maze.wrapPosition(cx + d.x, cy + d.y);
      const dist = maze.distance(w, target);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best;
  }

  currentSpeed(maze) {
    let s = GHOST_SPEED * (this.speedScale || 1);
    if (this.state === GHOST_EATEN) return s * GHOST_EATEN_SPEED_FACTOR;
    if (this.state === GHOST_VULNERABLE) return s * GHOST_VULNERABLE_SPEED_FACTOR;
    if (maze.isTunnelRow(this.tileY)) return s * GHOST_TUNNEL_SPEED_FACTOR;
    return s;
  }

  updateHouse(maze, dt, globalMode) {
    if (this.releaseTimer > 0) {
      this.releaseTimer -= dt;
      return;
    }
    const exit = maze.getGhostExitTarget();
    if (Math.abs(this.px - exit.x) < EPS && Math.abs(this.py - exit.y) < EPS) {
      this.inHouse = false;
      this.dir = { ...DIR_LEFT };
      this.state = globalMode; // join the current scatter/chase phase
      return;
    }
    stepEntity(this, maze, dt, true, true, () => {
      this.dir = this.chooseDirection(maze, exit);
    });
  }

  updateEaten(maze, dt) {
    const exit = maze.getGhostExitTarget();
    if (maze.distance(this.position, exit) <= 0) {
      // Reached the house entrance — respawn inside.
      this.px = this.start.x;
      this.py = this.start.y;
      this.state = GHOST_CHASE;
      this.inHouse = true;
      this.releaseTimer = 0.5;
      this.dir = { ...DIR_UP };
      return;
    }
    stepEntity(this, maze, dt, true, true, () => {
      this.dir = this.chooseDirection(maze, exit);
    });
  }

  update(maze, dt, pacman, blinky, globalMode) {
    if (this.state === GHOST_VULNERABLE) {
      this.vulnerableTimer -= dt;
      if (this.vulnerableTimer <= 0) this.state = globalMode;
    }
    this.speed = this.currentSpeed(maze);

    if (this.inHouse) { this.updateHouse(maze, dt, globalMode); return; }
    if (this.state === GHOST_EATEN) { this.updateEaten(maze, dt); return; }

    const target = this.state === GHOST_SCATTER
      ? this.scatterTarget
      : this.getTarget(pacman, blinky);

    stepEntity(this, maze, dt, true, false, () => {
      if (this.state === GHOST_VULNERABLE) {
        const cx = this.tileX;
        const cy = this.tileY;
        let moves = maze.getValidMoves(cx, cy, true, false, this.dir);
        if (moves.length === 0) moves = maze.getValidMoves(cx, cy, true, false, null);
        if (moves.length) this.dir = moves[Math.floor(Math.random() * moves.length)];
      } else {
        this.dir = this.chooseDirection(maze, target);
      }
    });
  }
}

// Blinky — chases Pac-Man's exact tile.
export class Blinky extends Ghost {
  constructor(start, scatterTarget) { super(GHOST_BLINKY, start, scatterTarget); }
  getTarget(pacman) { return pacman.position; }
}

// Pinky — aims 4 tiles ahead of Pac-Man.
export class Pinky extends Ghost {
  constructor(start, scatterTarget) {
    super(GHOST_PINKY, start, scatterTarget);
    this.releaseTimer = 3.0;
  }
  getTarget(pacman) { return pacman.aheadPosition(4); }
}

// Inky — doubles the vector from Blinky to a point 2 tiles ahead of Pac-Man.
export class Inky extends Ghost {
  constructor(start, scatterTarget) {
    super(GHOST_INKY, start, scatterTarget);
    this.releaseTimer = 6.0;
  }
  getTarget(pacman, blinky) {
    if (!blinky) return pacman.position;
    const ahead = pacman.aheadPosition(2);
    const b = blinky.position;
    return { x: ahead.x + (ahead.x - b.x), y: ahead.y + (ahead.y - b.y) };
  }
}

// Clyde — chases when far (>8 tiles), retreats to his corner when close.
export class Clyde extends Ghost {
  constructor(start, scatterTarget) {
    super(GHOST_CLYDE, start, scatterTarget);
    this.releaseTimer = 9.0;
  }
  getTarget(pacman) {
    const p = pacman.position;
    const dist = Math.abs(this.tileX - p.x) + Math.abs(this.tileY - p.y);
    return dist > 8 ? p : this.scatterTarget;
  }
}

export function createGhosts(maze) {
  const s = maze.ghostStarts;
  const t = maze.scatterTargets;
  return [
    new Blinky(s.blinky, t.blinky),
    new Pinky(s.pinky, t.pinky),
    new Inky(s.inky, t.inky),
    new Clyde(s.clyde, t.clyde),
  ];
}
