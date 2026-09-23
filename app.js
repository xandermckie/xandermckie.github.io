import {
  BEST_KEY,
  CAPTIONS,
  FAIL_LIMIT,
  FAIL_LOCK_MS,
  PASSWORD_SHA256,
  PASSWORD_SHA256_P2,
  PHOTO_PATH,
  SESSION_KEY,
  TIMED_SECONDS,
  WELCOME_TEXT_P1,
  WELCOME_TEXT_P2,
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
    const eyeOn = document.getElementById('eye-icon');
    const eyeOff = document.getElementById('eye-off-icon');
    if (eyeOn && eyeOff) {
      eyeOn.classList.toggle('hidden', show);
      eyeOff.classList.toggle('hidden', !show);
    }
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

    let player = 0;
    if (timingSafeEqual(digest, PASSWORD_SHA256)) {
      player = 1;
    } else if (timingSafeEqual(digest, PASSWORD_SHA256_P2)) {
      player = 2;
    }

    if (!player) {
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

    ui.player = player;
    sessionStorage.setItem(SESSION_KEY, String(player));
    openGame({ greet: true });
  });
}

function openWelcome() {
  const root = $('welcome');
  const text = ui.player === 1 ? WELCOME_TEXT_P1 : WELCOME_TEXT_P2;
  $('welcome-text').textContent = text;
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
  player: 1,
  mode: 'classic',
  state: null,
  best: 0,
  remaining: TIMED_SECONDS,
  timerId: 0,
  deadline: 0,
  tileMap: new Map(),
  nextTileId: 0,
  p1State: null,
  p2State: null,
  activePlayer: 1,
  versusScores: { p1: 0, p2: 0 },
  acknowledgedWin: false,
};

function captionFor(value) {
  return CAPTIONS[value] || `tile ${value}`;
}

function getTileId(r, c, value) {
  return `${r}-${c}-${value}-${ui.nextTileId++}`;
}

function attachPhoto(tile, value) {
  const face = tile.querySelector('.tile-face');
  if (!face) return;
  let img = tile.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.alt = '';
    face.append(img);
  }
  img.addEventListener('load', () => tile.classList.add('has-photo'), { once: true });
  img.addEventListener('error', () => img.remove(), { once: true });
  img.src = PHOTO_PATH(value);
}

function createTileElement(id, r, c, value) {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'tile';
  tile.dataset.id = id;
  tile.dataset.r = String(r);
  tile.dataset.c = String(c);
  tile.dataset.value = String(value);
  tile.style.setProperty('--r', String(r + 1));
  tile.style.setProperty('--c', String(c + 1));
  tile.setAttribute('aria-label', captionFor(value));

  const face = document.createElement('span');
  face.className = 'tile-face';

  const fallback = document.createElement('span');
  fallback.className = 'tile-fallback';
  fallback.textContent = String(value);
  face.append(fallback);
  tile.append(face);
  attachPhoto(tile, value);

  tile.addEventListener('click', () => {
    if (ignoreTileClick) {
      ignoreTileClick = false;
      return;
    }
    const current = Number(tile.dataset.value);
    openCaption(current, tile.querySelector('img'));
  });

  return tile;
}

function updateTileValue(tile, value) {
  tile.dataset.value = String(value);
  tile.setAttribute('aria-label', captionFor(value));
  tile.classList.remove('has-photo');
  const fallback = tile.querySelector('.tile-fallback');
  if (fallback) fallback.textContent = String(value);
  attachPhoto(tile, value);
}

function popTile(tile) {
  if (reducedMotion) return;
  const face = tile.querySelector('.tile-face');
  if (!face) return;
  face.classList.remove('tile-pop');
  void face.offsetWidth;
  face.classList.add('tile-pop');
}

function placeTile(tile, r, c) {
  tile.dataset.r = String(r);
  tile.dataset.c = String(c);
  tile.style.setProperty('--r', String(r + 1));
  tile.style.setProperty('--c', String(c + 1));
}

