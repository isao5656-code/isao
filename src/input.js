// ============================================================
// input.js - Mouse and keyboard input handling
// ============================================================
import { TILE_SIZE } from './renderer.js';

export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this._handlers = {};

    // Current mouse tile position
    this.mouseX = -1;
    this.mouseY = -1;

    this._boundMouseMove  = this._onMouseMove.bind(this);
    this._boundMouseDown  = this._onMouseDown.bind(this);
    this._boundKeyDown    = this._onKeyDown.bind(this);
    this._boundContextMenu = this._onContextMenu.bind(this);

    canvas.addEventListener('mousemove',   this._boundMouseMove);
    canvas.addEventListener('mousedown',   this._boundMouseDown);
    canvas.addEventListener('contextmenu', this._boundContextMenu);
    window.addEventListener('keydown',     this._boundKeyDown);
  }

  on(event, handler) {
    this._handlers[event] = handler;
  }

  _emit(event, data) {
    if (this._handlers[event]) this._handlers[event](data);
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const tx = Math.floor(sx / TILE_SIZE);
    const ty = Math.floor(sy / TILE_SIZE);
    if (tx !== this.mouseX || ty !== this.mouseY) {
      this.mouseX = tx;
      this.mouseY = ty;
      this._emit('hover', { x: tx, y: ty, sx, sy });
    }
    this._emit('mousemove', { sx, sy, tx, ty });
  }

  _onMouseDown(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const tx = Math.floor(sx / TILE_SIZE);
    const ty = Math.floor(sy / TILE_SIZE);

    if (e.button === 0) {
      this._emit('click', { x: tx, y: ty, sx, sy });
    } else if (e.button === 2) {
      this._emit('rightclick', { x: tx, y: ty, sx, sy });
    }
  }

  _onContextMenu(e) {
    e.preventDefault();
  }

  _onKeyDown(e) {
    this._emit('keydown', { key: e.key, code: e.code });
    if (e.key === 'Escape') this._emit('cancel', {});
  }

  destroy() {
    this.canvas.removeEventListener('mousemove',   this._boundMouseMove);
    this.canvas.removeEventListener('mousedown',   this._boundMouseDown);
    this.canvas.removeEventListener('contextmenu', this._boundContextMenu);
    window.removeEventListener('keydown',          this._boundKeyDown);
  }
}
