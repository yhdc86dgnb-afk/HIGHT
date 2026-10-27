/*
 * HIGHT · Reels del lanzamiento: 1080 × 1920, 30 cuadros por segundo, con efectos de sonido.
 *
 * reels.html?r=adelanto   franjas de texto, los seis colores de la tienda con una prenda cada uno y DROP 01
 * reels.html?r=giro       tres prendas dan una vuelta entera en su percha, como en el visor 360 de la tienda
 * reels.html?r=hoy        cuenta regresiva, HOY y las 20 piezas cayendo sobre la mesa
 * reels.html?r=correas    las correas corren en las franjas del inicio y una cruza la pantalla como un látigo
 *
 * Todos cierran igual: el logo cae de arriba, golpea y anuncia el lanzamiento, con una pregunta para la comunidad y
 * los seis colores de la tienda. Cada uno va al tempo de una canción de Tame Impala, que se le pone en Instagram (ver
 * README.md): los tiempos de cada reel están en golpes de su canción. El estilo es el de la página y los posts
 * (bocetos/instagram): carbón, hueso y los seis colores con sus texturas; Anton, Space Grotesk y Space Mono; copias
 * impresas con cinta, sellos y franjas. Los textos quedan fuera de los 290 px de arriba y de abajo, donde Instagram
 * pone su interfaz.
 *
 * window.frame(i) dibuja el cuadro i y lo devuelve como PNG (data URL); window.FRAMES dice cuántos tiene el reel y
 * window.SFX, en qué segundo suena cada efecto y cómo va la música (sonido.py arma el sonido con eso).
 */
import * as THREE from '../../assets/three.module.min.js';
import { drape } from '../../assets/hight-ropa.js';

const params = new URLSearchParams(location.search);
const REEL = params.get('r') || 'adelanto';
const W = 1080;
const H = 1920;
const FPS = 30;
const SS = Number(params.get('ss') || 2); // el 3D se dibuja SS veces más grande y se achica: bordes suaves
const AS = '../../assets/';
const IMG = '../instagram/imagenes/';
const SAFE_TOP = 290;
const SAFE_BOTTOM = H - 290;

const out = document.createElement('canvas');
out.width = W;
out.height = H;
document.body.appendChild(out);
let ctx = out.getContext('2d');

/* ---------- Colores de la tienda ---------- */

const CARBON = '#0d0c0b';
const HUESO = '#ece3d0';
const MUTED = '#9a9184';
const PAPEL = '#f6f4ef';
const COLORES = {
  acido: { name: 'Radiactivo', c: '#dff04a', on: CARBON },
  carmin: { name: 'Sangre Fría', c: '#c3142d', on: HUESO },
  indigo: { name: 'Medianoche', c: '#5b7cfa', on: CARBON },
  magenta: { name: 'Chicle', c: '#e0218a', on: HUESO },
  ceniza: { name: 'Asfalto', c: '#c4beb2', on: CARBON },
  leopardo: { name: 'Fiera', c: '#c08a4e', on: CARBON },
};
const ORDEN = ['acido', 'carmin', 'indigo', 'magenta', 'ceniza', 'leopardo'];
const CINTA = ['Edición corta', 'Drop 01', 'Hecho en Medellín', 'Denim intervenido', 'No se repite'];

// Texto sobre un color: carbón si el color es claro, hueso si es oscuro (la misma regla del tema).
function sobre(hex) {
  const n = parseInt(hex.slice(1), 16);
  const b = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return b < 120 ? HUESO : CARBON;
}

/* ---------- Ayudas ---------- */

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeBack = (t, s = 1.7) => (t <= 0 ? 0 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2));
const rad = (d) => (d * Math.PI) / 180;
function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}
const A = {};
async function assets(list) {
  await Promise.all(Object.entries(list).map(async ([k, src]) => (A[k] = await loadImage(src))));
}

function lienzo(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
// Dibuja una escena en otro lienzo con las mismas ayudas (para las transiciones).
function onto(c, fn) {
  const prev = ctx;
  ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  try {
    fn();
  } finally {
    ctx = prev;
  }
  return c;
}
const BUF_A = lienzo();
const BUF_B = lienzo();

/* ---------- Golpes: sacuden la pantalla y destellan ---------- */

let GOLPES = []; // [segundo, amplitud en px, cuánto dura]
let DESTELLOS = []; // [segundo, opacidad, cuánto dura, color]
function sacudida(t) {
  let x = 0;
  let y = 0;
  let r = 0;
  for (const [t0, a, d] of GOLPES) {
    const u = t - t0;
    if (u < 0 || u > d * 6) continue;
    const k = a * Math.exp(-u / d);
    x += k * Math.sin(u * 61 + t0 * 7);
    y += k * Math.cos(u * 53 + t0 * 3);
    r += k * 0.0008 * Math.sin(u * 47 + t0);
  }
  return { x, y, r };
}
function begin(t) {
  const s = sacudida(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2 + s.x, H / 2 + s.y);
  ctx.rotate(s.r);
  ctx.translate(-W / 2, -H / 2);
}
function destellos(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [t0, a, d, c = HUESO] of DESTELLOS) {
    const u = t - t0;
    if (u < 0 || u > d * 5) continue;
    ctx.globalAlpha = a * Math.exp(-u / d);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}

// Grano de fotocopia, como en la página: ruido de 2 px que cambia cada dos cuadros, suave para que la compresión de
// Instagram no lo vuelva bloques.
const noise = lienzo(512, 512);
{
  const n = noise.getContext('2d');
  const data = n.createImageData(512, 512);
  const r = rng(7);
  for (let k = 0; k < data.data.length; k += 4) {
    const v = 255 * r();
    data.data.set([v, v, v, 255], k);
  }
  n.putImageData(data, 0, 0);
}
function grain(i, alpha = 0.12) {
  const k = i >> 1;
  const ox = (k * 197) % 1024;
  const oy = (k * 331) % 1024;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  for (let y = -oy; y < H; y += 1024) for (let x = -ox; x < W; x += 1024) ctx.drawImage(noise, x, y, 1024, 1024);
  ctx.restore();
}

/* ---------- Fondos y texturas de los seis colores (las del collage del inicio) ---------- */

function fondo(color) {
  ctx.fillStyle = color;
  ctx.fillRect(-200, -200, W + 400, H + 400);
}
function radial(x, cx, cy, r, color, sy = 1) {
  x.save();
  x.translate(cx, cy);
  x.scale(1, sy);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(-r, -r, 2 * r, 2 * r);
  x.restore();
}
function rayas(x, angle, step, width, color) {
  x.save();
  x.translate(W / 2, H / 2);
  x.rotate(rad(angle));
  x.fillStyle = color;
  for (let k = -2400; k < 2400; k += step) x.fillRect(k, -2400, width, 4800);
  x.restore();
}
function patron(x, tile, scale = 1) {
  const p = x.createPattern(tile, 'repeat');
  p.setTransform(new DOMMatrix().scale(scale));
  x.fillStyle = p;
  x.fillRect(0, 0, W, H);
}
const LEOPARDO = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'><rect width='140' height='140' fill='#b98242'/><g fill='#8a5a26' stroke='#24160a' stroke-width='5' stroke-dasharray='10 5' stroke-linecap='round'><ellipse cx='24' cy='22' rx='13' ry='10' transform='rotate(-20 24 22)'/><ellipse cx='82' cy='18' rx='11' ry='9' transform='rotate(15 82 18)'/><ellipse cx='122' cy='48' rx='12' ry='9' transform='rotate(-35 122 48)'/><ellipse cx='52' cy='62' rx='14' ry='11' transform='rotate(25 52 62)'/><ellipse cx='100' cy='92' rx='13' ry='10' transform='rotate(-10 100 92)'/><ellipse cx='20' cy='104' rx='12' ry='9' transform='rotate(30 20 104)'/><ellipse cx='64' cy='122' rx='11' ry='8' transform='rotate(-25 64 122)'/></g><g fill='#24160a'><circle cx='44' cy='34' r='3.5'/><circle cx='108' cy='62' r='3'/><circle cx='78' cy='70' r='2.5'/><circle cx='36' cy='86' r='3'/><circle cx='126' cy='118' r='3.5'/><circle cx='92' cy='132' r='2.5'/></g></svg>`;

const TX = {};
async function texturas() {
  const leo = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LEOPARDO));
  for (const id of ORDEN) {
    const c = lienzo();
    const x = c.getContext('2d');
    if (id === 'acido') {
      x.fillStyle = '#10150b';
      x.fillRect(0, 0, W, H);
      radial(x, 0.85 * W, 0.1 * H, 1.2 * W, 'rgba(223, 240, 74, .38)', 0.9);
      radial(x, 0.15 * W, 0.95 * H, 1.0 * W, 'rgba(98, 240, 124, .28)', 0.9);
      rayas(x, 25, 20, 4, 'rgba(223, 240, 74, .08)');
      const tile = lienzo(120, 60);
      const t = tile.getContext('2d');
      t.strokeStyle = 'rgba(223, 240, 74, .6)';
      t.lineWidth = 4;
      t.setLineDash([10, 7.5]);
      t.beginPath();
      t.moveTo(0, 45);
      [30, 60, 90, 120].forEach((px, k) => t.lineTo(px, k % 2 ? 45 : 15));
      t.stroke();
      patron(x, tile);
    } else if (id === 'carmin') {
      const g = x.createRadialGradient(0.78 * W, 0.28 * H, 0, 0.78 * W, 0.28 * H, 1.2 * H);
      g.addColorStop(0, '#d0182f');
      g.addColorStop(0.68, '#4a050c');
      g.addColorStop(1, '#1a0306');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      const dots = lienzo();
      const d = dots.getContext('2d');
      const tile = lienzo(20, 20);
      const t = tile.getContext('2d');
      t.fillStyle = 'rgba(13, 12, 11, .92)';
      t.beginPath();
      t.arc(10, 10, 5.4, 0, 2 * Math.PI);
      t.fill();
      d.fillStyle = d.createPattern(tile, 'repeat');
      d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'destination-in';
      const m = d.createLinearGradient(0, H, W, 0);
      m.addColorStop(0.05, 'rgba(0,0,0,.15)');
      m.addColorStop(0.8, 'rgba(0,0,0,1)');
      d.fillStyle = m;
      d.fillRect(0, 0, W, H);
      x.drawImage(dots, 0, 0);
    } else if (id === 'indigo') {
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1c2b6e');
      g.addColorStop(1, '#0b1130');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      radial(x, 0.72 * W, 0.22 * H, 1.0 * W, 'rgba(91, 124, 250, .5)', 0.75);
      rayas(x, 45, 12, 2, 'rgba(0, 0, 0, .3)');
      rayas(x, -45, 7, 2, 'rgba(255, 255, 255, .075)');
      x.setLineDash([26, 16]);
      x.lineWidth = 5;
      x.strokeStyle = 'rgba(236, 227, 208, .34)';
      x.beginPath();
      x.moveTo(0.61 * W, 0);
      x.lineTo(0.61 * W, H);
      x.stroke();
      x.strokeStyle = 'rgba(223, 160, 74, .38)';
      x.beginPath();
      x.moveTo(0.61 * W + 20, 0);
      x.lineTo(0.61 * W + 20, H);
      x.stroke();
    } else if (id === 'magenta') {
      x.fillStyle = '#2b0b20';
      x.fillRect(0, 0, W, H);
      const tile = lienzo(380, 313);
      const t = tile.getContext('2d');
      for (const [cx, cy, rx, ry, c] of [[0.2, 0.3, 90, 60, '#e0218a'], [0.62, 0.22, 67, 94, '#b06cff'], [0.82, 0.72, 103, 67, '#ff7ac0'], [0.36, 0.76, 63, 49, '#8a1660'], [0.52, 0.52, 40, 31, '#f4b8d8']]) {
        t.fillStyle = c;
        t.beginPath();
        t.ellipse(cx * 380, cy * 313, rx, ry, 0, 0, 2 * Math.PI);
        t.fill();
      }
      patron(x, tile);
    } else if (id === 'ceniza') {
      const g = x.createRadialGradient(0.72 * W, 0.28 * H, 0, 0.72 * W, 0.28 * H, 1.1 * H);
      g.addColorStop(0, '#45423c');
      g.addColorStop(0.75, '#141312');
      g.addColorStop(1, '#141312');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(196, 190, 178, .11)';
      for (let k = 0; k < W; k += 36) x.fillRect(k, 0, 2, H);
      for (let k = 0; k < H; k += 36) x.fillRect(0, k, W, 2);
    } else if (id === 'leopardo') {
      patron(x, leo, 300 / 140);
    }
    TX[id] = c;
  }
}
// La textura de un color sobre carbón, oscurecida en el centro para que el texto se lea (como en la portada).
function textura(id, alpha = 0.62, centro = 0.78) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(TX[id], -70, -70, W + 140, H + 140);
  ctx.globalAlpha = 1;
  if (centro > 0) {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, H * 0.62);
    g.addColorStop(0, `rgba(13, 12, 11, ${centro})`);
    g.addColorStop(1, 'rgba(13, 12, 11, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-200, -200, W + 400, H + 400);
  }
}

