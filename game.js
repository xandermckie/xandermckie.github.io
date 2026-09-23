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
  const entries = [];
  line.forEach((value, index) => {
    if (value !== 0) entries.push({ value, from: index });
  });

  const placed = [];
  let score = 0;
  let i = 0;
  while (i < entries.length) {
    if (i + 1 < entries.length && entries[i].value === entries[i + 1].value) {
      const merged = entries[i].value * 2;
      placed.push({
        value: merged,
        from: [entries[i].from, entries[i + 1].from],
        merged: true,
      });
      score += merged;
      i += 2;
    } else {
      placed.push({
        value: entries[i].value,
        from: [entries[i].from],
        merged: false,
      });
      i += 1;
    }
  }
  while (placed.length < SIZE) placed.push({ value: 0, from: [], merged: false });

  const next = placed.map((cell) => cell.value);
  const moved = next.some((value, idx) => value !== line[idx]);
  return { line: next, score, moved, placed };
}

function readCol(grid, c) {
  return grid.map((row) => row[c]);
}

function writeCol(grid, c, col) {
  col.forEach((v, r) => {
    grid[r][c] = v;
  });
}

function axisIndex(dir, index) {
  if (dir === 'left' || dir === 'up') return index;
  return SIZE - 1 - index;
}

function motionsFromLine(dir, fixed, result) {
  const motions = [];
  if (!result.moved) return motions;
  const horizontal = dir === 'left' || dir === 'right';
  result.placed.forEach((cell, toIndex) => {
    if (!cell.value) return;
    const toAxis = axisIndex(dir, toIndex);
    cell.from.forEach((fromIndex) => {
      const fromAxis = axisIndex(dir, fromIndex);
      motions.push({
        fromR: horizontal ? fixed : fromAxis,
        fromC: horizontal ? fromAxis : fixed,
        toR: horizontal ? fixed : toAxis,
        toC: horizontal ? toAxis : fixed,
        value: cell.value,
        merged: cell.merged,
      });
    });
  });
  return motions;
}

export function move(state, dir) {
  if (state.over) return { moved: false, scoreGained: 0, spawned: null, motions: [] };

  const prev = { grid: cloneGrid(state.grid), score: state.score };
  let scoreGained = 0;
  let moved = false;
  const motions = [];

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < SIZE; r += 1) {
      const source =
        dir === 'left' ? state.grid[r].slice() : state.grid[r].slice().reverse();
      const result = slideLine(source);
      state.grid[r] = dir === 'left' ? result.line : result.line.slice().reverse();
      scoreGained += result.score;
      if (result.moved) moved = true;
      motions.push(...motionsFromLine(dir, r, result));
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
      motions.push(...motionsFromLine(dir, c, result));
    }
  }

  if (!moved) return { moved: false, scoreGained: 0, spawned: null, motions: [] };

  state.history.push(prev);
  if (state.history.length > 50) state.history.shift();
  state.score += scoreGained;
  if (state.grid.flat().includes(2048)) state.won = true;
  const spawned = spawn(state);
  state.over = !canMove(state);
  return { moved: true, scoreGained, spawned, motions };
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
  state.won = state.grid.flat().includes(2048);
  return true;
}
