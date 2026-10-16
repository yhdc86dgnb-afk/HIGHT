// Herramientas de dibujo para los bocetos planos: trazos, siluetas base y motivos.
// Corre en el navegador (Playwright) y deja todo en window.HK.
(function () {
  const INK = '#0d0c0b';
  const MUTED = '#6b665e';
  const METAL = '#b9b6ae';

  /* ---------- utilidades ---------- */
  const r1 = (v) => String(Math.round(v * 10) / 10);
  const P = (p) => r1(p[0]) + ' ' + r1(p[1]);
  const escAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function attrs(o) {
    return Object.entries(o)
      .filter(([, v]) => v !== undefined && v !== null && v !== false)
      .map(([k, v]) => `${k}="${escAttr(v)}"`)
      .join(' ');
  }
  function tag(name, o, inner) {
    return inner === undefined ? `<${name} ${attrs(o)}/>` : `<${name} ${attrs(o)}>${inner}</${name}>`;
  }
  const g = (o, inner) => tag('g', o, inner);
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (const c of s) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  }
  function rgbToHex(c) {
    return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  function lum(hex) {
    const [r, gg, b] = hexToRgb(hex);
    return (r * 299 + gg * 587 + b * 114) / 1000;
  }
  // Color de costuras que se ve sobre la tela.
  const seamOn = (fill) => (lum(fill) < 95 ? '#e9e3d6' : INK);

  /* ---------- trazos ---------- */
  function poly(pts, close) {
    return 'M' + pts.map(P).join(' L') + (close ? ' Z' : '');
  }
  // Curva suave que pasa por los puntos (Catmull-Rom → Bézier).
  function smooth(pts, close) {
    const n = pts.length;
    if (n < 3) return poly(pts, close);
    const get = (i) => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    let d = 'M' + P(pts[0]);
    const last = close ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1);
      const p1 = get(i);
      const p2 = get(i + 1);
      const p3 = get(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ' C' + P(c1) + ' ' + P(c2) + ' ' + P(p2);
    }
    return d + (close ? ' Z' : '');
  }
  const path = (d, o = {}) => tag('path', { d, fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...o });
  const stitch = (d, color = INK, w = 1.1) => path(d, { stroke: color, 'stroke-width': w, 'stroke-dasharray': '5 3.5' });
  const circle = (cx, cy, r, o = {}) => tag('circle', { cx: r1(cx), cy: r1(cy), r: r1(r), fill: 'none', stroke: INK, 'stroke-width': 1.4, ...o });
  const ellipse = (cx, cy, rx, ry, o = {}) => tag('ellipse', { cx: r1(cx), cy: r1(cy), rx: r1(rx), ry: r1(ry), fill: 'none', stroke: INK, 'stroke-width': 1.4, ...o });
  const rect = (x, y, w, h, o = {}) => tag('rect', { x: r1(x), y: r1(y), width: r1(w), height: r1(h), fill: 'none', stroke: INK, 'stroke-width': 1.4, ...o });
  const text = (x, y, s, o = {}) => tag('text', { x: r1(x), y: r1(y), 'font-family': 'Space Mono', 'font-size': 12, fill: INK, ...o }, esc(s));

  function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function polyLen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }
  // Puntos cada `step` a lo largo de una polilínea, con su dirección.
  function walk(pts, step) {
    const out = [];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!L) continue;
      const dir = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      let s = carry;
      while (s <= L) {
        out.push({ p: [a[0] + dir[0] * s, a[1] + dir[1] * s], dir });
        s += step;
      }
      carry = s - L;
    }
    return out;
  }
  function zigzag(pts, amp = 4, step = 7, o = {}) {
    const ws = walk(pts, step);
    const zz = ws.map((w, i) => {
      const nx = -w.dir[1];
      const ny = w.dir[0];
      const s = i % 2 ? amp : -amp;
      return [w.p[0] + nx * s, w.p[1] + ny * s];
    });
    return path(poly(zz), { 'stroke-width': 1.3, ...o });
  }
  function fringe(pts, len = 9, step = 4.5, o = {}, rnd = Math.random, side = 1) {
    let d = '';
    for (const w of walk(pts, step)) {
      const nx = -w.dir[1] * side;
      const ny = w.dir[0] * side;
      const l = len * (0.55 + rnd() * 0.7);
      const wob = (rnd() - 0.5) * 3;
      d += `M${P(w.p)} L${P([w.p[0] + nx * l + wob, w.p[1] + ny * l])} `;
    }
    return path(d, { 'stroke-width': 1, ...o });
  }
  function ticks(pts, len = 6, step = 6, o = {}) {
    let d = '';
    for (const w of walk(pts, step)) {
      const nx = -w.dir[1];
      const ny = w.dir[0];
      d += `M${P([w.p[0] - nx * len / 2, w.p[1] - ny * len / 2])} L${P([w.p[0] + nx * len / 2, w.p[1] + ny * len / 2])} `;
    }
    return path(d, { 'stroke-width': 1, ...o });
  }
  // Punto de manta: línea con dientes hacia un lado.
  function blanket(pts, len = 8, step = 8, o = {}) {
    let d = poly(pts) + ' ';
    for (const w of walk(pts, step)) {
      const nx = -w.dir[1];
      const ny = w.dir[0];
      d += `M${P(w.p)} L${P([w.p[0] + nx * len, w.p[1] + ny * len])} `;
    }
    return path(d, { 'stroke-width': 1.3, ...o });
  }
  function blob(cx, cy, r, rnd, irr = 0.35, n = 9, ry) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + (rnd() - 0.5) * 2 * irr;
      pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * (ry || r) * k]);
    }
    return smooth(pts, true);
  }
  function inset(pts, t) {
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    return pts.map((p) => lerp(p, c, t));
  }

  /* ---------- herrajes y piezas pequeñas ---------- */
  const rivet = (x, y, r = 3.2) => circle(x, y, r, { fill: METAL, 'stroke-width': 1 });
  const stud = (x, y, r = 3.4) => circle(x, y, r, { fill: '#d9d6cf', 'stroke-width': 1 }) + circle(x - r * 0.3, y - r * 0.3, r * 0.3, { fill: '#ffffff', stroke: 'none' });
  const eyelet = (x, y, r = 6, fill = '#ffffff') => circle(x, y, r, { fill: METAL, 'stroke-width': 1.1 }) + circle(x, y, r * 0.5, { fill, 'stroke-width': 1 });
  const button = (x, y, r = 7.5) => circle(x, y, r, { fill: METAL, 'stroke-width': 1.3 }) + circle(x, y, r * 0.55, { 'stroke-width': 0.9 });
  function ring(x, y, r = 7, w = 2.6) {
    return circle(x, y, r, { stroke: INK, 'stroke-width': w + 1.4 }) + circle(x, y, r, { stroke: METAL, 'stroke-width': w });
  }
  function chain(pts, link = 11, color = METAL, w = 2.4) {
    let out = '';
    const ws = walk(pts, link * 0.78);
    ws.forEach((s, i) => {
      const ang = (Math.atan2(s.dir[1], s.dir[0]) * 180) / Math.PI;
      const rx = link / 2;
      const ry = i % 2 ? link * 0.18 : link * 0.32;
      out += tag('ellipse', { cx: r1(s.p[0]), cy: r1(s.p[1]), rx: r1(rx), ry: r1(ry), transform: `rotate(${r1(ang)} ${r1(s.p[0])} ${r1(s.p[1])})`, fill: 'none', stroke: INK, 'stroke-width': w + 1.4 });
      out += tag('ellipse', { cx: r1(s.p[0]), cy: r1(s.p[1]), rx: r1(rx), ry: r1(ry), transform: `rotate(${r1(ang)} ${r1(s.p[0])} ${r1(s.p[1])})`, fill: 'none', stroke: color, 'stroke-width': w });
    });
    return out;
  }
  function zipper(x, y0, y1, o = {}) {
    const tape = o.tape || '#3a3a3a';
    let out = rect(x - 4.5, y0, 9, y1 - y0, { fill: tape, 'stroke-width': 1 });
    let d = '';
    for (let y = y0 + 4; y < y1 - 2; y += 5) d += `M${r1(x - 4.5)} ${r1(y)} L${r1(x + 4.5)} ${r1(y + 2.5)} `;
    out += path(d, { stroke: o.teeth || METAL, 'stroke-width': 1.6 });
    if (o.slider !== false) {
      const sy = o.sliderY != null ? o.sliderY : y0 + 4;
      out += rect(x - 6, sy, 12, 16, { fill: METAL, rx: 2, 'stroke-width': 1.2 }) + rect(x - 2.5, sy + 14, 5, 15, { fill: METAL, rx: 2, 'stroke-width': 1.1 });
    }
    return out;
  }
  function cord(p0, p1, sag = 12, o = {}) {
    const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + sag];
    return path(`M${P(p0)} Q${P(m)} ${P(p1)}`, { 'stroke-width': 3, stroke: o.color || '#ece8df', ...o }) + path(`M${P(p0)} Q${P(m)} ${P(p1)}`, { 'stroke-width': 1, stroke: INK, 'stroke-dasharray': '2 3' });
  }
  function drawstring(x, y, len, side = 1, color = '#ece8df') {
    const end = [x + side * 6, y + len];
    return (
      path(`M${P([x, y])} C${P([x + side * 4, y + len * 0.3])} ${P([x - side * 3, y + len * 0.7])} ${P(end)}`, { stroke: INK, 'stroke-width': 4.6 }) +
      path(`M${P([x, y])} C${P([x + side * 4, y + len * 0.3])} ${P([x - side * 3, y + len * 0.7])} ${P(end)}`, { stroke: color, 'stroke-width': 3 }) +
      rect(end[0] - 2.5, end[1] - 2, 5, 11, { fill: METAL, 'stroke-width': 1 })
    );
  }

  /* ---------- motivos ---------- */
  function star(cx, cy, r, o = {}, k = 0.45, n = 5, rot = -90) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = ((rot + (i * 180) / n) * Math.PI) / 180;
      const rr = i % 2 ? r * k : r;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return path(poly(pts, true), { fill: INK, 'stroke-width': 1.2, ...o });
  }
  function spiralStar(cx, cy, r, rot = 0) {
    let out = '';
    for (let i = 0; i < 5; i++) {
      const rr = r * (1 - i * 0.19);
      out += star(cx, cy, rr, { fill: i % 2 ? '#ffffff' : INK, 'stroke-width': 1 }, 0.42, 5, -90 + rot + i * 14);
    }
    return out;
  }
  function cross(cx, cy, s, o = {}) {
    const w = s * 0.28;
    return path(poly([[cx - w, cy - s], [cx + w, cy - s], [cx + w, cy - w], [cx + s, cy - w], [cx + s, cy + w], [cx + w, cy + w], [cx + w, cy + s * 1.3], [cx - w, cy + s * 1.3], [cx - w, cy + w], [cx - s, cy + w], [cx - s, cy - w], [cx - w, cy - w]], true), { fill: INK, 'stroke-width': 1, ...o });
  }
  function skull(cx, cy, s, o = {}) {
    const fill = o.fill || '#ffffff';
    let out = path(`M${P([cx - s, cy])} C${P([cx - s, cy - s * 1.3])} ${P([cx + s, cy - s * 1.3])} ${P([cx + s, cy])} C${P([cx + s, cy + s * 0.5])} ${P([cx + s * 0.6, cy + s * 0.6])} ${P([cx + s * 0.55, cy + s * 0.95])} L${P([cx - s * 0.55, cy + s * 0.95])} C${P([cx - s * 0.6, cy + s * 0.6])} ${P([cx - s, cy + s * 0.5])} ${P([cx - s, cy])} Z`, { fill, 'stroke-width': 1.3 });
    out += ellipse(cx - s * 0.42, cy - s * 0.05, s * 0.27, s * 0.3, { fill: INK, stroke: 'none' });
    out += ellipse(cx + s * 0.42, cy - s * 0.05, s * 0.27, s * 0.3, { fill: INK, stroke: 'none' });
    out += path(`M${P([cx, cy + s * 0.3])} L${P([cx - s * 0.1, cy + s * 0.5])} L${P([cx + s * 0.1, cy + s * 0.5])} Z`, { fill: INK, 'stroke-width': 0.8 });
    out += path(`M${P([cx - s * 0.3, cy + s * 0.95])} L${P([cx - s * 0.3, cy + s * 0.7])} M${P([cx, cy + s * 0.95])} L${P([cx, cy + s * 0.7])} M${P([cx + s * 0.3, cy + s * 0.95])} L${P([cx + s * 0.3, cy + s * 0.7])}`, { 'stroke-width': 1 });
    if (o.bow) {
      const by = cy - s * 1.05;
      out += path(`M${P([cx, by])} L${P([cx - s * 0.75, by - s * 0.4])} L${P([cx - s * 0.75, by + s * 0.4])} Z M${P([cx, by])} L${P([cx + s * 0.75, by - s * 0.4])} L${P([cx + s * 0.75, by + s * 0.4])} Z`, { fill: o.bow, 'stroke-width': 1.1 });
      out += circle(cx, by, s * 0.16, { fill: o.bow, 'stroke-width': 1 });
    }
    return out;
  }
  function heartPath(cx, cy, s) {
    return `M${P([cx, cy + s * 0.9])} C${P([cx - s * 1.4, cy])} ${P([cx - s * 0.8, cy - s * 1.1])} ${P([cx, cy - s * 0.35])} C${P([cx + s * 0.8, cy - s * 1.1])} ${P([cx + s * 1.4, cy])} ${P([cx, cy + s * 0.9])} Z`;
  }
  function checkerHeart(id, cx, cy, s) {
    const cid = id + '-heart-' + Math.round(cx) + '-' + Math.round(cy);
    let sq = '';
    const c = s / 3;
    for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) if ((i + j) % 2 === 0) sq += `M${r1(cx + i * c)} ${r1(cy + j * c)} h${r1(c)} v${r1(c)} h${r1(-c)} Z `;
    return tag('clipPath', { id: cid }, tag('path', { d: heartPath(cx, cy, s) })) + path(heartPath(cx, cy, s), { fill: '#ffffff', 'stroke-width': 1.3 }) + g({ 'clip-path': `url(#${cid})` }, path(sq, { fill: INK, stroke: 'none' })) + path(heartPath(cx, cy, s), { 'stroke-width': 1.3 });
  }
  function checker(x, y, w, h, c, o = {}) {
    let d = '';
    for (let i = 0; i * c < w; i++) for (let j = 0; j * c < h; j++) if ((i + j) % 2 === 0) d += `M${r1(x + i * c)} ${r1(y + j * c)} h${r1(Math.min(c, w - i * c))} v${r1(Math.min(c, h - j * c))} h${r1(-Math.min(c, w - i * c))} Z `;
    return rect(x, y, w, h, { fill: '#ffffff', 'stroke-width': 1.1 }) + path(d, { fill: INK, stroke: 'none' }) + rect(x, y, w, h, { 'stroke-width': 1.1, ...o });
  }
  function butterfly(cx, cy, s, rot = 0, c1 = '#e8902c', c2 = '#2f5fae') {
    const wing = (sx) =>
      path(`M${P([cx, cy])} C${P([cx + sx * s * 0.4, cy - s * 1.3])} ${P([cx + sx * s * 1.5, cy - s * 1.1])} ${P([cx + sx * s * 1.1, cy - s * 0.1])} C${P([cx + sx * s * 1.4, cy + s * 0.5])} ${P([cx + sx * s * 0.8, cy + s * 1.1])} ${P([cx, cy + s * 0.25])} Z`, { fill: sx > 0 ? c1 : c1, 'stroke-width': 1.2 }) +
      circle(cx + sx * s * 0.75, cy - s * 0.55, s * 0.2, { fill: c2, 'stroke-width': 0.9 }) +
      circle(cx + sx * s * 0.6, cy + s * 0.45, s * 0.13, { fill: '#ffffff', 'stroke-width': 0.8 });
    const body = ellipse(cx, cy, s * 0.1, s * 0.55, { fill: INK, stroke: 'none' }) + path(`M${P([cx, cy - s * 0.5])} Q${P([cx - s * 0.2, cy - s * 0.95])} ${P([cx - s * 0.35, cy - s * 1.05])} M${P([cx, cy - s * 0.5])} Q${P([cx + s * 0.2, cy - s * 0.95])} ${P([cx + s * 0.35, cy - s * 1.05])}`, { 'stroke-width': 0.9 });
    return g({ transform: `rotate(${rot} ${r1(cx)} ${r1(cy)})` }, wing(1) + wing(-1) + body);
  }
  function flame(x, y, s, flip = 1, o = {}) {
    // Flama que sube, de base ancha a punta (y = base).
    const X = (v) => x + v * s * flip;
    const Y = (v) => y - v * s;
    const d = `M${P([X(-0.5), Y(0)])} C${P([X(-0.9), Y(0.9)])} ${P([X(-0.1), Y(1.3)])} ${P([X(-0.45), Y(2.1)])} C${P([X(0.1), Y(1.7)])} ${P([X(0.25), Y(2.4)])} ${P([X(0.05), Y(3.2)])} C${P([X(0.65), Y(2.5)])} ${P([X(0.45), Y(1.9)])} ${P([X(0.75), Y(1.5)])} C${P([X(0.85), Y(1.0)])} ${P([X(0.6), Y(0.4)])} ${P([X(0.45), Y(0)])} Z`;
    return path(d, { fill: o.fill || '#c3142d', 'stroke-width': 1.4, ...o });
  }
  function snakeScales(id, d, x0, y0, w, h, color = '#7a0b18') {
    const cid = id + '-scales-' + Math.round(x0) + '-' + Math.round(y0);
    let s = '';
    for (let j = 0; j * 7 < h; j++) for (let i = 0; i * 9 < w; i++) s += `M${r1(x0 + i * 9 + (j % 2) * 4.5)} ${r1(y0 + j * 7)} q4.5 5 9 0 `;
    return tag('clipPath', { id: cid }, tag('path', { d })) + g({ 'clip-path': `url(#${cid})` }, path(s, { stroke: color, 'stroke-width': 0.9 }));
  }
  function leopard(x0, y0, w, h, rnd, o = {}) {
    const n = o.count || Math.round((w * h) / 520);
    let out = '';
    for (let i = 0; i < n; i++) {
      const cx = x0 + rnd() * w;
      const cy = y0 + rnd() * h;
      const r = (o.size || 5.5) * (0.7 + rnd() * 0.6);
      if (rnd() < 0.6) {
        // roseta: arcos oscuros alrededor de un centro más oscuro
        out += path(blob(cx, cy, r * 0.55, rnd, 0.3, 6), { fill: o.center || '#8a5a2b', stroke: 'none' });
        for (let k = 0; k < 3; k++) {
          const a0 = rnd() * Math.PI * 2;
          const a1 = a0 + 1.2 + rnd() * 0.8;
          out += path(`M${P([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r])} A${r1(r)} ${r1(r)} 0 0 1 ${P([cx + Math.cos(a1) * r, cy + Math.sin(a1) * r])}`, { stroke: o.spot || '#2a1a0c', 'stroke-width': 2.6 });
        }
      } else {
        out += path(blob(cx, cy, r * 0.5, rnd, 0.4, 6), { fill: o.spot || '#2a1a0c', stroke: 'none' });
      }
    }
    return out;
  }
  function camo(x0, y0, w, h, rnd, colors = ['#5d6b3a', '#3d4426', '#8a7a52', '#2a2a1e']) {
    let out = '';
    const n = Math.round((w * h) / 900);
    for (let i = 0; i < n; i++) {
      out += path(blob(x0 + rnd() * w, y0 + rnd() * h, 10 + rnd() * 16, rnd, 0.5, 7, 7 + rnd() * 10), { fill: colors[i % colors.length], stroke: 'none' });
    }
    return out;
  }
  function plaid(x0, y0, w, h, base, lines) {
    let out = rect(x0, y0, w, h, { fill: base, stroke: 'none' });
    for (const [c, step, wd, op] of lines) {
      let d = '';
      for (let x = x0 + step / 2; x < x0 + w; x += step) d += `M${r1(x)} ${r1(y0)} V${r1(y0 + h)} `;
      for (let y = y0 + step / 2; y < y0 + h; y += step) d += `M${r1(x0)} ${r1(y)} H${r1(x0 + w)} `;
      out += path(d, { stroke: c, 'stroke-width': wd, opacity: op, 'stroke-linecap': 'butt' });
    }
    return out;
  }
  function halftone(x0, y0, w, h, step, fn, color = INK) {
    let d = '';
    for (let y = y0; y < y0 + h; y += step)
      for (let x = x0 + ((Math.round((y - y0) / step) % 2) * step) / 2; x < x0 + w; x += step) {
        const r = fn(x, y) * step * 0.5;
        if (r > 0.35) d += `M${r1(x - r)} ${r1(y)} a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0 a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0 Z `;
      }
    return path(d, { fill: color, stroke: 'none' });
  }
  function cells(x0, y0, w, h, rnd, base, light) {
    let out = rect(x0, y0, w, h, { fill: base, stroke: 'none' });
    const n = Math.round((w * h) / 1300);
    for (let i = 0; i < n; i++) {
      const cx = x0 + rnd() * w;
      const cy = y0 + rnd() * h;
      const r = 8 + rnd() * 18;
      out += path(blob(cx, cy, r, rnd, 0.28, 8), { fill: light, stroke: mix(base, '#000000', 0.25), 'stroke-width': 1 });
      out += path(blob(cx + (rnd() - 0.5) * 4, cy + (rnd() - 0.5) * 4, r * 0.45, rnd, 0.3, 7), { fill: base, stroke: 'none' });
      if (rnd() < 0.5) out += circle(cx, cy, r * 0.16, { fill: light, stroke: 'none' });
    }
    return out;
  }
  function smiley(cx, cy, r, o = {}) {
    let out = circle(cx, cy, r, { fill: o.fill || '#f3e24a', 'stroke-width': 1.8 });
    const bolt = (x, y, s) => path(poly([[x - s * 0.2, y - s], [x + s * 0.35, y - s], [x + s * 0.05, y - s * 0.15], [x + s * 0.4, y - s * 0.15], [x - s * 0.3, y + s], [x - s * 0.05, y + s * 0.1], [x - s * 0.4, y + s * 0.1]], true), { fill: INK, 'stroke-width': 0.8 });
    out += bolt(cx - r * 0.36, cy - r * 0.22, r * 0.28) + bolt(cx + r * 0.36, cy - r * 0.22, r * 0.28);
    out += path(`M${P([cx - r * 0.55, cy + r * 0.25])} Q${P([cx, cy + r * 0.85])} ${P([cx + r * 0.55, cy + r * 0.25])}`, { 'stroke-width': 2 });
    return out;
  }
  function spray(cx, cy, r, rnd, color = INK, n = 90) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.pow(rnd(), 0.6) * r;
      const s = 0.5 + rnd() * 1.3;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      d += `M${r1(x - s)} ${r1(y)} a${r1(s)} ${r1(s)} 0 1 0 ${r1(2 * s)} 0 a${r1(s)} ${r1(s)} 0 1 0 ${r1(-2 * s)} 0 Z `;
    }
    return path(d, { fill: color, stroke: 'none' });
  }
  // Garabato que imita letra a mano.
  function scribble(x, y, w, rnd, o = {}) {
    const pts = [];
    const n = Math.max(6, Math.round(w / 6));
    for (let i = 0; i <= n; i++) pts.push([x + (i / n) * w, y + (i % 2 ? -1 : 1) * (2 + rnd() * (o.h || 6)) - (rnd() < 0.15 ? 6 : 0)]);
    return path(smooth(pts), { 'stroke-width': o.w || 1.4, stroke: o.color || INK });
  }
  function person(cx, base, h, fill, o = {}) {
    const hr = h * 0.13;
    const body = `M${P([cx - h * 0.26, base])} C${P([cx - h * 0.28, base - h * 0.45])} ${P([cx - h * 0.2, base - h * 0.66])} ${P([cx, base - h * 0.68])} C${P([cx + h * 0.2, base - h * 0.66])} ${P([cx + h * 0.28, base - h * 0.45])} ${P([cx + h * 0.26, base])} Z`;
    return path(body, { fill, stroke: o.edge || '#ffffff', 'stroke-width': 1.6 }) + circle(cx, base - h * 0.8, hr, { fill, stroke: o.edge || '#ffffff', 'stroke-width': 1.6 });
  }
  function leaf(cx, cy, len, ang, fill, rnd) {
    const a = (ang * Math.PI) / 180;
    const tip = [cx + Math.cos(a) * len, cy + Math.sin(a) * len];
    const nx = -Math.sin(a) * len * 0.32;
    const ny = Math.cos(a) * len * 0.32;
    const m1 = [cx + Math.cos(a) * len * 0.5 + nx, cy + Math.sin(a) * len * 0.5 + ny];
    const m2 = [cx + Math.cos(a) * len * 0.5 - nx, cy + Math.sin(a) * len * 0.5 - ny];
    const wob = (rnd() - 0.5) * len * 0.15;
    return path(`M${P([cx, cy])} Q${P([m1[0] + wob, m1[1]])} ${P(tip)} Q${P([m2[0], m2[1] + wob])} ${P([cx, cy])} Z`, { fill, 'stroke-width': 1.1, stroke: '#0d0c0b' }) + path(`M${P([cx, cy])} L${P(tip)}`, { stroke: '#6d6d6d', 'stroke-width': 0.8 });
  }
  function moss(cx, cy, r, rnd, colors = ['#4f7a3a', '#6f9a4a', '#3a5a2a']) {
    let out = '';
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = rnd() * r;
      out += path(blob(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3 + rnd() * 4, rnd, 0.5, 6), { fill: colors[i % colors.length], stroke: '#26391b', 'stroke-width': 0.6 });
    }
    return out;
  }
  // Roto: hueco irregular con hilos horizontales; opcional relleno de otra tela y zigzag alrededor.
  function rip(id, cx, cy, w, h, rnd, o = {}) {
    const d = blob(cx, cy, w / 2, rnd, 0.22, 10, h / 2);
    let out = path(d, { fill: o.fill || '#f4efe4', 'stroke-width': 1.2 });
    if (o.threads !== false) {
      let t = '';
      for (let y = cy - h / 2 + 3; y < cy + h / 2 - 2; y += o.threadStep || 4.2) {
        const half = (w / 2) * Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / (h / 2), 2))) * 0.95;
        t += `M${r1(cx - half)} ${r1(y)} Q${r1(cx)} ${r1(y + (rnd() - 0.5) * 3)} ${r1(cx + half)} ${r1(y)} `;
      }
      out += path(t, { stroke: o.threadColor || '#f7f4ec', 'stroke-width': 1.1 });
    }
    if (o.zig) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * (w / 2 + 4), cy + Math.sin(a) * (h / 2 + 4)]);
      }
      out += zigzag(pts, 2.6, 4.4, { stroke: o.zigColor || INK, 'stroke-width': 1 });
    }
    if (o.fringe) {
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * (w / 2), cy + Math.sin(a) * (h / 2)]);
      }
      out += fringe(pts, 5, 3.5, { stroke: o.fringeColor || '#f7f4ec' }, rnd, -1);
    }
    return out;
  }
  function knitMarks(x0, y0, w, h, rnd, color, step = 12) {
    let d = '';
    for (let y = y0; y < y0 + h; y += step)
      for (let x = x0 + ((y / step) % 2) * (step / 2); x < x0 + w; x += step) {
        if (rnd() < 0.18) continue;
        d += `M${r1(x - 3)} ${r1(y - 3)} L${r1(x)} ${r1(y + 2)} L${r1(x + 3)} ${r1(y - 3)} `;
      }
    return path(d, { stroke: color, 'stroke-width': 1 });
  }
  function bow(cx, cy, s, color = '#9aa356') {
    return (
      path(`M${P([cx, cy])} C${P([cx - s, cy - s * 0.8])} ${P([cx - s * 1.2, cy + s * 0.5])} ${P([cx, cy])} C${P([cx + s, cy - s * 0.8])} ${P([cx + s * 1.2, cy + s * 0.5])} ${P([cx, cy])}`, { fill: color, 'stroke-width': 1.2 }) +
      path(`M${P([cx, cy])} Q${P([cx - s * 0.3, cy + s * 1.2])} ${P([cx - s * 0.6, cy + s * 2])} M${P([cx, cy])} Q${P([cx + s * 0.3, cy + s * 1.2])} ${P([cx + s * 0.5, cy + s * 2.1])}`, { stroke: INK, 'stroke-width': 3.4 }) +
      path(`M${P([cx, cy])} Q${P([cx - s * 0.3, cy + s * 1.2])} ${P([cx - s * 0.6, cy + s * 2])} M${P([cx, cy])} Q${P([cx + s * 0.3, cy + s * 1.2])} ${P([cx + s * 0.5, cy + s * 2.1])}`, { stroke: color, 'stroke-width': 2 })
    );
  }
  function spiral(cx, cy, r, turns = 3, o = {}) {
    const pts = [];
    const n = turns * 24;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * turns * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r * t, cy + Math.sin(a) * r * t]);
    }
    return path(smooth(pts), { 'stroke-width': 1.4, ...o });
  }
  function face(cx, cy, r, o = {}) {
    const c = o.color || '#f4efe4';
    return (
      ellipse(cx, cy, r * 0.8, r, { stroke: c, 'stroke-width': 1.5 }) +
      path(`M${P([cx - r * 0.42, cy - r * 0.15])} q${r1(r * 0.15)} ${r1(-r * 0.12)} ${r1(r * 0.3)} 0 M${P([cx + r * 0.12, cy - r * 0.15])} q${r1(r * 0.15)} ${r1(-r * 0.12)} ${r1(r * 0.3)} 0 M${P([cx, cy - r * 0.05])} l${r1(-r * 0.08)} ${r1(r * 0.3)} l${r1(r * 0.14)} 0 M${P([cx - r * 0.3, cy + r * 0.5])} q${r1(r * 0.3)} ${r1(r * 0.18)} ${r1(r * 0.6)} 0`, { stroke: c, 'stroke-width': 1.3 })
    );
  }
  function wingedHeart(cx, cy, s, o = {}) {
    const c = o.color || '#f4efe4';
    const wing = (sx) => {
      let d = `M${P([cx + sx * s * 0.6, cy - s * 0.2])} C${P([cx + sx * s * 1.6, cy - s * 1.4])} ${P([cx + sx * s * 2.6, cy - s * 1.2])} ${P([cx + sx * s * 3, cy - s * 1.6])} C${P([cx + sx * s * 2.8, cy - s * 0.6])} ${P([cx + sx * s * 2.2, cy - s * 0.1])} ${P([cx + sx * s * 0.9, cy + s * 0.3])}`;
      for (let i = 0; i < 4; i++) d += ` M${P([cx + sx * s * (1.2 + i * 0.45), cy - s * (0.55 + i * 0.22)])} l${r1(sx * s * 0.25)} ${r1(s * 0.55)}`;
      return path(d, { stroke: c, 'stroke-width': 1.6 });
    };
    return wing(1) + wing(-1) + path(heartPath(cx, cy, s), { stroke: c, 'stroke-width': 2 }) + path(heartPath(cx, cy, s * 0.6), { stroke: c, 'stroke-width': 1 });
  }
  function letters(x, y, s, str, o = {}) {
    return tag('text', { x: r1(x), y: r1(y), 'font-family': o.family || 'Anton', 'font-size': r1(s), fill: o.fill || INK, stroke: o.stroke || 'none', 'stroke-width': o.sw || 0, transform: o.rot ? `rotate(${o.rot} ${r1(x)} ${r1(y)})` : undefined, 'letter-spacing': o.ls, 'text-anchor': o.anchor }, esc(str));
  }

  window.HK = {
    INK, MUTED, METAL, r1, P, esc, attrs, tag, g, rng, hash, mix, lum, seamOn, poly, smooth, path, stitch, circle, ellipse, rect, text,
    lerp, polyLen, walk, zigzag, fringe, ticks, blanket, blob, inset, rivet, stud, eyelet, button, ring, chain, zipper, cord, drawstring,
    star, spiralStar, cross, skull, heartPath, checkerHeart, checker, butterfly, flame, snakeScales, leopard, camo, plaid, halftone, cells,
    smiley, spray, scribble, person, leaf, moss, rip, knitMarks, bow, spiral, face, wingedHeart, letters
  };
})();
