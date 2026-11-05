// Saca cada post de posts.html como JPG de 1080 × 1350 en posts/ (lo llama posts.py, que sirve el repo).
// Uso: node render.js <dirección de posts.html> [números de post, como 03 07]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const [url, ...numeros] = process.argv.slice(2);
  const out = path.join(__dirname, 'posts');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1160, height: 1400 }, deviceScaleFactor: 1 });
  const errores = [];
  page.on('requestfailed', (r) => errores.push(r.url()));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.waitForTimeout(400);
  if (errores.length) throw new Error('No cargaron: ' + errores.join(', '));
  const ids = numeros.length ? numeros.map((n) => 'p' + n) : await page.$$eval('.post', (els) => els.map((e) => e.id));
  for (const id of ids) {
    const el = page.locator('#' + id);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: path.join(out, id.replace('p', '') + '.jpg'), type: 'jpeg', quality: 92 });
  }
  console.log(ids.length, 'posts');
  await browser.close();
})();
