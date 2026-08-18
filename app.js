import {
  BEST_KEY,
  CAPTIONS,
  FAIL_LIMIT,
  FAIL_LOCK_MS,
  PASSWORD_SHA256,
  PHOTO_PATH,
  SESSION_KEY,
  TIMED_SECONDS,
  WELCOME_TEXT,
} from './config.js';
import { SIZE, move, startGame, undo } from './game.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function loadBest(mode) {
  const raw = localStorage.getItem(`${BEST_KEY}-${mode}`);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function saveBest(mode, score) {
  const best = Math.max(loadBest(mode), score);
  localStorage.setItem(`${BEST_KEY}-${mode}`, String(best));
  return best;
}

let fails = 0;
let lockedUntil = 0;

function bindGate() {
  const form = $('gate-form');
  const input = $('password');
  const error = $('gate-error');
  const toggle = $('toggle-pw');
  const enter = $('enter');

  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const now = Date.now();
    if (now < lockedUntil) {
      const wait = Math.ceil((lockedUntil - now) / 1000);
      error.textContent = `try again in ${wait}s`;
      return;
    }

    enter.disabled = true;
    const digest = await sha256Hex(input.value);
    enter.disabled = false;

    if (!timingSafeEqual(digest, PASSWORD_SHA256)) {
      fails += 1;
      if (fails >= FAIL_LIMIT) {
        lockedUntil = Date.now() + FAIL_LOCK_MS;
        fails = 0;
        error.textContent = 'too many tries — wait a moment';
      } else {
        error.textContent = 'not quite';
      }
      input.value = '';
      input.focus();
      return;
    }

    sessionStorage.setItem(SESSION_KEY, '1');
    openGame({ greet: true });
  });
}

function openWelcome() {
  const root = $('welcome');
  $('welcome-text').textContent = WELCOME_TEXT;
  root.classList.remove('hidden');
  $('lets-play').focus();
}

function closeWelcome() {
  $('welcome').classList.add('hidden');
  const board = document.getElementById('board');
  if (board) board.focus();
}

function mountGame() {
  const app = $('app');
  app.replaceChildren($('game-template').content.cloneNode(true));
}

const ui = {
  mode: 'classic',
  state: null,
  best: 0,
  remaining: TIMED_SECONDS,
  timerId: 0,
  deadline: 0,
  lastSpawn: null,
  lastMerged: new Set(),
};

function renderTiles(animateSpawn) {
  const tiles = $('tiles');
  tiles.replaceChildren();
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const value = ui.state.grid[r][c];
      if (!value) continue;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.style.setProperty('--r', String(r));
      tile.style.setProperty('--c', String(c));
      tile.dataset.r = String(r);
      tile.dataset.c = String(c);
      tile.dataset.value = String(value);
      tile.setAttribute('aria-label', CAPTIONS[value] || `tile ${value}`);

      const fallback = document.createElement('span');
      fallback.className = 'tile-fallback';
      fallback.textContent = String(value);
      tile.append(fallback);

      const img = document.createElement('img');
      img.alt = '';
      img.src = PHOTO_PATH(value);
      img.addEventListener('load', () => tile.classList.add('has-photo'));
      img.addEventListener('error', () => img.remove());
      tile.append(img);

      const isSpawn =
        animateSpawn &&
        ui.lastSpawn &&
        ui.lastSpawn.r === r &&
        ui.lastSpawn.c === c &&
        ui.lastSpawn.value === value;
      if (!reducedMotion && isSpawn) tile.classList.add('tile-new');
      if (!reducedMotion && ui.lastMerged.has(`${r},${c}`)) {
        tile.classList.add('tile-merged');
      }

      tile.addEventListener('click', () => {
        if (ignoreTileClick) {
          ignoreTileClick = false;
          return;
        }
        openCaption(value, img);
      });
      tiles.append(tile);
    }
  }
}

function syncScores() {
  $('score').textContent = String(ui.state.score);
  ui.best = saveBest(ui.mode, ui.state.score);
  $('best').textContent = String(ui.best);
  $('undo').disabled = ui.state.history.length === 0;
}

