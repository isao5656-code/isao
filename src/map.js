// ============================================================
// map.js - GameMap: tile management, BFS movement/attack range
// ============================================================
import { TERRAIN } from './data.js';
import { Unit } from './unit.js';

export class GameMap {
  constructor(chapterData) {
    this.width  = chapterData.width;
    this.height = chapterData.height;
    // 2D array of terrain key strings
    this.tiles  = chapterData.tiles;
    // Units placed on the map
    this.units  = [];
  }

  getTerrain(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return TERRAIN[this.tiles[y][x]];
  }

  getTerrainKey(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.tiles[y][x];
  }

  getUnitAt(x, y) {
    return this.units.find(u => u.alive && u.x === x && u.y === y) || null;
  }

  addUnit(unit) {
    this.units.push(unit);
  }

  removeUnit(unit) {
    this.units = this.units.filter(u => u !== unit);
  }

  moveUnit(unit, x, y) {
    unit.x = x;
    unit.y = y;
    unit.moved = true;
  }

  // BFS flood-fill: returns Set of "x,y" strings reachable by unit
  getMovementRange(unit) {
    const reachable = new Set();
    const queue = [{ x: unit.x, y: unit.y, remaining: unit.mov }];
    const visited = new Map(); // "x,y" -> best remaining

    visited.set(`${unit.x},${unit.y}`, unit.mov);

    while (queue.length > 0) {
      const { x, y, remaining } = queue.shift();
      reachable.add(`${x},${y}`);

      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ];

      for (const n of neighbors) {
        if (n.x < 0 || n.x >= this.width || n.y < 0 || n.y >= this.height) continue;

        const terrain = this.getTerrain(n.x, n.y);
        if (!terrain || terrain.movCost >= 99) continue; // impassable

        // Can't stop on a tile occupied by enemy (but can pass through ally)
        const occupant = this.getUnitAt(n.x, n.y);
        if (occupant && occupant !== unit && occupant.team !== unit.team) continue;

        const newRemaining = remaining - terrain.movCost;
        if (newRemaining < 0) continue;

        const key = `${n.x},${n.y}`;
        const best = visited.get(key);
        if (best !== undefined && best >= newRemaining) continue;

        visited.set(key, newRemaining);
        queue.push({ x: n.x, y: n.y, remaining: newRemaining });
      }
    }

    // Remove tiles occupied by own-team units (can't stop there)
    for (const u of this.units) {
      if (u !== unit && u.alive && u.team === unit.team) {
        reachable.delete(`${u.x},${u.y}`);
      }
    }

    return reachable;
  }

  // Returns Set of "x,y" strings within attack range from given tile set
  getAttackRange(unit, moveTiles) {
    const atkSet = new Set();
    for (const key of moveTiles) {
      const [tx, ty] = key.split(',').map(Number);
      for (const range of unit.atkRange) {
        // Diamond pattern of given radius
        for (let dx = -range; dx <= range; dx++) {
          const dy = range - Math.abs(dx);
          const candidates = dy === 0
            ? [{ x: tx + dx, y: ty }]
            : [{ x: tx + dx, y: ty + dy }, { x: tx + dx, y: ty - dy }];

          for (const c of candidates) {
            if (c.x < 0 || c.x >= this.width || c.y < 0 || c.y >= this.height) continue;
            if (!moveTiles.has(`${c.x},${c.y}`)) {
              atkSet.add(`${c.x},${c.y}`);
            }
          }
        }
      }
    }
    return atkSet;
  }

  // Get attack positions: tiles unit can move to and attack target from
  getAttackPositionsFor(unit, target) {
    const movRange = this.getMovementRange(unit);
    const positions = [];

    for (const key of movRange) {
      const [mx, my] = key.split(',').map(Number);
      for (const range of unit.atkRange) {
        const dist = Math.abs(mx - target.x) + Math.abs(my - target.y);
        if (dist === range) {
          positions.push({ x: mx, y: my });
          break;
        }
      }
    }

    return positions;
  }

  // BFS shortest path distance between two points (ignoring units, for AI)
  getDistance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  // BFS path for AI movement
  findPath(unit, tx, ty) {
    const queue = [{ x: unit.x, y: unit.y, path: [] }];
    const visited = new Set([`${unit.x},${unit.y}`]);

    while (queue.length > 0) {
      const { x, y, path } = queue.shift();
      if (x === tx && y === ty) return path;

      const neighbors = [
        { x: x - 1, y }, { x: x + 1, y },
        { x, y: y - 1 }, { x, y: y + 1 },
      ];

      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (visited.has(key)) continue;
        if (n.x < 0 || n.x >= this.width || n.y < 0 || n.y >= this.height) continue;
        const terrain = this.getTerrain(n.x, n.y);
        if (!terrain || terrain.movCost >= 99) continue;
        visited.add(key);
        queue.push({ x: n.x, y: n.y, path: [...path, { x: n.x, y: n.y }] });
      }
    }
    return [];
  }

  get playerUnits() {
    return this.units.filter(u => u.team === 'player' && u.alive);
  }

  get enemyUnits() {
    return this.units.filter(u => u.team === 'enemy' && u.alive);
  }
}
