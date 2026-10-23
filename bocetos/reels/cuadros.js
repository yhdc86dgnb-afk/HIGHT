// Dibuja los cuadros de un reel y los guarda como PNG en cuadros-<reel>/. Uso: node cuadros.js <dirección de reels.html> <reel> [desde] [hasta]
const { chromium } = require('playwright');
const fs = require('fs');
const [, , base, reel, from, to] = process.argv;
(async () => {
  const dir = `cuadros-${reel}`;
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => console.log('error', e.message));
  await page.goto(`${base}?r=${reel}`);
  await page.waitForFunction(() => window.ready || window.failed, null, { timeout: 600000 });
  const failed = await page.evaluate(() => window.failed);
  if (failed) throw new Error(failed);
  const frames = await page.evaluate(() => window.FRAMES);
  const t0 = Date.now();
  for (let f = Number(from || 0); f < Number(to || frames); f++) {
    const name = `${dir}/${String(f).padStart(4, '0')}.png`;
    if (fs.existsSync(name)) continue;
    const url = await page.evaluate((f) => window.frame(f), f);
    fs.writeFileSync(name + '.tmp', Buffer.from(url.split(',')[1], 'base64'));
    fs.renameSync(name + '.tmp', name);
  }
  console.log(`${reel}: ${frames} cuadros en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await browser.close();
})();