function setOverlay(show, title, copy) {
  const overlay = $('overlay');
  overlay.classList.toggle('hidden', !show);
  if (show) {
    $('overlay-title').textContent = title;
    $('overlay-copy').textContent = copy;
  }
}

function checkEnd() {
  if (ui.mode === 'timed' && ui.remaining <= 0) {
    ui.state.over = true;
    setOverlay(true, 'time', 'the clock ran out.');
    return;
  }
  if (!ui.state.over) {
    setOverlay(false);
    return;
  }
  if (ui.mode === 'zen') {
    setOverlay(true, 'paused', 'no moves left — undo and keep going.');
  } else {
    setOverlay(true, 'game over', 'beautiful run. try again?');
  }
}

function stopTimer() {
  if (ui.timerId) window.clearInterval(ui.timerId);
  ui.timerId = 0;
}

function tickTimer() {
  ui.remaining = Math.max(0, Math.ceil((ui.deadline - Date.now()) / 1000));
  $('timer').textContent = formatTime(ui.remaining);
  if (ui.remaining <= 0) {
    stopTimer();
    checkEnd();
  }
}

function startTimer() {
  stopTimer();
  const card = $('timer-card');
  const timed = ui.mode === 'timed';
  card.classList.toggle('hidden', !timed);
  if (!timed) return;
  ui.deadline = Date.now() + ui.remaining * 1000;
  $('timer').textContent = formatTime(ui.remaining);
  ui.timerId = window.setInterval(tickTimer, 250);
}

function newGame() {
  ui.state = startGame();
  ui.lastSpawn = null;
  ui.lastMerged = new Set();
  ui.remaining = TIMED_SECONDS;
  setOverlay(false);
  syncScores();
  renderTiles(true);
  startTimer();
}

function applyMove(dir) {
  if (ui.state.over) return;
  if (ui.mode === 'timed' && ui.remaining <= 0) return;
  const before = ui.state.grid.map((row) => row.slice());
  const result = move(ui.state, dir);
  if (!result.moved) return;
  ui.lastSpawn = result.spawned;
  ui.lastMerged = new Set();
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (ui.state.grid[r][c] && ui.state.grid[r][c] === before[r][c] * 2 && before[r][c] !== 0) {
        // ponytail: mark cells that doubled in place; good enough for pop
        if (result.scoreGained) ui.lastMerged.add(`${r},${c}`);
      }
    }
  }
  syncScores();
  renderTiles(true);
  checkEnd();
}

function doUndo() {
  if (!undo(ui.state)) return;
  if (ui.mode === 'timed' && ui.remaining <= 0) {
    ui.remaining = 1;
    startTimer();
  }
  ui.lastSpawn = null;
  ui.lastMerged = new Set();
  syncScores();
  renderTiles(false);
  checkEnd();
}

function openCaption(value, img) {
  const root = $('caption');
  const photo = $('caption-photo');
  $('caption-text').textContent = CAPTIONS[value] || `tile ${value}`;
  if (img && img.naturalWidth) {
    photo.src = img.src;
    photo.alt = CAPTIONS[value] || '';
    photo.classList.remove('hidden');
  } else {
    photo.removeAttribute('src');
    photo.classList.add('hidden');
  }
  root.classList.remove('hidden');
  root.classList.toggle('center', window.matchMedia('(min-width: 768px)').matches);
}

function closeCaption() {
  $('caption').classList.add('hidden');
}

let ignoreTileClick = false;

function bindSwipe(board) {
  let x0 = 0;
  let y0 = 0;
  let tracking = false;

  board.addEventListener('pointerdown', (event) => {
    tracking = true;
    x0 = event.clientX;
    y0 = event.clientY;
  });

  const finish = (event) => {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - x0;
    const dy = event.clientY - y0;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 28) return;
    ignoreTileClick = true;
    event.preventDefault();
    if (absX > absY) applyMove(dx > 0 ? 'right' : 'left');
    else applyMove(dy > 0 ? 'down' : 'up');
  };

  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', () => {
    tracking = false;
  });
  board.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault();
    },
    { passive: false },
  );
}