/* ---------- Tipografía de la página ---------- */

function texto(str, x, y, { font, color = HUESO, align = 'left', alpha = 1, spacing = 0, upper = true, scale = 1, rot = 0, base = 'alphabetic' } = {}) {
  ctx.save();
  ctx.font = font;
  ctx.letterSpacing = `${spacing}px`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillStyle = color;
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rad(rot));
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.fillText(upper ? str.toUpperCase() : str, 0, 0);
  ctx.restore();
}
const anton = (s, x, y, size, color, o = {}) => texto(s, x, y, { ...o, font: `400 ${size}px Anton`, color, spacing: -0.005 * size });
const mono = (s, x, y, size, color, o = {}) => texto(s, x, y, { ...o, font: `${o.bold ? 700 : 400} ${size}px "Space Mono"`, color, spacing: 0.06 * size });
const grotesk = (s, x, y, size, color, o = {}) => texto(s, x, y, { upper: false, ...o, font: `${o.weight || 400} ${size}px "Space Grotesk"`, color });
function ancho(str, font, spacing = 0) {
  ctx.save();
  ctx.font = font;
  ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}
// El tamaño de Anton para que el texto quepa en maxW.
function cabe(str, size, maxW) {
  const w = ancho(str.toUpperCase(), `400 ${size}px Anton`, -0.005 * size);
  return w > maxW ? (size * maxW) / w : size;
}

/* ---------- Íconos del tema (snippets/icon.liquid) ---------- */

const FLARE = new Path2D('M12.56 4.41l.26 1.29 .29 1.11 .32 .96 .39 .8 .36 .51 1.46-1.03 1.29-.98 .16-.16-.16 .16-.98 1.29-1.03 1.46 .51 .36 .8 .39 .96 .32 1.11 .29 1.29 .26 3.21 .56-3.21 .56-1.29 .26-1.11 .29-.96 .32-.8 .39-.51 .36 1.03 1.46 .98 1.29 .16 .16-.16-.16-1.29-.98-1.46-1.03-.36 .51-.39 .8-.32 .96-.29 1.11-.26 1.29-.56 3.21-.56-3.21-.26-1.29-.29-1.11-.32-.96-.39-.8-.36-.51-1.46 1.03-1.29 .98-.16 .16 .16-.16 .98-1.29 1.03-1.46-.51-.36-.79-.39-.97-.32-1.11-.29-1.29-.26-3.21-.56 3.21-.56 1.29-.26 1.11-.29 .97-.32 .79-.39 .51-.36-1.03-1.46-.98-1.29-.16-.16 .16 .16 1.29 .98 1.46 1.03 .36-.51 .39-.8 .32-.96 .29-1.11 .26-1.29 .56-3.21z');
const GIRO_ICON = [new Path2D('M2 13.4a10 4.4 0 1 0 20 0a10 4.4 0 1 0-20 0zM3.7 13.4a8.3 3 0 1 1 16.6 0a8.3 3 0 1 1-16.6 0z'), new Path2D('M17.6 9.2l4.6 .7-3 3.1zM12 2.4l1.7 3.3-1.7 3.3-1.7-3.3z')];
function icono(paths, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  for (const p of [].concat(paths)) ctx.fill(p, 'evenodd');
  ctx.restore();
}

/* ---------- Motivos de la página: copia impresa con cinta, marquillas, sello y franja de texto ---------- */

function cinta(x, y, w, h, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad(rot));
  ctx.beginPath();
  const pts = [[0.03, 0.08], [0.09, 0], [0.92, 0.04], [1, 0], [0.97, 0.52], [1, 1], [0.9, 0.94], [0.06, 1], [0, 0.92], [0.03, 0.5]];
  pts.forEach(([px, py], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, -w / 2 + px * w, -h / 2 + py * h));
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, 'rgba(243, 236, 210, .86)');
  g.addColorStop(1, 'rgba(226, 215, 182, .78)');
  ctx.shadowColor = 'rgba(0, 0, 0, .28)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function marquilla(str, x, y, { bg = HUESO, fg = CARBON, size = 26, rot = 0, scale = 1, icon = null } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad(rot));
  ctx.scale(scale, scale);
  const font = `700 ${size}px "Space Mono"`;
  const tw = ancho(str.toUpperCase(), font, 0.06 * size);
  const iw = icon ? size * 1.15 + 10 : 0;
  const pw = tw + iw + size * 1.4;
  const ph = size * 1.95;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, pw, ph);
  if (icon) icono(icon, size * 0.7 + size * 0.575, ph / 2, size * 1.15, fg);
  mono(str, size * 0.7 + iw, ph / 2 + size * 0.36, size, fg, { bold: true });
  ctx.restore();
  return { w: pw, h: ph };
}

function copia(img, cx, cy, w, h, { rot = 0, scale = 1, alpha = 1, tape = true, tag = null, chip = false, corte = '', marco = HUESO, pad = 0.07 } = {}) {
  if (alpha <= 0 || scale <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rad(rot));
  ctx.scale(scale, scale);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, .55)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 40;
  ctx.fillStyle = marco;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  const p = Math.max(10, Math.round(w * 0.028));
  const iw = w - 2 * p;
  const ih = h - 2 * p;
  ctx.fillStyle = PAPEL;
  ctx.fillRect(-w / 2 + p, -h / 2 + p, iw, ih);
  if (img) {
    const pl = corte.includes('izq') || corte === 'lados' ? 0 : pad * iw;
    const pr = corte.includes('der') || corte === 'lados' ? 0 : pad * iw;
    const pt = corte.includes('arriba') || corte === 'alto' ? 0 : pad * ih;
    const pb = corte.includes('abajo') || corte === 'alto' ? 0 : pad * ih;
    const bw = iw - pl - pr;
    const bh = ih - pt - pb;
    const s = Math.min(bw / img.width, bh / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    let dx = -w / 2 + p + pl + (bw - dw) / 2;
    let dy = -h / 2 + p + pt + (bh - dh) / 2;
    if (corte.includes('der')) dx = w / 2 - p - dw;
    if (corte.includes('abajo')) dy = h / 2 - p - dh;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2 + p, -h / 2 + p, iw, ih);
    ctx.clip();
    ctx.shadowColor = 'rgba(13, 12, 11, .22)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 18;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }
  if (chip) marquilla('360°', -w / 2 + p + 18, -h / 2 + p + 18, { bg: CARBON, fg: HUESO, size: Math.max(18, w * 0.036), icon: GIRO_ICON });
  if (tape) cinta(0, -h / 2 + 2, Math.min(w * 0.44, 300), Math.min(62, w * 0.11), -4);
  if (tag) marquilla(tag.text, -w / 2 - 20, -h / 2 - 26, { bg: tag.bg, fg: tag.fg || sobre(tag.bg), size: tag.size || 26, rot: -3 });
  ctx.restore();
}

