// ============================================================
// unit.js - Unit class with stats, state, and level-up
// ============================================================
import { CLASSES } from './data.js';

export class Unit {
  constructor({ id, name, cls, x, y, team, isLord = false, isBoss = false }) {
    this.id = id;
    this.name = name;
    this.cls = cls;
    this.team = team; // 'player' | 'enemy'
    this.x = x;
    this.y = y;
    this.isLord = isLord;
    this.isBoss = isBoss;
    this.level = 1;
    this.exp = 0;

    const c = CLASSES[cls];
    this.classData = c;
    this.weapon = c.weapon;
    this.atkRange = c.atkRange;
    this.isHealer = !!c.healer;

    this.maxHp  = c.baseHp;
    this.hp     = c.baseHp;
    this.atk    = c.baseAtk;
    this.def    = c.baseDef;
    this.spd    = c.baseSpd;
    this.res    = c.baseRes;
    this.mov    = c.baseMov;
    this.hit    = c.baseHit;
    this.crit   = c.baseCrit;
    this.luck   = c.baseLuck;
    this.avo    = c.baseAvo;

    // Boss gets a stat boost
    if (isBoss) {
      this.maxHp += 10;
      this.hp    += 10;
      this.atk   += 3;
      this.def   += 3;
    }

    // Turn state
    this.moved    = false;
    this.attacked = false;
    this.alive    = true;
  }

  get acted() {
    return this.moved && this.attacked;
  }

  get color() {
    return this.classData.color;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp === 0) this.alive = false;
    return this.hp === 0;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  gainExp(amount) {
    this.exp += amount;
    if (this.exp >= 100) {
      this.exp -= 100;
      this.levelUp();
      return true;
    }
    return false;
  }

  levelUp() {
    this.level++;
    // Simple stat growths
    const growths = {
      lord:      { hp: 0.7, atk: 0.5, def: 0.4, spd: 0.5, res: 0.3 },
      knight:    { hp: 0.8, atk: 0.5, def: 0.6, spd: 0.2, res: 0.2 },
      mage:      { hp: 0.5, atk: 0.6, def: 0.2, spd: 0.4, res: 0.5 },
      archer:    { hp: 0.6, atk: 0.5, def: 0.3, spd: 0.4, res: 0.2 },
      cleric:    { hp: 0.5, atk: 0.0, def: 0.2, spd: 0.4, res: 0.6 },
      soldier:   { hp: 0.7, atk: 0.4, def: 0.4, spd: 0.3, res: 0.2 },
      brigand:   { hp: 0.7, atk: 0.5, def: 0.3, spd: 0.3, res: 0.1 },
      mercenary: { hp: 0.7, atk: 0.5, def: 0.4, spd: 0.5, res: 0.2 },
    };
    const g = growths[this.cls] || growths.soldier;
    if (Math.random() < g.hp)  { this.maxHp++; this.hp++; }
    if (Math.random() < g.atk) this.atk++;
    if (Math.random() < g.def) this.def++;
    if (Math.random() < g.spd) this.spd++;
    if (Math.random() < g.res) this.res++;
  }

  // Called at start of each turn for this team
  resetTurn() {
    this.moved    = false;
    this.attacked = false;
  }
}
