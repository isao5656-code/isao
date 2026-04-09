// ============================================================
// input.js - Mouse, keyboard, and touch input handling
// ============================================================
import { TILE_SIZE } from './renderer.js';

const LONG_PRESS_MS = 500; // long-press = cancel (right-click equivalent)

export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this._handlers = {};

    // Current hover tile position
    this.mouseX = -1;
    this.mouseY = -1;

    // Long-press state
    this._lpTimer    = null;
    this._lpStartX   = 0;
    this._lpStartY   = 0;
    this._lpMoved    = false;

    this._boundMouseMove   = this._onMouseMove.bind(this);
    this._boundMouseDown   = this._onMouseDown.bind(this);
    this._boundKeyDown     = this._onKeyDown.bind(this);
    this._boundContextMenu = this._onContextMenu.bind(this);
    this._boundTouchStart  = this._onTouchStart.bind(this);
    this._boundTouchMove   = this._onTouchMove.bind(this);
    this._boundTouchEnd    = this._onTouchEnd.bind(this);

    canvas.addEventListener('mousemove',   this._boundMouseMove);
    canvas.addEventListener('mousedown',   this._boundMouseDown);
    canvas.addEventListener('contextmenu', this._boundContextMenu);
    canvas.addEventListener('touchstart',  this._boundTouchStart, { passive: false });
    canvas.addEventListener('touchmove',   this._boundTouchMove,  { passive: false });
    canvas.addEventListener('touchend',    this._boundTouchEnd,   { passive: false });
    window.addEventListener('keydown',     this._boundKeyDown);
  }

  on(event, handler) {
    this._handlers[event] = handler;
  }

  _emit(event, data) {
    if (this._handlers[event]) this._handlers[event](data);
  }

  // Convert page coordinates → canvas pixel coordinates → tile coordinates
  // Accounts for CSS scaling (canvas.width vs getBoundingClientRect().width)
  _toTile(clientX, clientY) {
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const sx = (clientX - rect.left) * scaleX;
    const sy = (clientY - rect.top)  * scaleY;
    const tx = Math.floor(sx / TILE_SIZE);
    const ty = Math.floor(sy / TILE_SIZE);
    return { sx, sy, tx, ty };
  }

  // ---- Mouse ----

  _onMouseMove(e) {
    const { sx, sy, tx, ty } = this._toTile(e.clientX, e.clientY);
    if (tx !== this.mouseX || ty !== this.mouseY) {
      this.mouseX = tx;
      this.mouseY = ty;
      this._emit('hover', { x: tx, y: ty, sx, sy });
    }
    this._emit('mousemove', { sx, sy, tx, ty });
  }

  _onMouseDown(e) {
    e.preventDefault();
    const { sx, sy, tx, ty } = this._toTile(e.clientX, e.clientY);
    if (e.button === 0) {
      this._emit('click', { x: tx, y: ty, sx, sy });
    } else if (e.button === 2) {
      this._emit('rightclick', { x: tx, y: ty, sx, sy });
    }
  }

  _onContextMenu(e) {
    e.preventDefault();
  }

  // ---- Keyboard ----

  _onKeyDown(e) {
    this._emit('keydown', { key: e.key, code: e.code });
    if (e.key === 'Escape') this._emit('cancel', {});
  }

  // ---- Touch ----

  _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const { sx, sy, tx, ty } = this._toTile(touch.clientX, touch.clientY);

    this._lpStartX = touch.clientX;
    this._lpStartY = touch.clientY;
    this._lpMoved  = false;

    // Update hover
    this.mouseX = tx;
    this.mouseY = ty;
    this._emit('hover', { x: tx, y: ty, sx, sy });

    // Start long-press timer → cancel action
    this._lpTimer = setTimeout(() => {
      if (!this._lpMoved) {
        this._emit('cancel', {});
      }
    }, LONG_PRESS_MS);
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - this._lpStartX);
    const dy = Math.abs(touch.clientY - this._lpStartY);
    if (dx > 8 || dy > 8) {
      this._lpMoved = true;
      clearTimeout(this._lpTimer);
    }

    const { sx, sy, tx, ty } = this._toTile(touch.clientX, touch.clientY);
    if (tx !== this.mouseX || ty !== this.mouseY) {
      this.mouseX = tx;
      this.mouseY = ty;
      this._emit('hover', { x: tx, y: ty, sx, sy });
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();
    clearTimeout(this._lpTimer);

    if (this._lpMoved) return; // drag — no click
    if (e.changedTouches.length !== 1) return;

    const touch = e.changedTouches[0];
    const { sx, sy, tx, ty } = this._toTile(touch.clientX, touch.clientY);
    this._emit('click', { x: tx, y: ty, sx, sy });
  }

  destroy() {
    clearTimeout(this._lpTimer);
    this.canvas.removeEventListener('mousemove',   this._boundMouseMove);
    this.canvas.removeEventListener('mousedown',   this._boundMouseDown);
    this.canvas.removeEventListener('contextmenu', this._boundContextMenu);
    this.canvas.removeEventListener('touchstart',  this._boundTouchStart);
    this.canvas.removeEventListener('touchmove',   this._boundTouchMove);
    this.canvas.removeEventListener('touchend',    this._boundTouchEnd);
    window.removeEventListener('keydown',          this._boundKeyDown);
  }
}
