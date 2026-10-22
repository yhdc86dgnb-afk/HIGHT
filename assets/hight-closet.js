/*
 * HIGHT · Clóset del inicio.
 *
 * Todas las prendas, dibujadas en vector como en el visor 360, colgadas de dos barras: arriba las prendas de arriba,
 * abajo las de abajo. Las barras corren solas, en sentidos contrarios, y cada prenda gira al pasar: mira de frente en
 * el centro y de espalda en las orillas. Al tocar una prenda se abre su vista 360.
 *
 * Usa los modelos livianos de cada prenda (360-<prenda>-armario.json y sus dos texturas chicas) y three.js del tema.
 * hight.js lo carga recién cuando la sección se acerca, y solo se dibuja mientras se ve.
 */
import * as THREE from './three.module.min.js';

const FOV = 20;
const FRAME = 10.8;      // alto visible de la escena, en unidades
const THICK = 0.13;      // hondo de cada cara sobre el ancho, como en el visor
const LINE = 0.02;       // trazo negro de la ilustración
const STICKER = 0.075;   // borde hueso, como un sticker recortado
const EASE = 0.3;        // cuánto se queda cada prenda de frente y de espalda al girar
const LOOP = 34;         // segundos en que cada barra da la vuelta entera
const MAX_ASPECT = 2.4;  // la barra es más larga que la pantalla más ancha: nunca se ve dónde empieza
const INK = 0x0d0c0b;
const BONE = 0xece3d0;

const RAILS = {
  arriba: { dir: -1, spacing: 3.15, boxW: 3.2, boxH: 3.55, rail: 4.55, hook: 0.32, clip: false },
  abajo: { dir: 1, spacing: 2.9, boxW: 2.9, boxH: 4.35, rail: 0.25, hook: 0.3, clip: true },
};

/* ---------- Material de ilustración (el mismo del visor 360) ---------- */

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

function fabricMaterial(texture, steps, weave, px, webgl2) {
  const material = new THREE.MeshToonMaterial({ map: texture, gradientMap: steps });
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

/* ---------- Una prenda: volumen cerrado con su dibujo, como en el visor ---------- */

function bytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function buildGarment(data, frente, espalda, rail, shared) {
  const [gw, gh] = data.grid;
  const [tw, th] = data.tex;
  const step = data.step;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  data.rim.x.forEach((x, r) => {
    const y = data.rim.y[r];
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  });
  const cx = (x0 + x1) / 2 + 0.5;
  const cy = (y0 + y1) / 2 + 0.5;
  const s = Math.min(rail.boxW / (x1 - x0), rail.boxH / (y1 - y0));
  const alto = bytes(data.alto);
  const sideIndex = bytes(data.lado.i);
  const palette = data.lado.pal.map((hex) => {
    const c = new THREE.Color(hex);
    return [toLinear(c.r), toLinear(c.g), toLinear(c.b)];
  });
  const depth = THICK * data.widthPx * s;
  const n = gw * gh;
  const heights = new Float32Array(n);
  for (let k = 0; k < n; k++) heights[k] = alto[k] / 255;
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
    const p = sideIndex[k];
    if (p) side.set([...palette[p - 1], 1], k * 4);
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
  // Ancho donde va la percha: los hombros arriba, la pretina en las de abajo (en unidades, a cada lado del eje).
  const rowAt = (frac) => Math.min(gh - 1, Math.max(0, Math.round((y0 + (y1 - y0) * frac) / step)));
  const halfWidth = (row) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < gw; i++) {
      if (heights[row * gw + i] > 0) {
        const x = Math.min(i * step, tw - 1) + 0.5;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    return isFinite(lo) ? Math.max(0, Math.min(hi - cx, cx - lo)) * 0.9 * s : 0;
  };
  const weave = { sarga: 0, punto: 1, jersey: 2, malla: 2 }[data.tela] ?? 0;
  const group = new THREE.Group();
  const surfaces = [];
  const stickers = [];
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
      const x = normals[k * 3];
      const y = normals[k * 3 + 1];
      const l = Math.hypot(x, y);
      normals[k * 3] = l > 1e-6 ? x / l : 0;
      normals[k * 3 + 1] = l > 1e-6 ? y / l : 0;
      normals[k * 3 + 2] = 0;
    }
    const mesh = new THREE.Mesh(geometry, fabricMaterial(texture, shared.steps, weave, s, shared.webgl2));
    group.add(mesh);
    surfaces.push(mesh);
    // Trazo negro y, por fuera, el borde hueso: la misma cara inflada y vista por dentro.
    for (const [offset, material, list] of [[LINE, shared.line, null], [STICKER, shared.sticker, stickers]]) {
      const shell = new THREE.BufferGeometry();
      const p = pos.slice();
      for (let k = 0; k < p.length; k++) p[k] += normals[k] * offset;
      shell.setAttribute('position', new THREE.BufferAttribute(p, 3));
      shell.setIndex(index);
      const hull = new THREE.Mesh(shell, material);
      group.add(hull);
      if (list) list.push(hull);
    }
  };
  surface(1, front, frente);
  surface(-1, back, espalda);
  // Cuelga de su gancho: la parte más alta queda a `hook` de la barra.
  group.position.y = rail.rail - rail.hook - (cy - (y0 + 0.5)) * s;
  return {
    group,
    surfaces,
    stickers,
    top: rail.rail - rail.hook,
    hanger: rail.clip ? halfWidth(rowAt(0.02)) : halfWidth(rowAt(0.12)),
  };
}

