import assert from 'node:assert/strict';
import {
  canMove,
  createGame,
  move,
  slideLine,
  startGame,
  undo,
} from './game.js';

function rngSeq(values) {
  let i = 0;
  return () => {
    const v = values[i];
    i += 1;
    return v === undefined ? 0 : v;
  };
}

function grid(rows) {
  return rows.map((row) => row.slice());
}

{
  const a = slideLine([2, 2, 0, 0]);
  assert.deepEqual(a.line, [4, 0, 0, 0]);
  assert.equal(a.score, 4);
  assert.equal(a.moved, true);
}

{
  const a = slideLine([2, 2, 2, 2]);
  assert.deepEqual(a.line, [4, 4, 0, 0]);
  assert.equal(a.score, 8);
}

{
  const a = slideLine([2, 4, 8, 16]);
  assert.equal(a.moved, false);
  assert.deepEqual(a.line, [2, 4, 8, 16]);
}

{
  const state = createGame(rngSeq([0, 0]));
  state.grid = grid([
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const result = move(state, 'left');
  assert.equal(result.moved, true);
  assert.equal(result.scoreGained, 4);
  assert.equal(state.score, 4);
  assert.equal(state.grid[0][0], 4);
  assert.equal(state.grid.flat().filter((v) => v === 2).length, 1);
}

{
  const state = createGame(() => 0);
  state.grid = grid([
    [2, 0, 0, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  move(state, 'right');
  assert.equal(state.grid[0][3], 4);
}

{
  const state = createGame(() => 0);
  state.grid = grid([
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [2, 0, 0, 0],
  ]);
  move(state, 'down');
  assert.equal(state.grid[3][0], 4);
}

{
  const state = createGame(() => 0);
  state.grid = grid([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [2, 0, 0, 2],
  ]);
  move(state, 'up');
  assert.equal(state.grid[0][0], 2);
  assert.equal(state.grid[0][3], 2);
}

{
  const state = createGame(() => 0);
  state.grid = grid([
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const result = move(state, 'left');
  assert.equal(result.moved, false);
  assert.equal(state.history.length, 0);
}

{
  const state = createGame(rngSeq([0, 0]));
  state.grid = grid([
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const before = grid(state.grid);
  move(state, 'left');
  assert.equal(undo(state), true);
  assert.deepEqual(state.grid, before);
  assert.equal(state.score, 0);
  assert.equal(state.over, false);
  assert.equal(undo(state), false);
}

{
  const state = createGame(() => 0);
  state.grid = grid([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 64],
  ]);
  assert.equal(canMove(state), false);
}

{
  const state = createGame(() => 0);
  state.grid = grid([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 2, 2],
  ]);
  assert.equal(canMove(state), true);
}

{
  const state = startGame(() => 0);
  const filled = state.grid.flat().filter((v) => v !== 0);
  assert.equal(filled.length, 2);
}

{
  const merged = slideLine([2, 2, 0, 0]);
  assert.equal(merged.placed[0].merged, true);
  assert.equal(merged.placed[0].value, 4);
  assert.deepEqual(merged.placed[0].from, [0, 1]);
}

{
  const state = createGame(() => 0);
  state.grid = grid([
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const result = move(state, 'left');
  const merged = result.motions.filter((motion) => motion.merged);
  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((motion) => [motion.fromC, motion.toC]),
    [
      [0, 0],
      [1, 0],
    ],
  );
}

{
  const state = createGame(() => 0);
  state.grid = grid([
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  move(state, 'left');
  assert.equal(state.won, true);
  assert.equal(state.grid[0][0], 2048);
  assert.equal(undo(state), true);
  assert.equal(state.won, false);
  assert.equal(state.grid[0][0], 1024);
}

console.log('ok');
