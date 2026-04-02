// ============================================================
// data.js - Static game data: terrain, classes, chapter maps
// ============================================================

// --- Terrain Types ---
export const TERRAIN = {
  plains:   { name: 'Plains',   color: '#7ec850', movCost: 1, defBonus: 0, avoBonus: 0 },
  forest:   { name: 'Forest',   color: '#2d7a2d', movCost: 2, defBonus: 1, avoBonus: 15 },
  mountain: { name: 'Mountain', color: '#8b7355', movCost: 4, defBonus: 2, avoBonus: 10 },
  fort:     { name: 'Fort',     color: '#b0b0b0', movCost: 2, defBonus: 2, avoBonus: 20 },
  peak:     { name: 'Peak',     color: '#6b6b6b', movCost: 99, defBonus: 3, avoBonus: 0 }, // impassable
  sea:      { name: 'Sea',      color: '#3399cc', movCost: 99, defBonus: 0, avoBonus: 0 }, // impassable
  road:     { name: 'Road',     color: '#c8a850', movCost: 1, defBonus: 0, avoBonus: 0 },
  bridge:   { name: 'Bridge',   color: '#b8860b', movCost: 1, defBonus: 0, avoBonus: 0 },
  village:  { name: 'Village',  color: '#e8c890', movCost: 1, defBonus: 1, avoBonus: 0 },
};

// --- Weapon Types ---
export const WEAPON = {
  sword: { name: 'Sword', color: '#4488ff' },
  lance: { name: 'Lance', color: '#dd4444' },
  axe:   { name: 'Axe',   color: '#44aa44' },
  bow:   { name: 'Bow',   color: '#aa8844' },
  tome:  { name: 'Tome',  color: '#cc44cc' },
  staff: { name: 'Staff', color: '#44dddd' },
};

// Weapon triangle: key beats value[0], loses to value[1]
// sword > axe > lance > sword
export const WEAPON_TRIANGLE = {
  sword: { beats: 'axe',   losesTo: 'lance' },
  axe:   { beats: 'lance', losesTo: 'sword' },
  lance: { beats: 'sword', losesTo: 'axe'   },
  bow:   { beats: null,    losesTo: null     }, // neutral
  tome:  { beats: null,    losesTo: null     }, // neutral
  staff: { beats: null,    losesTo: null     }, // healing only
};

// +1 ATK, +15 Hit when advantaged; -1 ATK, -15 Hit when disadvantaged
export const WEAPON_TRIANGLE_BONUS = { atk: 1, hit: 15 };

// --- Unit Classes ---
export const CLASSES = {
  lord: {
    name: 'Lord', weapon: 'sword', color: '#2266cc',
    baseHp: 20, baseAtk: 8,  baseDef: 5,  baseSpd: 9,  baseRes: 3, baseMov: 6,
    baseHit: 80, baseCrit: 5, baseLuck: 8, baseAvo: 10,
    atkRange: [1], // melee only
  },
  knight: {
    name: 'Knight', weapon: 'lance', color: '#446688',
    baseHp: 28, baseAtk: 10, baseDef: 12, baseSpd: 4,  baseRes: 2, baseMov: 4,
    baseHit: 75, baseCrit: 2, baseLuck: 4, baseAvo: 5,
    atkRange: [1],
  },
  mage: {
    name: 'Mage', weapon: 'tome', color: '#8844cc',
    baseHp: 16, baseAtk: 12, baseDef: 3,  baseSpd: 8,  baseRes: 7, baseMov: 5,
    baseHit: 85, baseCrit: 5, baseLuck: 5, baseAvo: 10,
    atkRange: [1, 2],
  },
  archer: {
    name: 'Archer', weapon: 'bow', color: '#aa6622',
    baseHp: 18, baseAtk: 9,  baseDef: 5,  baseSpd: 7,  baseRes: 2, baseMov: 5,
    baseHit: 80, baseCrit: 5, baseLuck: 6, baseAvo: 10,
    atkRange: [2], // ranged only
  },
  cleric: {
    name: 'Cleric', weapon: 'staff', color: '#22aaaa',
    baseHp: 14, baseAtk: 0,  baseDef: 3,  baseSpd: 6,  baseRes: 8, baseMov: 5,
    baseHit: 100, baseCrit: 0, baseLuck: 8, baseAvo: 10,
    atkRange: [1], // staff range for healing
    healer: true,
  },
  soldier: {
    name: 'Soldier', weapon: 'lance', color: '#883333',
    baseHp: 20, baseAtk: 7,  baseDef: 6,  baseSpd: 5,  baseRes: 1, baseMov: 5,
    baseHit: 75, baseCrit: 1, baseLuck: 3, baseAvo: 5,
    atkRange: [1],
  },
  brigand: {
    name: 'Brigand', weapon: 'axe', color: '#553300',
    baseHp: 24, baseAtk: 11, baseDef: 4,  baseSpd: 4,  baseRes: 1, baseMov: 5,
    baseHit: 70, baseCrit: 3, baseLuck: 2, baseAvo: 5,
    atkRange: [1],
  },
  mercenary: {
    name: 'Mercenary', weapon: 'sword', color: '#664400',
    baseHp: 22, baseAtk: 9,  baseDef: 6,  baseSpd: 7,  baseRes: 2, baseMov: 5,
    baseHit: 80, baseCrit: 5, baseLuck: 5, baseAvo: 10,
    atkRange: [1],
  },
};