// En el teléfono las prendas se ven chicas: las texturas van al 60 %, con menos de la mitad de memoria.
function shrink(img, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

/* ---------- El clóset ---------- */

class Closet {
  constructor(root) {
    this.root = root;
    this.rods = root.querySelector('.hi-closet-rods');
    this.ctx = this.rods.getContext('2d');
    this.toggle = root.querySelector('[data-closet-toggle]');
    this.calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.small = Math.min(window.screen.width, window.screen.height) < 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'hi-closet-3d';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.rods.after(this.renderer.domElement);
    this.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 120);
    this.camera.position.set(0, 0, FRAME / 2 / Math.tan((FOV * Math.PI) / 360));
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.38 * Math.PI));
    const key = new THREE.DirectionalLight(0xffffff, 0.62 * Math.PI);
    key.position.set(-0.55, 0.65, 0);
    key.target.position.set(0, 0, -1);
    this.camera.add(key, key.target);

    this.shared = {
      steps: toonSteps(),
      line: new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }),
      sticker: new THREE.MeshBasicMaterial({ color: BONE, side: THREE.BackSide }),
      mark: new THREE.MeshBasicMaterial({ color: BONE, side: THREE.BackSide }),
      webgl2: this.renderer.capabilities.isWebGL2,
    };

    // Las prendas, repartidas en sus barras en el orden de la colección.
    const groups = { arriba: [], abajo: [] };
    root.querySelectorAll('[data-closet-item]').forEach((li) => {
      const button = li.querySelector('[data-360]');
      if (!button) return;
      const rail = li.dataset.rail === 'abajo' ? 'abajo' : 'arriba';
      groups[rail].push({ li, button, model: li.dataset.model, frente: li.dataset.frente, espalda: li.dataset.espalda });
    });
    this.rails = Object.entries(groups)
      .filter(([, items]) => items.length)
      .map(([name, items]) => {
        const rail = RAILS[name];
        const length = Math.max(items.length * rail.spacing, FRAME * MAX_ASPECT + 2 * rail.spacing);
        const gap = length / items.length;
        items.forEach((item, k) => {
          item.x0 = k * gap > length / 2 ? k * gap - length : k * gap;
          item.x = item.x0;
          item.angle = 0;
        });
        return { ...rail, name, items, length, offset: 0 };
      });
    this.items = this.rails.flatMap((rail) => rail.items.map((item) => Object.assign(item, { rail })));

    this.t = 0;
    this.speed = 1;
    this.playing = true;
    this.visible = false;
    this.dirty = true;
    this.hover = null;
    this.focus = null;
    this.pointer = null;
    this.raycaster = new THREE.Raycaster();
    this.tick = this.tick.bind(this);

    this.onMove = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      this.dirty = true;
    };
    this.onLeave = () => {
      this.pointer = null;
      this.setHover(null);
    };
    this.onClick = (event) => {
      const item = this.pick(event);
      if (item) item.button.click();
    };
    const canvas = this.renderer.domElement;
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      canvas.addEventListener('pointermove', this.onMove);
      canvas.addEventListener('pointerleave', this.onLeave);
    }
    canvas.addEventListener('click', this.onClick);

    // Con el teclado: cada prenda es un botón de la lista; al enfocarlo se marca en el clóset.
    this.onFocus = (event) => {
      const item = this.items.find((it) => it.button === event.target);
      this.focus = item || null;
      this.dirty = true;
    };
    this.onBlur = () => {
      this.focus = null;
      this.dirty = true;
    };
    root.addEventListener('focusin', this.onFocus);
    root.addEventListener('focusout', this.onBlur);

    this.onToggle = () => this.setPlaying(!this.playing);
    if (this.toggle) this.toggle.addEventListener('click', this.onToggle);
    this.setPlaying(true);

    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(root);
    this.watcher = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1].isIntersecting;
      if (this.visible) this.start();
    });
    this.watcher.observe(root);
    this.resize();
    this.load();
  }

  // Primero las prendas que se ven al empezar, de a cuatro.
  async load() {
    const queue = [...this.items].sort((a, b) => Math.abs(a.x0) - Math.abs(b.x0));
    const first = queue.filter((item) => Math.abs(item.x0) < (FRAME * this.camera.aspect) / 2 + 2);
    let pending = first.length;
    const live = () => this.root.classList.add('is-live');
    this.fallback = setTimeout(live, 5000);
    const next = async () => {
      const item = queue.shift();
      if (!item || this.destroyed) return;
      try {
        const [data, frente, espalda] = await Promise.all([
          fetch(item.model).then((r) => (r.ok ? r.json() : Promise.reject(new Error(item.model)))),
          loadImage(item.frente),
          loadImage(item.espalda),
        ]);
        if (this.destroyed) return;
        const tex = (img) => {
          const t = new THREE.Texture(this.small ? shrink(img, 0.6) : img);
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = this.anisotropy;
          t.needsUpdate = true;
          return t;
        };
        Object.assign(item, buildGarment(data, tex(frente), tex(espalda), item.rail, this.shared));
        item.group.userData.item = item;
        this.place(item);
        this.scene.add(item.group);
        this.dirty = true;
      } catch (error) {
        item.failed = true;
      }
      if (first.includes(item) && --pending === 0) live();
      return next();
    };
    await Promise.all([next(), next(), next(), next()]);
  }

  place(item) {
    const rail = item.rail;
    const L = rail.length;
    const x = ((((item.x0 + rail.offset + L / 2) % L) + L) % L) - L / 2;
    const phase = (-2 * Math.PI * x) / (L / 2);
    item.x = x;
    item.angle = phase - EASE * Math.sin(2 * phase);
    if (item.group) {
      item.group.position.x = x;
      item.group.rotation.y = item.angle;
    }
  }

  setPlaying(on) {
    this.playing = on;
    if (this.toggle) {
      this.toggle.classList.toggle('is-paused', !on);
      this.toggle.setAttribute('aria-label', this.toggle.getAttribute(on ? 'data-label-pause' : 'data-label-play'));
    }
    this.dirty = true;
    this.start();
  }

  setHover(item) {
    if (item === this.hover) return;
    this.hover = item;
    this.renderer.domElement.style.cursor = item ? 'pointer' : '';
    this.dirty = true;
    // El visor 360 se empieza a bajar apenas el cursor llega a una prenda (hight.js lo precarga con pointerover).
    if (item) item.button.dispatchEvent(new Event('pointerover', { bubbles: true }));
  }

  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const point = event
      ? new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      : this.pointer;
    if (!point) return null;
    this.raycaster.setFromCamera(point, this.camera);
    const meshes = this.items.filter((item) => item.surfaces && Math.abs(item.x) < FRAME * this.camera.aspect).flatMap((item) => item.surfaces);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.object.parent.userData.item : null;
  }

  resize() {
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.rods.width = Math.round(rect.width * ratio);
    this.rods.height = Math.round(rect.height * ratio);
    this.size = { w: rect.width, h: rect.height, ratio };
    this.dirty = true;
    this.start();
  }

  start() {
    if (!this.raf && this.visible && !this.destroyed) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  tick(now) {
    this.raf = null;
    if (!this.visible || this.destroyed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // Con un diálogo abierto (el 360, el carrito o el menú) el clóset queda quieto y sin dibujarse.
    if (document.querySelector('dialog[open]')) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    if (this.pointer && now - (this.picked || 0) > 80) {
      this.picked = now;
      this.setHover(this.pick());
    }
    // Más lento con el cursor encima de una prenda, para poder tocarla; más suave si se pide menos movimiento.
    const target = this.playing ? (this.hover ? 0.22 : 1) * (this.calm ? 0.4 : 1) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 4);
    if (target === 0 && Math.abs(this.speed) < 0.01) this.speed = 0;
    if (this.speed) {
      this.t += dt * this.speed;
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      for (const rail of this.rails) {
        rail.offset = (rail.dir * rail.length * this.t) / LOOP;
        rail.items.forEach((item) => this.place(item));
      }
      const marked = this.hover || this.focus;
      for (const item of this.items) {
        if (!item.stickers) continue;
        const material = item === marked ? this.markMaterial() : this.shared.sticker;
        item.stickers.forEach((mesh) => (mesh.material = material));
      }
      this.drawRods();
      this.renderer.render(this.scene, this.camera);
    }
    this.raf = requestAnimationFrame(this.tick);
  }

  // El color del turno de la tienda marca la prenda bajo el cursor o con el foco.
  markMaterial() {
    const accent = getComputedStyle(this.root).getPropertyValue('--accent').trim();
    if (accent && accent !== this.accent) {
      this.accent = accent;
      try {
        this.shared.mark.color.set(accent);
      } catch (e) {
        this.shared.mark.color.set(BONE);
      }
    }
    return this.shared.mark;
  }

  // Las barras, los ganchos y las perchas van en un lienzo detrás de las prendas.
  drawRods() {
    const { w, h, ratio } = this.size;
    const ctx = this.ctx;
    const unit = h / FRAME;
    const sx = (x) => w / 2 + x * unit;
    const sy = (y) => h / 2 - y * unit;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = ctx.fillStyle = 'rgba(236, 227, 208, 0.9)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const thin = Math.max(1.5, unit * 0.02);
    for (const rail of this.rails) {
      const y = sy(rail.rail);
      // La barra: un tubo con brillo arriba.
      ctx.fillRect(0, y - unit * 0.03, w, unit * 0.06);
      ctx.fillStyle = 'rgba(13, 12, 11, 0.45)';
      ctx.fillRect(0, y + unit * 0.005, w, unit * 0.025);
      ctx.fillStyle = 'rgba(236, 227, 208, 0.9)';
      for (const item of rail.items) {
        if (!item.group) continue;
        const x = sx(item.x);
        if (x < -unit * 3 || x > w + unit * 3) continue;
        const r = unit * 0.075;
        const cos = Math.abs(Math.cos(item.angle));
        ctx.lineWidth = thin;
        // Gancho por encima de la barra.
        ctx.beginPath();
        ctx.moveTo(x, y + r * 1.6);
        ctx.lineTo(x, y);
        ctx.arc(x + r, y, r, Math.PI, 0, false);
        ctx.lineTo(x + 2 * r, y + r * 0.4);
        ctx.stroke();
        const neck = sy(item.top) - unit * 0.02;
        const half = item.hanger * unit * cos;
        ctx.beginPath();
        if (rail.clip) {
          // Percha de pinzas: una barra sobre la pretina y dos pinzas.
          ctx.moveTo(x, y + r * 1.6);
          ctx.lineTo(x, neck - unit * 0.12);
          ctx.moveTo(x - half, neck - unit * 0.12);
          ctx.lineTo(x + half, neck - unit * 0.12);
          ctx.moveTo(x - half, neck - unit * 0.12);
          ctx.lineTo(x - half, neck + unit * 0.06);
          ctx.moveTo(x + half, neck - unit * 0.12);
          ctx.lineTo(x + half, neck + unit * 0.06);
        } else {
          // Percha de alambre: del gancho a los hombros, que quedan detrás de la prenda.
          const shoulder = sy(item.top - item.hanger * 0.5);
          ctx.moveTo(x, y + r * 1.6);
          ctx.lineTo(x, neck - unit * 0.1);
          ctx.lineTo(x - half, shoulder);
          ctx.lineTo(x + half, shoulder);
          ctx.closePath();
        }
        ctx.stroke();
      }
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    clearTimeout(this.fallback);
    this.resizer.disconnect();
    this.watcher.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerleave', this.onLeave);
    canvas.removeEventListener('click', this.onClick);
    this.root.removeEventListener('focusin', this.onFocus);
    this.root.removeEventListener('focusout', this.onBlur);
    if (this.toggle) this.toggle.removeEventListener('click', this.onToggle);
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material && !Object.values(this.shared).includes(obj.material)) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    this.shared.steps.dispose();
    ['line', 'sticker', 'mark'].forEach((k) => this.shared[k].dispose());
    this.renderer.dispose();
    canvas.remove();
  }
}

export function mount(root) {
  if (root._closet) return root._closet;
  try {
    root._closet = new Closet(root);
  } catch (error) {
    // Sin WebGL queda la imagen fija del clóset.
    root.classList.add('is-static');
  }
  return root._closet;
}

export function unmount(root) {
  if (root._closet) root._closet.destroy();
  root._closet = null;
}
