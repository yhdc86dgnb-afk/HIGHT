/*
 * HIGHT · Vista 360 de las prendas.
 *
 * Cada prenda está dibujada en vector, como sacada de Illustrator, con las texturas de su tela. El frente y la
 * espalda van sobre la misma silueta y se juntan por todo el borde: un volumen cerrado que se gira en cualquier
 * dirección, también desde arriba y desde abajo, sin huecos ni partes estiradas.
 *
 * Archivos por prenda (en assets/, con la dirección de la prenda):
 *   360-<prenda>.json         medidas del dibujo, grilla del volumen, borde exacto y tipo de espalda
 *   360-<prenda>-alto.png     qué tan abombada está la prenda en cada punto de la grilla
 *   360-<prenda>-lado.png     la tela del canto (la que se ve de lado, arriba y abajo)
 *   360-<prenda>-frente.webp  el dibujo del frente
 *   360-<prenda>-espalda.webp el dibujo de la espalda, en el mismo marco del frente
 *
 * Este módulo se carga recién cuando alguien toca un botón 360° (hight.js), junto con three.js del tema.
 */
import * as THREE from './three.module.min.js';
import { OrbitControls } from './three-orbit-controls.js';

const config = (() => {
  try {
    return JSON.parse(document.getElementById('HightConfig').textContent);
  } catch (e) {
    return {};
  }
})();
const T = Object.assign(
  {
    title: '360° · Ilustración',
    loading: 'Cargando la prenda…',
    hint: 'Arrastra en cualquier dirección',
    front: 'Frente',
    side: 'Costado',
    back: 'Espalda',
    top: 'Arriba',
    bottom: 'Abajo',
    auto: 'Girar sola',
    threeQuarters: 'Tres cuartos',
    threeQuartersBack: 'Tres cuartos de espalda',
    fromAbove: 'Desde arriba',
    fromBelow: 'Desde abajo',
    stage: '[title] en 3D. Arrastra o usa las flechas del teclado para girarla.',
    backPhoto: 'Frente y espalda dibujados de las fotos de la prenda.',
    backReference: 'Espalda de referencia: la prenda solo tiene foto de frente.',
    backSketch: 'Dibujada de su boceto: la prenda todavía no tiene foto.',
    error: 'No se pudo cargar la vista 360. Prueba de nuevo.',
    close: 'Cerrar',
  },
  (config.strings && config.strings.v360) || {}
);
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- El diálogo (uno por página) ---------- */

let ui = null;
function buildDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'hi-dialog hi-360';
  dialog.innerHTML = `
    <div class="hi-360-head">
      <p class="t-label hi-360-kicker">${T.title}</p>
      <h2 class="hi-360-title" data-title></h2>
      <button type="button" class="hi-header-btn hi-360-close" data-close-dialog aria-label="${T.close}">
        <span aria-hidden="true">✕</span>
      </button>
    </div>
    <div class="hi-360-stage" data-stage tabindex="0" role="img">
      <p class="hi-360-loading" data-loading>${T.loading}</p>
      <div class="hi-360-angle" aria-hidden="true"><span class="hi-360-deg" data-deg>0°</span><span class="hi-360-side" data-side>${T.front}</span></div>
      <svg class="hi-360-dial" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="22"></circle>
        <text x="32" y="8" text-anchor="middle">F</text>
        <text x="32" y="62" text-anchor="middle">E</text>
        <line data-needle x1="32" y1="32" x2="32" y2="13"></line>
      </svg>
      <p class="hi-360-hint" data-hint>${T.hint}</p>
    </div>
    <div class="hi-360-controls">
      <button type="button" class="hi-btn" data-view="0">${T.front}</button>
      <button type="button" class="hi-btn" data-view="90">${T.side}</button>
      <button type="button" class="hi-btn" data-view="180">${T.back}</button>
      <button type="button" class="hi-btn" data-view="top">${T.top}</button>
      <button type="button" class="hi-btn" data-view="bottom">${T.bottom}</button>
      <button type="button" class="hi-btn" data-auto aria-pressed="true">${T.auto}</button>
    </div>
    <p class="hi-360-note t-body-s" data-note></p>`;
  document.body.appendChild(dialog);
  const q = (sel) => dialog.querySelector(sel);
  ui = {
    dialog,
    title: q('[data-title]'),
    stage: q('[data-stage]'),
    loading: q('[data-loading]'),
    deg: q('[data-deg]'),
    side: q('[data-side]'),
    needle: q('[data-needle]'),
    hint: q('[data-hint]'),
    auto: q('[data-auto]'),
    note: q('[data-note]'),
  };
  dialog.addEventListener('close', () => viewer && viewer.pause());
  return ui;
}