function cellStep() {
  const cells = document.querySelectorAll('.board-bg .cell');
  if (cells.length < 5) return { x: 0, y: 0 };
  const first = cells[0].getBoundingClientRect();
  const right = cells[1].getBoundingClientRect();
  const below = cells[4].getBoundingClientRect();
  return { x: right.left - first.left, y: below.top - first.top };
}

function slideTile(tile, fromR, fromC, toR, toC) {
  placeTile(tile, toR, toC);
  tile.getAnimations().forEach((animation) => animation.cancel());
  tile.style.transition = '';
  tile.style.transform = '';
  if (reducedMotion || (fromR === toR && fromC === toC)) return;
  const step = cellStep();
  const offsetX = (fromC - toC) * step.x;
  const offsetY = (fromR - toR) * step.y;
  tile.animate(
    [{ transform: `translate(${offsetX}px, ${offsetY}px)` }, { transform: 'translate(0, 0)' }],
    { duration: 200, easing: 'ease-out', fill: 'both' },
  );
}

function reindexTiles() {
  const next = new Map();
  for (const tile of $('tiles').querySelectorAll('.tile')) {
    if (tile.dataset.dropping === '1') continue;
    next.set(`${tile.dataset.r},${tile.dataset.c}`, tile);
  }
  ui.tileMap = next;
}

function paintTiles() {
  const container = $('tiles');
  container.replaceChildren();
  ui.tileMap = new Map();
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const value = ui.state.grid[r][c];
      if (!value) continue;
      const tile = createTileElement(getTileId(r, c, value), r, c, value);
      container.append(tile);
      ui.tileMap.set(`${r},${c}`, tile);
    }
  }
}

function animateMotions(motions, spawned) {
  const byDest = new Map();
  for (const motion of motions) {
    const key = `${motion.toR},${motion.toC}`;
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key).push(motion);
  }

  for (const [key, group] of byDest) {
    const [toR, toC] = key.split(',').map((part) => Number(part));
    const tiles = group.map((motion) => ui.tileMap.get(`${motion.fromR},${motion.fromC}`));
    if (group.length >= 2 && tiles[0] && tiles[1]) {
      const keep = tiles[0];
      const drop = tiles[1];
      updateTileValue(keep, group[0].value);
      drop.dataset.dropping = '1';
      drop.style.pointerEvents = 'none';
      keep.style.zIndex = '2';
      drop.style.zIndex = '1';
      slideTile(keep, group[0].fromR, group[0].fromC, toR, toC);
      slideTile(drop, group[1].fromR, group[1].fromC, toR, toC);
      popTile(keep);
      window.setTimeout(() => drop.remove(), reducedMotion ? 0 : 220);
    } else if (tiles[0]) {
      slideTile(tiles[0], group[0].fromR, group[0].fromC, toR, toC);
    }
  }

  if (spawned) {
    const tile = createTileElement(
      getTileId(spawned.r, spawned.c, spawned.value),
      spawned.r,
      spawned.c,
      spawned.value,
    );
    $('tiles').append(tile);
    popTile(tile);
  }

  reindexTiles();
}

function versusPair() {
  const p1 = ui.activePlayer === 1 ? ui.state.score : ui.versusScores.p1;
  const p2 = ui.activePlayer === 2 ? ui.state.score : ui.versusScores.p2;
  return { p1, p2 };
}

function syncScores() {
  const scoreCard = $('score-card');
  const bestCard = $('best-card');
  if (ui.mode === 'versus') {
    const { p1, p2 } = versusPair();
    $('score-label').textContent = 'p1';
    $('best-label').textContent = 'p2';
    $('score').textContent = String(p1);
    $('best').textContent = String(p2);
    scoreCard.classList.toggle('is-active', ui.activePlayer === 1);
    bestCard.classList.toggle('is-active', ui.activePlayer === 2);
  } else {
    $('score-label').textContent = 'score';
    $('best-label').textContent = 'best';
    $('score').textContent = String(ui.state.score);
    ui.best = saveBest(ui.mode, ui.state.score);
    $('best').textContent = String(ui.best);
    scoreCard.classList.remove('is-active');
    bestCard.classList.remove('is-active');
  }
  $('undo').disabled = ui.state.history.length === 0;
}