// Sello circular: el texto da la vuelta y la estrella va en el centro.
function sello(cx, cy, r, str, bg, fg, { rot = 0, scale = 1 } = {}) {
  if (scale <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, .5)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  ctx.rotate(rad(rot));
  const size = r * 0.15;
  const font = `700 ${size}px "Space Mono"`;
  ctx.font = font;
  ctx.letterSpacing = '0px';
  const chars = [...str.toUpperCase()];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const R = r * 0.76;
  const extra = (2 * Math.PI * R - total) / chars.length;
  let a = -Math.PI / 2;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((c, k) => {
    const cw = widths[k] + extra;
    a += cw / 2 / R;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(c, 0, -R);
    ctx.restore();
    a += cw / 2 / R;
  });
  ctx.rotate(-rad(rot));
  icono(FLARE, 0, 0, r * 0.62, fg);
  ctx.restore();
}

// Franja de texto que corre, como la de arriba de la página.
function franja(cy, rot, offset, { bg, fg, h = 96, size = 30, items = CINTA } = {}) {
  ctx.save();
  ctx.translate(W / 2, cy);
  ctx.rotate(rad(rot));
  const L = 2800;
  ctx.fillStyle = bg;
  ctx.fillRect(-L / 2, -h / 2, L, h);
  const font = `700 ${size}px "Space Mono"`;
  const sp = 0.1 * size;
  const gap = size * 1.2;
  const widths = items.map((s) => ancho(s.toUpperCase(), font, sp));
  const unit = widths.reduce((a, b) => a + b + 2 * gap, 0);
  let x = -L / 2 - (((offset % unit) + unit) % unit);
  while (x < L / 2) {
    items.forEach((s, k) => {
      texto(s, x, size * 0.36, { font, color: fg, spacing: sp });
      x += widths[k] + gap;
      icono(FLARE, x, 0, size * 1.05, fg);
      x += gap;
    });
  }
  ctx.restore();
}

// Los seis colores de la tienda en fila, como en Elige tu color.
function puntos(cx, cy, u, { r = 17, gap = 26 } = {}) {
  const total = ORDEN.length * 2 * r + (ORDEN.length - 1) * gap;
  ORDEN.forEach((id, k) => {
    const s = easeBack(seg(u, k * 0.06, k * 0.06 + 0.22), 2.4);
    if (s <= 0) return;
    const x = cx - total / 2 + r + k * (2 * r + gap);
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(s, s);
    ctx.fillStyle = COLORES[id].c;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  });
}

// Polvo que salta cuando algo golpea el piso.
function polvo(cx, cy, u, color = HUESO, n = 48, seed = 9) {
  if (u < 0 || u > 0.9) return;
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI * (0.05 + 0.9 * r());
    const v = 380 + 900 * r();
    const size = 3 + 7 * r();
    const x = cx + (r() - 0.5) * 760 + Math.cos(a) * v * u;
    const y = cy + Math.sin(a) * v * u + 1700 * u * u;
    ctx.globalAlpha = (1 - u / 0.9) * 0.85;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  ctx.restore();
}

/* ---------- Cierre de todos los reels: el logo cae de arriba y anuncia el lanzamiento ---------- */

// Golpes y sonidos del cierre, para sumarlos a los de cada reel.
// El logo golpea en t0 + 0,55 y DROP 01 cae un tiempo de la canción después.
function cierreGolpes(t0, tiempo = 0.43) {
  const drop = t0 + 0.55 + tiempo;
  return {
    golpes: [[t0 + 0.55, 46, 0.2], [drop, 14, 0.12]],
    destellos: [[t0 + 0.55, 0.6, 0.14]],
    sfx: [[t0 - 0.05, 'subida', 0.9], [t0 + 0.55, 'boom', 1], [drop - 0.01, 'golpe', 0.6], [drop + 0.14, 'pop', 0.7], [t0 + 2.1, 'tic', 0.35], [t0 + 2.16, 'tic', 0.35], [t0 + 2.22, 'tic', 0.35], [t0 + 2.28, 'tic', 0.35], [t0 + 2.34, 'tic', 0.35], [t0 + 2.4, 'tic', 0.35]],
  };
}
function cierre(t, t0, cfg) {
  const u = t - t0;
  fondo(CARBON);
  textura(cfg.tx, 0.5, 0.86);
  franja(232, -3, t * 170, { bg: cfg.acc, fg: sobre(cfg.acc), h: 84, size: 27 });
  franja(H - 232, 3, -t * 170, { bg: HUESO, fg: CARBON, h: 84, size: 27 });
  const logo = A.logo;
  const lw = 860;
  const lh = (logo.height / logo.width) * lw;
  const base = 330 + lh; // el logo se apoya aquí
  if (u >= 0.15) {
    let y = base;
    let sx = 1;
    let sy = 1;
    let r = 0;
    if (u < 0.55) {
      const f = seg(u, 0.15, 0.55);
      y = lerp(-40, base, f * f);
      r = lerp(-8, 0, f);
    } else {
      const v = u - 0.55;
      const s = 0.16 * Math.exp(-v / 0.09) * Math.cos(v * 26);
      sy = 1 - s;
      sx = 1 + 0.55 * s;
      y = base - 44 * Math.exp(-v / 0.12) * Math.abs(Math.sin(v * 15));
    }
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.rotate(rad(r));
    ctx.scale(sx, sy);
    ctx.shadowColor = 'rgba(0, 0, 0, .6)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 30;
    ctx.drawImage(logo, -lw / 2, -lh, lw, lh);
    ctx.restore();
  }
  polvo(W / 2, base - 20, u - 0.55);
  const drop = 0.55 + (cfg.tiempo ?? 0.43);
  if (u >= drop - 0.16) {
    const k = easeOut(seg(u, drop - 0.16, drop));
    anton('Drop 01', W / 2, 1132, 230, cfg.acc, { align: 'center', scale: lerp(2.1, 1, k), alpha: k });
  }
  if (u >= drop + 0.1) {
    const k = easeBack(seg(u, drop + 0.1, drop + 0.3), 2.2);
    const font = `700 38px "Space Mono"`;
    const bw = ancho(cfg.cta.toUpperCase(), font, 3.8) + 120;
    ctx.save();
    ctx.translate(W / 2, 1222);
    ctx.scale(k, k);
    ctx.fillStyle = cfg.acc;
    ctx.fillRect(-bw / 2, -50, bw, 100);
    mono(cfg.cta, 0, 14, 38, sobre(cfg.acc), { bold: true, align: 'center' });
    ctx.restore();
  }
  if (u >= 1.4) {
    const n = Math.ceil(cfg.q.length * seg(u, 1.4, 1.9));
    const size = cabe(cfg.q, 92, 960);
    ctx.save();
    ctx.font = `400 ${size}px Anton`;
    ctx.letterSpacing = `${-0.005 * size}px`;
    const full = ctx.measureText(cfg.q.toUpperCase()).width;
    ctx.restore();
    // escribe la pregunta letra por letra sin que se corra el centro
    anton(cfg.q.slice(0, n), W / 2 - full / 2, 1402, size, HUESO);
  }
  if (u >= 1.95) mono(cfg.sub, W / 2, 1470, 26, MUTED, { align: 'center', alpha: easeOut(seg(u, 1.95, 2.2)) });
  if (u >= 2.1) puntos(W / 2, 1548, u - 2.1);
  if (u >= 1.55) sello(915, 815, 108, cfg.sello || 'EDICIÓN CORTA · NO SE REPITE · ', cfg.acc, sobre(cfg.acc), { rot: t * 50, scale: easeBack(seg(u, 1.55, 1.8), 2) });
}

// Barrido con una franja ancha: tapa la escena que sale y destapa la que entra.
function barrido(t, t0, d, sale, entra, { bg, fg }) {
  const p = seg(t, t0, t0 + d);
  if (p < 0.5) sale();
  else entra();
  const y = lerp(H + 1500, -1500, easeInOut(p));
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(rad(-12));
  ctx.fillStyle = bg;
  ctx.fillRect(-1700, -1250, 3400, 2500);
  ctx.restore();
  franja(y - 1200, -12, t * 900, { bg: CARBON, fg: HUESO, h: 90, size: 30 });
  franja(y + 1200, -12, -t * 900, { bg: CARBON, fg: HUESO, h: 90, size: 30 });
  if (p > 0.25 && p < 0.75) anton('Drop 01', W / 2, y + 120, 300, fg, { align: 'center', rot: -12 });
}

// Paneo rápido de una escena a otra, con barrido de movimiento.
function paneo(t, t0, d, sale, entra) {
  const p = easeInOut(seg(t, t0, t0 + d));
  onto(BUF_A, sale);
  onto(BUF_B, entra);
  const v = Math.sin(Math.PI * seg(t, t0, t0 + d)) * 220;
  const n = 7;
  for (let k = 0; k < n; k++) {
    const off = -p * W - (k / (n - 1) - 0.5) * v;
    ctx.globalAlpha = 1 / (k + 1);
    ctx.drawImage(BUF_A, off, 0);
    ctx.drawImage(BUF_B, off + W, 0);
  }
  ctx.globalAlpha = 1;
}

/* ---------- Prendas ---------- */

