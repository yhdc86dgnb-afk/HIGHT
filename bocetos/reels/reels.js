/*
 * HIGHT · Reels del lanzamiento: 1080 × 1920, 30 cuadros por segundo, sin sonido.
 *
 * reels.html?r=adelanto   la estrella, DROP 01 y seis prendas en cianotipo; cierra con PRONTO
 * reels.html?r=giro       tres prendas dan una vuelta entera en su percha, como en el visor 360 de la tienda
 * reels.html?r=correas    las correas de tachas corren en diagonal, como la cinta del inicio
 * reels.html?r=hoy        las 20 piezas aparecen una por una y después HOY
 *
 * Misma identidad que los posts (bocetos/instagram): noche con halo azul y grano, plata cepillada, Hight Espina en
 * cromo para los títulos y la mono para los datos. Los textos quedan fuera de los 250 px de arriba y de abajo, donde
 * Instagram pone su interfaz.
 *
 * window.frame(i) dibuja el cuadro i y lo devuelve como PNG (data URL); window.FRAMES dice cuántos tiene el reel.
 */
import * as THREE from '../../assets/three.module.min.js';
import { drape } from '../../assets/hight-ropa.js';

const params = new URLSearchParams(location.search);
const REEL = params.get('r') || 'adelanto';
const W = 1080;
const H = 1920;
const FPS = 30;
const SS = Number(params.get('ss') || 2); // el 3D se dibuja SS veces más grande y se achica: bordes suaves
const DS = '../../design-system/';
const IMG = '../instagram/imagenes/';
const SAFE_TOP = 290;
const SAFE_BOTTOM = H - 290;

const out = document.createElement('canvas');
out.width = W;
out.height = H;
document.body.appendChild(out);
const ctx = out.getContext('2d');

/* ---------- Ayudas de dibujo ---------- */

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function contain(img, cx, cy, maxW, maxH, scale = 1, alpha = 1) {
  const s = Math.min(maxW / img.width, maxH / img.height) * scale;
  const w = img.width * s;
  const h = img.height * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.globalAlpha = 1;
  return { w, h };
}

function cover(img) {
  const s = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
}

function night() {
  ctx.fillStyle = '#070a11';
  ctx.fillRect(0, 0, W, H);
}

function halo(cx, cy, r, alpha = 1) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(111, 162, 255, ${0.5 * alpha})`);
  g.addColorStop(0.34, `rgba(111, 162, 255, ${0.17 * alpha})`);
  g.addColorStop(0.66, 'rgba(111, 162, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

// Grano de película: un mosaico de ruido de 2 px que salta de lugar cada dos cuadros, suave para que la compresión de
// Instagram no lo vuelva bloques.
const noise = document.createElement('canvas');
noise.width = noise.height = 512;
{
  const n = noise.getContext('2d');
  const data = n.createImageData(512, 512);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < data.data.length; k += 4) {
    const v = 255 * rand();
    data.data.set([v, v, v, 255], k);
  }
  n.putImageData(data, 0, 0);
}
function grain(i, alpha = 0.12) {
  const k = i >> 1;
  const ox = (k * 197) % 1024;
  const oy = (k * 331) % 1024;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  for (let y = -oy; y < H; y += 1024) for (let x = -ox; x < W; x += 1024) ctx.drawImage(noise, x, y, 1024, 1024);
  ctx.restore();
}

function flash(alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(230, 239, 255, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function chrome(text, cx, y, size, alpha = 1, glow = true) {
  ctx.save();
  ctx.font = `${size}px Espina`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const g = ctx.createLinearGradient(0, y - size * 0.82, 0, y + size * 0.1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, '#e4e8ef');
  g.addColorStop(0.49, '#7c8088');
  g.addColorStop(0.62, '#f2f6ff');
  g.addColorStop(1, '#a9b0bd');
  ctx.globalAlpha = alpha;
  if (glow) {
    ctx.shadowColor = 'rgba(111, 162, 255, 0.75)';
    ctx.shadowBlur = size * 0.22;
  }
  ctx.fillStyle = g;
  ctx.fillText(text, cx, y);
  ctx.restore();
}

function label(text, x, y, { size = 28, color = '#e3e6eb', align = 'left', alpha = 1, weight = 500 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px Plex`;
  ctx.letterSpacing = `${(size * 0.08).toFixed(1)}px`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

function serif(text, x, y, size, color = '#e3e6eb', alpha = 1, align = 'left') {
  ctx.save();
  ctx.font = `italic ${size}px Serif`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillText(text, x, y);
  ctx.restore();
}

const A = {};
async function assets(list) {
  await Promise.all(Object.entries(list).map(async ([k, src]) => (A[k] = await loadImage(src))));
}

