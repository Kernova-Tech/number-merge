const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright'); const { join } = require('node:path'); const { tmpdir } = require('node:os');
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'chrome' });
 try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
   if (sessionStorage.getItem('challenge-seeded')) return;
   const board = Array.from({ length: 8 }, () => Array(5).fill(null));
   [64, 32, 16, 8].forEach((value, row) => board[row][2] = value);
   localStorage.setItem('number-merge:tutorial-complete', 'true');
   localStorage.setItem('number-merge:saved-run', JSON.stringify({ version: 1, board, score: 0, currentTile: 8, nextTile: 2, selectedColumn: 2, highestBlock: 128, totalXp: 0 }));
   sessionStorage.setItem('challenge-seeded', 'true');
  });
  const wallet = () => page.evaluate(() => JSON.parse(localStorage.getItem('number-merge:wallet-v1')));
  await page.goto(process.argv[3] || 'http://127.0.0.1:5174');
  await page.getByRole('button', { name: 'Rewards', exact: true }).click();
  await page.screenshot({ path: join(tmpdir(), 'merge-vault-gifts.png'), animations: 'disabled' });
  await page.getByRole('tab', { name: /Challenges/ }).click();
  assert.equal(await page.locator('.challenge-card').count(), 3);
  assert.equal(await page.locator('.challenge-collect:not(:disabled)').count(), 0);
  await page.getByRole('button', { name: 'PLAY NOW', exact: true }).click();
  await page.locator('.lane').nth(2).tap();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('number-merge:wallet-v1')).challenges?.merges === 4);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Back to home', exact: false }).click();
  await page.getByRole('button', { name: 'Rewards', exact: true }).click();
  await page.getByRole('tab', { name: /Challenges/ }).click();
  assert.equal(await page.locator('.challenge-card.is-ready').count(), 2);
  await page.screenshot({ path: join(tmpdir(), 'merge-vault-challenges.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Collect · 15 gems', exact: true }).click();
  await page.getByRole('button', { name: 'Collect · 20 gems', exact: true }).click();
  assert.equal((await wallet()).gems, 535);
  await page.reload();
  await page.getByRole('tab', { name: /Challenges/ }).click();
  assert.equal(await page.locator('.challenge-card.is-collected').count(), 2);
  assert.equal((await wallet()).challenges.merges, 4);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.screenshot({ path: join(tmpdir(), 'merge-vault-small.png'), animations: 'disabled' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => document.documentElement.dir = 'rtl');
  await page.screenshot({ path: join(tmpdir(), 'merge-vault-rtl.png'), animations: 'disabled' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('PASS: Rewards artwork, challenge tabs, real four-merge touch shot, two completed missions, 35 gems collected once, progress survives reload, small/RTL widths, no page errors.');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
