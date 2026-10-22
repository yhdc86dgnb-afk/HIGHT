/*
 * HIGHT · En movimiento (video de campaña).
 *
 * Dos rieles de tintorería con las 26 prendas dibujadas en vector, las mismas del visor 360: arriba cuelgan las
 * prendas de arriba y abajo las de abajo, y los rieles corren en sentidos contrarios. Cada prenda cuelga de un
 * gancho, da una vuelta entera mientras cruza la pantalla y mira de frente al pasar por el centro. Los rieles son
 * cintas métricas y cada gancho es una de sus marcas. Sin letras: el texto lo pone la sección del tema. El bucle
 * es exacto: el cuadro FRAMES es igual al cuadro 0.
 *
 * window.frame(i) dibuja el cuadro i y lo devuelve como PNG (data URL).
 */
import * as THREE from '../../assets/three.module.min.js';

const params = new URLSearchParams(location.search);
const W = Number(params.get('w') || 1920);
const H = Number(params.get('h') || 1080);
const SS = Number(params.get('ss') || 1); // se dibuja SS veces más grande y se achica: bordes suaves
const FPS = 30;
const SECONDS = 20;
const FRAMES = FPS * SECONDS;
const UNIT = H / 10.8;   // px por unidad en el plano de las prendas
const FOV = 20;
const INK = 0x0d0c0b;
const BONE = 0xece3d0;
const THICK = 0.13;      // hondo máximo de cada cara, sobre el ancho de la prenda (igual que el visor)
const LINE = Number(params.get('line') || 0.02);       // trazo negro de la ilustración
const STICKER = Number(params.get('sticker') || 0.075); // borde hueso, como un sticker recortado
const EASE = Number(params.get('ease') ?? 0.3);           // pausa de frente y de espalda al girar

const ROWS = [
  {
    // Arriba: chaquetas, buzos, tejidos, tops y la camiseta, hacia la izquierda.
    dir: -1, spacing: 3.8, boxW: 3.25, boxH: 3.3, rail: 4.62, hook: 0.3,
    items: ['chaqueta-trouble-maker', 'top-halftone-carmin', 'tejido-anillos-indigo', 'chaqueta-smiley-acido', 'buzo-sakura-rosa', 'camiseta-celula-carmin', 'buzo-multitud-termica', 'top-malla-asimetrico-rojo', 'tejido-deshilado-ceniza', 'top-crop-rostros', 'chaqueta-blood-rose', 'buzo-destroyed-ceniza'],
  },
  {
    // Abajo: jeans, pantalones y el short, hacia la derecha.
    dir: 1, spacing: 3.3, boxW: 2.85, boxH: 3.95, rail: 0.42, hook: 0.3,
    items: ['jean-flare-costura-neon', 'pantalon-hibrido-carmin', 'jean-wide-fleco-indigo', 'jean-flare-dragon-acido', 'jean-patchwork-cuadros', 'jean-pintado-fucsia', 'jean-musgo', 'short-camuflado-leopardo-rosa', 'jean-wide-ojales-ceniza', 'jean-flare-patchwork-leopardo', 'pantalon-hojas-carbon', 'jean-patchwork-estrellas-violeta', 'jean-flare-destroyed-verde', 'jean-wide-patchwork-indigo'],
  },
];

/* ---------- Material de ilustración (el mismo del visor 360) ---------- */

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
  const steps = 16;
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const v = (i + 0.5) / steps >= 0.68 ? 255 : 112;
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
const STEPS = toonSteps();

function material(texture, weave, px) {
  const material = new THREE.MeshToonMaterial({ map: texture, gradientMap: STEPS });
  const uWeave = { value: weave };
  const uPx = { value: px };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWeave = uWeave;
    shader.uniforms.uPx = uPx;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 side;\nvarying vec4 vSide;\nvarying vec3 vFront;\nvarying vec3 vObj;\nvarying vec3 vObjN;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSide = side;\nvObj = transformed;\nvObjN = objectNormal;\nvFront = normalize( mat3( modelViewMatrix ) * vec3( 0.0, 0.0, 1.0 ) );'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vSide;\nvarying vec3 vFront;\n' + FABRIC)
      .replace(
        '#include <normal_fragment_maps>',
        [
          '#include <normal_fragment_maps>',
          'if ( vSide.a > 0.5 ) {',
          '  vec3 front = normalize( vFront );',
          '  float facing = abs( dot( normalize( vViewPosition ), front ) );',
          '  float tilt = abs( dot( normal, front ) );',
          '  if ( tilt < 1.0 - facing * facing ) diffuseColor.rgb = fabric( vSide.rgb, vObj, vObjN );',
          '}',
        ].join('\n')
      );
  };
  return material;
}
const lineMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const stickerMaterial = new THREE.MeshBasicMaterial({ color: BONE, side: THREE.BackSide });

/* ---------- Una prenda: volumen cerrado con su dibujo, como en el visor ---------- */