function corners(i, dark = true) {
  const c = dark ? '#e3e6eb' : '#0b1222';
  label('(N1)', 60, SAFE_TOP, { size: 24, color: c });
  label('MED/COL', W - 60, SAFE_TOP, { size: 24, color: c, align: 'right' });
}

/* ---------- Adelanto ---------- */

// La tercera columna dice si la foto original corta la prenda por la derecha: ese lado toca el borde del reel.
const CIANO = [
  ['chaqueta-trouble-maker', 'Chaqueta Trouble Maker'],
  ['buzo-destroyed-ceniza', 'Buzo Destroyed Ceniza'],
  ['tejido-anillos-indigo', 'Tejido Anillos Índigo', 'derecha'],
  ['jean-flare-patchwork-leopardo', 'Jean Flare Patchwork Leopardo'],
  ['chaqueta-smiley-acido', 'Chaqueta Smiley Ácido'],
  ['jean-patchwork-estrellas-violeta', 'Jean Patchwork Estrellas Violeta'],
];

const adelanto = {
  seconds: 10,
  async setup() {
    const list = { star: DS + 'graficos/estrella-luz.svg', logo: DS + 'logos/hight-wordmark-plata.svg' };
    CIANO.forEach(([h]) => (list[h] = IMG + h + '-ciano.webp'));
    await assets(list);
  },
  draw(i) {
    const t = i / FPS;
    night();
    if (t < 3.4) {
      halo(540, 820, 200 + 760 * easeOut(seg(t, 0.2, 2.2)));
      const s = 400 * easeOut(seg(t, 0.1, 0.9));
      if (s > 1) contain(A.star, 540, 700, s, s);
      // destello cuando la estrella termina de abrir
      const f = seg(t, 0.75, 0.95) * (1 - seg(t, 0.95, 1.35));
      if (f > 0) contain(A.star, 540, 700, 400 + 500 * f, 400 + 500 * f, 1, 0.5 * f);
      const word = 'DROP 01';
      ctx.font = '196px Espina';
      const total = ctx.measureText(word).width;
      let x = 540 - total / 2;
      for (let k = 0; k < word.length; k++) {
        const ch = word[k];
        const w = ctx.measureText(ch).width;
        const a = easeOut(seg(t, 1.2 + 0.12 * k, 1.45 + 0.12 * k));
        if (a > 0) chrome(ch, x + w / 2, 1090 + 30 * (1 - a), 196, a);
        x += w;
      }
      label('Ediciones cortas · denim intervenido', 540, 1210, { size: 27, align: 'center', color: '#a2a8b4', alpha: seg(t, 2.5, 2.9) });
      corners(i);
    } else if (t < 7.6) {
      const k = Math.min(CIANO.length - 1, Math.floor((t - 3.4) / 0.7));
      const p = (t - 3.4 - k * 0.7) / 0.7;
      const [h, name, corte] = CIANO[k];
      const img = A[h];
      const scale = 1.06 - 0.06 * p;
      const cx = corte ? W - (Math.min(980 / img.width, 1120 / img.height) * scale * img.width) / 2 : 540;
      halo(540, 930, 820);
      contain(img, cx, 930, 980, 1120, scale);
      label(name, 540, SAFE_BOTTOM - 40, { size: 28, align: 'center' });
      label(`${String(k + 1).padStart(2, '0')} / 06`, 540, SAFE_BOTTOM + 6, { size: 22, align: 'center', color: '#a2a8b4' });
      corners(i);
      flash(0.35 * (1 - seg(p, 0, 0.12)));
    } else {
      const a = easeOut(seg(t, 7.6, 8.0));
      halo(540, 860, 860, a);
      contain(A.star, 540, 720, 280, 280, 1, a);
      chrome('PRONTO', 540, 1110, 168, a);
      label('Drop 01', 540, 1230, { size: 28, align: 'center', color: '#a2a8b4', alpha: a });
      contain(A.logo, 540, SAFE_BOTTOM - 30, 240, 46, 1, a);
      corners(i);
      flash(0.35 * (1 - seg(t, 7.6, 7.72)));
    }
    grain(i);
  },
};

/* ---------- Giro: las prendas en 3D, con la forma de ropa y la percha del visor ---------- */

const GIRO = [
  ['chaqueta-smiley-acido', 'Chaqueta Smiley Ácido', '$620.000', false],
  ['jean-flare-costura-neon', 'Jean Flare Costura Neón', '$560.000', true],
  ['buzo-multitud-termica', 'Buzo Multitud Térmica', '$390.000', false],
];
const GW = 1080;
const GH = 1240;
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

