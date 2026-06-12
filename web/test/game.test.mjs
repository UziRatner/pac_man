// Headless simulation of the game logic (no DOM/canvas). Validates the loop,
// eating, scoring, power-pellet fright, and collision outcomes.
// Run: node web/test/game.test.mjs

// Minimal localStorage shim.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
};

const { Game } = await import('../js/game.js');
const { DIR_LEFT, DIR_RIGHT, DIR_UP, DIR_DOWN, GHOST_VULNERABLE, GHOST_EATEN, STATE_PLAYING, STATE_DYING } =
  await import('../js/constants.js');

let failures = 0;
function check(cond, msg) {
  console[cond ? 'log' : 'error']((cond ? '  ok  - ' : '  FAIL- ') + msg);
  if (!cond) failures++;
}

// advance() clamps each frame (anti spiral-of-death), so simulate real
// frame-sized steps rather than one giant jump.
function advanceSeconds(g, seconds) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) g.advance(1 / 60);
}

const game = new Game(null);
game.startGame();
check(game.state === 'ready', 'starts in READY');

// Run past the READY timer.
advanceSeconds(game, 2.1);
check(game.state === STATE_PLAYING, 'transitions to PLAYING after READY');

const startDots = game.maze.remainingDots();

// Drive Pac-Man with a simple wall-follower so he actually eats dots: try to
// keep moving, switching direction when blocked.
const dirs = [DIR_LEFT, DIR_UP, DIR_RIGHT, DIR_DOWN];
let di = 0;
let crashed = null;
try {
  for (let i = 0; i < 600; i++) { // ~10 seconds at 60fps
    const pac = game.pacman;
    // If stopped or about to hit a wall, rotate to a walkable direction.
    const cx = pac.tileX, cy = pac.tileY;
    const ahead = game.maze.wrapPosition(cx + pac.dir.x, cy + pac.dir.y);
    if ((pac.dir.x === 0 && pac.dir.y === 0) || !game.maze.isWalkable(ahead.x, ahead.y)) {
      for (let k = 0; k < 4; k++) {
        const d = dirs[(di + k) % 4];
        const w = game.maze.wrapPosition(cx + d.x, cy + d.y);
        if (game.maze.isWalkable(w.x, w.y)) { game.setDirection(d); di = (di + k + 1) % 4; break; }
      }
    }
    game.advance(1 / 60);
    if (game.state === STATE_DYING) { // got caught; respawn handled internally
      game.advance(2.0);
    }
  }
} catch (e) {
  crashed = e;
}
check(!crashed, 'simulation ran 10s without crashing' + (crashed ? ': ' + crashed.stack : ''));
check(game.maze.remainingDots() < startDots, 'dots were eaten (' + (startDots - game.maze.remainingDots()) + ')');
check(game.score > 0, 'score increased to ' + game.score);

// Ghosts should have left the house by now.
const out = game.ghosts.filter((g) => !g.inHouse).length;
check(out >= 1, out + ' ghost(s) left the house');

// --- Power-pellet fright + eat-ghost scoring ---
const g2 = new Game(null);
g2.startGame();
advanceSeconds(g2, 2.1);
// Force Pac onto a power-pellet tile and eat it.
const pelletKey = [...g2.maze.powerPellets][0];
const [pxx, pyy] = pelletKey.split(',').map(Number);
g2.pacman.px = pxx; g2.pacman.py = pyy;
g2.eatPellets();
check(g2.ghosts.some((g) => g.state === GHOST_VULNERABLE || g.inHouse), 'power pellet frightens out-of-house ghosts');
const frightened = g2.ghosts.find((g) => g.state === GHOST_VULNERABLE);
check(!!frightened, 'at least one ghost is frightened (Blinky out of house)');

if (frightened) {
  const before = g2.score;
  frightened.px = g2.pacman.px; frightened.py = g2.pacman.py; // overlap
  frightened.inHouse = false;
  g2.checkCollisions();
  check(frightened.state === GHOST_EATEN, 'colliding with frightened ghost eats it');
  check(g2.score === before + 200, 'eating first ghost scores 200 (got ' + (g2.score - before) + ')');
}

// --- Collision with a normal ghost kills Pac-Man ---
const g3 = new Game(null);
g3.startGame();
advanceSeconds(g3, 2.1);
const blinky = g3.blinky;
blinky.inHouse = false;
blinky.state = 'chase';
blinky.px = g3.pacman.px; blinky.py = g3.pacman.py;
g3.checkCollisions();
check(g3.state === STATE_DYING, 'colliding with a normal ghost kills Pac-Man');

console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
