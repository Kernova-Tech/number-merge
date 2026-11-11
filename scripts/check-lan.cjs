const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'chrome' });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[3]);
  await page.waitForTimeout(2000);
  await page.getByText('PLAY NOW', { exact: true }).click();
  await page.locator('.board').waitFor();
  await page.locator('.lane').nth(2).tap();
  await page.waitForTimeout(1200);
  console.log(JSON.stringify({ url: page.url(), environment: await page.evaluate(() => ({ secure: window.isSecureContext, randomUUID: typeof globalThis.crypto?.randomUUID })), errors, body: (await page.locator('body').innerText()).slice(0, 200) }));
  if (errors.length) process.exitCode = 1;
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