const PRENDAS = {
  'chaqueta-trouble-maker': { name: 'Chaqueta Trouble Maker', type: 'Chaqueta', cm: 'Crop · Pintada a mano', price: '$580.000', color: 'ceniza', acc: '#9aa356' },
  'chaqueta-smiley-acido': { name: 'Chaqueta Smiley Ácido', type: 'Chaqueta', cm: 'Crop · Pintada a mano', price: '$620.000', color: 'acido', acc: '#dff04a' },
  'chaqueta-blood-rose': { name: 'Chaqueta Blood Rose', type: 'Chaqueta', cm: 'Chaqueta', price: '$500.000', color: 'magenta', acc: '#b9a2e8', img: 'dibujo' },
  'buzo-multitud-termica': { name: 'Buzo Multitud Térmica', type: 'Buzo', cm: 'Crop · Cremallera', price: '$390.000', color: 'ceniza', acc: '#a066ff' },
  'buzo-destroyed-ceniza': { name: 'Buzo Destroyed Ceniza', type: 'Buzo', cm: 'Crop · Capucha', price: '$520.000', color: 'ceniza', acc: '#c4beb2' },
  'tejido-anillos-indigo': { name: 'Tejido Anillos Índigo', type: 'Tejido', cm: 'Crop · Tejido grueso', price: '$460.000', color: 'indigo', acc: '#5b7cfa', corte: 'der' },
  'tejido-deshilado-ceniza': { name: 'Tejido Deshilado Ceniza', type: 'Tejido', cm: 'Oversize · Tejido abierto', price: '$380.000', color: 'ceniza', acc: '#c4beb2' },
  'camiseta-celula-carmin': { name: 'Camiseta Célula Carmín', type: 'Camiseta', cm: 'Regular · Estampado total', price: '$169.000', color: 'carmin', acc: '#c3142d' },
  'top-halftone-carmin': { name: 'Top Halftone Carmín', type: 'Top', cm: 'Cuello alto · Sin mangas', price: '$99.000', color: 'carmin', acc: '#c3142d' },
  'top-crop-rostros': { name: 'Top Crop Rostros', type: 'Top', cm: 'Crop · Sin mangas', price: '$89.000', color: 'ceniza', acc: '#c4beb2' },
  'top-malla-asimetrico-rojo': { name: 'Top Malla Asimétrico Rojo', type: 'Top', cm: 'Asimétrico · Malla', price: '$390.000', color: 'carmin', acc: '#c3142d' },
  'jean-flare-patchwork-leopardo': { name: 'Jean Flare Patchwork Leopardo', type: 'Jean', cm: 'Flare · Patchwork', price: '$690.000', color: 'leopardo', acc: '#c08a4e' },
  'jean-flare-dragon-acido': { name: 'Jean Flare Dragón Ácido', type: 'Jean', cm: 'Flare · Sobreteñido', price: '$490.000', color: 'acido', acc: '#dff04a', corte: 'lados' },
  'jean-flare-destroyed-verde': { name: 'Jean Flare Destroyed Verde', type: 'Jean', cm: 'Flare · Destroyed', price: '$480.000', color: 'acido', acc: '#dff04a' },
  'jean-flare-costura-neon': { name: 'Jean Flare Costura Neón', type: 'Jean', cm: 'Flare · Patchwork', price: '$560.000', color: 'acido', acc: '#62f07c' },
  'jean-patchwork-cuadros': { name: 'Jean Patchwork Cuadros', type: 'Jean', cm: 'Recto · Patchwork', price: '$540.000', color: 'leopardo', acc: '#c08a4e' },
  'jean-patchwork-estrellas-violeta': { name: 'Jean Patchwork Estrellas Violeta', type: 'Jean', cm: 'Wide · Patchwork', price: '$650.000', color: 'magenta', acc: '#b06cff' },
  'jean-wide-patchwork-indigo': { name: 'Jean Wide Patchwork Índigo', type: 'Jean', cm: 'Wide · Patchwork', price: '$590.000', color: 'indigo', acc: '#5b7cfa', corte: 'der' },
  'jean-wide-fleco-indigo': { name: 'Jean Wide Fleco Índigo', type: 'Jean', cm: 'Wide · Patchwork', price: '$620.000', color: 'indigo', acc: '#5b7cfa', corte: 'alto' },
  'short-camuflado-leopardo-rosa': { name: 'Short Camuflado Leopardo Rosa', type: 'Short', cm: 'Bermuda · Doble pretina', price: '$260.000', color: 'magenta', acc: '#e0218a' },
};
async function prendas(handles) {
  await assets(Object.fromEntries(handles.map((h) => [h, `${IMG}${h}-${PRENDAS[h].img || 'recorte'}.webp`])));
}

/* ---------- Adelanto ---------- */

// Una prenda por color, en el orden de Elige tu color.
const GOLPE_COLOR = [
  ['acido', 'chaqueta-smiley-acido', -4],
  ['carmin', 'top-halftone-carmin', 3],
  ['indigo', 'tejido-anillos-indigo', -2],
  ['magenta', 'jean-patchwork-estrellas-violeta', 4],
  ['ceniza', 'chaqueta-trouble-maker', -3],
  ['leopardo', 'jean-flare-patchwork-leopardo', 2],
];
// Va al tempo de «New Person, Same Old Mistakes» de Tame Impala (152 golpes por minuto), la canción que se le pone en
// Instagram: las franjas golpean en el medio tiempo y en el 1, un color por tiempo desde el 2, la pregunta en dos
// tiempos, DROP 01 letra por semicorchea desde el 10 y el logo cae en el 16 (6,3 s), al empezar el quinto compás.
const AD_T = 60 / 152;
const AD = { franja1: 0.5 * AD_T, franja2: AD_T, color0: 2 * AD_T, paso: AD_T, pregunta: 8 * AD_T, drop: 10 * AD_T, logo: 16 * AD_T };
AD.cierre = AD.logo - 0.55;
AD.barrido = AD.cierre - 0.2;
const LETRAS = [0, 1, 2, 3, 4, 5].map((k) => (k * AD_T) / 4);

