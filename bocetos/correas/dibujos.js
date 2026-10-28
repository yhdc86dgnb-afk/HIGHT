// Pasa cada correa-XX.svg a PNG con el fondo transparente, `escala` veces más grande.
// Uso: node dibujos.js <carpeta de salida> <escala>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [, , salida, escala] = process.argv;
  const k = Number(escala);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2412, height: 170 }, deviceScaleFactor: k });
  for (let i = 1; i <= 12; i++) {
    const n = String(i).padStart(2, '0');
    const svg = fs.readFileSync(path.join(__dirname, `correa-${n}.svg`), 'utf8');
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
    await p.locator('svg').screenshot({ path: path.join(salida, `correa-${n}.png`), omitBackground: true });
  }
  await b.close();
})();
