const baseLevels = [
  [
    '########',
    '#..G...#',
    '#..B...#',
    '#..P...#',
    '#..G.B.#',
    '########',
  ],
  [
    '##########',
    '#....G...#',
    '#.B##....#',
    '#..##.B..#',
    '#..P..G..#',
    '#........#',
    '##########',
  ],
  [
    '##########',
    '#....G...#',
    '#....B...#',
    '#..###...#',
    '#..P.....#',
    '#....G.B.#',
    '##########',
  ],
  [
    '##########',
    '#....G...#',
    '#..##....#',
    '#..B..B..#',
    '#..##....#',
    '#..P.G...#',
    '##########',
  ],
  [
    '##########',
    '#..G..G..#',
    '#..B..B..#',
    '#........#',
    '#...##...#',
    '#...P....#',
    '##########',
  ],
  [
    '##########',
    '#.G......#',
    '#.B.###..#',
    '#...#....#',
    '#...#.B..#',
    '#..G..P..#',
    '##########',
  ],
  [
    '##########',
    '#..G.....#',
    '#..B.##..#',
    '#....##..#',
    '#.P....G.#',
    '#.....B..#',
    '##########',
  ],
  [
    '##########',
    '#..G.....#',
    '#..B.....#',
    '#..###...#',
    '#..#.....#',
    '#..#..P..#',
    '#..G..B..#',
    '##########',
  ],
  [
    '##########',
    '#..G...G.#',
    '#..B...B.#',
    '#........#',
    '#.###....#',
    '#...P....#',
    '##########',
  ],
  [
    '##########',
    '#.....G..#',
    '#.###.B..#',
    '#....#...#',
    '#.P..#...#',
    '#....G.B.#',
    '##########',
  ],
  [
    '##########',
    '#..G.....#',
    '#..B..##.#',
    '#.....##.#',
    '#..P.....#',
    '#..G..B..#',
    '##########',
  ],
  [
    '##########',
    '#....G...#',
    '#....B...#',
    '#.##..##.#',
    '#....P...#',
    '#...G.B..#',
    '##########',
  ],
  [
    '##########',
    '#.G....G.#',
    '#.B....B.#',
    '#..####..#',
    '#....P...#',
    '#........#',
    '##########',
  ],
];

function toMatrix(level) {
  return level.map((row) => row.split(''));
}

function toLevel(matrix) {
  return matrix.map((row) => row.join(''));
}

function mirrorHorizontal(level) {
  return level.map((row) => row.split('').reverse().join(''));
}

function mirrorVertical(level) {
  return [...level].reverse();
}

function rotate180(level) {
  return mirrorVertical(mirrorHorizontal(level));
}

function transformLevel(level, kind) {
  if (kind === 'mirrorH') return mirrorHorizontal(level);
  if (kind === 'mirrorV') return mirrorVertical(level);
  if (kind === 'rotate180') return rotate180(level);
  return level;
}

function findCoords(level, targetChars) {
  const result = [];
  for (let y = 0; y < level.length; y += 1) {
    for (let x = 0; x < level[y].length; x += 1) {
      if (targetChars.includes(level[y][x])) {
        result.push({ x, y });
      }
    }
  }
  return result;
}

function cyclePlayerPosition(level) {
  const matrix = toMatrix(level);
  const floors = [];
  let player = null;

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const c = matrix[y][x];
      if (c === '.') floors.push({ x, y });
      if (c === 'P') player = { x, y };
    }
  }

  if (!player || floors.length === 0) return level;

  const nextFloor = floors[(player.x + player.y) % floors.length];
  matrix[player.y][player.x] = '.';
  matrix[nextFloor.y][nextFloor.x] = 'P';
  return toLevel(matrix);
}

function isLevelValid(level) {
  const allRowsSameWidth = level.every((row) => row.length === level[0].length);
  const playerCount = findCoords(level, ['P']).length;
  const boxCount = findCoords(level, ['B']).length;
  const goalCount = findCoords(level, ['G']).length;
  return allRowsSameWidth && playerCount === 1 && boxCount >= 1 && boxCount === goalCount;
}

function buildLevelSet(targetCount) {
  const variants = ['base', 'mirrorH', 'mirrorV', 'rotate180'];
  const generated = [];

  for (const seed of baseLevels) {
    for (const variant of variants) {
      const transformed = transformLevel(seed, variant);
      generated.push(transformed);
      generated.push(cyclePlayerPosition(transformed));
      if (generated.length >= targetCount) break;
    }
    if (generated.length >= targetCount) break;
  }

  const filtered = generated.filter(isLevelValid);
  return filtered.slice(0, targetCount);
}

