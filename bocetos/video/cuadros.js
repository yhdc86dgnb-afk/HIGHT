// Dibuja los cuadros [desde, hasta) de la escena y los guarda como PNG en cuadros/ (en la carpeta desde donde se corre).
// Uso: node cuadros.js "<dirección de escena.html con sus parámetros>" <desde> <hasta>
const { chromium } = require('playwright');
const fs = require('fs');
const [, , url, from, to] = process.argv;
(async () => {
  fs.mkdirSync('cuadros', { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.log('error', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.ready || window.failed, null, { timeout: 600000 });
  const t0 = Date.now();
  for (let f = Number(from); f < Number(to); f++) {
    const name = `cuadros/${String(f).padStart(4, '0')}.png`;
    if (fs.existsSync(name)) continue;
    const url = await page.evaluate((f) => window.frame(f), f);
    fs.writeFileSync(name + '.tmp', Buffer.from(url.split(',')[1], 'base64'));
    fs.renameSync(name + '.tmp', name);
  }
  console.log(`cuadros ${from}-${to} en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await browser.close();
})();
