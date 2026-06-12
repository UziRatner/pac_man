// Headless validation of the maze layout: row widths, dot reachability,
// ghost-house / gate presence. Run with: node web/test/maze.test.mjs
import { Maze, MAZE_LAYOUT } from '../js/maze.js';

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log('  ok  - ' + msg);
  } else {
    console.error('  FAIL- ' + msg);
    failures++;
  }
}

// 1. Every row is exactly 28 chars and there are 31 rows.
check(MAZE_LAYOUT.length === 31, 'maze has 31 rows');
const widths = new Set(MAZE_LAYOUT.map((r) => r.length));
check(widths.size === 1 && widths.has(28), 'every row is 28 cols wide (got ' + [...widths] + ')');

const maze = new Maze();
check(maze.ghostGate !== null, 'ghost gate parsed');
check(maze.ghostHousePositions.length > 0, 'ghost-house cells parsed (' + maze.ghostHousePositions.length + ')');
check(maze.totalDots > 0, 'dots parsed (' + maze.totalDots + ' total)');

// 2. Flood-fill from Pac-Man's start over walkable (non-ghost) tiles, honoring
//    tunnel wrap, and confirm every dot / power pellet is reachable.
const start = maze.pacmanStart;
check(maze.isWalkable(start.x, start.y), 'pacman start is walkable');

const seen = new Set();
const stack = [start];
const DIRS = [ { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 } ];
while (stack.length) {
  const { x, y } = stack.pop();
  const k = x + ',' + y;
  if (seen.has(k)) continue;
  seen.add(k);
  for (const d of DIRS) {
    const w = maze.wrapPosition(x + d.x, y + d.y);
    if (maze.isWalkable(w.x, w.y) && !seen.has(w.x + ',' + w.y)) stack.push(w);
  }
}

let unreachable = 0;
for (const k of [...maze.dots, ...maze.powerPellets]) {
  if (!seen.has(k)) {
    unreachable++;
    if (unreachable <= 5) console.error('    unreachable dot at ' + k);
  }
}
check(unreachable === 0, 'all ' + maze.totalDots + ' dots reachable from start');

// 3. Ghosts can leave the house: exit target is walkable for a ghost.
const exit = maze.getGhostExitTarget();
check(maze.isWalkable(exit.x, exit.y, true), 'ghost exit target walkable by ghost');

// 4. Pac cannot enter the gate or ghost house.
check(!maze.isWalkable(maze.ghostGate.x, maze.ghostGate.y, false), 'gate blocks pac-man');
const gh = maze.ghostHousePositions[0];
check(!maze.isWalkable(gh.x, gh.y, false), 'ghost house blocks pac-man');

console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