function setOverlay(show, title, copy, kind = '') {
  const overlay = $('overlay');
  overlay.classList.toggle('hidden', !show);
  overlay.dataset.kind = show ? kind : '';
  $('overlay-continue').classList.toggle('hidden', kind !== 'win');
  $('overlay-undo').classList.toggle('hidden', kind === 'win' || kind === 'versus');
  if (show) {
    $('overlay-title').textContent = title;
    $('overlay-copy').textContent = copy;
  }
}

function checkEnd() {
  if (ui.mode === 'versus') {
    if (ui.state.over) finishVersusTurn();
    else {
      setOverlay(false);
      updateTurnBanner();
    }
    return;
  }
  if (ui.mode === 'timed' && ui.remaining <= 0) {
    ui.state.over = true;
    pauseTimer();
    setOverlay(true, 'time', 'the clock ran out.', 'over');
    return;
  }
  if (ui.state.won && !ui.acknowledgedWin) {
    pauseTimer();
    setOverlay(true, '2048', CAPTIONS[2048], 'win');
    return;
  }
  if (!ui.state.over) {
    setOverlay(false);
    return;
  }
  if (ui.mode === 'zen') {
    setOverlay(true, 'paused', 'no moves left — undo and keep going.', 'over');
  } else {
    setOverlay(true, 'game over', 'beautiful run. try again?', 'over');
  }
}

function showPassDevice() {
  const modal = $('pass-device');
  const other = ui.activePlayer === 1 ? 2 : 1;
  $('pass-title').textContent = 'Pass Device';
  $('pass-text').textContent = `Hand the device to Player ${other}`;
  modal.classList.remove('hidden');
  $('pass-btn').focus();
}

function closePassDevice() {
  $('pass-device').classList.add('hidden');
}

function snapshotState() {
  return {
    grid: ui.state.grid.map((row) => row.slice()),
    score: ui.state.score,
    history: ui.state.history.map((entry) => ({
      grid: entry.grid.map((row) => row.slice()),
      score: entry.score,
    })),
    over: ui.state.over,
    won: ui.state.won,
  };
}

function saveActiveVersusSnapshot() {
  const snapshot = snapshotState();
  if (ui.activePlayer === 1) {
    ui.versusScores.p1 = ui.state.score;
    ui.p1State = snapshot;
  } else {
    ui.versusScores.p2 = ui.state.score;
    ui.p2State = snapshot;
  }
}

function restoreSnapshot(snapshot) {
  ui.state.grid = snapshot.grid.map((row) => row.slice());
  ui.state.score = snapshot.score;
  ui.state.history = snapshot.history.map((entry) => ({
    grid: entry.grid.map((row) => row.slice()),
    score: entry.score,
  }));
  ui.state.over = snapshot.over;
  ui.state.won = snapshot.won;
}

function otherPlayerIsOver() {
  const other = ui.activePlayer === 1 ? ui.p2State : ui.p1State;
  return Boolean(other?.over);
}

function showVersusResult() {
  const { p1, p2 } = versusPair();
  const winner = p1 > p2 ? 1 : p1 < p2 ? 2 : 0;
  $('score-card').classList.remove('is-active');
  $('best-card').classList.remove('is-active');
  document.getElementById('turn-banner')?.classList.add('hidden');
  if (winner === 0) {
    setOverlay(true, 'tie', `both scored ${p1}. play again?`, 'versus');
  } else {
    setOverlay(true, `player ${winner} wins`, `${p1} vs ${p2}. ready for a rematch?`, 'versus');
  }
}

function finishVersusTurn() {
  saveActiveVersusSnapshot();
  syncScores();
  if (otherPlayerIsOver()) showVersusResult();
  else showPassDevice();
}

function switchPlayer() {
  closePassDevice();
  saveActiveVersusSnapshot();
  if (ui.activePlayer === 1) {
    ui.activePlayer = 2;
    if (!ui.p2State) ui.state = startGame();
    else restoreSnapshot(ui.p2State);
  } else {
    ui.activePlayer = 1;
    restoreSnapshot(ui.p1State);
  }
  ui.acknowledgedWin = false;
  ui.nextTileId = 0;
  setOverlay(false);
  syncScores();
  paintTiles();
  updateTurnBanner();
  $('board').focus();
}

