// Genera los bocetos: node build.js <data.json> <outDir> <previewDir> [handle...]
// Ejemplo, desde la raíz del repo: node bocetos/generador/build.js bocetos/generador/data.json bocetos /tmp/bocetos-png
// outDir recibe un SVG por prenda y el PDF con todas; previewDir, un PNG por prenda para revisar.
const { chromium } = require(process.env.PW_PATH || 'playwright');
const fs = require('fs');
const path = require('path');

const [dataPath, outDir, previewDir, ...only] = process.argv.slice(2);
const HERE = __dirname;
const ASSETS = path.join(HERE, '..', '..', 'assets');

const font = (file) => 'data:font/woff2;base64,' + fs.readFileSync(file.includes('/') ? path.join(HERE, file) : path.join(ASSETS, file)).toString('base64');
const FONT_CSS = `
@font-face { font-family: 'Anton'; src: url(${font('anton-latin.woff2')}) format('woff2'); font-weight: 400; }
@font-face { font-family: 'Space Grotesk'; src: url(${font('fonts/space-grotesk-400.woff2')}) format('woff2'); font-weight: 400; }
@font-face { font-family: 'Space Grotesk'; src: url(${font('fonts/space-grotesk-500.woff2')}) format('woff2'); font-weight: 500; }
@font-face { font-family: 'Space Grotesk'; src: url(${font('fonts/space-grotesk-700.woff2')}) format('woff2'); font-weight: 700; }
@font-face { font-family: 'Space Mono'; src: url(${font('space-mono-400-latin.woff2')}) format('woff2'); font-weight: 400; }
@font-face { font-family: 'Space Mono'; src: url(${font('space-mono-700-latin.woff2')}) format('woff2'); font-weight: 700; }
html, body { margin: 0; padding: 0; background: #fff; }
`;

(async () => {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1680, height: 1188 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}</style></head><body><p style="font-family:Anton">a</p><p style="font-family:'Space Grotesk'">a</p><p style="font-family:'Space Mono'">a<b>b</b></p></body></html>`);
  for (const f of ['kit.js', 'tpl.js', 'specs.js', 'sheet.js']) await page.addScriptTag({ path: path.join(HERE, f) });
  await page.evaluate(async () => {
    await Promise.all(['28px Anton', '15px "Space Grotesk"', '500 15px "Space Grotesk"', '12px "Space Mono"', '700 12px "Space Mono"'].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  });

  const order = data.slice().sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : a.id - b.id));
  const files = [];
  const report = [];
  for (const [i, d] of order.entries()) {
    if (only.length && !only.includes(d.handle)) continue;
    const name = `${String(i + 1).padStart(2, '0')}-${d.handle}`;
    let res;
    try {
      res = await page.evaluate((dd) => window.buildSheet(dd), d);
    } catch (e) {
      errors.push(`${d.handle}: ${e.message}`);
      continue;
    }
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` + res.svg + '\n';
    fs.writeFileSync(path.join(outDir, name + '.svg'), svg);
    files.push({ name, svg: res.svg, title: d.title });
    report.push(`${name}: ficha ${res.infoSize}px (hasta y=${Math.round(res.infoBottom)}), leyenda hasta y=${Math.round(res.legendBottom)}, ${Math.round(svg.length / 1024)} KB`);
  }

  // Vista previa PNG de cada hoja, con las fuentes del tema.
  const view = await browser.newPage({ viewport: { width: 1680, height: 1188 } });
  view.on('pageerror', (e) => errors.push('preview: ' + e.message));
  for (const f of files) {
    await view.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS} svg{display:block;width:1680px;height:1188px}</style></head><body>${f.svg}</body></html>`);
    await view.evaluate(() => document.fonts.ready);
    await view.screenshot({ path: path.join(previewDir, f.name + '.png') });
  }

  // PDF con todas las hojas (A3 horizontal), si se generaron todas.
  if (!only.length) {
    const pdfPage = await browser.newPage();
    const pages = files.map((f) => `<div class="hoja">${f.svg}</div>`).join('');
    await pdfPage.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>Bocetos HIGHT</title><style>${FONT_CSS} @page { size: 420mm 297mm; margin: 0 } .hoja { width: 420mm; height: 297mm; page-break-after: always; overflow: hidden } .hoja:last-child { page-break-after: auto } .hoja svg { width: 420mm; height: 297mm; display: block }</style></head><body>${pages}</body></html>`);
    await pdfPage.evaluate(() => document.fonts.ready);
    await pdfPage.pdf({ path: path.join(outDir, 'hight-bocetos.pdf'), width: '420mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
  }

  await browser.close();
  console.log(report.join('\n'));
  if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
})();
