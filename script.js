const levels = [
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
];

const boardEl = document.getElementById('board');
const stepsEl = document.getElementById('steps');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const nextBtn = document.getElementById('nextBtn');

let currentLevel = 0;
let map = [];
let player = { x: 0, y: 0 };
let steps = 0;

function cloneMap(source) {
  return source.map((row) => row.split(''));
}

function loadLevel(index) {
  currentLevel = index;
  map = cloneMap(levels[index]);
  steps = 0;
  statusEl.textContent = '';
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
    statusEl.textContent = `クリア！ 手数 ${steps}`;
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

  stepsEl.textContent = `手数: ${steps}`;
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

loadLevel(0);
