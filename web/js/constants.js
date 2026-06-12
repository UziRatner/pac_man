// Game constants for Chomp Maze (web port of the Python terminal game).
// Frame-based timers from the Python version are rescaled to SECONDS so the
// game is framerate-independent (the original ran at a fixed 10 FPS).

// --- Timing (seconds) ---
export const GHOST_VULNERABLE_TIME = 6.0; // how long ghosts stay frightened
export const GHOST_FLASH_TIME = 2.0;      // trailing time spent flashing white
export const GHOST_RELEASE = {            // staggered exit from the ghost house
  blinky: 0.0,
  pinky: 3.0,
  inky: 6.0,
  clyde: 9.0,
};
export const READY_TIME = 2.0;            // "READY!" hold before a round starts
export const DYING_TIME = 1.5;            // death animation length
export const LEVEL_COMPLETE_TIME = 2.0;   // pause on level clear

// Classic scatter/chase phase schedule (seconds). After the last entry the
// ghosts remain in chase permanently. Faithful to the arcade behaviour.
export const PHASE_SCHEDULE = [
  { mode: 'scatter', time: 7 },
  { mode: 'chase', time: 20 },
  { mode: 'scatter', time: 7 },
  { mode: 'chase', time: 20 },
  { mode: 'scatter', time: 5 },
  { mode: 'chase', time: 20 },
  { mode: 'scatter', time: 5 },
  { mode: 'chase', time: Infinity },
];

// --- Speeds (tiles per second) ---
export const PAC_SPEED = 8.0;
export const GHOST_SPEED = 7.5;
export const GHOST_VULNERABLE_SPEED_FACTOR = 0.5;
export const GHOST_EATEN_SPEED_FACTOR = 2.0;
export const GHOST_TUNNEL_SPEED_FACTOR = 0.5; // ghosts slow in the side tunnel
// Per-level speed ramp applied multiplicatively, capped.
export const LEVEL_SPEED_STEP = 0.04;
export const LEVEL_SPEED_CAP = 1.3;

// --- Scoring ---
export const SCORE_DOT = 10;
export const SCORE_POWER_PELLET = 50;
export const SCORE_GHOST_BASE = 200; // doubles per ghost in a single chain
export const EXTRA_LIFE_SCORE = 10000;

// --- Lives ---
export const STARTING_LIVES = 3;

// --- Directions (dx, dy) ---
export const DIR_NONE = { x: 0, y: 0 };
export const DIR_UP = { x: 0, y: -1 };
export const DIR_DOWN = { x: 0, y: 1 };
export const DIR_LEFT = { x: -1, y: 0 };
export const DIR_RIGHT = { x: 1, y: 0 };
export const ALL_DIRECTIONS = [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT];

export function dirEquals(a, b) {
  return a.x === b.x && a.y === b.y;
}
export function dirReverse(d) {
  return { x: -d.x, y: -d.y };
}

// --- Ghost states ---
export const GHOST_CHASE = 'chase';
export const GHOST_SCATTER = 'scatter';
export const GHOST_VULNERABLE = 'vulnerable';
export const GHOST_EATEN = 'eaten';

// --- Ghost names ---
export const GHOST_BLINKY = 'blinky';
export const GHOST_PINKY = 'pinky';
export const GHOST_INKY = 'inky';
export const GHOST_CLYDE = 'clyde';

// --- Game states ---
export const STATE_START = 'start';
export const STATE_READY = 'ready';
export const STATE_PLAYING = 'playing';
export const STATE_PAUSED = 'paused';
export const STATE_DYING = 'dying';
export const STATE_LEVEL_COMPLETE = 'level_complete';
export const STATE_GAME_OVER = 'game_over';

// --- Maze cell types ---
export const CELL_WALL = '#';
export const CELL_DOT = '.';
export const CELL_POWER_PELLET = 'O';
export const CELL_EMPTY = ' ';
export const CELL_GATE = '-';
export const CELL_GHOST_HOUSE = 'G';

// --- Colors (hex for canvas) ---
export const COLORS = {
  pacman: '#FFE100',
  blinky: '#FF0000',
  pinky: '#FFB8DE',
  inky: '#00FFDE',
  clyde: '#FFB847',
  vulnerable: '#2121FF',
  vulnerableFlash: '#FFFFFF',
  wall: '#2121FF',
  gate: '#FFB8DE',
  dot: '#FFB897',
  powerPellet: '#FFB897',
  text: '#FFFFFF',
  ready: '#FFFF00',
  score: '#FFFFFF',
  ghostEyes: '#FFFFFF',
  ghostPupil: '#2121FF',
  frightenedFace: '#FFB897',
};

export const GHOST_COLOR_BY_NAME = {
  [GHOST_BLINKY]: COLORS.blinky,
  [GHOST_PINKY]: COLORS.pinky,
  [GHOST_INKY]: COLORS.inky,
  [GHOST_CLYDE]: COLORS.clyde,
};

// localStorage keys
export const LS_HIGH_SCORE = 'chompMaze.highScore';
export const LS_MUTED = 'chompMaze.muted';
