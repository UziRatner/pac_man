// Canvas rendering: maze, dots, Pac-Man, ghosts, HUD and overlays. All art is
// drawn procedurally (no image assets). The static maze walls are cached into a
// Path2D and re-stroked each frame for performance.

import {
  COLORS, CELL_WALL, GHOST_VULNERABLE, GHOST_EATEN, GHOST_FLASH_TIME,
  STATE_START, STATE_READY, STATE_PAUSED, STATE_GAME_OVER, STATE_LEVEL_COMPLETE,
  DIR_LEFT, DIR_RIGHT, DIR_UP, DIR_DOWN, dirEquals, DIR_NONE,
} from './constants.js';

// Layout: 28x31 board with HUD rows above and below.
const COLS = 28;
const ROWS = 31;
const HUD_TOP = 3;
const HUD_BOTTOM = 2;
const TOTAL_ROWS = ROWS + HUD_TOP + HUD_BOTTOM; // 36

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tile = 16;
    this.offsetX = 0;
    this.boardY = HUD_TOP;
    this.wallPath = null;
    this.gatePath = null;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    this.tile = Math.floor(Math.min(cssW / COLS, cssH / TOTAL_ROWS));
    const boardW = COLS * this.tile;
    const boardH = TOTAL_ROWS * this.tile;
    this.offsetX = Math.floor((cssW - boardW) / 2);
    this.offsetY = Math.floor((cssH - boardH) / 2);

    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.wallPath = null; // rebuild on next draw
  }

  // Convert tile coords to pixel coords (board is offset below the top HUD).
  px(tx) { return this.offsetX + tx * this.tile; }
  py(ty) { return this.offsetY + (ty + HUD_TOP) * this.tile; }

  buildWallPath(maze) {
    const t = this.tile;
    const path = new Path2D();
    const center = (v) => (v + 0.5) * t;
    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        if (maze.getCell(x, y) !== CELL_WALL) continue;
        const cx = center(x);
        const cy = center(y);
        // Connect to right and down wall neighbours (avoids duplicate segments).
        if (maze.getCell(x + 1, y) === CELL_WALL) {
          path.moveTo(cx, cy); path.lineTo(center(x + 1), cy);
        }
        if (maze.getCell(x, y + 1) === CELL_WALL) {
          path.moveTo(cx, cy); path.lineTo(cx, center(y + 1));
        }
        // Isolated single-cell wall: draw a dot so it's still visible.
        if (maze.getCell(x + 1, y) !== CELL_WALL && maze.getCell(x - 1, y) !== CELL_WALL &&
            maze.getCell(x, y + 1) !== CELL_WALL && maze.getCell(x, y - 1) !== CELL_WALL) {
          path.moveTo(cx, cy); path.lineTo(cx + 0.01, cy);
        }
      }
    }
    this.wallPath = path;

    // Ghost-house gate.
    const gate = new Path2D();
    if (maze.ghostGate) {
      const gy = center(maze.ghostGate.y);
      gate.moveTo(maze.ghostGate.x * t, gy);
      gate.lineTo((maze.ghostGate.x + 2) * t, gy);
    }
    this.gatePath = gate;
  }

  draw(game) {
    const ctx = this.ctx;
    // Clear whole canvas (drawing uses absolute coords via px()/py()).
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawMaze(game.maze);
    this.drawDots(game);
    this.drawPacman(game);
    for (const g of game.ghosts) this.drawGhost(g);
    this.drawScorePopups(game);
    this.drawHUD(game);
    this.drawOverlays(game);
  }

  drawMaze(maze) {
    if (!this.wallPath) this.buildWallPath(maze);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY + HUD_TOP * this.tile);
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = Math.max(2, this.tile * 0.55);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(this.wallPath);
    // gate
    ctx.strokeStyle = COLORS.gate;
    ctx.lineWidth = Math.max(2, this.tile * 0.18);
    ctx.stroke(this.gatePath);
    ctx.restore();
  }

  drawDots(game) {
    const ctx = this.ctx;
    const t = this.tile;
    ctx.fillStyle = COLORS.dot;
    for (const key of game.maze.dots) {
      const [x, y] = key.split(',').map(Number);
      ctx.beginPath();
      ctx.arc(this.px(x + 0.5), this.py(y + 0.5), t * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    // Power pellets blink.
    if (Math.floor(performance.now() / 250) % 2 === 0) {
      ctx.fillStyle = COLORS.powerPellet;
      for (const key of game.maze.powerPellets) {
        const [x, y] = key.split(',').map(Number);
        ctx.beginPath();
        ctx.arc(this.px(x + 0.5), this.py(y + 0.5), t * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _dirAngle(dir) {
    if (dirEquals(dir, DIR_LEFT)) return Math.PI;
    if (dirEquals(dir, DIR_UP)) return -Math.PI / 2;
    if (dirEquals(dir, DIR_DOWN)) return Math.PI / 2;
    return 0; // right / none
  }

  drawPacman(game) {
    const pac = game.pacman;
    const ctx = this.ctx;
    const t = this.tile;
    const cx = this.px(pac.px + 0.5);
    const cy = this.py(pac.py + 0.5);
    const r = t * 0.45;

    let mouth; // half-angle of the mouth opening
    if (game.state === 'dying') {
      // Mouth opens until Pac-Man vanishes.
      const p = Math.min(1, game.dyingTimer / 1.2);
      mouth = p * Math.PI;
      if (p >= 1) return;
    } else {
      const open = Math.abs(Math.sin(pac.mouthPhase * Math.PI * 1.6));
      mouth = (dirEquals(pac.dir, DIR_NONE) ? 0.18 : 0.02 + open * 0.33) * Math.PI;
    }

    const a = this._dirAngle(pac.dir);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = COLORS.pacman;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawGhost(g) {
    const ctx = this.ctx;
    const t = this.tile;
    const cx = this.px(g.px + 0.5);
    const cy = this.py(g.py + 0.5);
    const r = t * 0.45;

    let bodyColor = g.color;
    let drawBody = true;
    if (g.state === GHOST_EATEN) {
      drawBody = false;
    } else if (g.state === GHOST_VULNERABLE) {
      const flashing = g.vulnerableTimer < GHOST_FLASH_TIME &&
        Math.floor(g.vulnerableTimer * 6) % 2 === 0;
      bodyColor = flashing ? COLORS.vulnerableFlash : COLORS.vulnerable;
    }

    if (drawBody) {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      // Domed top.
      ctx.arc(cx, cy, r, Math.PI, 0);
      // Right side down to the skirt.
      ctx.lineTo(cx + r, cy + r);
      // Scalloped feet (3 bumps).
      const feet = 3;
      const fw = (2 * r) / feet;
      for (let i = 0; i < feet; i++) {
        const x0 = cx + r - i * fw;
        ctx.quadraticCurveTo(x0 - fw / 2, cy + r - t * 0.18, x0 - fw, cy + r);
      }
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
    }

    // Eyes (drawn for all states, including eaten).
    const lookX = g.dir.x * t * 0.12;
    const lookY = g.dir.y * t * 0.12;
    const eyeR = t * 0.15;
    const pupilR = t * 0.08;
    for (const ex of [-1, 1]) {
      const exC = cx + ex * t * 0.18;
      const eyC = cy - t * 0.06;
      if (g.state === GHOST_VULNERABLE) {
        // Frightened face: small dot eyes + zigzag mouth.
        ctx.fillStyle = COLORS.frightenedFace;
        ctx.beginPath();
        ctx.arc(exC, eyC, pupilR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS.ghostEyes;
        ctx.beginPath();
        ctx.arc(exC, eyC, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.ghostPupil;
        ctx.beginPath();
        ctx.arc(exC + lookX, eyC + lookY, pupilR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (g.state === GHOST_VULNERABLE) {
      ctx.strokeStyle = COLORS.frightenedFace;
      ctx.lineWidth = Math.max(1, t * 0.05);
      ctx.beginPath();
      const my = cy + t * 0.18;
      const seg = r / 3;
      ctx.moveTo(cx - r * 0.7, my);
      for (let i = 0; i < 3; i++) {
        const bx = cx - r * 0.7 + (i + 0.5) * seg * 1.4;
        ctx.lineTo(bx, my - t * 0.08);
        ctx.lineTo(bx + seg * 0.7, my);
      }
      ctx.stroke();
    }
  }

  _text(text, x, y, size, color, align = 'center') {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  drawScorePopups(game) {
    const t = this.tile;
    for (const p of game.scorePopups) {
      this._text(String(p.value), this.px(p.x + 0.5), this.py(p.y + 0.5), t * 0.6, '#00FFDE');
    }
  }

  drawHUD(game) {
    const t = this.tile;
    const topY = this.offsetY + 1.5 * t;
    this._text('1UP', this.px(3), topY - t * 0.7, t * 0.7, COLORS.text, 'center');
    this._text(String(game.score), this.px(6), topY, t * 0.8, COLORS.text, 'right');
    this._text('HIGH SCORE', this.px(14), topY - t * 0.7, t * 0.7, COLORS.text, 'center');
    this._text(String(game.highScore), this.px(14), topY, t * 0.8, COLORS.text, 'center');

    // Bottom: lives as small Pac icons, level on the right.
    const by = this.offsetY + (HUD_TOP + ROWS + 1) * t;
    for (let i = 0; i < Math.max(0, game.lives - 1); i++) {
      const lx = this.px(1.5 + i * 1.2);
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(lx, by);
      ctx.fillStyle = COLORS.pacman;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, t * 0.4, 0.25 * Math.PI, 1.75 * Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    this._text('LEVEL ' + game.level, this.px(COLS - 1), by, t * 0.7, COLORS.text, 'right');
  }

  drawOverlays(game) {
    const t = this.tile;
    const midX = this.px(COLS / 2);
    if (game.state === STATE_READY) {
      this._text('READY!', midX, this.py(17.5), t * 1.1, COLORS.ready);
    } else if (game.state === STATE_PAUSED) {
      this._text('PAUSED', midX, this.py(15.5), t * 1.2, COLORS.text);
    } else if (game.state === STATE_GAME_OVER) {
      this._text('GAME OVER', midX, this.py(15.5), t * 1.2, '#FF0000');
      this._text('Tap to play again', midX, this.py(18.5), t * 0.7, COLORS.text);
    } else if (game.state === STATE_LEVEL_COMPLETE) {
      this._text('LEVEL CLEARED', midX, this.py(15.5), t * 1.0, COLORS.ready);
    } else if (game.state === STATE_START) {
      this._text('CHOMP MAZE', midX, this.py(11), t * 1.4, COLORS.pacman);
      this._text('Swipe or arrow keys to move', midX, this.py(15), t * 0.7, COLORS.text);
      this._text('Tap or press SPACE to start', midX, this.py(17), t * 0.7, COLORS.ready);
      this._text('HIGH SCORE  ' + game.highScore, midX, this.py(20), t * 0.7, COLORS.text);
    }
  }
}
