// Run the pure TypeScript rules without adding a test runtime dependency.
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { createEmptyBoard, resolveMerges, hasPossibleMerge, removeRetiredTiles, shootTile } = require('../src/game/gameLogic.ts');
const { loadRun } = require('../src/game/savedRun.ts');
let stored = null;
global.localStorage = { getItem: () => stored };
const board = createEmptyBoard();
board[0][0] = 32; board[1][0] = 16; board[2][0] = 8; board[3][0] = 8;
const chain = resolveMerges(board, { row: 3, col: 0 });
assert.equal(chain.board[0][0], 64);
assert.equal(chain.scoreGained, 112);
assert.equal(hasPossibleMerge(chain.board), false);
assert.equal(board[0][0], 32, 'input remains unchanged');
const unrelated = createEmptyBoard();
unrelated[0][0] = 2; unrelated[0][3] = 8; unrelated[0][4] = 8;
assert.equal(resolveMerges(unrelated, { row: 0, col: 0 }).merges.length, 1);
const diagonal = createEmptyBoard();
diagonal[0][0] = 8; diagonal[0][1] = 4; diagonal[1][1] = 8;
assert.equal(resolveMerges(diagonal, { row: 0, col: 0 }).merges.length, 0);
const retirement = createEmptyBoard();
retirement[0][0] = 2; retirement[1][0] = 8; retirement[0][1] = 8;
assert.equal(resolveMerges(retirement, { row: 0, col: 0 }, 512).board[0][0], 16);
assert.equal(removeRetiredTiles(retirement, 512).flat().includes(2), false);
const milestone = createEmptyBoard();
milestone[0][0] = 256; milestone[0][1] = 2;
const shot = shootTile(milestone, 0, 256, 256);
assert.equal(shot.board.flat().includes(2), false);
assert.equal(shot.scoreGained, 512);
stored = JSON.stringify({ version: 1, board: chain.board, score: 112, currentTile: 4, nextTile: 8, selectedColumn: 2, highestBlock: 64, totalXp: 50 });
assert.equal(loadRun().score, 112);
stored = '{broken'; assert.equal(loadRun(), null);
stored = JSON.stringify({ version: 1, board: [[3]] }); assert.equal(loadRun(), null);
for (let trial = 0; trial < 200; trial += 1) {
  const randomBoard = createEmptyBoard();
  for (let col = 0; col < randomBoard[0].length; col += 1) {
    for (let row = 0; row < 4; row += 1) randomBoard[row][col] = 2 ** (1 + Math.floor(Math.random() * 6));
  }
  const result = resolveMerges(randomBoard, { row: 0, col: 0 }, 512);
  assert.equal(hasPossibleMerge(result.board), false, 'whole board settles');
  assert.equal(result.board.flat().includes(2), false, 'retired tiles stay removed');
  assert.equal(result.scoreGained, result.merges.reduce((sum, merge) => sum + merge.value, 0));
  assert.deepEqual(result, resolveMerges(randomBoard, { row: 0, col: 0 }, 512), 'resolution is deterministic');
}
console.log('Passed: chain merges, unrelated pairs, diagonals, retirement, collision retirement, input immutability, saved-run validation.');
