// ============================================================
// renderer.js - All canvas drawing
// ============================================================
import { TERRAIN, WEAPON } from './data.js';

export const TILE_SIZE = 48;
const UNIT_RADIUS = 16;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.camX   = 0;
    this.camY   = 0;
  }

  resize(mapWidth, mapHeight) {
    this.canvas.width  = Math.min(window.innerWidth,  mapWidth  * TILE_SIZE);
    this.canvas.height = Math.min(window.innerHeight - 120, mapHeight * TILE_SIZE);
  }

  // Convert tile coords to screen coords
  tileToScreen(tx, ty) {
    return {
      x: tx * TILE_SIZE - this.camX,
      y: ty * TILE_SIZE - this.camY,
    };
  }

  screenToTile(sx, sy) {
    return {
      x: Math.floor((sx + this.camX) / TILE_SIZE),
      y: Math.floor((sy + this.camY) / TILE_SIZE),
    };
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Draw entire map tiles
  drawMap(map) {
    const ctx = this.ctx;
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const terrain = map.getTerrain(tx, ty);
        if (!terrain) continue;
        const { x, y } = this.tileToScreen(tx, ty);

        // Skip if off-screen
        if (x + TILE_SIZE < 0 || x > this.canvas.width) continue;
        if (y + TILE_SIZE < 0 || y > this.canvas.height) continue;

        // Tile background
        ctx.fillStyle = terrain.color;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

        // Terrain label (for fort/village)
        const key = map.getTerrainKey(tx, ty);
        if (key === 'fort') {
          this._drawTerrainIcon(ctx, x, y, '⬛', '#aaa');
        } else if (key === 'village') {
          this._drawTerrainIcon(ctx, x, y, '🏠', '#c8a850');
        } else if (key === 'forest') {
          this._drawTree(ctx, x, y);
        } else if (key === 'mountain' || key === 'peak') {
          this._drawMountain(ctx, x, y, key === 'peak' ? '#555' : '#6b6b6b');
        }
      }
    }
  }

  _drawTree(ctx, x, y) {
    ctx.fillStyle = '#1a5c1a';
    ctx.beginPath();
    ctx.arc(x + 14, y + 14, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 30, y + 20, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 18, y + 28, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawMountain(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 6);
    ctx.lineTo(x + 42, y + 38);
    ctx.lineTo(x + 6,  y + 38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 6);
    ctx.lineTo(x + 32, y + 20);
    ctx.lineTo(x + 16, y + 20);
    ctx.closePath();
    ctx.fill();
  }

  _drawTerrainIcon(ctx, x, y, icon, color) {
    ctx.fillStyle = color;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
  }

  // Draw movement range overlay
  drawMoveRange(moveSet) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(40, 120, 220, 0.35)';
    for (const key of moveSet) {
      const [tx, ty] = key.split(',').map(Number);
      const { x, y } = this.tileToScreen(tx, ty);
      ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
    ctx.strokeStyle = 'rgba(60, 140, 255, 0.7)';
    ctx.lineWidth = 2;
    for (const key of moveSet) {
      const [tx, ty] = key.split(',').map(Number);
      const { x, y } = this.tileToScreen(tx, ty);
      ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  // Draw attack range overlay
  drawAttackRange(atkSet) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(220, 60, 40, 0.3)';
    for (const key of atkSet) {
      const [tx, ty] = key.split(',').map(Number);
      const { x, y } = this.tileToScreen(tx, ty);
      ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  // Draw all units
  drawUnits(units, actedUnits = new Set()) {
    for (const unit of units) {
      if (!unit.alive) continue;
      this.drawUnit(unit, actedUnits.has(unit.id));
    }
  }

  drawUnit(unit, grayed = false) {
    const ctx = this.ctx;
    const { x, y } = this.tileToScreen(unit.x, unit.y);
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + UNIT_RADIUS + 2, UNIT_RADIUS * 0.7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Unit body
    const baseColor = unit.color;
    ctx.fillStyle = grayed ? this._grayify(baseColor) : baseColor;
    ctx.beginPath();
    ctx.arc(cx, cy, UNIT_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = unit.team === 'player' ? '#88bbff' : '#ff8888';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Lord/Boss crown indicator
    if (unit.isLord || unit.isBoss) {
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unit.isLord ? '♛' : '★', cx, cy - 1);
    } else {
      // Class initial
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unit.classData.name[0], cx, cy);
    }

    // HP bar
    const barW = TILE_SIZE - 8;
    const barH = 4;
    const barX = x + 4;
    const barY = y + TILE_SIZE - 8;
    const hpFrac = unit.hp / unit.maxHp;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpFrac > 0.5 ? '#44cc44' : hpFrac > 0.25 ? '#cccc22' : '#cc2222';
    ctx.fillRect(barX, barY, Math.round(barW * hpFrac), barH);
  }

  _grayify(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const avg = Math.round((r + g + b) / 3 * 0.6);
    return `rgb(${avg},${avg},${avg})`;
  }

  // Draw selection cursor
  drawCursor(tx, ty, color = '#ffff00', pulse = 0) {
    const ctx = this.ctx;
    const { x, y } = this.tileToScreen(tx, ty);
    const alpha = 0.7 + 0.3 * Math.sin(pulse);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha;
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.globalAlpha = 1;
  }

  // Draw selected unit highlight
  drawSelectedUnit(unit) {
    const ctx = this.ctx;
    const { x, y } = this.tileToScreen(unit.x, unit.y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }

  // Draw unit info panel (bottom-left)
  drawUnitPanel(unit, panelX, panelY) {
    const ctx = this.ctx;
    const w = 200, h = 120;

    // Background
    ctx.fillStyle = 'rgba(10, 20, 40, 0.92)';
    this._roundRect(ctx, panelX, panelY, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = '#4466aa';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, w, h, 6);
    ctx.stroke();

    // Name & class
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(unit.name, panelX + 10, panelY + 8);

    ctx.fillStyle = '#aaaaff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${unit.classData.name}  Lv.${unit.level}`, panelX + 10, panelY + 26);

    // Weapon type
    const wpn = WEAPON[unit.weapon];
    ctx.fillStyle = wpn ? wpn.color : '#ccc';
    ctx.fillText(`Weapon: ${wpn ? wpn.name : unit.weapon}`, panelX + 10, panelY + 42);

    // HP bar
    const barW = 140;
    ctx.fillStyle = '#555';
    ctx.fillRect(panelX + 10, panelY + 60, barW, 8);
    const hpFrac = unit.hp / unit.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? '#44cc44' : hpFrac > 0.25 ? '#cccc22' : '#cc2222';
    ctx.fillRect(panelX + 10, panelY + 60, Math.round(barW * hpFrac), 8);

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText(`HP: ${unit.hp}/${unit.maxHp}`, panelX + 10, panelY + 74);

    // Stats
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px monospace';
    ctx.fillText(
      `ATK:${unit.atk} DEF:${unit.def} SPD:${unit.spd} MOV:${unit.mov}`,
      panelX + 10, panelY + 94
    );
  }

  // Draw terrain info panel
  drawTerrainPanel(terrainKey, terrainData, panelX, panelY) {
    const ctx = this.ctx;
    const w = 140, h = 70;

    ctx.fillStyle = 'rgba(10, 20, 40, 0.88)';
    this._roundRect(ctx, panelX, panelY, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = '#446644';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, w, h, 6);
    ctx.stroke();

    ctx.fillStyle = '#ccffcc';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(terrainData.name, panelX + 10, panelY + 8);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px monospace';
    const movStr = terrainData.movCost >= 99 ? '∞' : terrainData.movCost;
    ctx.fillText(`Move Cost: ${movStr}`, panelX + 10, panelY + 28);
    ctx.fillText(`DEF: +${terrainData.defBonus}  AVO: +${terrainData.avoBonus}`, panelX + 10, panelY + 44);
  }

  // Draw action menu (Attack / Wait / Heal)
  drawActionMenu(options, selectedIdx, panelX, panelY) {
    const ctx = this.ctx;
    const w = 130;
    const itemH = 32;
    const h = options.length * itemH + 12;

    ctx.fillStyle = 'rgba(10, 20, 40, 0.95)';
    this._roundRect(ctx, panelX, panelY, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = '#6688cc';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, w, h, 6);
    ctx.stroke();

    for (let i = 0; i < options.length; i++) {
      const iy = panelY + 6 + i * itemH;
      if (i === selectedIdx) {
        ctx.fillStyle = 'rgba(80, 120, 200, 0.6)';
        this._roundRect(ctx, panelX + 4, iy, w - 8, itemH, 4);
        ctx.fill();
      }
      ctx.fillStyle = i === selectedIdx ? '#ffffff' : '#cccccc';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(options[i], panelX + 16, iy + itemH / 2);
    }
  }

  // Draw combat preview overlay
  drawCombatPreview(preview, panelX, panelY) {
    const ctx = this.ctx;
    const { attacker, defender, atkStats, defStats, canDefend, projAtkHp, projDefHp } = preview;
    const w = 280, h = 160;

    // Background
    ctx.fillStyle = 'rgba(5, 10, 30, 0.96)';
    this._roundRect(ctx, panelX, panelY, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = '#8844cc';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, w, h, 8);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#ddaaff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('⚔ Combat Preview', panelX + w / 2, panelY + 8);

    // Attacker column
    this._drawCombatantInfo(ctx, attacker, atkStats, projAtkHp,
      panelX + 10, panelY + 30, true);

    // Separator
    ctx.strokeStyle = '#6644aa';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(panelX + w / 2, panelY + 28);
    ctx.lineTo(panelX + w / 2, panelY + h - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // VS
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', panelX + w / 2, panelY + 65);

    // Defender column
    this._drawCombatantInfo(ctx, defender, defStats, projDefHp,
      panelX + w / 2 + 5, panelY + 30, false);

    // Confirm hint
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Click to confirm  |  Esc / Right-click to cancel', panelX + w / 2, panelY + h - 6);
  }

  _drawCombatantInfo(ctx, unit, stats, projHp, x, y, isAttacker) {
    const colW = 130;

    ctx.fillStyle = unit.team === 'player' ? '#88aaff' : '#ff8888';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(unit.name, x, y);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px monospace';
    ctx.fillText(unit.classData.name, x, y + 16);

    // Current HP → projected HP
    const hpColor = projHp <= 0 ? '#ff4444' : projHp < unit.maxHp * 0.3 ? '#ffaa44' : '#44cc44';
    ctx.fillStyle = hpColor;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`HP: ${unit.hp} → ${Math.max(0, projHp)}`, x, y + 32);

    // HP bar (projected)
    const barW = colW - 20;
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y + 50, barW, 6);
    const frac = Math.max(0, projHp) / unit.maxHp;
    ctx.fillStyle = hpColor;
    ctx.fillRect(x, y + 50, Math.round(barW * frac), 6);

    if (stats) {
      ctx.fillStyle = '#cccccc';
      ctx.font = '11px monospace';
      ctx.fillText(`DMG: ${stats.atk}`, x, y + 64);
      ctx.fillText(`HIT: ${stats.hit}%`, x, y + 78);
      ctx.fillText(`CRT: ${stats.crit}%${stats.doubles ? '  ×2' : ''}`, x, y + 92);
    } else if (!isAttacker) {
      ctx.fillStyle = '#888888';
      ctx.font = '11px monospace';
      ctx.fillText('(No counter)', x, y + 64);
    }
  }

  // Draw phase banner
  drawPhaseBanner(phase, alpha = 1) {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = phase === 'player' ? 'rgba(20, 60, 140, 0.85)' : 'rgba(140, 20, 20, 0.85)';
    this._roundRect(ctx, cx - 160, cy - 30, 320, 60, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      phase === 'player' ? '⚔ Player Phase' : '👁 Enemy Phase',
      cx, cy
    );
    ctx.globalAlpha = 1;
  }

  // Draw game over / victory screen
  drawEndScreen(victory) {
    const ctx = this.ctx;
    ctx.fillStyle = victory ? 'rgba(0, 40, 0, 0.88)' : 'rgba(40, 0, 0, 0.88)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = victory ? '#88ff88' : '#ff8888';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      victory ? '🏆 Victory!' : '💀 Game Over',
      this.canvas.width / 2, this.canvas.height / 2 - 20
    );

    ctx.fillStyle = '#cccccc';
    ctx.font = '18px sans-serif';
    ctx.fillText('Press R to restart', this.canvas.width / 2, this.canvas.height / 2 + 30);
  }

  // Draw "End Turn" button
  drawEndTurnButton(x, y, w, h, hovered) {
    const ctx = this.ctx;
    ctx.fillStyle = hovered ? '#3355aa' : '#223377';
    this._roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = '#5577cc';
    ctx.lineWidth = 2;
    this._roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('End Turn', x + w / 2, y + h / 2);
  }

  // Draw turn/log info bar
  drawInfoBar(text, x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ccddff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 10, y + h / 2);
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
}