const giro = {
  seconds: 13,
  async setup() {
    await assets({ logo: DS + 'logos/hight-wordmark-plata.svg' });
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
    for (const [h, name, price, bottom] of GIRO) {
      const base = '../../assets/360-' + h;
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
      const g = garment(data, tex(frente), tex(espalda), alto, lado, bottom, h, steps, weave);
      // centrada y del alto justo para el cuadro del 3D
      const box = new THREE.Box3().setFromObject(g);
      const c = box.getCenter(new THREE.Vector3());
      g.position.sub(c);
      const pivot = new THREE.Group();
      pivot.add(g);
      pivot.visible = false;
      this.scene.add(pivot);
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.z) / 2;
      this.items.push({ pivot, name, price, height: size.y, radius });
    }
  },
  draw(i) {
    const t = i / FPS;
    night();
    halo(540, 930, 800);
    chrome('360', 540, SAFE_TOP + 150, 160, 1);
    const k = Math.min(this.items.length, Math.floor(t / 4));
    if (k < this.items.length) {
      const it = this.items[k];
      const p = (t - k * 4) / 4;
      this.items.forEach((o) => (o.pivot.visible = o === it));
      // una vuelta entera: se queda un poco de frente al empezar y al terminar
      it.pivot.rotation.y = 2 * Math.PI * (p - Math.sin(2 * Math.PI * p) / (2 * Math.PI));
      const fov = (this.camera.fov * Math.PI) / 180;
      const dist = (it.height * 0.56) / Math.tan(fov / 2) + it.radius;
      this.camera.position.set(0, 0, dist);
      this.camera.lookAt(0, 0, 0);
      this.renderer.render(this.scene, this.camera);
      const a = seg(p, 0, 0.06) * (1 - seg(p, 0.94, 1));
      ctx.globalAlpha = a;
      ctx.drawImage(this.renderer.domElement, 0, 340, GW, GH);
      ctx.globalAlpha = 1;
      label(it.name, 540, SAFE_BOTTOM - 46, { size: 30, align: 'center', alpha: a });
      label(it.price, 540, SAFE_BOTTOM + 2, { size: 26, align: 'center', color: '#a2a8b4', alpha: a });
    } else {
      const a = easeOut(seg(t, 12, 12.4));
      label('Vista 360° en la tienda', 540, 980, { size: 34, align: 'center', alpha: a });
      contain(A.logo, 540, SAFE_BOTTOM - 30, 240, 46, 1, a);
    }
    corners(i);
    grain(i);
  },
};

/* ---------- Correas ---------- */

const correas = {
  seconds: 9,
  async setup() {
    const list = { logo: DS + 'logos/hight-wordmark-plata.svg' };
    for (let k = 1; k <= 12; k++) list['c' + k] = `../../assets/correa-${String(k).padStart(2, '0')}.svg`;
    await assets(list);
    // Cada correa, ya dibujada al tamaño del reel, para no rasterizar el SVG en cada cuadro.
    this.belts = {};
    for (let k = 1; k <= 12; k++) {
      const img = A['c' + k];
      const h = 200;
      const w = Math.round((img.width / img.height) * h);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      this.belts[k] = c;
    }
    this.rows = [[4, 1, 7], [2, 9, 5], [7, 12, 3], [11, 6, 8], [9, 2, 10], [5, 4, 1], [12, 8, 6], [3, 10, 11]];
  },
  draw(i) {
    const t = i / FPS;
    night();
    halo(540, 900, 980);
    ctx.save();
    ctx.translate(540, 960);
    ctx.rotate((-28 * Math.PI) / 180);
    this.rows.forEach((row, r) => {
      const y = (r - (this.rows.length - 1) / 2) * 250;
      const dir = r % 2 ? 1 : -1;
      // La fila es una tira de tres correas que se repite; corre a 210 px por segundo, unas filas a cada lado.
      const len = row.reduce((s, k) => s + this.belts[k].width + 40, 0);
      const u = (((dir * 210 * t + r * 911) % len) + len) % len;
      let x = u - len - 1200;
      while (x < 1200) {
        for (const k of row) {
          const b = this.belts[k];
          if (x + b.width > -1200 && x < 1200) ctx.drawImage(b, x, y - b.height / 2);
          x += b.width + 40;
        }
      }
    });
    ctx.restore();
    const a = easeOut(seg(t, 5.4, 5.9));
    if (a > 0) {
      ctx.fillStyle = `rgba(7, 10, 17, ${0.86 * a})`;
      ctx.fillRect(0, 1270, W, 400);
      chrome('TACHAS', 540, 1480, 170, a);
      label('Doce correas, ninguna igual', 540, 1580, { size: 28, align: 'center', color: '#a2a8b4', alpha: a });
    }
    contain(A.logo, W - 60 - 80, SAFE_TOP - 12, 160, 30);
    label('(N1) — Correas', 60, SAFE_TOP, { size: 24 });
    grain(i);
  },
};