function stopTimer() {
  if (ui.timerId) window.clearInterval(ui.timerId);
  ui.timerId = 0;
}

function pauseTimer() {
  if (ui.mode !== 'timed' || !ui.timerId) return;
  ui.remaining = Math.max(0, Math.ceil((ui.deadline - Date.now()) / 1000));
  stopTimer();
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
  if (ui.mode === 'versus') {
    ui.p1State = null;
    ui.p2State = null;
    ui.activePlayer = 1;
    ui.versusScores = { p1: 0, p2: 0 };
  }
  ui.state = startGame();
  ui.acknowledgedWin = false;
  ui.remaining = TIMED_SECONDS;
  ui.tileMap.clear();
  ui.nextTileId = 0;
  setOverlay(false);
  syncScores();
  paintTiles();
  startTimer();
  updateTurnBanner();
}

function updateTurnBanner() {
  const banner = document.getElementById('turn-banner');
  if (!banner) return;
  if (ui.mode === 'versus') {
    banner.textContent = `Player ${ui.activePlayer}'s Turn`;
    banner.classList.remove('hidden');
    banner.dataset.player = String(ui.activePlayer);
  } else {
    banner.classList.add('hidden');
  }
}

function winOverlayOpen() {
  const overlay = document.getElementById('overlay');
  return Boolean(overlay && !overlay.classList.contains('hidden') && overlay.dataset.kind === 'win');
}

function continueWin() {
  ui.acknowledgedWin = true;
  setOverlay(false);
  if (ui.mode === 'timed' && ui.remaining > 0) startTimer();
  const board = document.getElementById('board');
  if (board) board.focus();
  checkEnd();
}

function applyMove(dir) {
  if (!ui.state || ui.state.over) return;
  if (winOverlayOpen()) return;
  if (ui.mode === 'timed' && ui.remaining <= 0) return;
  const result = move(ui.state, dir);
  if (!result.moved) return;
  if (ui.mode !== 'zen') ui.state.history = ui.state.history.slice(-1);
  animateMotions(result.motions, result.spawned);
  syncScores();
  checkEnd();
}

function doUndo() {
  if (!undo(ui.state)) return;
  if (!ui.state.won) ui.acknowledgedWin = false;
  if (ui.mode === 'timed' && ui.remaining <= 0) ui.remaining = 1;
  if (ui.mode === 'timed' && !ui.state.won && ui.remaining > 0) startTimer();
  syncScores();
  paintTiles();
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
    ignoreTileClick = false;
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
    Left: 'left',
    Right: 'right',
    Up: 'up',
    Down: 'down',
    KeyA: 'left',
    KeyD: 'right',
    KeyW: 'up',
    KeyS: 'down',
    a: 'left',
    d: 'right',
    w: 'up',
    s: 'down',
  };

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      const welcome = document.getElementById('welcome');
      if (welcome && !welcome.classList.contains('hidden')) return;

      const caption = document.getElementById('caption');
      if (caption && !caption.classList.contains('hidden')) {
        if (event.key === 'Escape') closeCaption();
        return;
      }

      const shareSheet = document.getElementById('share-sheet');
      if (shareSheet && !shareSheet.classList.contains('hidden')) {
        if (event.key === 'Escape') closeShare();
        return;
      }

      const dir =
        map[event.code] || map[event.key] || map[event.key.toLowerCase()];
      if (!dir) return;
      event.preventDefault();
      applyMove(dir);
    },
    true,
  );
}

function openShare() {
  const note = $('share-note');
  note.textContent = '';
  note.classList.add('hidden');
  $('share-sheet').classList.remove('hidden');
  $('share-link').focus();
}

function closeShare() {
  const sheet = document.getElementById('share-sheet');
  if (sheet) sheet.classList.add('hidden');
}

function showShareNote(message) {
  const note = $('share-note');
  note.textContent = message;
  note.classList.remove('hidden');
}

