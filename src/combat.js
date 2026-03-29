// ============================================================
// combat.js - Combat calculations: weapon triangle, hit%, damage
// ============================================================
import { WEAPON_TRIANGLE, WEAPON_TRIANGLE_BONUS, TERRAIN } from './data.js';

// Get weapon triangle relationship: 'advantage' | 'disadvantage' | 'neutral'
function getTriangleRelation(atkWeapon, defWeapon) {
  const wt = WEAPON_TRIANGLE[atkWeapon];
  if (!wt || !wt.beats) return 'neutral';
  if (wt.beats === defWeapon)   return 'advantage';
  if (wt.losesTo === defWeapon) return 'disadvantage';
  return 'neutral';
}

// Calculate combat stats for one attacker vs one defender
// Returns { atk, hit, crit, doubles } for the attacker
function calcStats(attacker, defender, map) {
  const relation = getTriangleRelation(attacker.weapon, defender.weapon);
  const triAtkBonus = relation === 'advantage' ? WEAPON_TRIANGLE_BONUS.atk
    : relation === 'disadvantage' ? -WEAPON_TRIANGLE_BONUS.atk : 0;
  const triHitBonus = relation === 'advantage' ? WEAPON_TRIANGLE_BONUS.hit
    : relation === 'disadvantage' ? -WEAPON_TRIANGLE_BONUS.hit : 0;

  // Terrain avo bonus on defender's tile
  const terrain = map ? map.getTerrain(defender.x, defender.y) : null;
  const terrainAvo = terrain ? terrain.avoBonus : 0;
  const terrainDef = terrain ? terrain.defBonus : 0;

  // Effective attack (magical tomes ignore physical def, use res)
  const defStat = attacker.weapon === 'tome' ? defender.res : defender.def;
  const atkVal = Math.max(1, attacker.atk + triAtkBonus - defStat - terrainDef);

  // Hit% (clamped 0-100)
  const avo = defender.avo + terrainAvo;
  const hitVal = Math.min(100, Math.max(0, attacker.hit + triHitBonus - avo));

  // Crit%
  const critVal = Math.min(100, Math.max(0, attacker.crit - defender.luck));

  // Double attack if spd difference >= 4
  const doubles = (attacker.spd - defender.spd) >= 4;

  return { atk: atkVal, hit: hitVal, crit: critVal, doubles };
}

// Build a full combat preview object
// Returns { attacker, defender, atkStats, defStats, canDefend }
export function buildCombatPreview(attacker, defender, map) {
  // Check if defender can counter-attack (has compatible attack range)
  const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
  const canDefend = !defender.isHealer &&
    defender.atkRange.includes(dist) &&
    defender.hp > 0;

  const atkStats = calcStats(attacker, defender, map);
  const defStats = canDefend ? calcStats(defender, attacker, map) : null;

  // Simulate HP changes
  let atkHp = attacker.hp;
  let defHp  = defender.hp;

  // Attacker hits (always at least once)
  defHp -= atkStats.atk; // simplified for preview (assumes hit)
  if (defHp > 0 && atkStats.doubles) defHp -= atkStats.atk;

  if (canDefend && defHp > 0) {
    atkHp -= defStats.atk;
    if (atkHp > 0 && defStats.doubles) atkHp -= defStats.atk;
  }

  return {
    attacker,
    defender,
    atkStats,
    defStats,
    canDefend,
    projAtkHp: Math.max(0, atkHp),
    projDefHp: Math.max(0, defHp),
  };
}

// Execute combat: apply actual damage with RNG
// Returns array of log strings
export function executeCombat(attacker, defender, map) {
  const log = [];
  const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
  const canDefend = !defender.isHealer &&
    defender.atkRange.includes(dist) &&
    defender.hp > 0;

  const atkStats = calcStats(attacker, defender, map);
  const defStats = canDefend ? calcStats(defender, attacker, map) : null;

  // Single attack function
  function strike(striker, target, stats, logArr) {
    const roll = Math.random() * 100;
    if (roll > stats.hit) {
      logArr.push(`${striker.name} misses!`);
      return false;
    }
    const critRoll = Math.random() * 100;
    let dmg = stats.atk;
    if (critRoll < stats.crit) {
      dmg *= 3;
      logArr.push(`${striker.name} crits! ${dmg} damage!`);
    } else {
      logArr.push(`${striker.name} deals ${dmg} damage.`);
    }
    target.takeDamage(dmg);
    return true;
  }

  // Attacker attacks (1 or 2 times)
  strike(attacker, defender, atkStats, log);
  if (defender.alive && atkStats.doubles) {
    strike(attacker, defender, atkStats, log);
  }

  // Defender counter-attacks if alive and able
  if (defender.alive && canDefend) {
    strike(defender, attacker, defStats, log);
    if (attacker.alive && defStats.doubles) {
      strike(defender, attacker, defStats, log);
    }
  }

  // Exp gain
  if (!defender.alive) {
    const expGain = Math.min(100, 30 + (defender.level || 1) * 2);
    if (attacker.team === 'player') {
      attacker.gainExp(expGain);
      log.push(`${attacker.name} gained ${expGain} EXP.`);
    }
  } else {
    if (attacker.team === 'player') {
      attacker.gainExp(10);
    }
  }

  return log;
}

// Execute healing (cleric uses staff on ally)
export function executeHeal(healer, target) {
  const amount = Math.max(5, healer.atk + 10);
  target.heal(amount);
  healer.gainExp(15);
  return [`${healer.name} heals ${target.name} for ${amount} HP.`];
}