const adelanto = {
  seconds: Math.round((AD.logo + 3.6) * 10) / 10,
  async setup() {
    await prendas(GOLPE_COLOR.map((g) => g[1]));
    const golpes = [[AD.franja1, 18, 0.12], [AD.franja2, 18, 0.12]];
    const sfx = [[0, 'whoosh', 0.8], [AD.franja1 - 0.01, 'golpe', 0.75], [AD.franja2 - 0.13, 'whoosh', 0.8], [AD.franja2 - 0.01, 'golpe', 0.75]];
    GOLPE_COLOR.forEach((_, k) => {
      const t = AD.color0 + k * AD.paso;
      golpes.push([t, 26, 0.12]);
      sfx.push([t, 'golpe', 1]);
    });
    for (let k = 0; k < 6; k++) sfx.push([AD.pregunta + (k * (AD.drop - AD.pregunta)) / 6, 'tic', 0.6]);
    const letras = LETRAS;
    letras.forEach((d) => {
      golpes.push([AD.drop + d, 12, 0.1]);
      sfx.push([AD.drop + d, 'golpe', 0.5]);
    });
    sfx.push([AD.barrido, 'whoosh', 1]);
    const c = cierreGolpes(AD.cierre, AD_T);
    // La música propia va a la mitad del tempo, como se siente la canción (76): redoble en la pregunta, golpes en las
    // letras y la caída cuando cae el logo, al empezar el tercer compás.
    const logo = AD.logo;
    this.musica = {
      bpm: 60 / AD_T / 2,
      origen: 0,
      logo,
      golpes: letras.map((d) => AD.drop + d),
      secciones: [[0, AD.color0, 'entrada'], [AD.color0, AD.pregunta, 'ritmo'], [AD.pregunta, AD.drop, 'redoble'], [AD.drop, AD.barrido, 'golpes'], [AD.barrido, logo, 'subida'], [logo, this.seconds, 'caida']],
    };
    this.golpes = golpes.concat(c.golpes);
    this.destellos = [[AD.franja1 - 0.01, 0.18, 0.06], [AD.franja2 - 0.01, 0.18, 0.06], ...GOLPE_COLOR.map((_, k) => [AD.color0 + k * AD.paso, 0.22, 0.06])].concat(c.destellos);
    this.sfx = sfx.concat(c.sfx);
  },
  franjas(t) {
    fondo(CARBON);
    const a = easeOut(seg(t, 0, AD.franja1));
    const b = easeOut(seg(t, AD.franja2 - 0.13, AD.franja2));
    franja(820, -8, t * 420 + lerp(-1400, 0, a), { bg: COLORES.acido.c, fg: CARBON, h: 150, size: 46 });
    if (t >= AD.franja2 - 0.13) franja(1120, 6, -t * 420 + lerp(1400, 0, b), { bg: HUESO, fg: CARBON, h: 150, size: 46 });
  },
  color(t, k) {
    const [id, h, rot] = GOLPE_COLOR[k];
    const u = t - (AD.color0 + k * AD.paso);
    const col = COLORES[id];
    const p = PRENDAS[h];
    fondo(CARBON);
    textura(id, 0.62, 0.55);
    const size = cabe(col.name, 250, 960);
    anton(col.name, W / 2, 1540 + 70 * (1 - easeOut(seg(u, 0, 0.12))), size, col.c, { align: 'center' });
    mono(`(${String(k + 1).padStart(2, '0')}/06) · Drop 01`, W / 2, 1300, 28, HUESO, { align: 'center', alpha: seg(u, 0.04, 0.12) });
    const s = 1 + 0.38 * (1 - easeOut(seg(u, 0, 0.12)));
    copia(A[h], W / 2, 790, 620, 740, { rot, scale: s, corte: p.corte || '', tag: { text: 'Últimas 4', bg: p.acc } });
  },
  pregunta(t) {
    const k = Math.min(5, Math.floor(((t - AD.pregunta) * 6) / (AD.drop - AD.pregunta)));
    const id = ORDEN[k];
    fondo(CARBON);
    textura(id, 0.9, 0.6);
    anton('¿De qué color', W / 2, 900, 150, HUESO, { align: 'center' });
    anton('eres?', W / 2, 1070, 190, COLORES[id].c, { align: 'center' });
    ORDEN.forEach((o, j) => {
      const x = W / 2 + (j - 2.5) * 110;
      ctx.fillStyle = COLORES[o].c;
      ctx.beginPath();
      ctx.arc(x, 1250, j === k ? 34 : 22, 0, 2 * Math.PI);
      ctx.fill();
      if (j === k) {
        ctx.strokeStyle = HUESO;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, 1250, 46, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
    mono(COLORES[id].name, W / 2, 1350, 30, HUESO, { align: 'center', bold: true });
  },
  drop(t) {
    fondo(CARBON);
    textura('acido', 0.62, 0.8);
    franja(460, -3, t * 220, { bg: COLORES.acido.c, fg: CARBON, h: 84, size: 27 });
    const word = 'DROP 01';
    const size = 300;
    const font = `400 ${size}px Anton`;
    const total = ancho(word, font, -0.005 * size);
    const letras = [...LETRAS.slice(0, 4), null, ...LETRAS.slice(4)];
    let x = W / 2 - total / 2;
    [...word].forEach((ch, k) => {
      const w = ancho(ch, font, -0.005 * size);
      const d = letras[k];
      if (d !== null && t >= AD.drop + d) {
        const s = easeOut(seg(t, AD.drop + d, AD.drop + d + 0.08));
        anton(ch, x + w / 2, 1080, size, COLORES.acido.c, { align: 'center', scale: lerp(1.9, 1, s), alpha: s });
      }
      x += w;
    });
    mono('(01) Denim intervenido — MED/COL', W / 2, 760, 28, HUESO, { align: 'center', alpha: seg(t, AD.drop + 0.68, AD.drop + 0.8) });
    grotesk('Prendas intervenidas a mano y piezas de archivo.', W / 2, 1190, 38, HUESO, { align: 'center', alpha: seg(t, AD.drop + 0.72, AD.drop + 0.86) });
    sello(840, 1380, 130, 'EDICIÓN CORTA · NO SE REPITE · ', COLORES.acido.c, CARBON, { rot: t * 60, scale: easeBack(seg(t, AD.drop + 0.72, AD.drop + 0.94), 2) });
  },
  draw(i) {
    const t = i / FPS;
    begin(t);
    const fin = { tx: 'acido', acc: COLORES.acido.c, cta: 'Pronto', q: '¿De qué color eres?', sub: 'Entérate primero · enlace en la bio', tiempo: AD_T };
    if (t < AD.color0) this.franjas(t);
    else if (t < AD.pregunta) this.color(t, Math.min(5, Math.floor((t - AD.color0) / AD.paso)));
    else if (t < AD.drop) this.pregunta(t);
    else if (t < AD.barrido) this.drop(t);
    else if (t < AD.barrido + 0.4) barrido(t, AD.barrido, 0.4, () => this.drop(t), () => cierre(t, AD.cierre, fin), { bg: COLORES.acido.c, fg: CARBON });
    else cierre(t, AD.cierre, fin);
    destellos(t);
    grain(i);
  },
};

/* ---------- Giro: las prendas en 3D, con la forma de ropa y la percha del visor ---------- */

const GW = 1080;
const GH = 1060;
const WIDTH = 3.3;
const OUTLINE = 0.015;
const WIRE = 0.02;
const INK = 0x0d0c0b;

const FABRIC = `
uniform float uWeave;
uniform float uPx;
varying vec3 vObj;
varying vec3 vObjN;
float hilo( float t, float duty ) {
  float w = clamp( fwidth( t ), 1e-4, 0.5 );
  float x = fract( t );
  float r = smoothstep( duty - w, duty + w, x ) * ( 1.0 - smoothstep( 1.0 - w, 1.0, x ) );
  return mix( r, 1.0 - duty, clamp( ( w - 0.35 ) * 4.0, 0.0, 1.0 ) );
}
float trama( vec2 q ) {
  if ( uWeave < 0.5 ) return hilo( ( q.x * 0.47 + q.y * 0.88 ) / ( 9.0 * uPx ), 0.64 );
  if ( uWeave < 1.5 ) return hilo( q.x / ( 6.0 * uPx ), 0.6 );
  return 0.5 * hilo( q.y / ( 4.0 * uPx ), 0.7 );
}
vec3 fabric( vec3 c, vec3 p, vec3 n ) {
  vec3 an = abs( normalize( n ) );
  vec2 w = pow( an.xy + 1e-3, vec2( 4.0 ) );
  w /= w.x + w.y;
  float r = trama( p.zy ) * w.x + trama( p.xz ) * w.y;
  float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  return c * ( 1.0 + ( lum < 0.05 ? 0.6 : 0.22 ) * r );
}`;

function toonSteps() {
  const steps = 32;
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const x = (i + 0.5) / steps;
    const v = x >= 0.84 ? 255 : x >= 0.6 ? 196 : 112;
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function gridPixels(image, gw, gh) {
  const c = document.createElement('canvas');
  c.width = gw;
  c.height = gh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(image, 0, 0);
  return x.getImageData(0, 0, gw, gh).data;
}
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// La misma prenda del visor 360 (hight-360.js): dos capas de tela con su forma, sus pliegues y su percha.
function garment(data, front, back, alto, lado, bottom, seed, steps, weave) {
  const [gw, gh] = data.grid;
  const [tw, th] = data.tex;
  const step = data.step;
  const pixels = gridPixels(alto, gw, gh);
  const sidePixels = gridPixels(lado, gw, gh);
  const scale = WIDTH / data.widthPx;
  const n = gw * gh;
  const heights = new Float32Array(n);
  for (let k = 0; k < n; k++) heights[k] = pixels[k * 4] / 255;
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      px[j * gw + i] = Math.min(i * step, tw - 1) + 0.5;
      py[j * gw + i] = Math.min(j * step, th - 1) + 0.5;
    }
  }
  const onRim = new Uint8Array(n);
  data.rim.i.forEach((k, r) => {
    onRim[k] = 1;
    px[k] = data.rim.x[r] + 0.5;
    py[k] = data.rim.y[r] + 0.5;
  });
  const shape = drape({ gw, gh, step, heights, px, py, onRim, bottom, seed });
  const frontPos = new Float32Array(n * 3);
  const backPos = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    const x = (px[k] - tw / 2) * scale;
    const y = (th / 2 - py[k]) * scale;
    frontPos.set([x, y, (shape.fold[k] + shape.z[k]) * scale], k * 3);
    backPos.set([x, y, (shape.fold[k] - shape.z[k]) * scale], k * 3);
    uvs[k * 2] = px[k] / tw;
    uvs[k * 2 + 1] = 1 - py[k] / th;
  }
  const side = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const r = sidePixels[k * 4], g = sidePixels[k * 4 + 1], b = sidePixels[k * 4 + 2];
    if (r + g + b === 0) continue;
    side.set([toLinear(r / 255), toLinear(g / 255), toLinear(b / 255), 1], k * 4);
  }
  const fi = [];
  const bi = [];
  for (let j = 0; j < gh - 1; j++) {
    for (let i = 0; i < gw - 1; i++) {
      const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1;
      if (heights[a] > 0 || heights[b] > 0 || heights[c] > 0 || heights[d] > 0) {
        fi.push(a, c, b, b, c, d);
        bi.push(a, b, c, b, d, c);
      }
    }
  }
  const group = new THREE.Group();
  const outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const surface = (pos, index, map) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('side', new THREE.BufferAttribute(side, 4));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal.array;
    for (let k = 0; k < n; k++) {
      if (!onRim[k] || shape.open[k] > 0.5) continue;
      const x = normals[k * 3], y = normals[k * 3 + 1];
      const l = Math.hypot(x, y);
      normals[k * 3] = l > 1e-6 ? x / l : 0;
      normals[k * 3 + 1] = l > 1e-6 ? y / l : 0;
      normals[k * 3 + 2] = 0;
    }
    const material = new THREE.MeshToonMaterial({ map, gradientMap: steps, side: THREE.DoubleSide });
    const uWeave = { value: weave };
    const uPx = { value: scale };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWeave = uWeave;
      shader.uniforms.uPx = uPx;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 side;\nvarying vec4 vSide;\nvarying vec3 vFront;\nvarying vec3 vObj;\nvarying vec3 vObjN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSide = side;\nvObj = transformed;\nvObjN = objectNormal;\nvFront = normalize( mat3( modelViewMatrix ) * vec3( 0.0, 0.0, 1.0 ) );');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec4 vSide;\nvarying vec3 vFront;\n' + FABRIC)
        .replace('#include <map_fragment>', '#include <map_fragment>\nif ( !gl_FrontFacing ) diffuseColor.rgb *= 0.32;')
        .replace(
          '#include <normal_fragment_maps>',
          [
            '#include <normal_fragment_maps>',
            'if ( gl_FrontFacing && vSide.a > 0.5 ) {',
            '  vec3 front = normalize( vFront );',
            '  float facing = abs( dot( normalize( vViewPosition ), front ) );',
            '  float tilt = abs( dot( normal, front ) );',
            '  if ( tilt < 1.0 - facing * facing ) diffuseColor.rgb = fabric( vSide.rgb, vObj, vObjN );',
            '}',
          ].join('\n')
        );
    };
    group.add(new THREE.Mesh(geometry, material));
    const shell = geometry.clone();
    const p = shell.attributes.position.array;
    for (let k = 0; k < p.length; k++) p[k] += normals[k] * OUTLINE;
    group.add(new THREE.Mesh(shell, outline));
  };
  surface(frontPos, fi, front);
  surface(backPos, bi, back);
  group.add(hanger(shape, px, py, onRim, (x, y) => [(x - tw / 2) * scale, (th / 2 - y) * scale], scale, bottom, steps));
  return group;
}

function hanger(shape, px, py, onRim, toScene, scale, bottom, steps) {
  const material = new THREE.MeshToonMaterial({ color: 0x3a3632, gradientMap: steps });
  const { x0, x1, y0, y1 } = shape.box;
  const Wd = x1 - x0;
  const cx = (x0 + x1) / 2;
  let top = Infinity, lo = Infinity, hi = -Infinity;
  for (let k = 0; k < px.length; k++) {
    if (!onRim[k]) continue;
    if (Math.abs(px[k] - cx) < 0.1 * Wd) top = Math.min(top, py[k]);
    if (py[k] < y0 + 0.05 * (y1 - y0)) {
      lo = Math.min(lo, px[k]);
      hi = Math.max(hi, px[k]);
    }
  }
  if (!isFinite(top)) top = y0;
  const group = new THREE.Group();
  const wire = (list) => {
    const curve = new THREE.CatmullRomCurve3(list.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, WIRE, 8), material));
  };
  const [mid, ty] = toScene(cx, top);
  let base = ty - 0.12;
  if (bottom && isFinite(lo)) {
    const inset = 0.1 * (hi - lo);
    const [ax] = toScene(lo + inset, top);
    const [bx] = toScene(hi - inset, top);
    base = ty + 0.2;
    wire([[ax - 0.06, base], [mid, base], [bx + 0.06, base]]);
    const deep = 2 * 0.05 * Wd * scale + 0.05;
    for (const x of [ax, bx]) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, deep), material);
      clip.position.set(x, base - 0.15, 0);
      group.add(clip);
    }
  }
  const r = 0.13;
  const stem = Math.max(base, ty) + 0.2;
  const path = [[mid, base], [mid, (base + stem) / 2], [mid, stem]];
  for (const a of [2.6, 2.0, 1.4, 0.8, 0.2, -0.4, -0.8]) path.push([mid + r + r * Math.cos(a), stem + r * Math.sin(a)]);
  wire(path);
  return group;
}