/* ---------- La escena ---------- */

const WIDTH = 3.3;       // ancho de la prenda en la escena
const THICK = 0.13;      // hondo máximo de cada cara, sobre el ancho
const OUTLINE = 0.015;   // grosor del contorno
const INK = 0x0d0c0b;

function toonSteps() {
  // Sombreado de ilustración: dos tonos, luz plena o sombra, sin degradé.
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

// Canto: cuando miras la prenda de lado, desde arriba o desde abajo, las partes muy inclinadas toman la tela del
// borde (lado.png) en vez del dibujo, que ahí se vería estirado; de frente y de espalda se ve el dibujo entero. El
// canto lleva la trama de la tela de la prenda (sarga, punto o jersey), con el mismo paso que en el dibujo.
const FABRIC = `
uniform float uWeave;
uniform float uPx;
varying vec3 vObj;
varying vec3 vObjN;
float hilo( float t, float duty ) {
#ifdef NO_DERIV
  float w = 0.08;
#else
  float w = clamp( fwidth( t ), 1e-4, 0.5 );
#endif
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

class Viewer {
  constructor(stage) {
    this.stage = stage;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.camera.position.set(0, 0.25, 9);
    this.scene.add(this.camera);
    // Luz de ilustración: una base pareja y una luz que viaja con la cámara, arriba a la izquierda.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.38 * Math.PI));
    const key = new THREE.DirectionalLight(0xffffff, 0.62 * Math.PI);
    key.position.set(-0.55, 0.65, 0);
    key.target.position.set(0, 0, -1);
    this.camera.add(key, key.target);

    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.75;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI - 0.12;
    controls.autoRotateSpeed = 1.6;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.ROTATE };
    this.renderer.domElement.style.touchAction = 'pan-y';
    this.controls = controls;

    this.steps = toonSteps();
    this.outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    this.uWeave = { value: 0 };
    this.uPx = { value: 0.003 };
    this.points = null;
    this.tween = null;
    this.running = false;
    this.touched = false;

    controls.addEventListener('start', () => {
      this.tween = null;
      stage.classList.add('is-drag');
      if (!this.touched) {
        this.touched = true;
        ui.hint.classList.add('is-gone');
        stage.classList.add('is-touched');
      }
      this.setAuto(false);
    });
    controls.addEventListener('end', () => stage.classList.remove('is-drag'));
    new ResizeObserver(() => this.resize()).observe(stage);
    this.tick = this.tick.bind(this);
  }

  material(texture) {
    const material = new THREE.MeshToonMaterial({ map: texture, gradientMap: this.steps });
    const uWeave = this.uWeave;
    const uPx = this.uPx;
    const webgl2 = this.renderer.capabilities.isWebGL2;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWeave = uWeave;
      shader.uniforms.uPx = uPx;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 side;\nvarying vec4 vSide;\nvarying vec3 vFront;\nvarying vec3 vObj;\nvarying vec3 vObjN;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSide = side;\nvObj = transformed;\nvObjN = objectNormal;\nvFront = normalize( mat3( modelViewMatrix ) * vec3( 0.0, 0.0, 1.0 ) );'
        );
      shader.fragmentShader =
        (webgl2 ? '' : '#define NO_DERIV\n') +
        shader.fragmentShader
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

  // Volumen cerrado: las dos caras van sobre la misma silueta y se juntan por todo el borde.
  build(data, frontTexture, backTexture, heightImage, sideImage) {
    const [gw, gh] = data.grid;
    const [tw, th] = data.tex;
    const step = data.step;
    const pixels = gridPixels(heightImage, gw, gh);
    const sidePixels = gridPixels(sideImage, gw, gh);
    const scale = WIDTH / data.widthPx;
    const depth = THICK * WIDTH;
    const n = gw * gh;
    const heights = new Float32Array(n);
    for (let k = 0; k < n; k++) heights[k] = pixels[k * 4] / 255;
    const positions = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    const place = (k, x, y, z) => {
      positions[k * 3] = (x - tw / 2) * scale;
      positions[k * 3 + 1] = (th / 2 - y) * scale;
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
      // En el canto las dos caras se tocan: su normal queda de lado, igual en las dos.
      const normals = geometry.attributes.normal.array;
      for (let k = 0; k < n; k++) {
        if (!onRim[k]) continue;
        const x = normals[k * 3], y = normals[k * 3 + 1];
        const l = Math.hypot(x, y);
        normals[k * 3] = l > 1e-6 ? x / l : 0;
        normals[k * 3 + 1] = l > 1e-6 ? y / l : 0;
        normals[k * 3 + 2] = 0;
      }
      group.add(new THREE.Mesh(geometry, this.material(texture)));
      // Contorno: la misma cara un poco más grande, en negro y vista por dentro; solo asoma por el borde.
      const shell = geometry.clone();
      const p = shell.attributes.position.array;
      for (let k = 0; k < p.length; k++) p[k] += normals[k] * OUTLINE;
      group.add(new THREE.Mesh(shell, this.outline));
    };
    surface(1, front, frontTexture);
    surface(-1, back, backTexture);
    return group;
  }

  show(data, frontTexture, backTexture, heightImage, sideImage) {
    this.clear();
    this.uWeave.value = { sarga: 0, punto: 1, jersey: 2, malla: 2 }[data.tela] ?? 0;
    this.uPx.value = WIDTH / data.widthPx;
    const jacket = this.build(data, frontTexture, backTexture, heightImage, sideImage);
    this.jacket = jacket;
    this.scene.add(jacket);
    const box = new THREE.Box3().setFromObject(jacket);
    const sample = [];
    jacket.children.forEach((mesh) => {
      const pos = mesh.geometry.attributes.position.array;
      const index = mesh.geometry.index.array;
      for (let k = 0; k < index.length; k += 15) {
        const i = index[k] * 3;
        sample.push(pos[i], pos[i + 1], pos[i + 2]);
      }
    });
    this.points = new Float32Array(sample);
    // Sombra en el piso, plana como en un dibujo.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 72),
      new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.14, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    const size = box.getSize(new THREE.Vector3());
    shadow.scale.set(size.x * 0.48, Math.max(size.z * 2.2, size.x * 0.16), 1);
    shadow.position.y = box.min.y - 0.08;
    this.shadow = shadow;
    this.scene.add(shadow);
    this.controls.reset();
    this.camera.position.set(0, 0.25, 9);
    this.touched = false;
    ui.hint.classList.remove('is-gone');
    this.stage.classList.remove('is-touched');
    this.setAuto(!calm);
    this.resize();
    this.play();
  }

  clear() {
    for (const obj of [this.jacket, this.shadow]) {
      if (!obj) continue;
      this.scene.remove(obj);
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material && child.material !== this.outline) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }
    this.jacket = this.shadow = null;
    this.points = null;
  }

  // Distancia para que la pieza entera quepa desde cualquier ángulo: puntos de la prenda desde 24 giros y 9 alturas.
  fitDistance() {
    if (!this.points) return 9;
    const camera = this.camera;
    const tv = Math.tan((camera.fov * Math.PI) / 180 / 2);
    const th = tv * camera.aspect;
    const polars = [0.12, 0.5, 0.9, 1.2, Math.PI / 2, Math.PI - 1.2, Math.PI - 0.9, Math.PI - 0.5, Math.PI - 0.12];
    const points = this.points;
    let need = 0;
    for (let a = 0; a < 24; a++) {
      const az = (a / 24) * Math.PI * 2;
      for (const polar of polars) {
        const fx = -Math.sin(polar) * Math.sin(az), fy = -Math.cos(polar), fz = -Math.sin(polar) * Math.cos(az);
        let rx = -fz, rz = fx;
        const rl = Math.hypot(rx, rz) || 1;
        rx /= rl;
        rz /= rl;
        const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
        for (let k = 0; k < points.length; k += 3) {
          const x = points[k], y = points[k + 1], z = points[k + 2];
          const depth = x * fx + y * fy + z * fz;
          const sx = Math.abs(x * rx + z * rz) / th - depth;
          const sy = Math.abs(x * ux + y * uy + z * uz) / tv - depth;
          if (sx > need) need = sx;
          if (sy > need) need = sy;
        }
      }
    }
    return need * 1.06;
  }

  resize() {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    const fit = this.fitDistance();
    this.controls.minDistance = this.controls.maxDistance = fit;
    this.camera.position.setLength(fit);
  }

  setAuto(on) {
    this.controls.autoRotate = on;
    ui.auto.setAttribute('aria-pressed', String(on));
  }

  degrees() {
    return Math.round(((-this.controls.getAzimuthalAngle() * 180) / Math.PI + 360) % 360);
  }

  goTo(deg, polar) {
    const from = this.controls.getAzimuthalAngle();
    const to = (-deg * Math.PI) / 180;
    const delta = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const polarFrom = this.controls.getPolarAngle();
    this.tween = { from, delta, polarFrom, polarDelta: polar - polarFrom, start: performance.now(), ms: calm ? 1 : 750 };
    this.setAuto(false);
  }

  view(name) {
    if (name === 'top') this.goTo(this.degrees(), 0.3);
    else if (name === 'bottom') this.goTo(this.degrees(), Math.PI - 0.3);
    else this.goTo(Number(name), Math.PI / 2);
  }

  key(event) {
    const polar = this.controls.getPolarAngle();
    const step = Math.PI / 12;
    if (event.key === 'ArrowRight') this.goTo(this.degrees() + 15, polar);
    else if (event.key === 'ArrowLeft') this.goTo(this.degrees() - 15, polar);
    else if (event.key === 'ArrowUp') this.goTo(this.degrees(), Math.max(this.controls.minPolarAngle, polar - step));
    else if (event.key === 'ArrowDown') this.goTo(this.degrees(), Math.min(this.controls.maxPolarAngle, polar + step));
    else return;
    event.preventDefault();
  }

  readout() {
    const deg = this.degrees();
    const polar = this.controls.getPolarAngle();
    let name;
    if (polar < 0.9) name = T.fromAbove;
    else if (polar > Math.PI - 0.9) name = T.fromBelow;
    else {
      const d = deg > 180 ? 360 - deg : deg;
      name = d <= 25 ? T.front : d < 70 ? T.threeQuarters : d <= 110 ? T.side : d < 155 ? T.threeQuartersBack : T.back;
    }
    ui.deg.textContent = deg + '°';
    ui.side.textContent = name;
    ui.needle.setAttribute('transform', 'rotate(' + deg + ' 32 32)');
    if (this.shadow) {
      this.shadow.material.opacity = 0.14 * Math.min(1, Math.max(0, (this.camera.position.y - this.shadow.position.y) / 1.2));
    }
  }

  play() {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.tick);
  }

  pause() {
    this.running = false;
  }

  tick(now) {
    if (!this.running) return;
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.ms);
      const e = 1 - Math.pow(1 - t, 3);
      const az = this.tween.from + this.tween.delta * e;
      const polar = this.tween.polarFrom + this.tween.polarDelta * e;
      const dist = this.camera.position.distanceTo(this.controls.target);
      this.camera.position.set(dist * Math.sin(polar) * Math.sin(az), dist * Math.cos(polar), dist * Math.sin(polar) * Math.cos(az));
      if (t >= 1) this.tween = null;
    }
    this.controls.update();
    this.readout();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  }
}

function gridPixels(image, gw, gh) {
  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, gw, gh).data;
}

function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function texture(img, renderer) {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  return tex;
}

/* ---------- Abrir ---------- */

let viewer = null;
let current = 0;

function noteFor(kind) {
  if (kind === 'foto') return T.backPhoto;
  if (kind === 'boceto') return T.backSketch;
  return T.backReference;
}

export function open(trigger) {
  if (!ui) buildDialog();
  const d = trigger.dataset;
  const title = d['360Title'] || '';
  ui.title.textContent = title;
  ui.stage.setAttribute('aria-label', T.stage.replace('[title]', title));
  ui.note.textContent = noteFor(d['360Back']);
  ui.loading.textContent = T.loading;
  ui.loading.hidden = false;
  ui.dialog._opener = trigger;
  if (!ui.dialog.open) {
    ui.dialog.showModal();
    document.documentElement.classList.add('hi-locked');
  }
  if (!viewer) {
    try {
      viewer = new Viewer(ui.stage);
    } catch (e) {
      ui.loading.textContent = T.error;
      return;
    }
    ui.dialog.addEventListener('click', (event) => {
      const button = event.target.closest('[data-view]');
      if (button) viewer.view(button.dataset.view);
      if (event.target.closest('[data-auto]')) viewer.setAuto(!viewer.controls.autoRotate);
    });
    ui.stage.addEventListener('keydown', (event) => viewer.key(event));
  }
  viewer.clear();
  const ticket = ++current;
  Promise.all([
    fetch(d['360Datos']).then((r) => (r.ok ? r.json() : Promise.reject(new Error('datos')))),
    loadImage(d['360Frente']),
    loadImage(d['360Espalda']),
    loadImage(d['360Alto']),
    loadImage(d['360Lado']),
  ])
    .then(([data, front, back, alto, lado]) => {
      if (ticket !== current) return;
      ui.loading.hidden = true;
      viewer.show(data, texture(front, viewer.renderer), texture(back, viewer.renderer), alto, lado);
      ui.stage.focus({ preventScroll: true });
    })
    .catch(() => {
      if (ticket === current) ui.loading.textContent = T.error;
    });
}