function gridPixels(image, gw, gh) {
  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, gw, gh).data;
}
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function buildGarment(data, maps, row) {
  const [gw, gh] = data.grid;
  const [tw, th] = data.tex;
  const step = data.step;
  // Caja de la silueta (en px del dibujo), con el borde exacto.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  data.rim.x.forEach((x, r) => {
    const y = data.rim.y[r];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  });
  const cx = (x0 + x1) / 2 + 0.5, cy = (y0 + y1) / 2 + 0.5;
  const s = Math.min(row.boxW / (x1 - x0), row.boxH / (y1 - y0));
  const pixels = gridPixels(maps.alto, gw, gh);
  const sidePixels = gridPixels(maps.lado, gw, gh);
  const depth = THICK * data.widthPx * s;
  const n = gw * gh;
  const heights = new Float32Array(n);
  for (let k = 0; k < n; k++) heights[k] = pixels[k * 4] / 255;
  const positions = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);
  const place = (k, x, y, z) => {
    positions[k * 3] = (x - cx) * s;
    positions[k * 3 + 1] = (cy - y) * s;
    positions[k * 3 + 2] = z;
    uvs[k * 2] = x / tw;
    uvs[k * 2 + 1] = 1 - y / th;
  };
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      place(k, Math.min(i * step, tw - 1) + 0.5, Math.min(j * step, th - 1) + 0.5, heights[k] * depth);
    }
  }
  const side = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const r = sidePixels[k * 4], g = sidePixels[k * 4 + 1], b = sidePixels[k * 4 + 2];
    if (r + g + b === 0) continue;
    side.set([toLinear(r / 255), toLinear(g / 255), toLinear(b / 255), 1], k * 4);
  }
  const onRim = new Uint8Array(n);
  data.rim.i.forEach((k, r) => {
    onRim[k] = 1;
    place(k, data.rim.x[r] + 0.5, data.rim.y[r] + 0.5, 0);
  });
  const front = [];
  const back = [];
  for (let j = 0; j < gh - 1; j++) {
    for (let i = 0; i < gw - 1; i++) {
      const a = j * gw + i;
      const b = a + 1;
      const c = a + gw;
      const d = c + 1;
      if (heights[a] > 0 || heights[b] > 0 || heights[c] > 0 || heights[d] > 0) {
        front.push(a, c, b, b, c, d);
        back.push(a, b, c, b, d, c);
      }
    }
  }
  const weave = { sarga: 0, punto: 1, jersey: 2, malla: 2 }[data.tela] ?? 0;
  const group = new THREE.Group();
  const surface = (sign, index, texture) => {
    const pos = positions.slice();
    if (sign < 0) for (let k = 0; k < n; k++) pos[k * 3 + 2] = -pos[k * 3 + 2];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('side', new THREE.BufferAttribute(side, 4));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal.array;
    for (let k = 0; k < n; k++) {
      if (!onRim[k]) continue;
      const x = normals[k * 3], y = normals[k * 3 + 1];
      const l = Math.hypot(x, y);
      normals[k * 3] = l > 1e-6 ? x / l : 0;
      normals[k * 3 + 1] = l > 1e-6 ? y / l : 0;
      normals[k * 3 + 2] = 0;
    }
    group.add(new THREE.Mesh(geometry, material(texture, weave, s)));
    // Trazo negro y, por fuera, el borde hueso: la misma cara inflada y vista por dentro.
    for (const [offset, mat] of [[LINE, lineMaterial], [STICKER, stickerMaterial]]) {
      const shell = new THREE.BufferGeometry();
      const p = pos.slice();
      for (let k = 0; k < p.length; k++) p[k] += normals[k] * offset;
      shell.setAttribute('position', new THREE.BufferAttribute(p, 3));
      shell.setIndex(index);
      group.add(new THREE.Mesh(shell, mat));
    }
  };
  surface(1, front, maps.frente);
  surface(-1, back, maps.espalda);
  // Cuelga del gancho: la parte más alta queda a `hook` del riel y el gancho baja hasta la tela en el eje de giro.
  group.position.y = row.rail - row.hook - (cy - (y0 + 0.5)) * s;
  let axisTop = Infinity;
  data.rim.x.forEach((x, r) => {
    if (Math.abs(x + 0.5 - cx) < 3 * step) axisTop = Math.min(axisTop, data.rim.y[r] + 0.5);
  });
  if (!isFinite(axisTop)) axisTop = y0 + 0.5;
  group.userData.hookEnd = group.position.y + (cy - axisTop) * s;
  return group;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

/* ---------- Escena ---------- */

