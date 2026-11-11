const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const native of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ native }) => {
        if (!sessionStorage.getItem('seeded')) {
          const board = Array.from({ length: 8 }, () => Array(5).fill(null)); board[0][0] = 32;
          localStorage.setItem('number-merge:tutorial-complete', 'true');
          localStorage.setItem('number-merge:boosters', JSON.stringify({ hammer: 0, swap: 0, undo: 0 }));
          localStorage.setItem('number-merge:saved-run', JSON.stringify({ version: 1, board, score: 0, currentTile: 2, nextTile: 4, selectedColumn: 2, highestBlock: 32, totalXp: 0, rewardModal: 'unlock', modalTile: 32 }));
          sessionStorage.setItem('seeded', 'true');
        }
        window.nativeRequests = [];
        if (native) setTimeout(() => { window.GameHost = { postMessage(message) {
          const request = JSON.parse(message);
          window.nativeRequests.push(request);
          if (request.type === 'rewarded.ready') window.NumberMergeHost?.receive({ version: 1, type: 'rewarded.capabilities', enabled: true, bridgeToken: 'test-page-token', placements: ['milestone_double', 'booster_refill', 'daily_double'] });
        } }; }, 1200);
      }, { native });
      await page.goto(process.argv[3] || 'http://127.0.0.1:5174');
      await page.getByText('PLAY NOW', { exact: true }).click();
      const wallet = () => page.evaluate(() => JSON.parse(localStorage.getItem('number-merge:wallet-v1')));
      const reply = status => page.evaluate(status => {
        const request = JSON.parse(localStorage.getItem('number-merge:pending-ad'));
        window.lastAdRequest = request;
        window.NumberMergeHost.receive({ requestId: request.requestId, status });
      }, status);
      if (!native) {
        assert(await page.getByRole('button', { name: /Collect ×2 · 20 gems/ }).isDisabled());
        await page.getByRole('button', { name: 'Collect · 10 gems', exact: true }).click();
        await page.waitForTimeout(150);
        assert.equal((await wallet()).gems, 510);
      } else {
        await page.getByRole('button', { name: /Collect ×2 · 20 gems/ }).click();
        assert.equal(await page.evaluate(() => window.nativeRequests.find(request => request.type === 'rewarded.request').bridgeToken), 'test-page-token', 'late-injected host completes handshake and receives nonce');
        assert.equal((await wallet()).gems, 500, 'click alone does not grant');
        await reply('cancelled');
        assert.equal((await wallet()).gems, 500, 'cancel grants nothing');
        await page.getByRole('button', { name: /Collect ×2 · 20 gems/ }).click();
        await page.reload();
        await page.getByText('PLAY NOW', { exact: true }).click();
        await page.locator('.game-screen').waitFor();
        assert.equal((await wallet()).gems, 500);
        await reply('earned');
        await page.waitForTimeout(150);
        assert.equal((await wallet()).gems, 520, 'earned grants base and bonus');
        await page.evaluate(() => window.NumberMergeHost.receive({ requestId: window.lastAdRequest.requestId, status: 'earned' }));
        assert.equal((await wallet()).gems, 520, 'duplicate earns nothing extra');
      }
      await page.getByRole('button', { name: 'Refill Smash', exact: true }).click();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.shot-flight').count(), 0, 'refill modal locks keyboard shots');
      await page.getByRole('button', { name: 'Buy 1 · 50 gems', exact: true }).click();
      await page.waitForTimeout(150);
      assert.equal((await wallet()).boosters.hammer, 1);
      assert.equal((await wallet()).gems, native ? 470 : 460);
      if (native) {
        await page.getByRole('button', { name: 'Refill Swap', exact: true }).click();
        await page.getByRole('button', { name: /Collect · 1 booster/ }).click();
        assert.equal((await wallet()).boosters.swap, 0);
        await reply('failed');
        assert.equal((await wallet()).boosters.swap, 0);
        await page.getByRole('button', { name: /Collect · 1 booster/ }).click();
        await reply('earned');
        await page.waitForTimeout(150);
        assert.equal((await wallet()).boosters.swap, 1);
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.getByRole('button', { name: 'Refill Undo', exact: true }).click();
        await page.getByRole('button', { name: /Collect · 1 booster/ }).click();
        await page.evaluate(() => {
          const pending = JSON.parse(localStorage.getItem('number-merge:pending-ad'));
          window.lateRequestId = pending.requestId;
          pending.createdAt = Date.now() - 91000;
          localStorage.setItem('number-merge:pending-ad', JSON.stringify(pending));
        });
        await page.waitForTimeout(1300);
        assert(await page.getByRole('button', { name: 'Cancel', exact: true }).isEnabled());
        await page.evaluate(() => window.NumberMergeHost.receive({ requestId: window.lateRequestId, status: 'earned' }));
        await page.waitForTimeout(150);
        assert.equal((await wallet()).boosters.undo, 1, 'late earned result survives timeout');
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      await page.screenshot({ path: join(tmpdir(), `merge-rewards-${native ? 'native' : 'browser'}.png`) });
      assert.deepEqual(errors, []);
      console.log(`PASS ${native ? 'native simulation: cancelled, earned, duplicate, pending reload, failed/refilled booster' : 'browser fallback: base claim and gem purchase'}; SVG icons; keyboard lock; no page errors.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
