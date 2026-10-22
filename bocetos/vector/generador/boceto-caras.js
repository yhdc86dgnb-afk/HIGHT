// Saca el frente y la espalda del boceto plano de una prenda (solo el dibujo, sin textos ni llamadas), en alta.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [,, svgPath, slug, outDir] = process.argv;
  const svg = fs.readFileSync(svgPath, 'utf8').replace(/^<\?xml[^>]*>/, '');
  const hide = ['encabezado', 'llamadas', 'colores', 'leyenda', 'ficha', 'pie'].map((g) => `#${slug}-${g}`).join(',');
  const html = `<html><body style="margin:0;background:#fff"><style>${hide}{display:none!important} #${slug}-boceto > text, #${slug}-boceto text{display:none!important} svg{display:block}</style>${svg}</body></html>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1680, height: 1188 }, deviceScaleFactor: 3 });
  await p.setContent(html);
  await p.evaluate(() => { const s = document.querySelector('svg'); s.setAttribute('width', '1680'); s.setAttribute('height', '1188'); });
  for (const face of ['frente', 'espalda']) {
    const box = await p.evaluate((id) => {
      const g = document.getElementById(id);
      const r = g.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }, `${slug}-${face}`);
    const pad = 24;
    await p.screenshot({ path: path.join(outDir, face === 'frente' ? 'foto.jpg' : 'espalda.jpg'), type: 'jpeg', quality: 95, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } });
    console.log(face, JSON.stringify(box));
  }
  await b.close();
})();