const renderer = new THREE.WebGLRenderer({ antialias: params.get('aa') !== '0', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const anisotropy = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, W / H, 1, 120);
camera.position.set(0, 0, 5.4 / Math.tan((FOV * Math.PI) / 360));
scene.add(camera);
scene.add(new THREE.AmbientLight(0xffffff, 0.38 * Math.PI));
const key = new THREE.DirectionalLight(0xffffff, 0.62 * Math.PI);
key.position.set(-0.55, 0.65, 0);
key.target.position.set(0, 0, -1);
camera.add(key, key.target);

// Fondo: negro con la grilla de puntos del visor, las cintas y sus etiquetas (se dibuja en 2D cada cuadro).
const paper = document.createElement('canvas');
paper.width = W;
paper.height = H;
{
  const ctx = paper.getContext('2d');
  ctx.fillStyle = '#0d0c0b';
  ctx.fillRect(0, 0, W, H);
  const gap = Math.round(UNIT * 0.18);
  ctx.fillStyle = 'rgba(236, 227, 208, 0.085)';
  for (let y = gap / 2; y < H; y += gap) {
    for (let x = gap / 2; x < W; x += gap) {
      ctx.beginPath();
      ctx.arc(x, y, UNIT * 0.013, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
const back = document.createElement('canvas');
back.width = W;
back.height = H;
const bctx = back.getContext('2d');
const backTexture = new THREE.CanvasTexture(back);
backTexture.colorSpace = THREE.SRGBColorSpace;
backTexture.minFilter = THREE.LinearFilter;
backTexture.generateMipmaps = false;
scene.background = backTexture;

const sx = (x) => W / 2 + x * UNIT;
const sy = (y) => H / 2 - y * UNIT;

function drawBack(rows) {
  bctx.drawImage(paper, 0, 0);
  bctx.fillStyle = 'rgba(236, 227, 208, 0.9)';
  const thin = Math.max(2, Math.round(UNIT * 0.018));
  for (const row of rows) {
    const y = sy(row.rail);
    const tick = row.spacing / 10;
    bctx.fillRect(0, Math.round(y - UNIT * 0.016), W, Math.max(3, Math.round(UNIT * 0.032)));
    // Marcas de la cinta métrica, pintadas en el riel: avanzan con las prendas.
    const first = Math.floor((-9.8 - row.offset) / tick);
    const last = Math.ceil((9.8 - row.offset) / tick);
    for (let k = first; k <= last; k++) {
      const m = ((k % 10) + 10) % 10;
      if (m === 0) continue;
      const x = sx(k * tick + row.offset);
      bctx.fillRect(Math.round(x - thin / 2), Math.round(y - (m === 5 ? 0.13 : 0.075) * UNIT), thin, Math.round((m === 5 ? 0.13 : 0.075) * UNIT));
    }
    // Ganchos: la marca larga de cada prenda baja del riel hasta la tela.
    for (const g of row.garments) {
      const x = sx(g.x);
      if (x < -UNIT || x > W + UNIT) continue;
      const end = sy(g.group.userData.hookEnd) + UNIT * 0.05;
      bctx.fillRect(Math.round(x - thin / 2), Math.round(y), thin, Math.round(end - y));
      bctx.beginPath();
      bctx.arc(x, y, UNIT * 0.05, 0, Math.PI * 2);
      bctx.fill();
    }
  }
  backTexture.needsUpdate = true;
}

const rows = ROWS.map((row) => ({ ...row, offset: 0, garments: [] }));

async function setup() {
  for (const row of rows) {
    const P = row.items.length * row.spacing;
    await Promise.all(
      row.items.map(async (handle, index) => {
        const base = '../../assets/360-' + handle;
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
          t.anisotropy = anisotropy;
          t.needsUpdate = true;
          return t;
        };
        const group = buildGarment(data, { frente: tex(frente), espalda: tex(espalda), alto, lado }, row);
        scene.add(group);
        // Repartidas a lo largo de la cinta; la primera queda en el centro al empezar.
        row.garments[index] = { handle, group, x0: index * row.spacing - (index * row.spacing > P / 2 ? P : 0), x: 0 };
      })
    );
  }
  window.frame(0);
  window.ready = true;
}

// Cuadro i (0 ≤ i < FRAMES): cada cinta avanza su largo entero en el bucle y cada prenda gira según dónde está.
window.frame = (i, format = 'image/png') => {
  const t = (((i % FRAMES) + FRAMES) % FRAMES) / FRAMES;
  for (const row of rows) {
    const P = row.items.length * row.spacing;
    row.offset = row.dir * P * t;
    for (const g of row.garments) {
      const x = ((((g.x0 + row.offset + P / 2) % P) + P) % P) - P / 2;
      g.x = x;
      g.group.position.x = x;
      // Vuelta entera al cruzar: se queda más de frente y de espalda, y pasa rápido por el costado.
      const phase = (-2 * Math.PI * x) / (P / 2);
      g.group.rotation.y = phase - EASE * Math.sin(2 * phase);
    }
    // Las etiquetas siguen a las prendas en la cinta (posición sin envolver, para que las marcas no salten).
    row.offset = ((((row.offset + P / 2) % P) + P) % P) - P / 2;
  }
  drawBack(rows);
  renderer.render(scene, camera);
  if (!format) return null;
  if (SS === 1) return renderer.domElement.toDataURL(format);
  octx.drawImage(renderer.domElement, 0, 0, out.width, out.height);
  return out.toDataURL(format);
};
const out = document.createElement('canvas');
out.width = Math.round(W / SS);
out.height = Math.round(H / SS);
const octx = out.getContext('2d');
octx.imageSmoothingEnabled = true;
octx.imageSmoothingQuality = 'high';
window.FRAMES = FRAMES;
window.FPS = FPS;
setup().catch((e) => {
  window.failed = String(e && e.message ? e.message : e);
});
