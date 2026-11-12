const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const values = new Map();
global.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};

const {
  createDailySeedOpening,
  getDailySeed,
  getDailySeedDay,
  loadDailySeedRun,
  nextSeededRandom,
  readDailySeedRecord,
  recordDailySeedProgress,
  saveDailySeedRun,
} = require('../src/game/dailySeed.ts');

const today = '2026-11-12';
assert.equal(getDailySeedDay(Date.UTC(2026, 10, 12, 23, 59)), today, 'daily rollover uses UTC');
assert.equal(getDailySeedDay(Date.UTC(2026, 10, 13, 0, 0)), '2026-11-13');
assert.notEqual(getDailySeed(today), getDailySeed('2026-11-13'), 'different days receive distinct seeds');

const openingA = createDailySeedOpening(today);
const openingB = createDailySeedOpening(today);
assert.deepEqual(openingA, openingB, 'opening board and shooter queue are deterministic for the same day');
const nextA = nextSeededRandom(openingA.randomState);
const nextB = nextSeededRandom(openingB.randomState);
assert.deepEqual(nextA, nextB, 'subsequent seeded random values resume deterministically');
assert.notDeepEqual(openingA.board, createDailySeedOpening('2026-11-13').board, 'different days normally use a different opening');

const classicRun = { score: 123, board: 'classic' };
values.set('number-merge:saved-run', JSON.stringify(classicRun));
const run = {
  version: 1,
  day: today,
  ...openingA,
  score: 48,
  selectedColumn: 2,
  longestChain: 3,
  bestScoreAtStart: 20,
};
saveDailySeedRun(run);
assert.deepEqual(loadDailySeedRun(today), run, 'valid in-progress daily run round-trips');
assert.equal(loadDailySeedRun('2026-11-13'), null, 'a prior day run cannot resume on a new seed day');
assert.deepEqual(JSON.parse(values.get('number-merge:saved-run')), classicRun, 'daily storage never overwrites the Classic run');

values.set('number-merge:daily-seed-run-v1', JSON.stringify({ ...run, currentTile: 3 }));
assert.equal(loadDailySeedRun(today), null, 'invalid saved tile values are rejected');
saveDailySeedRun(null);

assert.deepEqual(readDailySeedRecord(today), { day: today, bestScore: 0, longestChain: 0 });
assert.deepEqual(recordDailySeedProgress(today, 48, 3), { day: today, bestScore: 48, longestChain: 3 });
assert.deepEqual(recordDailySeedProgress(today, 40, 2), { day: today, bestScore: 48, longestChain: 3 }, 'personal records never decrease');
assert.deepEqual(recordDailySeedProgress('2026-11-13', 10, 1), { day: '2026-11-13', bestScore: 10, longestChain: 1 });
assert.deepEqual(readDailySeedRecord(today), { day: today, bestScore: 48, longestChain: 3 });

console.log('Daily Seed checks passed');