// --- Chapter 1 Map ---
// Tile map: 15 columns x 10 rows
// P = plains, F = forest, M = mountain, R = road, T = fort, V = village, S = sea, B = bridge
const T1 = [
  ['P','P','P','P','P','F','F','M','M','M','M','P','P','P','P'],
  ['P','V','R','R','P','F','M','M','P','P','M','P','P','T','P'],
  ['P','P','R','P','P','P','P','P','P','P','P','P','P','P','P'],
  ['F','F','R','P','P','P','P','P','F','F','P','P','P','P','P'],
  ['F','F','R','R','R','R','P','P','F','F','F','P','P','P','P'],
  ['P','P','P','P','P','R','P','P','P','P','P','P','P','P','P'],
  ['P','P','P','P','P','R','P','F','F','P','P','P','M','M','P'],
  ['P','P','M','M','P','R','R','R','R','P','P','P','M','M','P'],
  ['P','P','M','P','P','P','P','P','R','P','P','P','P','P','P'],
  ['P','P','P','P','P','P','P','P','R','P','P','P','P','T','P'],
];

const TILE_CODE = {
  'P': 'plains', 'F': 'forest', 'M': 'mountain',
  'R': 'road',   'T': 'fort',   'V': 'village',
  'S': 'sea',    'B': 'bridge',
};

export const CHAPTER_1 = {
  name: 'Chapter 1: The Beginning',
  width: 15,
  height: 10,
  tiles: T1.map(row => row.map(c => TILE_CODE[c])),
  playerUnits: [
    { id: 'p1', name: 'Aric',   cls: 'lord',    x: 1, y: 9, isLord: true },
    { id: 'p2', name: 'Gareth', cls: 'knight',  x: 0, y: 8 },
    { id: 'p3', name: 'Lyra',   cls: 'mage',    x: 1, y: 8 },
    { id: 'p4', name: 'Finn',   cls: 'archer',  x: 2, y: 9 },
    { id: 'p5', name: 'Elena',  cls: 'cleric',  x: 0, y: 9 },
  ],
  enemyUnits: [
    { id: 'e1', name: 'Soldier',   cls: 'soldier',   x: 13, y: 1 },
    { id: 'e2', name: 'Brigand',   cls: 'brigand',   x: 12, y: 2 },
    { id: 'e3', name: 'Soldier',   cls: 'soldier',   x: 14, y: 3 },
    { id: 'e4', name: 'Mercenary', cls: 'mercenary', x: 11, y: 4 },
    { id: 'e5', name: 'Brigand',   cls: 'brigand',   x: 13, y: 5 },
    { id: 'e6', name: 'Boss Vorn',  cls: 'soldier',   x: 14, y: 9, isBoss: true },
  ],
  winCondition: 'rout',   // kill all enemies
  loseCondition: 'lord',  // lord dies
};

// --- Chapter 2 Map ---
// River crossing: sea tiles in row 3, bridges at x=6 and x=10
const T2 = [
  ['F','F','F','P','P','P','P','P','P','P','P','F','F','F','F'],
  ['F','P','P','P','T','P','P','P','T','P','P','F','P','P','F'],
  ['P','P','P','P','P','P','P','P','P','P','P','P','P','P','P'],
  ['P','P','P','P','S','S','B','S','S','S','B','S','P','P','P'],
  ['P','P','P','P','P','P','P','P','P','P','P','P','P','P','P'],
  ['P','P','P','P','P','P','P','P','P','P','P','P','P','P','P'],
  ['F','F','P','P','P','P','P','P','P','P','P','P','F','F','F'],
  ['F','P','P','M','M','P','P','P','M','M','P','P','P','P','F'],
  ['P','P','P','M','P','P','V','P','P','M','P','P','P','P','P'],
  ['P','P','P','P','P','P','P','P','P','P','P','P','P','T','P'],
];