/* ---------- Hoy ---------- */

const PIEZAS = [
  ['chaqueta-trouble-maker', 'recorte'], ['chaqueta-smiley-acido', 'recorte'], ['chaqueta-blood-rose', 'dibujo'], ['buzo-multitud-termica', 'recorte'],
  ['buzo-destroyed-ceniza', 'recorte'], ['tejido-anillos-indigo', 'recorte'], ['tejido-deshilado-ceniza', 'recorte'], ['camiseta-celula-carmin', 'recorte'],
  ['top-halftone-carmin', 'recorte'], ['top-crop-rostros', 'recorte'], ['top-malla-asimetrico-rojo', 'recorte'], ['jean-flare-patchwork-leopardo', 'recorte'],
  ['jean-flare-dragon-acido', 'recorte'], ['jean-flare-destroyed-verde', 'recorte'], ['jean-flare-costura-neon', 'recorte'], ['jean-patchwork-cuadros', 'recorte'],
  ['jean-patchwork-estrellas-violeta', 'recorte'], ['jean-wide-patchwork-indigo', 'recorte'], ['jean-wide-fleco-indigo', 'recorte'], ['short-camuflado-leopardo-rosa', 'recorte'],
];

const hoy = {
  seconds: 10,
  async setup() {
    const list = { star: DS + 'graficos/estrella-luz.svg', logo: DS + 'logos/hight-wordmark-plata.svg', plata: DS + 'graficos/plata-cepillada.svg' };
    PIEZAS.forEach(([h, k]) => (list[h] = IMG + `${h}-${k}.webp`));
    await assets(list);
    // La plata cepillada, una vez, ya al tamaño del reel.
    this.plata = document.createElement('canvas');
    this.plata.width = W;
    this.plata.height = H;
    const p = this.plata.getContext('2d');
    const s = Math.max(W / A.plata.width, H / A.plata.height);
    p.drawImage(A.plata, (W - A.plata.width * s) / 2, (H - A.plata.height * s) / 2, A.plata.width * s, A.plata.height * s);
  },
  draw(i) {
    const t = i / FPS;
    if (t < 4.3) {
      ctx.drawImage(this.plata, 0, 0);
      label('Drop 01 — las 20 piezas', 60, SAFE_TOP, { size: 24, color: '#0b1222' });
      label('MED/COL', W - 60, SAFE_TOP, { size: 24, color: '#0b1222', align: 'right' });
      const cols = 4;
      const cw = (W - 120) / cols;
      const ch = (SAFE_BOTTOM - 40 - (SAFE_TOP + 40)) / 5;
      PIEZAS.forEach(([h], k) => {
        const a = easeOut(seg(t, 0.25 + k * 0.16, 0.55 + k * 0.16));
        if (a <= 0) return;
        const cx = 60 + cw * (k % cols) + cw / 2;
        const cy = SAFE_TOP + 40 + ch * Math.floor(k / cols) + ch / 2;
        contain(A[h], cx, cy, cw - 26, ch - 30, 0.7 + 0.3 * a, a);
      });
      flash(seg(t, 4.0, 4.3));
    } else {
      night();
      const p = seg(t, 4.3, 8.5);
      halo(540, 900, 860 + 120 * p);
      contain(A.star, 540, 620, 250, 250, 0.9 + 0.1 * easeOut(p));
      chrome('HOY', 540, 1150, 330, 1);
      label('Drop 01 · máximo 4 por talla', 540, 1290, { size: 28, align: 'center', color: '#a2a8b4' });
      const b = easeOut(seg(t, 8.3, 8.8));
      label('En el enlace de la bio', 540, 1380, { size: 30, align: 'center', alpha: b });
      contain(A.logo, 540, SAFE_BOTTOM - 30, 240, 46, 1, b);
      corners(i);
      flash(0.9 * (1 - seg(t, 4.3, 4.6)));
      grain(i);
    }
  },
};

/* ---------- Cuadros ---------- */

const REELS = { adelanto, giro, correas, hoy };
const reel = REELS[REEL];
window.FRAMES = reel.seconds * FPS;
window.FPS = FPS;
window.frame = (i) => {
  reel.draw(i);
  return out.toDataURL('image/png');
};
(async () => {
  await Promise.all(['196px Espina', '500 28px Plex', 'italic 40px Serif', '700 40px Archivo'].map((f) => document.fonts.load(f)));
  await reel.setup();
  reel.draw(0);
  window.ready = true;
})().catch((e) => {
  window.failed = String(e && e.message ? e.message : e);
});
