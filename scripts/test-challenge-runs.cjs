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
  getChallengeRunOutcome,
  readChallengeRunRecord,
  recordChallengeRun,
} = require('../src/game/challengeRuns.ts');

const sprintWin = { shots: 24, highestTile: 256, longestCascade: 2 };
assert.equal(getChallengeRunOutcome('milestone-sprint', sprintWin), 'won', 'a reached target wins on the final allowed shot');
assert.equal(getChallengeRunOutcome('milestone-sprint', { ...sprintWin, highestTile: 128 }), 'failed', 'the sprint fails once its shot limit is reached');
assert.equal(getChallengeRunOutcome('milestone-sprint', { ...sprintWin, highestTile: 128 }, true), 'failed', 'a full board ends an incomplete run');
assert.equal(getChallengeRunOutcome('milestone-sprint', sprintWin, true), 'won', 'a completed objective takes precedence over a full board');
assert.equal(getChallengeRunOutcome('cascade-hunt', { shots: 4, highestTile: 32, longestCascade: 4 }), 'won');
assert.equal(getChallengeRunOutcome('cascade-hunt', { shots: 20, highestTile: 64, longestCascade: 3 }), 'failed');
assert.equal(getChallengeRunOutcome('clean-merge', { shots: 39, highestTile: 512, longestCascade: 2 }), 'won');
assert.equal(getChallengeRunOutcome('clean-merge', { shots: 40, highestTile: 256, longestCascade: 2 }), 'failed');

const first = recordChallengeRun('milestone-sprint', sprintWin, 512, 'won');
assert.deepEqual(first, { attempts: 1, wins: 1, bestScore: 512, bestHighestTile: 256, bestCascade: 2, fewestShotsToWin: 24 });
const second = recordChallengeRun('milestone-sprint', { shots: 19, highestTile: 128, longestCascade: 3 }, 300, 'failed');
assert.equal(second.attempts, 2);
assert.equal(second.wins, 1);
assert.equal(second.bestScore, 512);
assert.equal(second.bestCascade, 3);
assert.equal(second.fewestShotsToWin, 24);
assert.deepEqual(readChallengeRunRecord('milestone-sprint'), second, 'personal records round-trip locally');

console.log('Challenge Run checks passed');
