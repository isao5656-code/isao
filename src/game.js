// ============================================================
// game.js - Main game loop and state machine
// ============================================================
import { CHAPTER_1 } from './data.js';
import { Unit }       from './unit.js';
import { GameMap }    from './map.js';
import { buildCombatPreview, executeCombat, executeHeal } from './combat.js';
import { runEnemyAI } from './ai.js';
import { Renderer, TILE_SIZE } from './renderer.js';
import { InputHandler } from './input.js';

// Game states
const STATE = {
  PLAYER_PHASE:    'PLAYER_PHASE',
  UNIT_SELECTED:   'UNIT_SELECTED',
  UNIT_MOVED:      'UNIT_MOVED',
  ATTACK_SELECT:   'ATTACK_SELECT',
  COMBAT_PREVIEW:  'COMBAT_PREVIEW',
  HEAL_SELECT:     'HEAL_SELECT',
  ENEMY_PHASE:     'ENEMY_PHASE',
  VICTORY:         'VICTORY',
  GAME_OVER:       'GAME_OVER',
};

export class Game {
  constructor(canvas) {
    this.canvas   = canvas;
    this.renderer = new Renderer(canvas);
    this.input    = new InputHandler(canvas);

    this.state    = null;
    this.map      = null;
    this.turn     = 1;

    // Selection state
    this.selectedUnit     = null;
    this.moveRange        = null;
    this.attackRange      = null;
    this.pendingMoveX     = -1;
    this.pendingMoveY     = -1;
    this.combatPreview    = null;
    this.combatTarget     = null;
    this.healTarget       = null;

    // Action menu state
    this.actionOptions    = [];
    this.actionSelected   = 0;

    // Cursor & hover
    this.cursorX = 0;
    this.cursorY = 0;
    this.hoveredUnit = null;

    // Animation/timing
    this.phaseBannerAlpha = 0;
    this.phaseBannerTimer = 0;
    this.logMessages      = [];
    this.pulse            = 0;

    // End Turn button rect
    this.endTurnBtn = { x: 0, y: 0, w: 90, h: 30 };

    // Optional callback fired whenever state changes (used by HTML buttons)
    this._onStateChange = null;

    this._setupInput();

    // Defer init by two animation frames so CSS layout has fully settled.
    // A single rAF is sometimes not enough on iOS/Android for flex layout
    // to propagate correct clientWidth/clientHeight to #canvas-wrap.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._initChapter(CHAPTER_1);
      this._startPlayerPhase();
    }));
    this._loop();
  }

  // Called by index.html on window resize / orientation change
  _onResize() {
    if (!this.map) return;
    this.renderer.resize(CHAPTER_1.width, CHAPTER_1.height);
    this._updateEndTurnBtn();
  }

  // ---- Initialization ----

  _initChapter(chapter) {
    this.map = new GameMap(chapter);

    for (const pd of chapter.playerUnits) {
      const u = new Unit({ ...pd, team: 'player' });
      this.map.addUnit(u);
    }
    for (const ed of chapter.enemyUnits) {
      const u = new Unit({ ...ed, team: 'enemy' });
      this.map.addUnit(u);
    }

    this.renderer.resize(chapter.width, chapter.height);
    this._updateEndTurnBtn();
    this.turn = 1;
    this.logMessages = [];
  }

  _updateEndTurnBtn() {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.endTurnBtn = { x: cw - 100, y: ch - 40, w: 90, h: 30 };
  }

  // ---- Phase management ----

  _startPlayerPhase() {
    this.state = STATE.PLAYER_PHASE;
    for (const u of this.map.playerUnits) u.resetTurn();
    this.selectedUnit  = null;
    this.moveRange     = null;
    this.attackRange   = null;
    this.combatPreview = null;

    this.phaseBannerAlpha = 1;
    this.phaseBannerTimer = 0;
    this._addLog(`Turn ${this.turn} — Player Phase`);
    if (this._onStateChange) this._onStateChange();
  }

  _startEnemyPhase() {
    this.state = STATE.ENEMY_PHASE;
    this.selectedUnit  = null;
    this.moveRange     = null;
    this.attackRange   = null;
    this.combatPreview = null;

    this.phaseBannerAlpha = 1;
    this.phaseBannerTimer = 0;
    this._addLog('Enemy Phase');
    if (this._onStateChange) this._onStateChange();

    // Run AI after a short delay
    setTimeout(() => {
      const actions = runEnemyAI(this.map);
      for (const a of actions) {
        if (a.log) this.logMessages.push(...a.log.slice(-2));
      }
      this._checkWinLoss();
      if (this.state === STATE.ENEMY_PHASE) {
        this.turn++;
        this._startPlayerPhase();
      }
      if (this._onStateChange) this._onStateChange();
    }, 800);
  }

  // ---- Win/Loss check ----

  _checkWinLoss() {
    if (this.map.enemyUnits.length === 0) {
      this.state = STATE.VICTORY;
      if (this._onStateChange) this._onStateChange();
      return true;
    }
    const lord = this.map.playerUnits.find(u => u.isLord);
    if (!lord || !lord.alive) {
      this.state = STATE.GAME_OVER;
      if (this._onStateChange) this._onStateChange();
      return true;
    }
    return false;
  }

  // ---- Input setup ----

  _setupInput() {
    this.input.on('click', ({ x, y, sx, sy }) => this._onClick(x, y, sx, sy));
    this.input.on('rightclick', ({ x, y }) => this._onCancel());
    this.input.on('hover', ({ x, y }) => {
      this.cursorX = x;
      this.cursorY = y;
      this.hoveredUnit = this.map ? this.map.getUnitAt(x, y) : null;
    });
    this.input.on('cancel', () => this._onCancel());
    this.input.on('keydown', ({ key }) => {
      if (key === 'r' || key === 'R') {
        if (this.state === STATE.VICTORY || this.state === STATE.GAME_OVER) {
          this._restart();
        }
      }
    });
  }

  _restart() {
    this._initChapter(CHAPTER_1);
    this._startPlayerPhase();
  }

  // ---- Click handler ----

  _onClick(tx, ty, sx, sy) {
    if (this.state === STATE.VICTORY || this.state === STATE.GAME_OVER) return;
    if (this.state === STATE.ENEMY_PHASE) return;

    // Check End Turn button
    const btn = this.endTurnBtn;
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      if (this.state === STATE.PLAYER_PHASE || this.state === STATE.UNIT_SELECTED) {
        this._startEnemyPhase();
        return;
      }
    }

    switch (this.state) {
      case STATE.PLAYER_PHASE:
        this._handlePlayerPhaseClick(tx, ty);
        break;
      case STATE.UNIT_SELECTED:
        this._handleUnitSelectedClick(tx, ty);
        break;
      case STATE.UNIT_MOVED:
        this._handleActionMenuClick(sx, sy);
        break;
      case STATE.ATTACK_SELECT:
        this._handleAttackSelectClick(tx, ty);
        break;
      case STATE.COMBAT_PREVIEW:
        this._confirmCombat();
        break;
      case STATE.HEAL_SELECT:
        this._handleHealSelectClick(tx, ty);
        break;
    }
    if (this._onStateChange) this._onStateChange();
  }

  _onCancel() {
    switch (this.state) {
      case STATE.UNIT_SELECTED:
        this.selectedUnit = null;
        this.moveRange    = null;
        this.attackRange  = null;
        this.state = STATE.PLAYER_PHASE;
        break;
      case STATE.UNIT_MOVED:
        // Undo move
        if (this.selectedUnit) {
          this.selectedUnit.x     = this.pendingMoveX;
          this.selectedUnit.y     = this.pendingMoveY;
          this.selectedUnit.moved = false;
        }
        this.state = STATE.UNIT_SELECTED;
        break;
      case STATE.ATTACK_SELECT:
        this.state = STATE.UNIT_MOVED;
        break;
      case STATE.COMBAT_PREVIEW:
        this.combatPreview = null;
        this.combatTarget  = null;
        this.state = STATE.ATTACK_SELECT;
        break;
      case STATE.HEAL_SELECT:
        this.state = STATE.UNIT_MOVED;
        break;
    }
    if (this._onStateChange) this._onStateChange();
  }

  // ---- State handlers ----

  _handlePlayerPhaseClick(tx, ty) {
    const unit = this.map.getUnitAt(tx, ty);
    if (unit && unit.team === 'player' && !unit.acted) {
      this.selectedUnit = unit;
      this.moveRange    = this.map.getMovementRange(unit);
      this.attackRange  = this.map.getAttackRange(unit, this.moveRange);
      this.state = STATE.UNIT_SELECTED;
    }
  }

  _handleUnitSelectedClick(tx, ty) {
    const key = `${tx},${ty}`;

    // Clicked another player unit → switch selection
    const other = this.map.getUnitAt(tx, ty);
    if (other && other.team === 'player' && other !== this.selectedUnit && !other.acted) {
      this.selectedUnit = other;
      this.moveRange    = this.map.getMovementRange(other);
      this.attackRange  = this.map.getAttackRange(other, this.moveRange);
      return;
    }

    // Clicked a reachable tile → move unit there
    if (this.moveRange && this.moveRange.has(key)) {
      const occupant = this.map.getUnitAt(tx, ty);
      if (occupant && occupant !== this.selectedUnit) return;

      // Save original position for undo
      this.pendingMoveX = this.selectedUnit.x;
      this.pendingMoveY = this.selectedUnit.y;

      this.map.moveUnit(this.selectedUnit, tx, ty);

      // Build action menu
      this._buildActionMenu();
      this.state = STATE.UNIT_MOVED;
    } else {
      // Clicked outside range → deselect
      this._onCancel();
    }
  }

  _buildActionMenu() {
    const unit = this.selectedUnit;
    const options = [];

    if (unit.isHealer) {
      // Check if any allies adjacent need healing
      const healTargets = this._getHealTargets(unit);
      if (healTargets.length > 0) options.push('Heal');
    } else {
      // Check if any enemies are in attack range
      const atkTargets = this._getAttackTargets(unit);
      if (atkTargets.length > 0) options.push('Attack');
    }

    options.push('Wait');
    this.actionOptions  = options;
    this.actionSelected = 0;
  }

  _getAttackTargets(unit) {
    const targets = [];
    for (const range of unit.atkRange) {
      for (let dx = -range; dx <= range; dx++) {
        const dyAbs = range - Math.abs(dx);
        const dyVals = dyAbs === 0 ? [0] : [dyAbs, -dyAbs];
        for (const dy of dyVals) {
          const tx = unit.x + dx;
          const ty = unit.y + dy;
          const target = this.map.getUnitAt(tx, ty);
          if (target && target.team !== unit.team) targets.push(target);
        }
      }
    }
    return targets;
  }

  _getHealTargets(unit) {
    const targets = [];
    const dirs = [[-1,0],[1,0],[0,-1],[0,1],[0,0]]; // adjacent + self
    for (const [dx, dy] of dirs) {
      const tx = unit.x + dx;
      const ty = unit.y + dy;
      const target = this.map.getUnitAt(tx, ty);
      if (target && target.team === unit.team && target.hp < target.maxHp) {
        targets.push(target);
      }
    }
    return targets;
  }

  _handleActionMenuClick(sx, sy) {
    // Determine which action was clicked based on menu position
    const menuX = Math.min(this.canvas.width - 140, this.selectedUnit.x * TILE_SIZE + 10);
    const menuY = Math.min(this.canvas.height - 120, this.selectedUnit.y * TILE_SIZE - 20);
    const itemH = 32;

    for (let i = 0; i < this.actionOptions.length; i++) {
      const iy = menuY + 6 + i * itemH;
      if (sx >= menuX && sx <= menuX + 130 && sy >= iy && sy <= iy + itemH) {
        this._executeAction(this.actionOptions[i]);
        return;
      }
    }
  }

  _executeAction(action) {
    switch (action) {
      case 'Attack': {
        // Show attackable tiles from current position
        const atkSet = new Set();
        for (const range of this.selectedUnit.atkRange) {
          for (let dx = -range; dx <= range; dx++) {
            const dyAbs = range - Math.abs(dx);
            const dyVals = dyAbs === 0 ? [0] : [dyAbs, -dyAbs];
            for (const dy of dyVals) {
              const tx = this.selectedUnit.x + dx;
              const ty = this.selectedUnit.y + dy;
              if (tx >= 0 && tx < this.map.width && ty >= 0 && ty < this.map.height) {
                atkSet.add(`${tx},${ty}`);
              }
            }
          }
        }
        this.attackRange = atkSet;
        this.state = STATE.ATTACK_SELECT;
        break;
      }
      case 'Heal': {
        this.state = STATE.HEAL_SELECT;
        break;
      }
      case 'Wait': {
        this.selectedUnit.attacked = true; // mark as done
        this._finishUnitTurn();
        break;
      }
    }
  }

  _handleAttackSelectClick(tx, ty) {
    const key = `${tx},${ty}`;
    if (!this.attackRange || !this.attackRange.has(key)) {
      this._onCancel();
      return;
    }

    const target = this.map.getUnitAt(tx, ty);
    if (!target || target.team === this.selectedUnit.team) {
      this._onCancel();
      return;
    }

    // Build combat preview
    this.combatTarget  = target;
    this.combatPreview = buildCombatPreview(this.selectedUnit, target, this.map);
    this.state = STATE.COMBAT_PREVIEW;
  }

  _confirmCombat() {
    if (!this.combatTarget || !this.selectedUnit) return;

    const log = executeCombat(this.selectedUnit, this.combatTarget, this.map);
    this.logMessages.push(...log);
    this._addLog(log[log.length - 1] || '');

    // Remove dead units
    if (!this.combatTarget.alive) {
      this.map.removeUnit(this.combatTarget);
    }
    if (!this.selectedUnit.alive) {
      this.map.removeUnit(this.selectedUnit);
    }

    this.combatPreview = null;
    this.combatTarget  = null;
    this.selectedUnit.attacked = true;

    if (this._checkWinLoss()) return;
    this._finishUnitTurn();
  }

  _handleHealSelectClick(tx, ty) {
    const target = this.map.getUnitAt(tx, ty);
    if (!target || target.team !== this.selectedUnit.team || target.hp >= target.maxHp) {
      this._onCancel();
      return;
    }
    const dist = Math.abs(this.selectedUnit.x - target.x) + Math.abs(this.selectedUnit.y - target.y);
    if (dist > 1) { // staff range = 1 tile (adjacent or self)
      this._onCancel();
      return;
    }

    const log = executeHeal(this.selectedUnit, target);
    this.logMessages.push(...log);
    this.selectedUnit.attacked = true;
    this._finishUnitTurn();
  }

  _finishUnitTurn() {
    this.selectedUnit  = null;
    this.moveRange     = null;
    this.attackRange   = null;
    this.combatPreview = null;
    this.state = STATE.PLAYER_PHASE;
    if (this._onStateChange) this._onStateChange();

    // Auto-end turn if all player units have acted
    const pending = this.map.playerUnits.filter(u => !u.acted);
    if (pending.length === 0) {
      this._startEnemyPhase();
    }
  }

  _addLog(msg) {
    if (msg) this.logMessages.push(msg);
    if (this.logMessages.length > 8) this.logMessages.shift();
  }

  // ---- Render loop ----

  _loop() {
    this.pulse += 0.05;

    // Fade phase banner
    if (this.phaseBannerAlpha > 0) {
      this.phaseBannerTimer++;
      if (this.phaseBannerTimer > 90) {
        this.phaseBannerAlpha = Math.max(0, this.phaseBannerAlpha - 0.02);
      }
    }

    this._render();
    requestAnimationFrame(() => this._loop());
  }

  _render() {
    const r = this.renderer;
    const state = this.state;

    r.clear();

    if (!this.map) return;

    // Map tiles
    r.drawMap(this.map);

    // Movement / attack overlays
    if (this.moveRange)   r.drawMoveRange(this.moveRange);
    if (this.attackRange && state !== STATE.COMBAT_PREVIEW) {
      r.drawAttackRange(this.attackRange);
    }

    // Units
    const actedSet = new Set(
      this.map.playerUnits.filter(u => u.acted).map(u => u.id)
    );
    r.drawUnits(this.map.units, actedSet);

    // Selected unit highlight
    if (this.selectedUnit && this.selectedUnit.alive) {
      r.drawSelectedUnit(this.selectedUnit);
    }

    // Cursor
    if (state !== STATE.GAME_OVER && state !== STATE.VICTORY) {
      r.drawCursor(this.cursorX, this.cursorY, '#ffff44', this.pulse);
    }

    // Hover unit panel (bottom-left)
    const panelUnit = this.hoveredUnit || this.selectedUnit;
    if (panelUnit && panelUnit.alive) {
      r.drawUnitPanel(panelUnit, 4, this.canvas.height - 128);
    }

    // Hover terrain panel (bottom-right area)
    if (this.cursorX >= 0 && this.cursorY >= 0 &&
        this.cursorX < this.map.width && this.cursorY < this.map.height) {
      const terrKey  = this.map.getTerrainKey(this.cursorX, this.cursorY);
      const terrData = this.map.getTerrain(this.cursorX, this.cursorY);
      if (terrData) {
        r.drawTerrainPanel(terrKey, terrData, this.canvas.width - 150, this.canvas.height - 78);
      }
    }

    // Action menu
    if (state === STATE.UNIT_MOVED && this.selectedUnit) {
      const mx = Math.min(this.canvas.width - 140, this.selectedUnit.x * TILE_SIZE + 10);
      const my = Math.min(this.canvas.height - 120, this.selectedUnit.y * TILE_SIZE - 20);
      r.drawActionMenu(this.actionOptions, this.actionSelected, mx, Math.max(4, my));
    }

    // Combat preview
    if (state === STATE.COMBAT_PREVIEW && this.combatPreview) {
      const px = Math.min(this.canvas.width - 290, 10);
      const py = Math.max(4, this.canvas.height / 2 - 80);
      r.drawCombatPreview(this.combatPreview, px, py);
    }

    // End Turn button (during player phase)
    if (state === STATE.PLAYER_PHASE || state === STATE.UNIT_SELECTED) {
      const btn = this.endTurnBtn;
      const hovered = (this.input.mouseX * TILE_SIZE + TILE_SIZE / 2 >= btn.x);
      r.drawEndTurnButton(btn.x, btn.y, btn.w, btn.h, false);
    }

    // Phase banner (fading)
    if (this.phaseBannerAlpha > 0) {
      const phase = (state === STATE.ENEMY_PHASE) ? 'enemy' : 'player';
      r.drawPhaseBanner(phase, this.phaseBannerAlpha);
    }

    // Log bar (bottom)
    const lastMsg = this.logMessages[this.logMessages.length - 1] || '';
    r.drawInfoBar(
      `Turn ${this.turn}  |  ${lastMsg}`,
      0, this.canvas.height - 20, this.canvas.width, 20
    );

    // End screens
    if (state === STATE.VICTORY)   r.drawEndScreen(true);
    if (state === STATE.GAME_OVER) r.drawEndScreen(false);
  }
}