export const CHAPTER_2 = {
  name: 'Chapter 2: River of Swords',
  width: 15,
  height: 10,
  tiles: T2.map(row => row.map(c => TILE_CODE[c])),
  playerUnits: [
    { id: 'p1', name: 'Aric',   cls: 'lord',   x: 1, y: 9, isLord: true },
    { id: 'p2', name: 'Gareth', cls: 'knight', x: 0, y: 8 },
    { id: 'p3', name: 'Lyra',   cls: 'mage',   x: 1, y: 8 },
    { id: 'p4', name: 'Finn',   cls: 'archer', x: 2, y: 9 },
    { id: 'p5', name: 'Elena',  cls: 'cleric', x: 0, y: 9 },
  ],
  enemyUnits: [
    { id: 'e1', name: 'Soldier',    cls: 'soldier',   x: 12, y: 0 },
    { id: 'e2', name: 'Soldier',    cls: 'soldier',   x: 13, y: 2 },
    { id: 'e3', name: 'Brigand',    cls: 'brigand',   x: 11, y: 1 },
    { id: 'e4', name: 'Brigand',    cls: 'brigand',   x:  6, y: 2 },
    { id: 'e5', name: 'Mercenary',  cls: 'mercenary', x: 14, y: 3 },
    { id: 'e6', name: 'Mercenary',  cls: 'mercenary', x:  9, y: 1 },
    { id: 'e7', name: 'Archer',     cls: 'archer',    x: 14, y: 5 },
    { id: 'e8', name: 'Boss Drake', cls: 'knight',    x:  8, y: 1, isBoss: true },
  ],
  winCondition: 'rout',
  loseCondition: 'lord',
};

// --- Chapter 3 Map ---
// Fortress assault: forts and mountains in the enemy's half
const T3 = [
  ['M','M','P','P','P','P','P','P','P','P','P','P','P','M','M'],
  ['M','P','P','F','F','P','T','P','T','P','F','F','P','P','M'],
  ['P','P','P','F','P','P','P','P','P','P','P','F','P','P','P'],
  ['P','P','P','P','P','P','P','P','P','P','P','P','P','P','P'],
  ['P','T','P','P','P','F','F','P','F','F','P','P','P','T','P'],
  ['P','P','P','P','P','F','P','P','P','F','P','P','P','P','P'],
  ['P','P','P','P','P','P','P','P','P','P','P','P','P','P','P'],
  ['P','P','M','M','P','P','P','P','P','P','M','M','P','P','P'],
  ['P','P','M','P','P','P','V','P','P','P','P','M','P','P','P'],
  ['P','P','P','P','P','P','P','P','P','P','P','P','P','T','P'],
];

export const CHAPTER_3 = {
  name: 'Chapter 3: The Fallen Fortress',
  width: 15,
  height: 10,
  tiles: T3.map(row => row.map(c => TILE_CODE[c])),
  playerUnits: [
    { id: 'p1', name: 'Aric',   cls: 'lord',   x: 1, y: 9, isLord: true },
    { id: 'p2', name: 'Gareth', cls: 'knight', x: 0, y: 8 },
    { id: 'p3', name: 'Lyra',   cls: 'mage',   x: 1, y: 8 },
    { id: 'p4', name: 'Finn',   cls: 'archer', x: 2, y: 9 },
    { id: 'p5', name: 'Elena',  cls: 'cleric', x: 0, y: 9 },
  ],
  enemyUnits: [
    { id: 'e1',  name: 'Soldier',    cls: 'soldier',   x:  6, y: 1 },
    { id: 'e2',  name: 'Soldier',    cls: 'soldier',   x:  8, y: 1 },
    { id: 'e3',  name: 'Soldier',    cls: 'soldier',   x: 12, y: 0 },
    { id: 'e4',  name: 'Brigand',    cls: 'brigand',   x: 13, y: 2 },
    { id: 'e5',  name: 'Brigand',    cls: 'brigand',   x: 14, y: 4 },
    { id: 'e6',  name: 'Mercenary',  cls: 'mercenary', x: 11, y: 3 },
    { id: 'e7',  name: 'Mercenary',  cls: 'mercenary', x: 14, y: 5 },
    { id: 'e8',  name: 'Archer',     cls: 'archer',    x:  9, y: 0 },
    { id: 'e9',  name: 'Archer',     cls: 'archer',    x: 13, y: 3 },
    { id: 'e10', name: 'Boss Garm',  cls: 'knight',    x: 13, y: 1, isBoss: true },
  ],
  winCondition: 'rout',
  loseCondition: 'lord',
};

export const CHAPTERS = [CHAPTER_1, CHAPTER_2, CHAPTER_3];
