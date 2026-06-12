# Chomp Maze — web/PWA maze game

A faithful arcade-style maze chase game built with HTML5 Canvas + vanilla JS
(no build tools, no frameworks). Designed to run fullscreen on an iPhone and be
installed to the home screen as a PWA. All art is drawn procedurally — there
are no copyrighted ROM/sprite assets.

This is a port of the algorithms from the Python terminal game in the repo root
(maze model, four-ghost AI, scoring, state machine), upgraded with smooth
sub-tile movement, swipe controls, responsive scaling, sound, and offline play.

## Run it

A static web server is required (ES modules + the service worker do not work
over `file://`):

```sh
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

## Install on iPhone

1. Host the `web/` folder over HTTPS (any static host) — PWA install requires
   a secure origin.
2. Open the URL in Safari on the iPhone.
3. Share → **Add to Home Screen**. Launch from the icon for fullscreen play.

## Controls

- **Touch:** swipe up/down/left/right to steer (you can keep your finger down
  and curve through the maze). Tap to start / pause / resume.
- **Keyboard:** arrow keys or WASD to move, `Space`/`Enter` to start/pause,
  `P` pause, `M` mute.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | App shell, iOS meta tags, fullscreen no-scroll CSS |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA install + offline cache |
| `js/constants.js` | Tunables (timers in seconds, speeds, scoring, colors) |
| `js/maze.js` | 28×31 maze model + parser |
| `js/entities.js` | Pac-Man + ghosts (Blinky/Pinky/Inky/Clyde) with smooth motion |
| `js/input.js` | Swipe + keyboard |
| `js/audio.js` | WebAudio sound effects + siren |
| `js/render.js` | All canvas drawing + scaling |
| `js/game.js` | State machine, loop, collisions |
| `js/main.js` | Bootstrap + service-worker registration |

## Tests

Headless checks (no browser needed):

```sh
node web/test/maze.test.mjs      # maze width / dot reachability
node web/test/game.test.mjs      # loop, eating, fright, collisions
node web/test/imports.test.mjs   # every import resolves to an export
```

`node web/test/generate-icons.mjs` regenerates the PNG icons.
