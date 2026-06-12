// Bootstrap: wire up the canvas, input, audio and the requestAnimationFrame
// loop, and register the service worker for offline play.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { STATE_PLAYING, STATE_PAUSED } from './constants.js';

const canvas = document.getElementById('game');
const audio = new AudioEngine();
const game = new Game(audio);
const renderer = new Renderer(canvas);

function unlockAudio() {
  audio.unlock();
}

const input = new Input(canvas, {
  onDirection: (dir) => game.setDirection(dir),
  onTap: () => { unlockAudio(); game.onTap(); },
  onPause: () => game.togglePause(),
  onMute: () => audio.toggleMute(),
});

// First interaction anywhere unlocks audio on iOS.
window.addEventListener('pointerdown', unlockAudio, { once: false });

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => renderer.resize());

// Auto-pause when the tab is backgrounded; reset the loop clock on resume.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === STATE_PLAYING) {
    game.state = STATE_PAUSED;
  }
  last = performance.now();
});

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  game.advance(dt);
  renderer.draw(game);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline still works once cached */ });
  });
}
