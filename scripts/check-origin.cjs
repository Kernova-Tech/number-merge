const { chromium } = require(process.argv[2]);
const { join } = require('node:path');
const { tmpdir } = require('node:os');
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'chrome' });
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
 const page = await context.newPage();
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => {
   const board = Array.from({ length: 8 }, () => Array(5).fill(null));
   board[0] = [8, 4, 16, 8, 4];
   localStorage.setItem('number-merge:tutorial-complete', 'true');
   localStorage.setItem('number-merge:saved-run', JSON.stringify({ version: 1, board, score: 0, currentTile: 2, nextTile: 4, selectedColumn: 2, highestBlock: 16, totalXp: 0 }));
 });
 await page.goto('http://127.0.0.1:5174');
 await page.waitForTimeout(3500);
 await page.getByText('PLAY NOW', { exact: true }).click();
 await page.locator('.origin-light i').waitFor();
 await page.waitForTimeout(900);
 for (const lane of [0, 1, 4]) {
   if (await page.locator('.unlock-modal .modal-link').isVisible()) await page.locator('.unlock-modal .modal-link').click();
   await page.evaluate(() => {
     window.lightSamples = [];
     const start = performance.now();
     function sample() {
       const light = document.querySelector('.origin-light i');
       const rect = light.getBoundingClientRect();
       window.lightSamples.push({ t: Math.round(performance.now() - start), opacity: Number(getComputedStyle(light).opacity), x: Math.round(rect.x + rect.width / 2), state: document.querySelector('.shooter-rail').className, flight: !!document.querySelector('.shot-flight') });
       if (performance.now() - start < 5000) requestAnimationFrame(sample);
     }
     requestAnimationFrame(sample);
   });
   await page.locator('.lane').nth(lane).tap();
   await page.waitForTimeout(190);
   await page.screenshot({ path: join(tmpdir(), `origin-flight-${lane}.png`) });
   await page.waitForTimeout(5000);
   const samples = await page.evaluate(() => window.lightSamples);
   const compact = samples.filter((s, i) => i === 0 || s.state !== samples[i - 1].state || Math.floor(s.t / 150) !== Math.floor(samples[i - 1].t / 150));
   console.log(JSON.stringify({ lane, samples: compact.filter(s => s.t < 2000 || (s.opacity > 0 && s.opacity < 1)), final: samples.at(-1) }));
   if (!samples.some(s => s.flight)) throw new Error('Shot did not launch');
   if (!samples.some(s => s.opacity < .05)) throw new Error('Origin never faded out');
   if (!samples.some(s => s.state.includes('origin-returning') && s.opacity > .05 && s.opacity < .95)) throw new Error('No gradual return');
   if (samples.at(-1).opacity < .99) throw new Error('Origin did not return');
   if (samples.some(s => Math.abs(s.x - 195) > 2)) throw new Error('Origin moved from center');
 }
 await page.screenshot({ path: join(tmpdir(), 'origin-settled.png') });
 console.log(JSON.stringify({ errors, result: 'PASS: three touch shots; fade-out, gradual centered return, and no page errors.' }));
 if (errors.length) throw new Error('Browser errors');
 await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