const levels = buildLevelSet(100);

const boardEl = document.getElementById('board');
const stepsEl = document.getElementById('steps');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const nextBtn = document.getElementById('nextBtn');
const clearBannerEl = document.getElementById('clearBanner');
const clearDetailEl = document.getElementById('clearDetail');

let currentLevel = 0;
let map = [];
let player = { x: 0, y: 0 };
let steps = 0;

function cloneMap(source) {
  return source.map((row) => row.split(''));
}

function hideClearBanner() {
  clearBannerEl.hidden = true;
  clearDetailEl.textContent = '';
}

function showClearBanner() {
  clearBannerEl.hidden = false;
  if (currentLevel < levels.length - 1) {
    clearDetailEl.textContent = `手数 ${steps} でクリア！「次のステージ」へ進めます。`;
  } else {
    clearDetailEl.textContent = `手数 ${steps} で最終ステージをクリア！おめでとう！`;
  }
}

function loadLevel(index) {
  currentLevel = index;
  map = cloneMap(levels[index]);
  steps = 0;
  hideClearBanner();
  statusEl.textContent = `ステージ ${currentLevel + 1} / ${levels.length}`;
  nextBtn.disabled = true;

  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      if (map[y][x] === 'P') {
        player = { x, y };
      }
    }
  }

  render();
}

function tileAt(x, y) {
  if (y < 0 || y >= map.length || x < 0 || x >= map[y].length) return '#';
  return map[y][x];
}

function setTile(x, y, value) {
  map[y][x] = value;
}

function isGoalChar(char) {
  return char === 'G' || char === '+' || char === '*';
}

function isBoxChar(char) {
  return char === 'B' || char === '*';
}

function move(dx, dy) {
  if (nextBtn.disabled === false) return;

  const nx = player.x + dx;
  const ny = player.y + dy;
  const target = tileAt(nx, ny);

  if (target === '#') return;

  if (isBoxChar(target)) {
    const bx = nx + dx;
    const by = ny + dy;
    const behind = tileAt(bx, by);
    if (behind === '#' || isBoxChar(behind)) return;

    setTile(bx, by, isGoalChar(behind) ? '*' : 'B');
    setTile(nx, ny, target === '*' ? 'G' : '.');
  }

  const current = tileAt(player.x, player.y);
  setTile(player.x, player.y, current === '+' ? 'G' : '.');

  setTile(nx, ny, isGoalChar(target) ? '+' : 'P');
  player = { x: nx, y: ny };
  steps += 1;

  if (isCleared()) {
    statusEl.textContent = `ステージ ${currentLevel + 1} クリア！ 手数 ${steps}`;
    showClearBanner();
    if (currentLevel < levels.length - 1) {
      nextBtn.disabled = false;
    }
  }

  render();
}

function isCleared() {
  for (const row of map) {
    if (row.includes('B')) {
      return false;
    }
  }
  return true;
}

function render() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${map[0].length}, 44px)`;

  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      const c = map[y][x];
      const cell = document.createElement('div');
      cell.classList.add('cell');

      if (c === '#') {
        cell.classList.add('wall');
      } else {
        cell.classList.add('floor');
        if (c === 'G' || c === '+' || c === '*') {
          cell.classList.add('goal');
          cell.textContent = '⭐';
        }
        if (c === 'B' || c === '*') {
          cell.classList.add('box');
          cell.textContent = '📦';
        }
        if (c === 'P' || c === '+') {
          cell.classList.add('player');
          cell.textContent = '🙂';
        }
      }

      boardEl.append(cell);
    }
  }

  stepsEl.textContent = `手数: ${steps} | ステージ: ${currentLevel + 1}/${levels.length}`;
}

const keyMap = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

document.addEventListener('keydown', (event) => {
  const dir = keyMap[event.key];
  if (!dir) return;
  event.preventDefault();
  move(dir[0], dir[1]);
});

resetBtn.addEventListener('click', () => loadLevel(currentLevel));
nextBtn.addEventListener('click', () => loadLevel(currentLevel + 1));

const touchDirMap = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

for (const button of document.querySelectorAll('.dir')) {
  const handleDirection = (event) => {
    event.preventDefault();
    const dir = touchDirMap[button.dataset.dir];
    if (!dir) return;
    move(dir[0], dir[1]);
  };

  button.addEventListener('click', handleDirection);
  button.addEventListener('touchstart', handleDirection, { passive: false });
}

loadLevel(0);
