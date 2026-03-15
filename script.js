const KEY_LAYOUT = [
  { type: "kana", chars: ["あ", "い", "う", "え", "お"] },
  { type: "kana", chars: ["か", "き", "く", "け", "こ"] },
  { type: "kana", chars: ["さ", "し", "す", "せ", "そ"] },
  { type: "kana", chars: ["た", "ち", "つ", "て", "と"] },
  { type: "kana", chars: ["な", "に", "ぬ", "ね", "の"] },
  { type: "kana", chars: ["は", "ひ", "ふ", "へ", "ほ"] },
  { type: "kana", chars: ["ま", "み", "む", "め", "も"] },
  { type: "kana", chars: ["や", "ゃ", "ゆ", "ゅ", "よ"] },
  { type: "kana", chars: ["ら", "り", "る", "れ", "ろ"] },
  { type: "kana", chars: ["わ", "を", "ん", "ー", "、"] },
  { type: "kana", chars: ["。", "！", "？", "…", "・"] },
  { type: "backspace", label: "⌫" },
];

const WORDS = [
  "あさ", "いえ", "うみ", "かさ", "くるま", "けむり", "こころ", "さかな", "しお", "すいか",
  "たまご", "ちず", "つくえ", "とけい", "なつ", "にわ", "ぬの", "ねこ", "のり", "はな",
  "ひこうき", "ふね", "へや", "ほし", "まど", "みず", "むし", "めがね", "もり", "やま",
  "ゆき", "よる", "らいおん", "りんご", "るす", "れもん", "ろうそく", "わに", "おんがく", "きもの",
];

const BASE_FLICK_THRESHOLD = 20;
const ROUND_SECONDS = 30;
const HIGH_SCORE_KEY = "flick-practice-high-score";

const keyboard = document.getElementById("keyboard");
const template = document.getElementById("key-template");
const targetWordEl = document.getElementById("targetWord");
const typedEl = document.getElementById("typed");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const timeEl = document.getElementById("time");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");

let running = false;
let score = 0;
let remaining = ROUND_SECONDS;
let timerId = null;
let currentWord = "";
let typed = "";
let wordStartedAt = 0;
let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function vibrate(pattern = 10) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function setMessage(text, tone = "") {
  messageEl.textContent = text;
  messageEl.classList.remove("good", "bad");
  if (tone) {
    messageEl.classList.add(tone);
  }
}

function updateStatus() {
  scoreEl.textContent = String(score);
  timeEl.textContent = String(remaining);
  highScoreEl.textContent = String(highScore);
  typedEl.textContent = typed
    ? typed + " " + "_ ".repeat(Math.max(0, currentWord.length - typed.length)).trimEnd()
    : "_ ".repeat(currentWord.length).trimEnd();
}

function setNextWord() {
  currentWord = randomWord();
  typed = "";
  wordStartedAt = performance.now();
  targetWordEl.textContent = currentWord;
  updateStatus();
}

function calcWordPoint(wordLength, elapsedMs) {
  const base = wordLength * 100;
  const speedBonus = Math.max(0, Math.round((5000 - elapsedMs) / 20));
  return base + speedBonus;
}

function saveHighScoreIfNeeded() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  }
}

function finishGame() {
  running = false;
  clearInterval(timerId);
  timerId = null;
  saveHighScoreIfNeeded();
  updateStatus();
  setMessage(`終了！ スコア ${score} / ハイスコア ${highScore}`, "good");
}

function judgeInput(char) {
  if (!running) {
    setMessage("先に「スタート」を押してください");
    return;
  }

  const expected = currentWord[typed.length];
  if (char === expected) {
    typed += char;

    if (typed.length === currentWord.length) {
      const elapsed = performance.now() - wordStartedAt;
      const point = calcWordPoint(currentWord.length, elapsed);
      score += point;
      saveHighScoreIfNeeded();
      vibrate(20);
      setMessage(`✅ ${currentWord} クリア！ +${point}pt`, "good");
      setNextWord();
    } else {
      setMessage(`◎ ${typed.length}/${currentWord.length} 文字目正解`);
      updateStatus();
    }
    return;
  }

  const penalty = 20;
  score = Math.max(0, score - penalty);
  vibrate([20, 30, 20]);
  setMessage(`❌ ミス！ -${penalty}pt（次は「${expected}」）`, "bad");
  updateStatus();
}

function handleBackspace() {
  if (!running) {
    return;
  }
  if (!typed.length) {
    return;
  }
  typed = typed.slice(0, -1);
  updateStatus();
  setMessage("1文字削除しました");
  vibrate(8);
}

function directionFromDelta(dx, dy, pointerType = "touch") {
  const threshold = pointerType === "mouse" ? BASE_FLICK_THRESHOLD + 8 : BASE_FLICK_THRESHOLD;
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
    return 0;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 2 : 4;
  }
  return dy > 0 ? 3 : 1;
}

function setupKanaKey(node, chars) {
  const [center, up, right, down, left] = chars;
  node.querySelector(".center").textContent = center;
  node.querySelector(".up").textContent = up;
  node.querySelector(".right").textContent = right;
  node.querySelector(".down").textContent = down;
  node.querySelector(".left").textContent = left;

  let sx = 0;
  let sy = 0;

  node.addEventListener("pointerdown", (event) => {
    sx = event.clientX;
    sy = event.clientY;
    node.classList.add("flicking");
    node.setPointerCapture(event.pointerId);
  });

  node.addEventListener("pointerup", (event) => {
    const dx = event.clientX - sx;
    const dy = event.clientY - sy;
    const dir = directionFromDelta(dx, dy, event.pointerType);
    const chosen = chars[dir] || chars[0];
    node.classList.remove("flicking");
    judgeInput(chosen);
  });

  node.addEventListener("pointercancel", () => {
    node.classList.remove("flicking");
  });
}

function setupActionKey(node, label, onClick) {
  node.classList.add("action-key");
  node.querySelector(".center").textContent = label;
  node.querySelector(".up").textContent = "";
  node.querySelector(".right").textContent = "";
  node.querySelector(".down").textContent = "";
  node.querySelector(".left").textContent = "";

  node.addEventListener("click", onClick);
}

function buildKeyboard() {
  KEY_LAYOUT.forEach((entry) => {
    const node = template.content.firstElementChild.cloneNode(true);

    if (entry.type === "kana") {
      setupKanaKey(node, entry.chars);
    } else if (entry.type === "backspace") {
      setupActionKey(node, entry.label, handleBackspace);
    }

    keyboard.appendChild(node);
  });
}

function resetGame() {
  running = false;
  clearInterval(timerId);
  timerId = null;
  score = 0;
  remaining = ROUND_SECONDS;
  setNextWord();
  updateStatus();
  setMessage("「スタート」を押して開始！");
}

startBtn.addEventListener("click", () => {
  if (running) {
    return;
  }

  running = true;
  score = 0;
  remaining = ROUND_SECONDS;
  setNextWord();
  updateStatus();
  setMessage("30秒チャレンジ開始！");

  timerId = setInterval(() => {
    remaining -= 1;
    updateStatus();

    if (remaining <= 0) {
      finishGame();
    }
  }, 1000);
});

resetBtn.addEventListener("click", resetGame);

buildKeyboard();
resetGame();

let lastTouchEnd = 0;
document.addEventListener("touchend", (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 280) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });
