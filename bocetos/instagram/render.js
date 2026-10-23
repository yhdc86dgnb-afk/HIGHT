// Saca cada post de posts.html como JPG de 1080 × 1350 en posts/. Uso: node render.js <dirección de posts.html>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const url = process.argv[2];
  const out = path.join(__dirname, 'posts');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1160, height: 1400 }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const ids = await page.$$eval('.post', (els) => els.map((e) => e.id));
  for (const id of ids) {
    const el = page.locator('#' + id);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: path.join(out, id.replace('p', '') + '.jpg'), type: 'jpeg', quality: 92 });
  }
  console.log(ids.length, 'posts');
  await browser.close();
})();
