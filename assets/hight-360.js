/*
 * HIGHT · Vista 360 de las prendas.
 *
 * Cada prenda está dibujada en vector, como sacada de Illustrator, con las texturas de su tela, y tiene forma de ropa
 * colgada en su percha (hight-ropa.js): el frente y la espalda son dos capas de tela delgadas sobre la misma silueta,
 * con sus pliegues, cosidas por los costados y abiertas en el ruedo, así que desde abajo se ve por dentro. Se gira en
 * cualquier dirección, también desde arriba y desde abajo, sin partes estiradas.
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
import { drape } from './hight-ropa.js?v=1';

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
const OUTLINE = 0.015;   // grosor del contorno
const WIRE = 0.02;       // grosor del alambre de la percha
const INK = 0x0d0c0b;
const BOTTOMS = ['Jean', 'Pantalón', 'Short', 'Falda'];

function toonSteps() {
  // Sombreado de ilustración, sin degradé: luz plena, el medio tono de los pliegues y la sombra.
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
    this.controls = controls;

    this.steps = toonSteps();
    this.outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    this.wire = new THREE.MeshToonMaterial({ color: 0x3a3632, gradientMap: this.steps });
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

  // Por fuera el dibujo; por dentro (lo que asoma por el ruedo) la misma tela en sombra.
  material(texture) {
    const material = new THREE.MeshToonMaterial({ map: texture, gradientMap: this.steps, side: THREE.DoubleSide });
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
            '#include <map_fragment>',
            '#include <map_fragment>\nif ( !gl_FrontFacing ) diffuseColor.rgb *= 0.32;'
          )
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
    return material;
  }

  // La prenda: dos capas de tela sobre la misma silueta, con la forma y los pliegues de hight-ropa.js.
  build(data, frontTexture, backTexture, heightImage, sideImage, bottom, seed) {
    const [gw, gh] = data.grid;
    const [tw, th] = data.tex;
    const step = data.step;
    const pixels = gridPixels(heightImage, gw, gh);
    const sidePixels = gridPixels(sideImage, gw, gh);
    const scale = WIDTH / data.widthPx;
    const n = gw * gh;
    const heights = new Float32Array(n);
    for (let k = 0; k < n; k++) heights[k] = pixels[k * 4] / 255;
    // Dónde cae cada punto en el dibujo; los del borde, en el borde exacto.
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
    // Puntos para encuadrar: todo el borde y, adentro, uno de cada tres de la grilla, por delante y por detrás.
    const fit = [];
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const k = j * gw + i;
        if (!onRim[k] && (heights[k] === 0 || i % 3 || j % 3)) continue;
        fit.push(frontPos[k * 3], frontPos[k * 3 + 1], frontPos[k * 3 + 2]);
        if (shape.z[k]) fit.push(backPos[k * 3], backPos[k * 3 + 1], backPos[k * 3 + 2]);
      }
    }
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
    const surface = (pos, index, texture) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setAttribute('side', new THREE.BufferAttribute(side, 4));
      geometry.setIndex(index);
      geometry.computeVertexNormals();
      // Donde las dos capas están cosidas, su normal queda de lado, igual en las dos; en el ruedo cada una tiene la suya.
      const normals = geometry.attributes.normal.array;
      for (let k = 0; k < n; k++) {
        if (!onRim[k] || shape.open[k] > 0.5) continue;
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
    surface(frontPos, front, frontTexture);
    surface(backPos, back, backTexture);
    const hook = hanger(shape, px, py, onRim, (x, y) => [(x - tw / 2) * scale, (th / 2 - y) * scale], scale, bottom, this.wire);
    group.add(hook.group);
    fit.push(...hook.points);
    this.points = new Float32Array(fit);
    return group;
  }

  show(data, frontTexture, backTexture, heightImage, sideImage, bottom, seed) {
    this.clear();
    this.uWeave.value = { sarga: 0, punto: 1, jersey: 2, malla: 2 }[data.tela] ?? 0;
    this.uPx.value = WIDTH / data.widthPx;
    const jacket = this.build(data, frontTexture, backTexture, heightImage, sideImage, bottom, seed);
    this.jacket = jacket;
    this.scene.add(jacket);
    const box = new THREE.Box3().setFromObject(jacket);
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
        if (child.material && child.material !== this.outline && child.material !== this.wire) {
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

// La percha, para que se lea como ropa colgada: un gancho de alambre que sale del cuello y, en las de abajo, una barra
// con dos pinzas que muerden la pretina. Devuelve el grupo y sus puntos, para encuadrar.
function hanger(shape, px, py, onRim, toScene, scale, bottom, material) {
  const { x0, x1, y0, y1 } = shape.box;
  const W = x1 - x0;
  const cx = (x0 + x1) / 2;
  let top = Infinity;
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < px.length; k++) {
    if (!onRim[k]) continue;
    if (Math.abs(px[k] - cx) < 0.1 * W) top = Math.min(top, py[k]);
    if (py[k] < y0 + 0.05 * (y1 - y0)) {
      lo = Math.min(lo, px[k]);
      hi = Math.max(hi, px[k]);
    }
  }
  if (!isFinite(top)) top = y0;
  const group = new THREE.Group();
  const points = [];
  const wire = (list) => {
    const curve = new THREE.CatmullRomCurve3(list.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, WIRE, 8), material));
    curve.getPoints(24).forEach((p) => points.push(p.x, p.y, p.z));
  };
  const [mid, ty] = toScene(cx, top);
  // El gancho arranca adentro, entre las dos capas de tela.
  let base = ty - 0.12;
  if (bottom && isFinite(lo)) {
    const inset = 0.1 * (hi - lo);
    const [ax] = toScene(lo + inset, top);
    const [bx] = toScene(hi - inset, top);
    base = ty + 0.2;
    wire([[ax - 0.06, base], [mid, base], [bx + 0.06, base]]);
    // Cada pinza abraza la pretina: un poco más honda que las dos capas juntas.
    const deep = 2 * 0.05 * W * scale + 0.05;
    for (const x of [ax, bx]) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, deep), material);
      clip.position.set(x, base - 0.15, 0);
      group.add(clip);
      points.push(x, base - 0.31, deep / 2, x, base - 0.31, -deep / 2);
    }
  }
  // Sube derecho y se curva hacia un lado, como un signo de pregunta.
  const r = 0.13;
  const stem = Math.max(base, ty) + 0.2;
  const path = [[mid, base], [mid, (base + stem) / 2], [mid, stem]];
  for (const a of [2.6, 2.0, 1.4, 0.8, 0.2, -0.4, -0.8]) path.push([mid + r + r * Math.cos(a), stem + r * Math.sin(a)]);
  wire(path);
  return { group, points };
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
  // Sin la prenda anterior mientras carga la nueva.
  viewer.clear();
  viewer.renderer.clear();
  const ticket = ++current;
  Promise.all([
    fetch(d['360Datos']).then((r) => (r.ok ? r.json() : Promise.reject(new Error('datos')))),
    loadImage(d['360Frente']),
    loadImage(d['360Espalda']),
    loadImage(d['360Alto']),
    loadImage(d['360Lado']),
  ])
    .then(([data, front, back, alto, lado]) => {
      // Si se cerró mientras cargaba, no se arma ni se anima a escondidas.
      if (ticket !== current || !ui.dialog.open) return;
      ui.loading.hidden = true;
      const bottom = BOTTOMS.includes(d['360Tipo']);
      const seed = (d['360Datos'].match(/360-([^/?]+)\.json/) || [])[1] || title;
      viewer.show(data, texture(front, viewer.renderer), texture(back, viewer.renderer), alto, lado, bottom, seed);
      ui.stage.focus({ preventScroll: true });
    })
    .catch(() => {
      if (ticket === current) ui.loading.textContent = T.error;
    });
}