// Cada prenda gira sobre un fondo de la página: ácido, la textura de Radiactivo y hueso.
const GIRO = [
  { h: 'chaqueta-smiley-acido', bottom: false, fondo: 'acido' },
  { h: 'jean-flare-costura-neon', bottom: true, fondo: 'textura' },
  { h: 'buzo-multitud-termica', bottom: false, fondo: 'hueso' },
];
// Va al tempo de «Feels Like We Only Go Backwards» de Tame Impala (150 golpes por minuto, que se sienten a la mitad):
// el 360° golpea en el 1, cada prenda dura ocho tiempos (un compás de la canción) y entra en el 2, el 10 y el 18, donde
// suena la caja, y el logo cae en el 26 (10,4 s), también en la caja.
const GI_T = 60 / 150;
const GI = { golpe: GI_T, intro: 2 * GI_T, ventana: 8 * GI_T, paso: 0.25, logo: 26 * GI_T };
GI.dura = GI.ventana - GI.paso;
GI.cierre = GI.logo - 0.55;
const ventana = (k) => GI.intro + k * GI.ventana;

const giro = {
  seconds: Math.round((GI.logo + 3.7) * 10) / 10,
  async setup() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(SS);
    this.renderer.setSize(GW, GH, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, GW / GH, 0.1, 100);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.38 * Math.PI));
    const key = new THREE.DirectionalLight(0xffffff, 0.62 * Math.PI);
    key.position.set(-0.55, 0.65, 0);
    key.target.position.set(0, 0, -1);
    this.camera.add(key, key.target);
    const steps = toonSteps();
    this.items = [];
    for (const g of GIRO) {
      const base = AS + '360-' + g.h;
      const [data, frente, espalda, alto, lado] = await Promise.all([
        fetch(base + '.json').then((r) => r.json()),
        loadImage(base + '-frente.webp'),
        loadImage(base + '-espalda.webp'),
        loadImage(base + '-alto.png'),
        loadImage(base + '-lado.png'),
      ]);
      const tex = (img) => {
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        t.needsUpdate = true;
        return t;
      };
      const weave = { sarga: 0, punto: 1, jersey: 2, malla: 2 }[data.tela] ?? 0;
      const group = garment(data, tex(frente), tex(espalda), alto, lado, g.bottom, g.h, steps, weave);
      const box = new THREE.Box3().setFromObject(group);
      group.position.sub(box.getCenter(new THREE.Vector3()));
      const pivot = new THREE.Group();
      pivot.add(group);
      pivot.visible = false;
      this.scene.add(pivot);
      const size = box.getSize(new THREE.Vector3());
      this.items.push({ ...g, pivot, height: size.y, radius: Math.max(size.x, size.z) / 2 });
    }
    const golpes = [[GI.golpe, 22, 0.14]];
    const sfx = [[0, 'whoosh', 0.9], [GI.golpe - 0.01, 'golpe', 1]];
    GIRO.forEach((_, k) => {
      // cada prenda golpea justo cuando entra, en el tiempo
      const t = ventana(k);
      sfx.push([t - 0.01, 'golpe', 0.65], [t + 0.02, 'whoosh', 0.7]);
      golpes.push([t, 12, 0.12]);
      if (k > 0) sfx.push([t - GI.paso, 'whoosh', 1]);
    });
    sfx.push([GI.cierre - 0.15, 'whoosh', 1]);
    const c = cierreGolpes(GI.cierre, GI_T);
    // La música propia va a la mitad del tempo (75), como se siente la canción, y sube en el último tiempo antes del logo.
    const logo = GI.logo;
    const sube = logo - 2 * GI_T;
    this.musica = {
      bpm: 60 / GI_T / 2,
      origen: 0,
      logo,
      golpes: [GI.golpe - 0.01],
      secciones: [[0, GI.intro, 'entrada'], [GI.intro, sube, 'ritmo'], [sube, logo, 'subida'], [logo, this.seconds, 'caida']],
    };
    this.golpes = golpes.concat(c.golpes);
    this.destellos = [[GI.golpe - 0.01, 0.2, 0.07]].concat(c.destellos);
    this.sfx = sfx.concat(c.sfx);
  },
  intro(t) {
    fondo(COLORES.acido.c);
    const p = seg(t, 0, GI.golpe);
    const flip = Math.cos(Math.PI * (1 - easeOut(p)) * 2);
    ctx.save();
    ctx.translate(W / 2, 1000);
    ctx.scale(lerp(2.6, 1, easeOut(p)) * Math.max(0.05, Math.abs(flip)), lerp(2.6, 1, easeOut(p)));
    anton('360°', 0, 230, 640, CARBON, { align: 'center' });
    ctx.restore();
    mono('(Vista 360°) · Drop 01', W / 2, 1420, 30, CARBON, { align: 'center', alpha: seg(t, GI.golpe + 0.02, GI.golpe + 0.12) });
  },
  prenda(t, k) {
    const it = this.items[k];
    const p = PRENDAS[it.h];
    const u = t - ventana(k);
    const q = clamp01(u / GI.dura);
    const claro = it.fondo !== 'textura';
    const tinta = claro ? CARBON : HUESO;
    if (it.fondo === 'acido') fondo(COLORES.acido.c);
    else if (it.fondo === 'hueso') fondo(HUESO);
    else {
      fondo(CARBON);
      textura('acido', 0.62, 0.7);
    }
    // 360° gigante que corre por detrás
    ctx.save();
    ctx.globalAlpha = claro ? 0.1 : 0.14;
    anton('360° 360° 360°', W / 2 - 900 * q, 1060, 560, tinta, { align: 'left' });
    ctx.restore();
    this.items.forEach((o) => (o.pivot.visible = o === it));
    it.pivot.rotation.y = 2 * Math.PI * easeInOut(q);
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = ((it.height * 0.56) / Math.tan(fov / 2) + it.radius) * lerp(1.04, 0.96, q);
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
    const s = 1 + 0.25 * (1 - easeOut(seg(u, 0, 0.16)));
    ctx.save();
    ctx.translate(W / 2, 300 + GH / 2);
    ctx.scale(s, s);
    ctx.drawImage(this.renderer.domElement, -GW / 2, -GH / 2, GW, GH);
    ctx.restore();
    marquilla('360°', 60, SAFE_TOP + 20, { bg: CARBON, fg: HUESO, size: 30, icon: GIRO_ICON });
    // la ficha entra desde abajo, como el cuerpo de una tarjeta de la tienda
    const e = easeOut(seg(u, 0.1, 0.26));
    ctx.save();
    ctx.translate(0, 260 * (1 - e));
    ctx.globalAlpha = e;
    const col = COLORES[p.color];
    ctx.fillStyle = col.c;
    ctx.strokeStyle = tinta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(73, 1393, 13, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    mono(`${col.name} · ${p.type}`, 100, 1402, 26, tinta);
    const size = cabe(p.name, 104, 960);
    anton(p.name, 58, 1510, size, tinta);
    mono(p.cm, 60, 1568, 26, claro ? 'rgba(13,12,11,.62)' : MUTED);
    mono(p.price, W - 60, 1570, 40, tinta, { bold: true, align: 'right' });
    ctx.restore();
    // sobre el ácido, la marquilla del mismo color se invierte
    const igual = it.fondo === 'acido' && p.acc === COLORES.acido.c;
    const tw = ancho('ÚLTIMAS 4', '700 28px "Space Mono"', 1.68) + 28 * 1.4;
    marquilla('Últimas 4', W - 60 - tw, SAFE_TOP + 14, { bg: igual ? CARBON : p.acc, fg: igual ? COLORES.acido.c : sobre(p.acc), size: 28, rot: -3, scale: easeBack(seg(u, 0.3, 0.46), 2) });
  },
  draw(i) {
    const t = i / FPS;
    begin(t);
    const fin = { tx: 'acido', acc: COLORES.acido.c, cta: 'Mañana', q: '¿Cuál te pondrías?', sub: 'Gíralas en la tienda · enlace en la bio', tiempo: GI_T };
    const last = GIRO.length - 1;
    const fuera = ventana(last) + GI.dura;
    if (t < GI.intro) this.intro(t);
    else if (t >= GI.cierre + 0.2) cierre(t, GI.cierre, fin);
    else if (t >= GI.cierre - 0.2) barrido(t, GI.cierre - 0.2, 0.4, () => this.prenda(Math.min(t, fuera - 1e-3), last), () => cierre(t, GI.cierre, fin), { bg: COLORES.acido.c, fg: CARBON });
    else {
      const k = Math.min(last, Math.floor((t - GI.intro) / GI.ventana));
      const u = t - ventana(k);
      if (u < GI.dura || k === last) this.prenda(Math.min(t, ventana(k) + GI.dura - 1e-3), k);
      else paneo(t, ventana(k) + GI.dura, GI.paso, () => this.prenda(ventana(k) + GI.dura - 1e-3, k), () => this.prenda(ventana(k + 1), k + 1));
    }
    destellos(t);
    grain(i);
  },
};

/* ---------- Hoy ---------- */

const PIEZAS = [
  'chaqueta-trouble-maker', 'chaqueta-smiley-acido', 'chaqueta-blood-rose', 'buzo-multitud-termica',
  'buzo-destroyed-ceniza', 'tejido-anillos-indigo', 'tejido-deshilado-ceniza', 'camiseta-celula-carmin',
  'top-halftone-carmin', 'top-crop-rostros', 'top-malla-asimetrico-rojo', 'jean-flare-patchwork-leopardo',
  'jean-flare-dragon-acido', 'jean-flare-destroyed-verde', 'jean-flare-costura-neon', 'jean-patchwork-cuadros',
  'jean-patchwork-estrellas-violeta', 'jean-wide-patchwork-indigo', 'jean-wide-fleco-indigo', 'short-camuflado-leopardo-rosa',
];
const CUENTA = [
  ['3', COLORES.acido.c, CARBON, 'acido'],
  ['2', COLORES.carmin.c, HUESO, 'carmin'],
  ['1', '#1c2a63', HUESO, 'indigo'],
];
// Va al tempo de «Let It Happen» de Tame Impala (125 golpes por minuto): 3, 2 y 1 en los tiempos 0, 1 y 2, HOY en el 3,
// las piezas caen una por semicorchea desde el 5 y medio y el logo cae en el 12 (5,76 s), al empezar el cuarto compás.
const HO_T = 60 / 125;
const HO = { cuenta: HO_T, hoy: 3 * HO_T, mesa: 5 * HO_T, cae: 5.5 * HO_T, cada: HO_T / 4, logo: 12 * HO_T };
HO.caida = HO.cae - 0.14; // cada pieza tarda 0,14 s en caer
HO.cierre = HO.logo - 0.55;
HO.barrido = HO.cierre - 0.2;