function bindKeys() {
  const map = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    a: 'left',
    d: 'right',
    w: 'up',
    s: 'down',
  };
  window.addEventListener('keydown', (event) => {
    if ($('welcome').classList.contains('hidden') === false) return;
    if ($('caption').classList.contains('hidden') === false) {
      if (event.key === 'Escape') closeCaption();
      return;
    }
    const dir = map[event.key] || map[event.key.toLowerCase()];
    if (!dir) return;
    event.preventDefault();
    applyMove(dir);
  });
}

async function shareCard() {
  const canvas = document.createElement('canvas');
  const size = 840;
  canvas.width = size;
  canvas.height = 980;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FCE7F3';
  ctx.fillRect(0, 0, size, canvas.height);
  ctx.fillStyle = '#0A0A0A';
  ctx.font = '600 42px "Playfair Display", Georgia, serif';
  ctx.fillText('2048 for Hadyn', 48, 72);
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText(`score ${ui.state.score}   best ${ui.best}`, 48, 120);
  ctx.font = '400 22px Inter, sans-serif';
  ctx.fillText(new Date().toLocaleDateString(), 48, 156);

  const grid = 720;
  const origin = 48;
  const top = 200;
  const gap = 12;
  const cell = (grid - gap * 5) / 4;
  ctx.fillStyle = '#FBCFE8';
  roundRect(ctx, origin, top, grid, grid, 24);
  ctx.fill();

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const x = origin + gap + c * (cell + gap);
      const y = top + gap + r * (cell + gap);
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, x, y, cell, cell, 16);
      ctx.fill();
      const value = ui.state.grid[r][c];
      if (!value) continue;
      const img = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"] img`);
      if (img && img.naturalWidth) {
        ctx.save();
        roundRect(ctx, x, y, cell, cell, 16);
        ctx.clip();
        ctx.drawImage(img, x, y, cell, cell);
        ctx.restore();
      } else {
        ctx.fillStyle = '#FCE7F3';
        roundRect(ctx, x, y, cell, cell, 16);
        ctx.fill();
        ctx.fillStyle = '#0A0A0A';
        ctx.font = '700 36px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(value), x + cell / 2, y + cell / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'hadyn-2048.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: '2048 for Hadyn',
        text: `score ${ui.state.score}`,
      });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function bindMusic() {
  const audio = $('bgm');
  const btn = $('music');
  btn.addEventListener('click', async () => {
    try {
      if (audio.paused) {
        await audio.play();
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-label', 'Pause music');
      } else {
        audio.pause();
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Play music');
      }
    } catch {
      // ponytail: file missing until they drop audio/song.mp3
    }
  });
}

function setMode(mode) {
  ui.mode = mode;
  document.querySelectorAll('.modes [data-mode]').forEach((btn) => {
    btn.setAttribute('aria-selected', String(btn.dataset.mode === mode));
  });
  ui.best = loadBest(mode);
  newGame();
}

function bindGame() {
  ui.best = loadBest(ui.mode);
  newGame();
  bindSwipe($('board'));
  bindKeys();
  bindMusic();

  document.querySelectorAll('.modes [data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode || 'classic'));
  });
  $('new-game').addEventListener('click', () => newGame());
  $('undo').addEventListener('click', () => doUndo());
  $('share').addEventListener('click', () => {
    shareCard().catch(() => {});
  });
  $('overlay-new').addEventListener('click', () => newGame());
  $('overlay-undo').addEventListener('click', () => doUndo());
}

function openGame({ greet }) {
  mountGame();
  bindGame();
  if (greet) openWelcome();
  else $('board').focus();
}

function bindModals() {
  $('lets-play').addEventListener('click', closeWelcome);
  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-close');
      if (id === 'welcome') closeWelcome();
      if (id === 'caption') closeCaption();
    });
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!$('welcome').classList.contains('hidden')) closeWelcome();
    if (!$('caption').classList.contains('hidden')) closeCaption();
  });
}

bindGate();
bindModals();
if (sessionStorage.getItem(SESSION_KEY) === '1') {
  openGame({ greet: false });
}
