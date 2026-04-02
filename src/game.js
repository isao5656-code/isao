// ============================================================
// game.js - Main game loop and state machine
// ============================================================
import { CHAPTERS } from './data.js';
import { Unit }       from './unit.js';
import { GameMap }    from './map.js';
import { buildCombatPreview, executeCombat, executeHeal } from './combat.js';
import { runEnemyAI } from './ai.js';
import { Renderer, TILE_SIZE } from './renderer.js';
import { InputHandler } from './input.js';

// Game states
const STATE = {
  TITLE:           'TITLE',
  PLAYER_PHASE:    'PLAYER_PHASE',
  UNIT_SELECTED:   'UNIT_SELECTED',
  UNIT_MOVED:      'UNIT_MOVED',
  ATTACK_SELECT:   'ATTACK_SELECT',
  COMBAT_PREVIEW:  'COMBAT_PREVIEW',
  HEAL_SELECT:     'HEAL_SELECT',
  ENEMY_PHASE:     'ENEMY_PHASE',
  COMBAT_RESULT:   'COMBAT_RESULT',
  CHAPTER_CLEAR:   'CHAPTER_CLEAR',
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
    // Optional callback fired when chapter changes
    this._onChapterChange = null;
    // Current chapter index
    this.chapterIndex = 0;
    // Enemy turn animation
    this.enemyActingUnit = null;
    this.enemyAnimQueue  = [];
    // Combat result overlay
    this.combatResultLog   = null;
    this.combatResultTimer = 0;

    this._setupInput();

    // Show title screen after layout settles
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.renderer.resizeTitle();
      this.state = STATE.TITLE;
      if (this._onStateChange) this._onStateChange();
    }));
    this._loop();
  }

  // Called by index.html on window resize / orientation change
  _onResize() {
    if (this.state === STATE.TITLE) { this.renderer.resizeTitle(); return; }
    if (!this.map) return;
    const ch = CHAPTERS[this.chapterIndex];
    this.renderer.resize(ch.width, ch.height);
    this._updateEndTurnBtn();
  }

  // ---- Title screen / Save / Load ----

  _hasSave() {
    return !!localStorage.getItem('emblem_save');
  }

  _saveGame() {
    if (!this.map) return;
    const chapter = CHAPTERS[this.chapterIndex];
    const deadEnemyIds = chapter.enemyUnits
      .filter(ed => !this.map.units.find(u => u.id === ed.id && u.team === 'enemy' && u.alive))
      .map(ed => ed.id);
    const save = {
      chapterIndex: this.chapterIndex,
      turn: this.turn,
      playerUnits: this.map.playerUnits.map(u => ({
        id: u.id, x: u.x, y: u.y,
        level: u.level, exp: u.exp, hp: u.hp,
        maxHp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, res: u.res,
      })),
      deadEnemyIds,
    };
    localStorage.setItem('emblem_save', JSON.stringify(save));
  }

  _loadSaveData() {
    try {
      const data = JSON.parse(localStorage.getItem('emblem_save') || 'null');
      if (!data) return false;
      const savedStats = {};
      for (const u of data.playerUnits) savedStats[u.id] = u;

      this.chapterIndex = data.chapterIndex || 0;
      this._initChapterWith(CHAPTERS[this.chapterIndex], savedStats);

      // Restore current positions and HP
      for (const u of this.map.playerUnits) {
        const s = savedStats[u.id];
        if (s) { u.x = s.x; u.y = s.y; u.hp = Math.min(s.hp, u.maxHp); }
      }
      // Remove already-defeated enemies
      for (const id of (data.deadEnemyIds || [])) {
        const e = this.map.units.find(u => u.id === id && u.team === 'enemy');
        if (e) this.map.removeUnit(e);
      }
      this.turn = data.turn || 1;
      return true;
    } catch (e) {
      console.error('Load error:', e);
      return false;
    }
  }

  _handleTitleClick(sx, sy) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const bw = 200, bh = 44;
    // New Game button
    if (sx >= cx - bw / 2 && sx <= cx + bw / 2 && sy >= cy && sy <= cy + bh) {
      this.chapterIndex = 0;
      this._initChapterWith(CHAPTERS[0], {});
      this._startPlayerPhase();
      return;
    }
    // Continue button
    if (this._hasSave() && sx >= cx - bw / 2 && sx <= cx + bw / 2 && sy >= cy + 60 && sy <= cy + 60 + bh) {
      if (!this._loadSaveData()) {
        this.chapterIndex = 0;
        this._initChapterWith(CHAPTERS[0], {});
      }
      this._startPlayerPhase();
    }
  }

  // ---- Initialization ----

  // savedStats: map of unit id -> { level, exp, maxHp, atk, def, spd, res }
  // Pass {} to start fresh with base stats.
  _initChapterWith(chapter, savedStats) {
    this.map = new GameMap(chapter);

    for (const pd of chapter.playerUnits) {
      const u = new Unit({ ...pd, team: 'player' });
      const s = savedStats[pd.id];
      if (s) {
        u.level = s.level; u.exp = s.exp;
        u.maxHp = s.maxHp; u.atk = s.atk;
        u.def   = s.def;   u.spd = s.spd; u.res = s.res;
        u.hp    = u.maxHp; // full heal between chapters
      }
      this.map.addUnit(u);
    }
    for (const ed of chapter.enemyUnits) {
      this.map.addUnit(new Unit({ ...ed, team: 'enemy' }));
    }

    this.renderer.resize(chapter.width, chapter.height);
    this._updateEndTurnBtn();
    this.turn = 1;
    this.logMessages = [];
    this.selectedUnit  = null;
    this.moveRange     = null;
    this.attackRange   = null;
    this.combatPreview = null;

    if (this._onChapterChange) this._onChapterChange(chapter);
  }

  // Advance to the next chapter, carrying over player unit stats
  _advanceChapter() {
    const savedStats = {};
    for (const u of this.map.playerUnits) {
      savedStats[u.id] = {
        level: u.level, exp: u.exp,
        maxHp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, res: u.res,
      };
    }
    this.chapterIndex++;
    this._initChapterWith(CHAPTERS[this.chapterIndex], savedStats);
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
    this.enemyActingUnit = null;

    // Village HP recovery: units standing on a village tile recover 20% max HP
    for (const u of this.map.playerUnits) {
      if (this.map.getTerrainKey(u.x, u.y) === 'village' && u.hp < u.maxHp) {
        const heal = Math.max(1, Math.floor(u.maxHp * 0.2));
        u.heal(heal);
        this._addLog(`${u.name} recovers ${heal} HP at the village.`);
      }
    }

    this.phaseBannerAlpha = 1;
    this.phaseBannerTimer = 0;
    this._addLog(`Turn ${this.turn} — Player Phase`);
    this._saveGame(); // auto-save at each player phase start
    if (this._onStateChange) this._onStateChange();
  }

  _startEnemyPhase() {
    this.state = STATE.ENEMY_PHASE;
    this.selectedUnit    = null;
    this.moveRange       = null;
    this.attackRange     = null;
    this.combatPreview   = null;
    this.enemyActingUnit = null;
    this.enemyAnimQueue  = [];

    this.phaseBannerAlpha = 1;
    this.phaseBannerTimer = 0;
    this._addLog('Enemy Phase');
    if (this._onStateChange) this._onStateChange();

    // Run AI (all moves/attacks applied immediately), then animate results
    setTimeout(() => {
      const actions = runEnemyAI(this.map);
      this.enemyAnimQueue = actions.map(a => ({
        unit: a.enemy, log: a.log || [],
      }));
      this._playNextEnemyAction();
    }, 800);
  }

  _playNextEnemyAction() {
    if (this.state !== STATE.ENEMY_PHASE) return;
    if (this.enemyAnimQueue.length === 0) {
      this.enemyActingUnit = null;
      this._checkWinLoss();
      if (this.state === STATE.ENEMY_PHASE) {
        this.turn++;
        this._startPlayerPhase();
      }
      if (this._onStateChange) this._onStateChange();
      return;
    }
    const action = this.enemyAnimQueue.shift();
    this.enemyActingUnit = action.unit.alive ? action.unit : null;
    for (const line of action.log) this._addLog(line);
    if (this._onStateChange) this._onStateChange();
    setTimeout(() => this._playNextEnemyAction(), 550);
  }

  // Skip remaining enemy animations and finish the phase immediately
  _skipEnemyAnim() {
    if (this.state !== STATE.ENEMY_PHASE) return;
    while (this.enemyAnimQueue.length > 0) {
      for (const line of this.enemyAnimQueue.shift().log) this._addLog(line);
    }
    this.enemyActingUnit = null;
    this._checkWinLoss();
    if (this.state === STATE.ENEMY_PHASE) {
      this.turn++;
      this._startPlayerPhase();
    }
    if (this._onStateChange) this._onStateChange();
  }

  // ---- Win/Loss check ----

  _checkWinLoss() {
    if (this.map.enemyUnits.length === 0) {
      const isLast = this.chapterIndex >= CHAPTERS.length - 1;
      this.state = isLast ? STATE.VICTORY : STATE.CHAPTER_CLEAR;
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
        } else if (this.state === STATE.CHAPTER_CLEAR) {
          this._advanceChapter();
          this._startPlayerPhase();
        }
      }
      if (key === 's' || key === 'S') {
        if (this.state === STATE.ENEMY_PHASE) this._skipEnemyAnim();
        if (this.state === STATE.COMBAT_RESULT) this._dismissCombatResult();
      }
    });
  }

  _restart() {
    this.chapterIndex = 0;
    this._initChapterWith(CHAPTERS[0], {});
    this._startPlayerPhase();
  }

  // ---- Click handler ----

  _onClick(tx, ty, sx, sy) {
    if (this.state === STATE.TITLE)         { this._handleTitleClick(sx, sy); return; }
    if (this.state === STATE.COMBAT_RESULT) { this._dismissCombatResult(); return; }
    // Canvas tap advances end-of-chapter / end-of-game screens
    if (this.state === STATE.CHAPTER_CLEAR) { this._advanceChapter(); this._startPlayerPhase(); return; }
    if (this.state === STATE.VICTORY || this.state === STATE.GAME_OVER) { this._restart(); return; }
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
        // If only one enemy in range, skip selection and go straight to preview
        const autoTargets = this._getAttackTargets(this.selectedUnit);
        if (autoTargets.length === 1) {
          this.combatTarget  = autoTargets[0];
          this.combatPreview = buildCombatPreview(this.selectedUnit, autoTargets[0], this.map);
          this.state = STATE.COMBAT_PREVIEW;
        } else {
          this.state = STATE.ATTACK_SELECT;
        }
        break;
      }
      case 'Heal': {
        // If only one heal target, execute immediately
        const healTargets = this._getHealTargets(this.selectedUnit);
        if (healTargets.length === 1) {
          const log = executeHeal(this.selectedUnit, healTargets[0]);
          this.logMessages.push(...log);
          this.selectedUnit.attacked = true;
          this._finishUnitTurn();
        } else {
          this.state = STATE.HEAL_SELECT;
        }
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
    // Tapping outside attack range is a no-op on mobile (don't cancel);
    // explicit cancel (long-press / Esc / Cancel button) still works.
    if (!this.attackRange || !this.attackRange.has(key)) return;

    const target = this.map.getUnitAt(tx, ty);
    if (!target || target.team === this.selectedUnit.team) return;

    // Build combat preview
    this.combatTarget  = target;
    this.combatPreview = buildCombatPreview(this.selectedUnit, target, this.map);
    this.state = STATE.COMBAT_PREVIEW;
  }

  _confirmCombat() {
    if (!this.combatTarget || !this.selectedUnit) return;

    const attacker = this.selectedUnit;
    const log = executeCombat(attacker, this.combatTarget, this.map);

    // Remove dead units
    if (!this.combatTarget.alive) this.map.removeUnit(this.combatTarget);
    if (!attacker.alive)         this.map.removeUnit(attacker);

    this.combatPreview = null;
    this.combatTarget  = null;
    attacker.attacked  = true;

    // Show result overlay (click or 3 s to dismiss)
    this.combatResultLog   = log;
    this.combatResultTimer = 0;
    this.state = STATE.COMBAT_RESULT;
    if (this._onStateChange) this._onStateChange();
  }

  _dismissCombatResult() {
    this.combatResultLog   = null;
    this.combatResultTimer = 0;
    if (this._checkWinLoss()) return;
    this._finishUnitTurn();
  }

  _handleHealSelectClick(tx, ty) {
    const target = this.map.getUnitAt(tx, ty);
    // Tapping invalid tile is a no-op; use Cancel button/long-press to go back
    if (!target || target.team !== this.selectedUnit.team || target.hp >= target.maxHp) return;
    const dist = Math.abs(this.selectedUnit.x - target.x) + Math.abs(this.selectedUnit.y - target.y);
    if (dist > 1) return;

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

    // Auto-dismiss combat result after ~3 s
    if (this.state === STATE.COMBAT_RESULT) {
      this.combatResultTimer++;
      if (this.combatResultTimer > 180) this._dismissCombatResult();
    }

    this._render();
    requestAnimationFrame(() => this._loop());
  }

  _render() {
    const r = this.renderer;
    const state = this.state;

    r.clear();

    // Title screen
    if (state === STATE.TITLE) {
      r.drawTitleScreen(this._hasSave());
      return;
    }

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

    // Hover unit panel — switch between bottom-left and top-left to avoid covering the unit
    const panelUnit = this.hoveredUnit || this.selectedUnit;
    if (panelUnit && panelUnit.alive) {
      const unitPixY = panelUnit.y * TILE_SIZE;
      const panelY = unitPixY > this.canvas.height * 0.55
        ? 4                            // unit is in bottom half → draw panel at top
        : this.canvas.height - 128;    // unit is in top half  → draw panel at bottom
      r.drawUnitPanel(panelUnit, 4, panelY);
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

    // Enemy acting highlight
    if (state === STATE.ENEMY_PHASE && this.enemyActingUnit && this.enemyActingUnit.alive) {
      r.drawEnemyActingHighlight(this.enemyActingUnit, this.pulse);
    }

    // Log bar (bottom) — hint "S:Skip" during enemy phase
    const lastMsg = this.logMessages[this.logMessages.length - 1] || '';
    const infoText = state === STATE.ENEMY_PHASE
      ? `Turn ${this.turn}  |  Enemy Phase  |  S / Skip button to skip`
      : `Turn ${this.turn}  |  ${lastMsg}`;
    r.drawInfoBar(infoText, 0, this.canvas.height - 20, this.canvas.width, 20);

    // Combat result overlay
    if (state === STATE.COMBAT_RESULT && this.combatResultLog) {
      r.drawCombatResult(this.combatResultLog, this.combatResultTimer);
    }

    // End screens
    if (state === STATE.CHAPTER_CLEAR) r.drawChapterClearScreen(CHAPTERS[this.chapterIndex + 1]);
    if (state === STATE.VICTORY)       r.drawEndScreen(true);
    if (state === STATE.GAME_OVER)     r.drawEndScreen(false);
  }
}
