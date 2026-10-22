// Saca el primer cuadro del clóset del inicio, el que se ve mientras cargan las prendas en 3D, y lo deja en el tema:
//   assets/closet-poster.webp       2592 × 1080 (2,4 × 1, lo más ancho que muestra el clóset)
//   assets/closet-poster-cel.webp   el centro, cuadrado, para el teléfono
//   snippets/closet-poster.liquid   las prendas que salen en él, en orden: si el clóset cuelga otras, no se muestra
// Las barras, las perchas y las prendas van sobre fondo transparente; el puntillado y los costados los pone el tema.
// Uso: node poster.js <dirección del inicio de la tienda> <carpeta del tema>
// (por ejemplo, con `shopify theme dev` andando: node poster.js http://127.0.0.1:9292 ../../..)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [, , url, theme] = process.argv;
const H = 1080, W = Math.round(H * 2.4);

const SNIPPET = `{%- doc -%}
  El primer cuadro del clóset (assets/closet-poster.webp y, en el teléfono, closet-poster-cel.webp), que se ve
  mientras cargan las prendas en 3D. Lo escribe bocetos/vector/generador/poster.js junto con las imágenes y solo se
  muestra si el clóset va a colgar las mismas prendas, en el mismo orden y en las mismas barras. Si cambian (se
  publica o se oculta una prenda, o cambia su nombre o su tipo), el clóset aparece cuando cargan las prendas.

  @param {string} prendas - Las prendas del clóset, "<dirección>:<barra>" separadas por espacios

  @example
  {% render 'closet-poster', prendas: closet_shown %}
{%- enddoc -%}
{%- liquid
  assign poster_prendas = 'PRENDAS'
  assign poster_actual = prendas | strip
-%}
{%- if poster_actual == poster_prendas -%}
  <picture>
    <source
      media="(max-width: 560px)"
      srcset="{{ 'closet-poster-cel.webp' | asset_url }}"
      width="${H}"
      height="${H}"
    >
    <img
      class="hi-closet-poster"
      src="{{ 'closet-poster.webp' | asset_url }}"
      alt=""
      width="${W}"
      height="${H}"
      loading="lazy"
      decoding="async"
    >
  </picture>
{%- endif -%}
`;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', (e) => console.log('error', e.message));
  await p.goto(url);

  // Las prendas tal como las cuelga la sección, y el clóset y los estilos del tema.
  const found = await p.evaluate(() => {
    const list = document.querySelector('.hi-closet-items');
    if (!list) return null;
    const config = JSON.parse(document.getElementById('HightConfig').textContent);
    return {
      items: list.innerHTML,
      css: document.querySelector('link[rel="stylesheet"][href*="hight.css"]').href,
      closet: new URL(config.closet, location.href).href,
    };
  });
  if (!found) throw new Error(`No hay clóset en ${url}`);

  // El clóset solo, del alto de la ventana, sin fondo, costados ni botón.
  await p.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="${found.css}">
<style>
  html, body { margin: 0; background: none; }
  .hi-closet-stage { height: 100vh !important; background: none !important; }
  .hi-closet-stage::before, .hi-closet-stage::after, .hi-pause-btn { display: none !important; }
</style></head><body>
<div class="hi-closet-stage" id="stage"><canvas class="hi-closet-rods"></canvas><ul class="hi-closet-items" role="list">${found.items}</ul></div>
<script type="module">
  import { mount } from ${JSON.stringify(found.closet)};
  window.closet = mount(document.getElementById('stage'));
</script></body></html>`);
  await p.waitForFunction(() => window.closet && window.closet.items.every((i) => i.group || i.failed), null, { timeout: 600000 });
  const failed = await p.evaluate(() => window.closet.items.filter((i) => i.failed).length);
  if (failed) throw new Error(`${failed} prendas no cargaron`);

  // Quieto en el cuadro inicial.
  await p.evaluate(() => {
    const c = window.closet;
    c.setPlaying(false);
    c.speed = 0;
    c.t = 0;
    c.dirty = true;
  });
  await p.waitForTimeout(1500);
  const png = (await p.screenshot({ omitBackground: true })).toString('base64');

  const webp = (x, w) =>
    p.evaluate(
      async ({ png, x, w, h }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, x, 0, w, h, 0, 0, w, h);
        return canvas.toDataURL('image/webp', 0.8).split(',')[1];
      },
      { png, x, w, h: H }
    );
  fs.writeFileSync(path.join(theme, 'assets/closet-poster.webp'), Buffer.from(await webp(0, W), 'base64'));
  fs.writeFileSync(path.join(theme, 'assets/closet-poster-cel.webp'), Buffer.from(await webp((W - H) / 2, H), 'base64'));

  const prendas = await p.evaluate(() =>
    [...document.querySelectorAll('[data-closet-item]')]
      .map((li) => `${li.dataset.model.match(/\/360-([^/]+)-armario\.json/)[1]}:${li.dataset.rail}`)
      .join(' ')
  );
  fs.writeFileSync(path.join(theme, 'snippets/closet-poster.liquid'), SNIPPET.replace('PRENDAS', prendas));
  console.log(`${prendas.split(' ').length} prendas`);
  await b.close();
})();
