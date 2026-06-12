// Maze model — ported from the Python Maze class. Same parsing and helper
// logic; the layout is upgraded to the iconic full 28x31 arcade grid.

import {
  CELL_WALL, CELL_DOT, CELL_POWER_PELLET, CELL_EMPTY, CELL_GATE,
  CELL_GHOST_HOUSE, ALL_DIRECTIONS,
} from './constants.js';

// 28 columns x 31 rows. Cell chars: '#' wall, '.' dot, 'O' power pellet,
// ' ' empty (walkable), '-' ghost gate, 'G' ghost-house interior.
// The middle row (index 14) opens on the left/right borders for the tunnel.
export const MAZE_LAYOUT = [
  '############################', // 0
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#O####.#####.##.#####.####O#', // 3
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
  '#.####.##.########.##.####.#', // 7
  '#......##....##....##......#', // 8
  '######.##### ## #####.######', // 9
  '######.##### ## #####.######', // 10
  '######.##          ##.######', // 11
  '######.## ###--### ##.######', // 12
  '######.## #GGGGGG# ##.######', // 13
  '      .   #GGGGGG#   .      ', // 14  <- tunnel row
  '######.## #GGGGGG# ##.######', // 15
  '######.## ######## ##.######', // 16
  '######.##          ##.######', // 17
  '######.## ######## ##.######', // 18
  '######.## ######## ##.######', // 19
  '#............##............#', // 20
  '#.####.#####.##.#####.####.#', // 21
  '#.####.#####.##.#####.####.#', // 22
  '#O..##.......  .......##..O#', // 23
  '###.##.##.########.##.##.###', // 24
  '###.##.##.########.##.##.###', // 25
  '#......##....##....##......#', // 26
  '#.##########.##.##########.#', // 27
  '#.##########.##.##########.#', // 28
  '#..........................#', // 29
  '############################', // 30
];

export class Maze {
  constructor() {
    this.reset();

    // Fixed start positions for this layout.
    this.pacmanStart = { x: 13, y: 23 };
    this.ghostStarts = {
      blinky: { x: 13, y: 11 }, // just above the gate
      pinky: { x: 13, y: 14 },
      inky: { x: 11, y: 14 },
      clyde: { x: 16, y: 14 },
    };
    this.scatterTargets = {
      blinky: { x: this.width - 3, y: 0 },
      pinky: { x: 2, y: 0 },
      inky: { x: this.width - 1, y: this.height - 1 },
      clyde: { x: 0, y: this.height - 1 },
    };
  }

  reset() {
    this.layout = MAZE_LAYOUT.map((row) => row.split(''));
    this.height = this.layout.length;
    this.width = this.layout[0].length;
    this.dots = new Set();
    this.powerPellets = new Set();
    this.totalDots = 0;
    this.ghostHousePositions = [];
    this.ghostGate = null;
    this._parse();
  }

  _key(x, y) {
    return x + ',' + y;
  }

  _parse() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.layout[y][x];
        if (cell === CELL_DOT) {
          this.dots.add(this._key(x, y));
          this.totalDots++;
        } else if (cell === CELL_POWER_PELLET) {
          this.powerPellets.add(this._key(x, y));
          this.totalDots++;
        } else if (cell === CELL_GHOST_HOUSE) {
          this.ghostHousePositions.push({ x, y });
        } else if (cell === CELL_GATE && this.ghostGate === null) {
          this.ghostGate = { x, y };
        }
      }
    }
  }

  getCell(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.layout[y][x];
    }
    return CELL_WALL;
  }

  isWall(x, y) {
    return this.getCell(x, y) === CELL_WALL;
  }

  isWalkable(x, y, isGhost = false, isEaten = false) {
    if (x < 0 || x >= this.width) return true; // tunnel wrap columns
    if (y < 0 || y >= this.height) return false;

    const cell = this.getCell(x, y);
    if (cell === CELL_WALL) return false;
    if (cell === CELL_GATE) return isGhost;        // only ghosts use the gate
    if (cell === CELL_GHOST_HOUSE) return isGhost;  // only ghosts inside house
    return true;
  }

  hasDot(x, y) {
    return this.dots.has(this._key(x, y));
  }

  hasPowerPellet(x, y) {
    return this.powerPellets.has(this._key(x, y));
  }

  eatDot(x, y) {
    const k = this._key(x, y);
    if (this.dots.has(k)) {
      this.dots.delete(k);
      this.layout[y][x] = CELL_EMPTY;
      return true;
    }
    return false;
  }

  eatPowerPellet(x, y) {
    const k = this._key(x, y);
    if (this.powerPellets.has(k)) {
      this.powerPellets.delete(k);
      this.layout[y][x] = CELL_EMPTY;
      return true;
    }
    return false;
  }

  remainingDots() {
    return this.dots.size + this.powerPellets.size;
  }

  wrapPosition(x, y) {
    if (x < 0) x = this.width - 1;
    else if (x >= this.width) x = 0;
    return { x, y };
  }

  getValidMoves(x, y, isGhost = false, isEaten = false, currentDir = null) {
    const valid = [];
    for (const dir of ALL_DIRECTIONS) {
      // Ghosts cannot reverse unless eaten or forced.
      if (isGhost && currentDir && !isEaten) {
        if (dir.x === -currentDir.x && dir.y === -currentDir.y) continue;
      }
      const w = this.wrapPosition(x + dir.x, y + dir.y);
      if (this.isWalkable(w.x, w.y, isGhost, isEaten)) valid.push(dir);
    }
    return valid;
  }

  getGhostExitTarget() {
    if (this.ghostGate) return { x: this.ghostGate.x, y: this.ghostGate.y - 1 };
    return { x: 13, y: 11 };
  }

  // Manhattan distance (matches the Python pathing heuristic).
  distance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  isTunnelRow(y) {
    return this.getCell(0, y) === CELL_EMPTY || this.getCell(this.width - 1, y) === CELL_EMPTY;
  }
}
