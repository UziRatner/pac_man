// Input handling: swipe gestures for touch (with continuous re-origin steering
// so you can curve through the maze without lifting your finger) plus keyboard
// arrows / WASD for desktop testing. Input only emits a desired direction;
// the entity decides when it can actually turn.

import { DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT } from './constants.js';

const SWIPE_THRESHOLD = 24; // CSS px of travel before a swipe registers

export class Input {
  constructor(target, handlers) {
    this.handlers = handlers || {};
    this.startX = 0;
    this.startY = 0;
    this.tracking = false;
    this.moved = false;
    this._bind(target);
  }

  _dir(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? DIR_RIGHT : DIR_LEFT;
    }
    return dy > 0 ? DIR_DOWN : DIR_UP;
  }

  _bind(target) {
    target.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.startX = t.clientX;
      this.startY = t.clientY;
      this.tracking = true;
      this.moved = false;
    }, { passive: false });

    target.addEventListener('touchmove', (e) => {
      e.preventDefault(); // stop iOS scroll / rubber-banding
      if (!this.tracking) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this.startX;
      const dy = t.clientY - this.startY;
      if (Math.abs(dx) >= SWIPE_THRESHOLD || Math.abs(dy) >= SWIPE_THRESHOLD) {
        this.moved = true;
        this._emitDirection(this._dir(dx, dy));
        // Re-origin so a continued drag can register the next turn.
        this.startX = t.clientX;
        this.startY = t.clientY;
      }
    }, { passive: false });

    target.addEventListener('touchend', (e) => {
      if (this.tracking && !this.moved) this._emitTap();
      this.tracking = false;
    }, { passive: false });

    // Block iOS pinch-zoom gestures.
    target.addEventListener('gesturestart', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => this._onKey(e));
  }

  _onKey(e) {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': this._emitDirection(DIR_UP); break;
      case 'ArrowDown': case 's': case 'S': this._emitDirection(DIR_DOWN); break;
      case 'ArrowLeft': case 'a': case 'A': this._emitDirection(DIR_LEFT); break;
      case 'ArrowRight': case 'd': case 'D': this._emitDirection(DIR_RIGHT); break;
      case ' ': case 'Enter': e.preventDefault(); this._emitTap(); break;
      case 'p': case 'P': if (this.handlers.onPause) this.handlers.onPause(); break;
      case 'm': case 'M': if (this.handlers.onMute) this.handlers.onMute(); break;
      default: return;
    }
    if (e.key.startsWith('Arrow')) e.preventDefault();
  }

  _emitDirection(dir) {
    if (this.handlers.onDirection) this.handlers.onDirection(dir);
  }

  _emitTap() {
    if (this.handlers.onTap) this.handlers.onTap();
  }
}