async function shareLink() {
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: '2048 for Hadyn', text: '2048 for Hadyn', url });
      closeShare();
      return;
    }
    await navigator.clipboard.writeText(url);
    showShareNote('link copied');
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    showShareNote('could not share the link');
  }
}

function drawHeart(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-16, -18);
  const heart = new Path2D(
    'M16 25s-8.5-5.2-8.5-11A4.5 4.5 0 0 1 16 11.2 4.5 4.5 0 0 1 24.5 14C24.5 19.8 16 25 16 25z',
  );
  ctx.fill(heart);
  ctx.restore();
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

function drawScoreCard() {
  const canvas = document.createElement('canvas');
  canvas.width = 840;
  canvas.height = 980;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('could not draw the score');

  ctx.fillStyle = '#FCE7F3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0A0A0A';
  for (const [x, y, scale] of [
    [150, 150, 3.4],
    [690, 190, 2.4],
    [210, 860, 2.6],
    [680, 800, 3.6],
    [420, 120, 1.8],
  ]) {
    drawHeart(ctx, x, y, scale);
  }

  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, 90, 280, 660, 460, 32);
  ctx.fill();

  ctx.fillStyle = '#0A0A0A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 52px "Playfair Display", Georgia, serif';
  ctx.fillText('2048 for Hadyn', 420, 370);

  if (ui.mode === 'versus') {
    const { p1, p2 } = versusPair();
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText('p1', 280, 460);
    ctx.fillText('p2', 560, 460);
    ctx.font = '700 96px Inter, sans-serif';
    ctx.fillText(String(p1), 280, 580);
    ctx.fillText(String(p2), 560, 580);
  } else {
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText('best', 420, 460);
    ctx.font = '700 140px Inter, sans-serif';
    ctx.fillText(String(ui.best), 420, 610);
    ctx.font = '500 32px Inter, sans-serif';
    ctx.fillText(`score ${ui.state.score}`, 420, 680);
  }

  ctx.textAlign = 'start';
  return canvas;
}

async function shareScore() {
  try {
    await document.fonts.ready;
    const canvas = drawScoreCard();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('could not draw the score');
    const file = new File([blob], 'hadyn-2048.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '2048 for Hadyn' });
      closeShare();
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    showShareNote('score card saved');
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    showShareNote('could not share the score');
  }
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
  if (mode === 'versus') {
    ui.best = 0;
  } else {
    ui.best = loadBest(mode);
  }
  newGame();
}

function bindGame() {
  ui.best = loadBest(ui.mode);
  newGame();
  bindSwipe($('board'));
  bindMusic();

  document.querySelectorAll('.modes [data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode || 'classic'));
  });
  $('new-game').addEventListener('click', () => newGame());
  $('undo').addEventListener('click', () => doUndo());
  $('share').addEventListener('click', openShare);
  $('overlay-new').addEventListener('click', () => newGame());
  $('overlay-undo').addEventListener('click', () => doUndo());
  $('overlay-continue').addEventListener('click', continueWin);
}

function openGame({ greet }) {
  mountGame();
  bindGame();
  if (greet) openWelcome();
  else $('board').focus();
}

function bindModals() {
  $('lets-play').addEventListener('click', closeWelcome);
  $('pass-btn').addEventListener('click', switchPlayer);
  $('share-link').addEventListener('click', () => {
    shareLink();
  });
  $('share-score').addEventListener('click', () => {
    shareScore();
  });
  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-close');
      if (id === 'welcome') closeWelcome();
      if (id === 'caption') closeCaption();
      if (id === 'share') closeShare();
    });
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!$('welcome').classList.contains('hidden')) closeWelcome();
    if (!$('caption').classList.contains('hidden')) closeCaption();
    if (!$('share-sheet').classList.contains('hidden')) closeShare();
  });
}

bindGate();
bindModals();
bindKeys();
const savedPlayer = sessionStorage.getItem(SESSION_KEY);
if (savedPlayer === '1' || savedPlayer === '2') {
  ui.player = parseInt(savedPlayer, 10);
  openGame({ greet: false });
}
