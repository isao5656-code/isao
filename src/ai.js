// ============================================================
// ai.js - Enemy AI: move toward player units and attack
// ============================================================
import { executeCombat } from './combat.js';

// Choose the best action for one enemy unit
// Returns { moveX, moveY, target } or null if no action
function chooseAction(enemy, map) {
  const playerUnits = map.playerUnits;
  if (playerUnits.length === 0) return null;

  const movRange = map.getMovementRange(enemy);

  // Find the closest player unit
  let closestTarget = null;
  let closestDist = Infinity;
  for (const pu of playerUnits) {
    const dist = map.getDistance(enemy.x, enemy.y, pu.x, pu.y);
    if (dist < closestDist) {
      closestDist = dist;
      closestTarget = pu;
    }
  }
  if (!closestTarget) return null;

  // Check if any player unit is in attack range from a reachable tile
  let bestMoveX = enemy.x;
  let bestMoveY = enemy.y;
  let bestTarget = null;
  let bestTargetDist = Infinity;

  for (const key of movRange) {
    const [mx, my] = key.split(',').map(Number);

    // Don't stop on a tile occupied by another unit
    const occupant = map.getUnitAt(mx, my);
    if (occupant && occupant !== enemy) continue;

    for (const pu of playerUnits) {
      for (const range of enemy.atkRange) {
        const dist = Math.abs(mx - pu.x) + Math.abs(my - pu.y);
        if (dist === range) {
          // Can attack this player unit from this tile
          if (bestTarget === null || dist < bestTargetDist) {
            bestMoveX = mx;
            bestMoveY = my;
            bestTarget = pu;
            bestTargetDist = dist;
          }
        }
      }
    }
  }

  // If we found an attackable target, move there
  if (bestTarget) {
    return { moveX: bestMoveX, moveY: bestMoveY, target: bestTarget };
  }

  // Otherwise, move toward the closest player unit
  // Pick the reachable tile closest to the target
  let moveBest = null;
  let moveBestDist = Infinity;
  for (const key of movRange) {
    const [mx, my] = key.split(',').map(Number);
    const occupant = map.getUnitAt(mx, my);
    if (occupant && occupant !== enemy) continue;

    const dist = map.getDistance(mx, my, closestTarget.x, closestTarget.y);
    if (dist < moveBestDist) {
      moveBestDist = dist;
      moveBest = { x: mx, y: my };
    }
  }

  if (moveBest) {
    return { moveX: moveBest.x, moveY: moveBest.y, target: null };
  }

  return { moveX: enemy.x, moveY: enemy.y, target: null };
}

// Run AI for all enemy units sequentially
// Returns array of action objects (for animation/logging)
export function runEnemyAI(map) {
  const actions = [];

  for (const enemy of map.enemyUnits) {
    if (!enemy.alive) continue;
    enemy.resetTurn();

    const action = chooseAction(enemy, map);
    if (!action) {
      enemy.moved    = true;
      enemy.attacked = true;
      actions.push({ enemy, moveX: enemy.x, moveY: enemy.y, target: null, log: [] });
      continue;
    }

    // Move
    const prevX = enemy.x;
    const prevY = enemy.y;
    map.moveUnit(enemy, action.moveX, action.moveY);
    enemy.attacked = false; // moveUnit sets moved=true, reset attacked

    let log = [];
    if (action.target) {
      // Attack
      log = executeCombat(enemy, action.target, map);
      enemy.attacked = true;

      // Remove dead units
      if (!action.target.alive) {
        map.removeUnit(action.target);
      }
      if (!enemy.alive) {
        map.removeUnit(enemy);
      }
    } else {
      enemy.attacked = true; // wait (no attack)
    }

    actions.push({
      enemy,
      prevX, prevY,
      moveX: action.moveX,
      moveY: action.moveY,
      target: action.target,
      log,
    });
  }

  return actions;
}
