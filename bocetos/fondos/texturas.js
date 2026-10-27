// Saca las texturas de las seis colecciones tal como las dibuja la tienda (las clases .hi-tx--<colección> de
// assets/hight.css), a un tamaño dado y con el dibujo agrandado `escala` veces, como PNG en la carpeta de salida.
// Uso: node texturas.js <carpeta de salida> <ancho> <alto> <escala> [colecciones separadas por coma]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COLECCIONES = ['acido', 'carmin', 'indigo', 'magenta', 'ceniza', 'leopardo'];

(async () => {
  const [, , salida, ancho, alto, escala, lista] = process.argv;
  const k = Number(escala);
  const w = Math.round(Number(ancho) / k);
  const h = Math.round(Number(alto) / k);
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'hight.css'), 'utf8');
  const reglas = css.slice(css.indexOf('.hi-tx--acido {'), css.indexOf('/* Prendas del turno'));
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0}.caja{position:relative;width:${w}px;height:${h}px;overflow:hidden}.hi-tx{position:absolute;inset:0}${reglas}</style><div class="caja"><div class="hi-tx"></div></div>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: k });
  await p.setContent(html);
  for (const c of lista ? lista.split(',') : COLECCIONES) {
    await p.evaluate((c) => (document.querySelector('.hi-tx').className = 'hi-tx hi-tx--' + c), c);
    await p.locator('.caja').screenshot({ path: path.join(salida, `${c}-${ancho}x${alto}.png`) });
  }
  await b.close();
})();
