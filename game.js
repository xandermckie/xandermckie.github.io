export const SIZE = 4;

export function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

export function createGame(rng = Math.random) {
  return {
    grid: emptyGrid(),
    score: 0,
    won: false,
    over: false,
    history: [],
    rng,
  };
}

export function emptyCells(grid) {
  const cells = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

export function spawn(state) {
  const cells = emptyCells(state.grid);
  if (cells.length === 0) return null;
  const [r, c] = cells[Math.floor(state.rng() * cells.length)];
  const value = state.rng() < 0.9 ? 2 : 4;
  state.grid[r][c] = value;
  return { r, c, value };
}

export function startGame(rng = Math.random) {
  const state = createGame(rng);
  spawn(state);
  spawn(state);
  return state;
}

export function slideLine(line) {
  const nums = line.filter((v) => v !== 0);
  const next = [];
  let score = 0;
  let i = 0;
  while (i < nums.length) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const merged = nums[i] * 2;
      next.push(merged);
      score += merged;
      i += 2;
    } else {
      next.push(nums[i]);
      i += 1;
    }
  }
  while (next.length < SIZE) next.push(0);
  const moved = next.some((v, idx) => v !== line[idx]);
  return { line: next, score, moved };
}

function readCol(grid, c) {
  return grid.map((row) => row[c]);
}

function writeCol(grid, c, col) {
  col.forEach((v, r) => {
    grid[r][c] = v;
  });
}

export function move(state, dir) {
  if (state.over) return { moved: false, scoreGained: 0, spawned: null };

  const prev = { grid: cloneGrid(state.grid), score: state.score };
  let scoreGained = 0;
  let moved = false;

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < SIZE; r += 1) {
      const source =
        dir === 'left' ? state.grid[r].slice() : state.grid[r].slice().reverse();
      const result = slideLine(source);
      state.grid[r] = dir === 'left' ? result.line : result.line.slice().reverse();
      scoreGained += result.score;
      if (result.moved) moved = true;
    }
  } else {
    for (let c = 0; c < SIZE; c += 1) {
      const col = readCol(state.grid, c);
      const source = dir === 'up' ? col : col.slice().reverse();
      const result = slideLine(source);
      const written = dir === 'up' ? result.line : result.line.slice().reverse();
      writeCol(state.grid, c, written);
      scoreGained += result.score;
      if (result.moved) moved = true;
    }
  }

  if (!moved) return { moved: false, scoreGained: 0, spawned: null };

  state.history.push(prev);
  if (state.history.length > 50) state.history.shift();
  state.score += scoreGained;
  if (state.grid.flat().includes(2048)) state.won = true;
  const spawned = spawn(state);
  state.over = !canMove(state);
  return { moved: true, scoreGained, spawned };
}

export function canMove(state) {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const v = state.grid[r][c];
      if (v === 0) return true;
      if (c + 1 < SIZE && v === state.grid[r][c + 1]) return true;
      if (r + 1 < SIZE && v === state.grid[r + 1][c]) return true;
    }
  }
  return false;
}

export function undo(state) {
  const prev = state.history.pop();
  if (!prev) return false;
  state.grid = prev.grid;
  state.score = prev.score;
  state.over = false;
  return true;
}
