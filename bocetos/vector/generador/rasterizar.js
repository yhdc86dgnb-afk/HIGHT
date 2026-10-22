// Pasa los mapas del 3D (SVG) de cada prenda a PNG con el lado largo en 2048 px.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const handles = process.argv.slice(2);
  const root = path.join(process.env.HIGHT_360 || process.cwd(), 'productos');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2048, height: 2048 } });
  for (const h of handles) {
    for (const face of ['frente', 'espalda']) {
      const svgPath = path.join(root, h, `3d-${face}.svg`);
      const head = fs.readFileSync(svgPath, 'utf8').slice(0, 400);
      const w = +head.match(/width="(\d+)"/)[1], hh = +head.match(/height="(\d+)"/)[1];
      const s = 2048 / Math.max(w, hh);
      const W = Math.round(w * s), H = Math.round(hh * s);
      await p.setViewportSize({ width: W, height: H });
      const wrap = path.join(root, h, '_r.html');
      fs.writeFileSync(wrap, `<html><body style="margin:0;background:#fff"><img src="3d-${face}.svg" style="display:block;width:${W}px;height:${H}px"></body></html>`);
      await p.goto('file://' + wrap);
      await p.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
      await p.screenshot({ path: path.join(root, h, `3d-${face}.png`) });
      fs.unlinkSync(wrap);
    }
    console.log(h);
  }
  await b.close();
})();