const hoy = {
  seconds: Math.round((HO.logo + 3.65) * 10) / 10,
  async setup() {
    await prendas(PIEZAS);
    await assets({ logo: AS + 'hight-logo-plata.webp' });
    const golpes = [];
    const sfx = [];
    // la cuenta y HOY golpean justo en el tiempo; el primero, apenas después del arranque para que suene entero
    const cuenta = CUENTA.map((_, k) => Math.max(0.03, k * HO.cuenta));
    cuenta.forEach((t) => {
      golpes.push([t, 26, 0.12]);
      sfx.push([t, 'golpe', 1]);
    });
    golpes.push([HO.hoy, 48, 0.2]);
    sfx.push([HO.hoy - 0.35, 'subida', 0.7], [HO.hoy, 'boom', 1], [HO.mesa - 0.02, 'whoosh', 0.8]);
    PIEZAS.forEach((_, k) => {
      const t = HO.caida + k * HO.cada + 0.14;
      golpes.push([t, 5, 0.08]);
      sfx.push([t, 'tic', 0.55]);
    });
    sfx.push([HO.barrido, 'whoosh', 1]);
    const c = cierreGolpes(HO.cierre, HO_T);
    // La música propia: golpes en la cuenta y en HOY; en la mesa, una semicorchea por cada pieza que cae.
    const logo = HO.logo;
    this.musica = {
      bpm: 60 / HO_T,
      origen: 0,
      logo,
      golpes: [...cuenta, HO.hoy],
      secciones: [[0, HO.mesa, 'golpes'], [HO.mesa, HO.barrido, 'ritmo'], [HO.barrido, logo, 'subida'], [logo, this.seconds, 'caida']],
    };
    this.golpes = golpes.concat(c.golpes);
    this.destellos = [...cuenta.map((t) => [t, 0.2, 0.06]), [HO.hoy, 0.55, 0.12]].concat(c.destellos);
    this.sfx = sfx.concat(c.sfx);
  },
  cuenta(t) {
    const k = Math.min(2, Math.floor(t / HO.cuenta));
    const [n, bg, fg, tx] = CUENTA[k];
    const u = t - k * HO.cuenta;
    fondo(bg);
    ctx.globalAlpha = 0.22;
    ctx.drawImage(TX[tx], 0, 0);
    ctx.globalAlpha = 1;
    const s = easeOut(seg(u, 0, 0.1));
    anton(n, W / 2, 1330, 1000, fg, { align: 'center', scale: lerp(1.7, 1, s), alpha: s });
    mono('Drop 01 · sale hoy', W / 2, SAFE_BOTTOM - 20, 30, fg, { align: 'center', bold: true });
  },
  hoy(t) {
    const u = t - HO.hoy;
    fondo(CARBON);
    textura('leopardo', 0.62, 0.7);
    ctx.globalAlpha = seg(u, 0.25, 0.45);
    const lw = 640;
    ctx.drawImage(A.logo, W / 2 - lw / 2, 330, lw, (A.logo.height / A.logo.width) * lw);
    ctx.globalAlpha = 1;
    const s = easeOut(seg(u, 0, 0.1));
    anton('Hoy', W / 2, 1290, 560, COLORES.leopardo.c, { align: 'center', scale: lerp(2.2, 1, s), alpha: s });
    mono('(Drop 01) (20) piezas', W / 2, 1400, 30, HUESO, { align: 'center', alpha: seg(u, 0.2, 0.3) });
    grotesk('20 piezas, máximo 4 por talla.', W / 2, 1470, 40, HUESO, { align: 'center', alpha: seg(u, 0.3, 0.42) });
    sello(870, 750, 118, 'SALE HOY · DROP 01 · SALE HOY · DROP 01 · ', COLORES.leopardo.c, CARBON, { rot: t * 60, scale: easeBack(seg(u, 0.35, 0.6), 2) });
  },
  mesa(t) {
    fondo(HUESO);
    mono('(Recién llegado) (20) piezas', 60, SAFE_TOP + 40, 28, CARBON);
    mono('MED/COL', W - 60, SAFE_TOP + 40, 28, CARBON, { align: 'right' });
    anton('Lo nuevo', 56, SAFE_TOP + 190, 150, CARBON);
    const cols = 4;
    const cw = 960 / cols;
    const top = SAFE_TOP + 230;
    const ch = (SAFE_BOTTOM - top) / 5;
    const r = rng(3);
    PIEZAS.forEach((h, k) => {
      const rot = (r() - 0.5) * 8;
      const t0 = HO.caida + k * HO.cada;
      const f = seg(t, t0, t0 + 0.14);
      if (f <= 0) return;
      const p = PRENDAS[h];
      const cx = 60 + cw * (k % cols) + cw / 2;
      const cy = top + ch * Math.floor(k / cols) + ch / 2 - 14;
      const y = lerp(cy - 700, cy, easeIn(f));
      const sc = f < 1 ? 1.15 : 1 + 0.06 * Math.exp(-(t - t0 - 0.14) / 0.05);
      copia(A[h], cx, y, cw - 26, ch - 52, { rot: rot * (1 - 0.3 * f), scale: sc, tape: false, corte: p.corte || '' });
      if (f >= 1) {
        ctx.fillStyle = COLORES[p.color].c;
        ctx.beginPath();
        ctx.arc(cx - (cw - 26) / 2 + 10, cy + (ch - 52) / 2 + 26, 9, 0, 2 * Math.PI);
        ctx.fill();
        mono(p.price, cx - (cw - 26) / 2 + 28, cy + (ch - 52) / 2 + 35, 22, CARBON, { bold: true });
      }
    });
  },
  draw(i) {
    const t = i / FPS;
    begin(t);
    const fin = { tx: 'leopardo', acc: COLORES.leopardo.c, cta: 'Sale hoy', q: 'Si es tu talla, es tuya.', sub: 'Enlace en la bio · máximo 4 por talla', sello: 'SALE HOY · DROP 01 · SALE HOY · DROP 01 · ', tiempo: HO_T };
    if (t < HO.hoy) this.cuenta(t);
    else if (t < HO.mesa) this.hoy(t);
    else if (t < HO.barrido) this.mesa(t);
    else if (t < HO.barrido + 0.4) barrido(t, HO.barrido, 0.4, () => this.mesa(t), () => cierre(t, HO.cierre, fin), { bg: COLORES.leopardo.c, fg: CARBON });
    else cierre(t, HO.cierre, fin);
    destellos(t);
    grain(i);
  },
};

/* ---------- Correas: corren en las franjas del inicio y una cruza la pantalla como un látigo ---------- */

// Va al tempo de «Dracula» de Tame Impala (115 golpes por minuto): TACHAS en el tiempo 2, las franjas se van en el 6 y
// medio, la punta revienta en el 8 (4,17 s), al empezar el tercer compás, y el logo cae en el 9. Entre las franjas y el
// latigazo la pantalla queda vacía apenas un cuarto de segundo.
const CO_T = 60 / 115;
const CO = { tachas: 2 * CO_T, frena: 6.5 * CO_T, dura: 0.45, crack: 0.86 };
CO.latigo = 8 * CO_T - CO.dura * CO.crack; // la punta revienta justo en el tiempo 8
CO.entra = CO.frena + 0.2;
CO.cierre = 9 * CO_T - 0.55;
const TH0 = rad(-100);
const TH1 = rad(-43);

// La pose del látigo en el instante tau (0 a 1): la mano gira y cada punto de la correa sigue al de antes con retraso,
// así que la curva corre hasta la punta y la punta revienta al final.
function poseLatigo(tau, L, n) {
  const k = 0.62;
  const m = easeOut(clamp01(tau));
  let x = lerp(-150, -40, m);
  let y = lerp(1760, 1580, m);
  const ds = L / n;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = clamp01((tau - (k * i) / n) / (1 - k));
    const th = TH0 + (TH1 - TH0) * easeBack(u, 3);
    pts.push([x, y, th]);
    x += Math.cos(th) * ds;
    y += Math.sin(th) * ds;
  }
  return pts;
}
function dibujaCorrea(img, pts, bh, alpha = 1) {
  const n = pts.length - 1;
  const sw = img.width / n;
  const ds = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const [x, y, th] = pts[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(th);
    ctx.drawImage(img, i * sw, 0, sw, img.height, 0, -bh / 2, ds * 1.15, bh);
    ctx.restore();
  }
  ctx.restore();
}

