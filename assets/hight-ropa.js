/*
 * HIGHT · La forma de la ropa, para el visor 360 y el clóset.
 *
 * Cada prenda son dos capas de tela sobre la misma silueta: delgadas, más hondas arriba, donde la sostiene la percha,
 * con pliegues que caen y crecen hacia abajo, y abiertas en el ruedo (y en la pretina de las de abajo), así que
 * desde abajo se ve por dentro. Los pliegues mueven las dos capas juntas, como la tela colgada.
 *
 * Si cambia este archivo, hay que subir el número de `?v=` donde se importa (hight-360.js y hight-closet.js).
 */

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// Números al azar que salen siempre iguales para la misma prenda: cada una tiene sus pliegues.
function random(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (Math.imul(s, 31) + seed.charCodeAt(i)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * gw, gh, step: la grilla del volumen y cuántos px del dibujo hay entre sus puntos.
 * heights: de 0 a 1 en cada punto (la silueta, con el borde redondeado); onRim: 1 en los puntos del borde.
 * px, py: dónde cae cada punto en el dibujo (los del borde, en el borde exacto).
 * bottom: prenda de abajo (jean, pantalón, short, falda). seed: algo propio de la prenda, como su dirección.
 * openings: false deja el borde cerrado entero (el clóset, que las mira de frente y con borde de sticker).
 *
 * Devuelve, en px del dibujo: z, el hondo de cada cara (la de adelante va en +z y la de atrás en -z), y fold, el
 * pliegue, que se suma igual a las dos. open vale 1 en los puntos del borde que quedan abiertos; box es la caja de
 * la silueta.
 */
export function drape({ gw, gh, step, heights, px, py, onRim, bottom, seed, openings = true }) {
  const n = gw * gh;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < n; k++) {
    if (!onRim[k]) continue;
    x0 = Math.min(x0, px[k]);
    x1 = Math.max(x1, px[k]);
    y0 = Math.min(y0, py[k]);
    y1 = Math.max(y1, py[k]);
  }
  const W = x1 - x0;
  const H = y1 - y0;
  const cx = (x0 + x1) / 2;
  const h = (i, j) => heights[Math.min(gh - 1, Math.max(0, j)) * gw + Math.min(gw - 1, Math.max(0, i))];

  // El borde abierto: el ruedo (abajo, mirando hacia abajo) y la pretina de las de abajo (arriba, mirando arriba).
  // Hacia afuera es contra la subida del alto.
  const rim = [];
  const flag = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    if (!onRim[k]) continue;
    const i = k % gw;
    const j = (k - i) / gw;
    const nx = 2 * (h(i - 1, j) - h(i + 1, j)) + h(i - 1, j - 1) - h(i + 1, j - 1) + h(i - 1, j + 1) - h(i + 1, j + 1);
    const ny = 2 * (h(i, j - 1) - h(i, j + 1)) + h(i - 1, j - 1) - h(i - 1, j + 1) + h(i + 1, j - 1) - h(i + 1, j + 1);
    const l = Math.hypot(nx, ny) || 1;
    const v = (py[k] - y0) / H;
    const down = ny / l;
    if (openings && ((down > 0.55 && v > 0.8) || (bottom && down < -0.55 && v < 0.07))) flag[k] = 1;
    rim.push(k);
  }
  // Sin aberturas sueltas: cada punto del borde mira a sus vecinos del borde.
  const open = new Float32Array(n);
  const near = 3;
  for (const k of rim) {
    const i = k % gw;
    const j = (k - i) / gw;
    let sum = 0;
    let count = 0;
    for (let b = -near; b <= near; b++) {
      for (let a = -near; a <= near; a++) {
        const ii = i + a;
        const jj = j + b;
        if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
        const q = jj * gw + ii;
        if (!onRim[q]) continue;
        sum += flag[q];
        count++;
      }
    }
    open[k] = smooth(0.35, 0.65, sum / count);
  }
  // Junto a una abertura la tela no se redondea: llega al borde con todo su hondo.
  const reach = new Float32Array(n);
  const R = Math.max(3, Math.round((0.05 * W) / step));
  for (const k of rim) {
    if (!open[k]) continue;
    const i = k % gw;
    const j = (k - i) / gw;
    for (let b = -R; b <= R; b++) {
      for (let a = -R; a <= R; a++) {
        const ii = i + a;
        const jj = j + b;
        if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
        const w = open[k] * (1 - smooth(0.5 * R, R, Math.hypot(a, b)));
        const q = jj * gw + ii;
        if (w > reach[q]) reach[q] = w;
      }
    }
  }

  // Los pliegues: tres ondas a lo ancho que bajan serpenteando, con su número, fuerza y fase propios de la prenda.
  const rnd = random(seed || 'prenda');
  const waves = [
    [3.1, 0.55],
    [5.9, 0.3],
    [10.7, 0.15],
  ].map(([count, weight]) => ({
    count: count * (0.85 + 0.3 * rnd()),
    weight,
    phase: rnd() * Math.PI * 2,
    bend: 0.05 + 0.07 * rnd(),
    turns: 0.6 + 0.9 * rnd(),
    bendPhase: rnd() * Math.PI * 2,
  }));
  const amp = (bottom ? 0.018 : 0.024) * W;

  const z = new Float32Array(n);
  const fold = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const u = (px[k] - cx) / W;
    const v = Math.min(1, Math.max(0, (py[k] - y0) / H));
    // Hondo de cada cara sobre el ancho: arriba la percha y los hombros (o la cadera), abajo dos capas de tela.
    const depth = bottom ? mix(0.05, 0.024, smooth(0, 0.4, v)) : mix(0.068, 0.03, smooth(0.08, 0.8, v));
    // El borde se redondea en poco espacio, como una costura, y no como un cojín.
    const e = Math.min(1, heights[k] / 0.4);
    const round = Math.sqrt(1 - (1 - e) * (1 - e));
    const profile = onRim[k] ? open[k] : Math.max(round, reach[k]);
    z[k] = depth * W * profile;
    let f = 0;
    for (const w of waves) {
      f += w.weight * Math.sin(Math.PI * 2 * (u * w.count + w.bend * Math.sin(Math.PI * 2 * v * w.turns + w.bendPhase)) + w.phase);
    }
    fold[k] = amp * Math.pow(smooth(0.03, 0.95, v), 0.85) * f;
  }
  return { z, fold, open, box: { x0, x1, y0, y1 } };
}