const correas = {
  seconds: Math.round((CO.cierre + 0.55 + 3.9) * 10) / 10,
  async setup() {
    const list = {};
    for (let k = 1; k <= 12; k++) list['c' + k] = `${AS}correa-${String(k).padStart(2, '0')}.svg`;
    await assets(list);
    // Cada correa, ya dibujada a su tamaño, para no rasterizar el SVG en cada cuadro.
    this.belts = {};
    for (let k = 1; k <= 12; k++) {
      const img = A['c' + k];
      const h = 104;
      const c = lienzo(Math.round((img.width / img.height) * h), h);
      c.getContext('2d').drawImage(img, 0, 0, c.width, h);
      this.belts[k] = c;
    }
    const lh = 96;
    const lat = lienzo(Math.round((A.c5.width / A.c5.height) * lh * 2), lh * 2);
    lat.getContext('2d').drawImage(A.c5, 0, 0, lat.width, lat.height);
    this.latigo = lat;
    this.L = (lat.width / lat.height) * lh;
    this.lh = lh;
    const crack = CO.latigo + CO.dura * CO.crack;
    this.crack = crack;
    const c = cierreGolpes(CO.cierre, CO_T);
    this.golpes = [[CO.tachas, 20, 0.12], [crack, 62, 0.18]].concat(c.golpes);
    // La música se acelera con las franjas, se calla antes del latigazo y cae con el logo.
    const logo = CO.cierre + 0.55;
    this.musica = {
      bpm: 60 / CO_T,
      origen: 0,
      logo,
      golpes: [CO.tachas],
      secciones: [[0, CO.frena, 'acelera'], [CO.frena, crack + 0.1, 'pausa'], [crack + 0.1, logo, 'subida'], [logo, this.seconds, 'caida']],
    };
    this.destellos = [[CO.tachas, 0.18, 0.06], [crack, 0.85, 0.07]].concat(c.destellos);
    this.sfx = [
      [0, 'whoosh', 0.8], [0.25, 'subida', 0.5], [CO.tachas, 'golpe', 1], [3 * CO_T, 'subida', 0.9],
      [CO.frena, 'whoosh', 1], [CO.entra, 'whoosh', 0.5], [crack - 0.1, 'latigo', 1],
    ].concat(c.sfx.filter((e) => e[1] !== 'subida'));
  },
  offset(t) {
    // la velocidad sube como con el scroll del inicio: de 260 a 2.000 px por segundo
    const a = 0.3;
    const b = 3.0;
    const x = seg(t, a, b);
    return 260 * t + 1740 * ((b - a) * Math.pow(x, 4) / 4 + Math.max(0, t - b));
  },
  bandas(t) {
    fondo(CARBON);
    textura('leopardo', 0.12, 0.4);
    const off = this.offset(t);
    const v = 260 + 1740 * Math.pow(seg(t, 0.3, 3.0), 3);
    const salida = easeIn(seg(t, CO.frena, CO.frena + 0.18));
    const banda = (cy, rot, bg, rows, sign) => {
      ctx.save();
      ctx.translate(W / 2 + sign * salida * 300, cy - sign * salida * 1500);
      ctx.rotate(rad(rot));
      const bh = 104;
      const pad = 26;
      const hb = rows.length * bh + (rows.length + 1) * pad;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, .6)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = 34;
      ctx.fillStyle = bg;
      ctx.fillRect(-1600, -hb / 2, 3200, hb);
      ctx.restore();
      rows.forEach((row, r) => {
        const y = -hb / 2 + pad + r * (bh + pad);
        const dir = r % 2 ? 1 : -1;
        const len = row.reduce((s, k) => s + this.belts[k].width + 50, 0);
        const samples = v > 900 ? 4 : 1;
        for (let q = 0; q < samples; q++) {
          ctx.globalAlpha = 1 / (q + 1);
          const o = dir * (off - (q * v) / FPS / samples) + r * 700;
          let x = (((o % len) + len) % len) - len - 1600;
          while (x < 1600) {
            for (const k of row) {
              const b = this.belts[k];
              if (x + b.width > -1600 && x < 1600) ctx.drawImage(b, x, y);
              x += b.width + 50;
            }
          }
        }
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    };
    banda(640, -8, COLORES.leopardo.c, [[1, 2, 4], [8, 11, 9]], 1);
    banda(1300, 6, COLORES.acido.c, [[3, 6, 12], [5, 7, 10]], -1);
    if (t >= CO.tachas) {
      const s = easeOut(seg(t, CO.tachas, CO.tachas + 0.1));
      ctx.save();
      ctx.globalAlpha = 1 - salida;
      anton('Tachas', W / 2, 1060, 280, HUESO, { align: 'center', scale: lerp(2, 1, s), alpha: s });
      // en una marquilla de carbón, porque debajo pasa la franja ácida y el hueso no se lee sobre ella
      const m = '(12) correas · ninguna igual';
      const tw = ancho(m.toUpperCase(), '700 30px "Space Mono"', 1.8) + 42;
      ctx.globalAlpha *= seg(t, CO.tachas + 0.15, CO.tachas + 0.25);
      marquilla(m, W / 2 - tw / 2, 1094, { bg: CARBON, fg: HUESO, size: 30, rot: -2 });
      ctx.restore();
    }
  },
  latigazo(t) {
    fondo(CARBON);
    textura('leopardo', 0.12, 0.4);
    const tau = (t - CO.latigo) / CO.dura;
    const n = 120;
    if (t < CO.latigo) {
      // entra desde la esquina de abajo
      const w = easeOut(seg(t, CO.entra, CO.latigo));
      const pts = poseLatigo(0, this.L, n).map(([x, y, th]) => [x + lerp(-420, 0, w), y + lerp(420, 0, w), th + rad(12) * (1 - w)]);
      dibujaCorrea(this.latigo, pts, this.lh);
      return;
    }
    // estela de la punta
    const tip = (tt) => poseLatigo(tt, this.L, n)[n];
    if (tau > 0.2) {
      ctx.save();
      ctx.strokeStyle = HUESO;
      ctx.lineCap = 'round';
      const now = Math.min(tau, CO.crack + 0.04);
      for (let k = 1; k <= 18; k++) {
        const a = tip(now - (k - 1) * 0.02);
        const b = tip(now - k * 0.02);
        ctx.globalAlpha = 0.65 * (1 - k / 19) * (1 - seg(tau, CO.crack + 0.04, 1));
        ctx.lineWidth = 34 * (1 - k / 20);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const [dt, a] of [[0.08, 0.12], [0.06, 0.18], [0.04, 0.26], [0.02, 0.4], [0, 1]]) dibujaCorrea(this.latigo, poseLatigo(Math.min(tau, 1) - dt, this.L, n), this.lh, a);
    const u = t - this.crack;
    if (u >= 0) {
      const [px, py] = tip(CO.crack);
      ctx.save();
      ctx.strokeStyle = HUESO;
      ctx.lineCap = 'round';
      const r = rng(5);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * 2 * Math.PI + r();
        const l0 = 40 + 60 * r();
        const l1 = l0 + (120 + 220 * r()) * easeOut(seg(u, 0, 0.08));
        ctx.globalAlpha = 1 - seg(u, 0.05, 0.16);
        ctx.lineWidth = 6 + 6 * r();
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * l0, py + Math.sin(a) * l0);
        ctx.lineTo(px + Math.cos(a) * l1, py + Math.sin(a) * l1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1 - seg(u, 0.04, 0.16);
      ctx.lineWidth = 12 * (1 - seg(u, 0, 0.16));
      ctx.beginPath();
      ctx.arc(px, py, 30 + 280 * easeOut(seg(u, 0, 0.16)), 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  },
  // La línea por donde se parte la pantalla: sigue la correa y pasa por donde revienta la punta.
  grieta(px, py, alpha) {
    const d = [Math.cos(TH1), Math.sin(TH1)];
    const nrm = [-d[1], d[0]];
    const r = rng(11);
    ctx.save();
    ctx.strokeStyle = HUESO;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 7;
    ctx.shadowColor = HUESO;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    for (let s = -2600; s <= 2600; s += 70) {
      const j = (r() - 0.5) * 40;
      const x = px + d[0] * s + nrm[0] * j;
      const y = py + d[1] * s + nrm[1] * j;
      s === -2600 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  },
  draw(i) {
    const t = i / FPS;
    begin(t);
    const fin = { tx: 'ceniza', acc: COLORES.leopardo.c, cta: 'Ya en la tienda', q: '¿Cuál es la tuya?', sub: 'Doce correas, ninguna igual · enlace en la bio', sello: 'TACHAS · NINGUNA IGUAL · TACHAS · NINGUNA IGUAL · ', tiempo: CO_T };
    const split = this.crack + 0.07;
    if (t < CO.frena + 0.2) this.bandas(t);
    else if (t < split) {
      this.latigazo(t);
      // dos cuadros con los colores al revés cuando revienta
      if (t >= this.crack && t < this.crack + 2 / FPS) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        onto(BUF_A, () => ctx.drawImage(out, 0, 0));
        ctx.filter = 'invert(1)';
        ctx.drawImage(BUF_A, 0, 0);
        ctx.filter = 'none';
        begin(t);
      }
    } else {
      // la pantalla se parte por la línea del latigazo y las dos mitades se van; detrás cae el logo
      const [px, py] = poseLatigo(CO.crack, this.L, 120)[120];
      onto(BUF_A, () => {
        this.latigazo(split);
        this.grieta(px, py, 1);
      });
      cierre(t, CO.cierre, fin);
      const p = Math.pow(seg(t, split, split + 0.32), 2);
      if (p < 1) {
        const d = [Math.cos(TH1), Math.sin(TH1)];
        const nrm = [-d[1], d[0]];
        for (const sign of [1, -1]) {
          ctx.save();
          ctx.translate(sign * nrm[0] * 1500 * p, sign * nrm[1] * 1500 * p);
          ctx.beginPath();
          ctx.moveTo(px - d[0] * 4000, py - d[1] * 4000);
          ctx.lineTo(px + d[0] * 4000, py + d[1] * 4000);
          ctx.lineTo(px + d[0] * 4000 + sign * nrm[0] * 4000, py + d[1] * 4000 + sign * nrm[1] * 4000);
          ctx.lineTo(px - d[0] * 4000 + sign * nrm[0] * 4000, py - d[1] * 4000 + sign * nrm[1] * 4000);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(BUF_A, 0, 0);
          ctx.restore();
        }
      }
    }
    destellos(t);
    grain(i);
  },
};

/* ---------- Cuadros ---------- */

const REELS = { adelanto, giro, hoy, correas };
const reel = REELS[REEL];
window.FRAMES = Math.round(reel.seconds * FPS);
window.FPS = FPS;
window.frame = (i) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  reel.draw(i);
  return out.toDataURL('image/png');
};
(async () => {
  await Promise.all(['400 100px Anton', '400 28px "Space Mono"', '700 28px "Space Mono"', '400 40px "Space Grotesk"', '500 40px "Space Grotesk"'].map((f) => document.fonts.load(f)));
  await texturas();
  await assets({ logo: AS + 'hight-logo-plata.webp' });
  await reel.setup();
  GOLPES = reel.golpes || [];
  DESTELLOS = reel.destellos || [];
  window.SFX = { seconds: reel.seconds, events: reel.sfx || [], musica: reel.musica || null };
  reel.draw(0);
  window.ready = true;
})().catch((e) => {
  window.failed = String(e && e.message ? e.message : e);
});
