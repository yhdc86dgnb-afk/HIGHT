// Siluetas base de los bocetos planos. Cada plantilla devuelve la silueta (d), costuras, pespuntes,
// piezas con relleno (pretina, presillas, cuello…) y puntos de referencia para ubicar los detalles.
(function () {
  const K = window.HK;
  const { P, path, stitch, rect, circle, poly } = K;

  /* ---------- media silueta que se refleja ---------- */
  class Half {
    constructor(start) {
      this.start = start;
      this.cur = start;
      this.segs = [];
    }
    L(p) {
      this.segs.push({ t: 'L', from: this.cur, p });
      this.cur = p;
      return this;
    }
    C(c1, c2, p) {
      this.segs.push({ t: 'C', from: this.cur, c1, c2, p });
      this.cur = p;
      return this;
    }
    Q(c, p) {
      const a = this.cur;
      return this.C([a[0] + (2 / 3) * (c[0] - a[0]), a[1] + (2 / 3) * (c[1] - a[1])], [p[0] + (2 / 3) * (c[0] - p[0]), p[1] + (2 / 3) * (c[1] - p[1])], p);
    }
  }
  const mx = (p) => [-p[0], p[1]];
  const segD = (s) => (s.t === 'L' ? ` L${P(s.p)}` : ` C${P(s.c1)} ${P(s.c2)} ${P(s.p)}`);
  function mirroredReverse(h) {
    let d = '';
    for (let i = h.segs.length - 1; i >= 0; i--) {
      const s = h.segs[i];
      d += s.t === 'L' ? ` L${P(mx(s.from))}` : ` C${P(mx(s.c2))} ${P(mx(s.c1))} ${P(mx(s.from))}`;
    }
    return d;
  }
  // M espejo(inicio) → borde superior → media derecha → tramo central → media izquierda (reflejada) → Z
  function closed(h, top, middle = '') {
    return `M${P(mx(h.start))}${top}${h.segs.map(segD).join('')}${middle}${mirroredReverse(h)} Z`;
  }
  function interp(pts, y) {
    if (y <= pts[0][1]) return pts[0][0];
    for (let i = 1; i < pts.length; i++) {
      if (y <= pts[i][1]) {
        const t = (y - pts[i - 1][1]) / (pts[i][1] - pts[i - 1][1] || 1);
        return pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
      }
    }
    return pts[pts.length - 1][0];
  }
  const both = (fn) => fn(1) + fn(-1);

  /* ---------- jean, pantalón y bermuda ---------- */
  function jeans(o = {}) {
    const W = o.W ?? 148;
    const WB = o.WB ?? 34;
    const H = o.H ?? 180;
    const hipY = o.hipY ?? 215;
    const R = o.R ?? 300;
    const KN = o.K ?? 545;
    const hemY = o.hemY ?? 860;
    const { ko, ki, ho, hi } = o;
    const h = new Half([W, 0]);
    h.L([W, WB]);
    h.C([W + (H - W) * 0.35, WB + 55], [H, hipY - 70], [H, hipY]);
    if (o.short) h.C([H + 4, hipY + 90], [ho, hemY - 90], [ho, hemY]);
    else {
      h.C([H, hipY + 130], [ko, KN - 140], [ko, KN]);
      h.C([ko + (ho - ko) * 0.25, KN + 120], [ho, hemY - 120], [ho, hemY]);
    }
    if (o.pointHem) h.Q([(ho + hi) / 2 + 10, hemY + 70], [hi, hemY]);
    else h.Q([(ho + hi) / 2, hemY + 7], [hi, hemY]);
    if (o.short) h.C([hi, hemY - 80], [12, R + 70], [0, R]);
    else {
      h.C([hi + (ki - hi) * 0.2, hemY - 140], [ki, KN + 120], [ki, KN]);
      h.C([ki, KN - 130], [10, R + 70], [0, R]);
    }
    const d = closed(h, ` L${P([W, 0])}`);

    const outerPts = o.short ? [[W, WB], [H, hipY], [ho, hemY]] : [[W, WB], [H, hipY], [ko, KN], [ho, hemY]];
    const innerPts = o.short ? [[0, R], [hi, hemY]] : [[0, R], [ki, KN], [hi, hemY]];
    const outer = (y) => interp(outerPts, y);
    const inner = (y) => (y < R ? 0 : interp(innerPts, y));
    const mid = (y, side) => (side * (outer(y) + inner(y))) / 2;

    const seam = o.seam || K.INK;
    const fab = o.fabric || '#7f9fd0';
    const pocketEnd = (s) => [s * outer(122), 122];
    const pocket = (s) => `M${P([s * W * 0.47, WB])} C${P([s * W * 0.5, WB + 42])} ${P([s * W * 0.8, 112])} ${P(pocketEnd(s))}`;
    const pocketStitch = (s) => `M${P([s * W * 0.47 + s * 7, WB])} C${P([s * W * 0.5 + s * 7, WB + 36])} ${P([s * W * 0.8, 104])} ${P([s * outer(114), 114])}`;
    const hemStitch = (s) => `M${P([s * (ho - 3), hemY - 13])} Q${P([(s * (ho + hi)) / 2, hemY - 7])} ${P([s * (hi + 3), hemY - 13])}`;
    const loops = (xs) =>
      xs.map((x) => rect(x - 5.5, -5, 11, WB + 13, { fill: fab, rx: 1.5, 'stroke-width': 1.3 }) + stitch(`M${P([x - 2.5, 0])} V${K.r1(WB + 4)} M${P([x + 2.5, 0])} V${K.r1(WB + 4)}`, seam, 0.8)).join('');

    let seamsF = path(`M${P([-W, WB])} L${P([W, WB])}`, { stroke: seam }) + path(`M0 ${K.r1(WB)} L0 ${K.r1(R - 4)}`, { stroke: seam });
    let stitchF = stitch(`M${P([-W + 3, 7])} L${P([W - 3, 7])} M${P([-W + 3, WB - 7])} L${P([W - 3, WB - 7])}`, seam);
    let partsF = '';
    if (o.waist !== 'drawstring') {
      seamsF += both((s) => path(pocket(s), { stroke: seam }));
      stitchF += both((s) => stitch(pocketStitch(s), seam));
      if (o.fly !== false) stitchF += stitch(`M${P([30, WB + 2])} L${P([30, R - 62])} Q${P([30, R - 24])} ${P([3, R - 14])}`, seam);
      if (o.coin !== false) seamsF += path(`M${P([W * 0.6, WB + 22])} L${P([W * 0.6, WB + 52])} L${P([W * 0.86, WB + 46])}`, { stroke: seam, 'stroke-width': 1.2 });
      partsF += loops([-W * 0.86, -W * 0.45, W * 0.45, W * 0.86]);
      if (o.fly !== false) partsF += K.button(-4, WB / 2, 7.5);
      partsF += K.rivet(W * 0.47 + 5, WB + 5) + K.rivet(-W * 0.47 - 5, WB + 5) + K.rivet(outer(122) - 6, 118) + K.rivet(-outer(122) + 6, 118);
    }
    if (!o.rawHem) stitchF += both((s) => stitch(hemStitch(s), seam));

    let seamsB = path(`M${P([-W, WB])} L${P([W, WB])}`, { stroke: seam }) + path(`M0 ${K.r1(WB)} L0 ${K.r1(R - 4)}`, { stroke: seam });
    seamsB += path(`M${P([-outer(92), 92])} L0 140 L${P([outer(92), 92])}`, { stroke: seam });
    const bp = (s) => {
      const cx = s * (W * 0.5 + 6);
      return [[cx - 48, 152], [cx + 48, 152], [cx + 44, 258], [cx, 282], [cx - 44, 258]];
    };
    let partsB = '';
    let stitchB = stitch(`M${P([-W + 3, 7])} L${P([W - 3, 7])} M${P([-W + 3, WB - 7])} L${P([W - 3, WB - 7])}`, seam);
    if (o.backPockets !== false) {
      partsB += both((s) => path(poly(bp(s), true), { fill: fab, stroke: seam, 'stroke-width': 1.5 }) + stitch(poly(K.inset(bp(s), 0.1), true), seam));
    }
    if (o.waist !== 'drawstring') partsB += loops([-W * 0.86, -W * 0.45, 0, W * 0.45, W * 0.86]) + rect(W * 0.2, 7, W * 0.32, WB - 14, { fill: '#e8dcc4', 'stroke-width': 1.1 });
    if (!o.rawHem) stitchB += both((s) => stitch(hemStitch(s), seam));

    const wide = Math.max(H, ko || 0, ho);
    return {
      kind: 'jeans',
      d,
      bbox: [-wide - 8, -8, wide + 8, hemY + (o.pointHem ? 60 : 12)],
      front: { seams: seamsF, stitches: stitchF, parts: partsF },
      back: { seams: seamsB, stitches: stitchB, parts: partsB },
      a: { W, WB, H, hipY, R, K: KN, hemY, ko, ki, ho, hi },
      outer,
      inner,
      mid,
      hemPt: (side, t) => [side * (hi + (ho - hi) * t), hemY + 3],
    };
  }

  /* ---------- tops, camisetas, buzos y chaquetas ---------- */
  function top(o = {}) {
    const nw = o.nw ?? 52;
    const nd = o.nd ?? 44;
    const S = o.S ?? [150, 22];
    const U = o.U ?? [150, 200];
    const Hm = o.Hm ?? [150, 560];
    const sl = o.sleeve;
    const seam = o.seam || K.INK;
    const h = new Half([nw, 0]);
    h.Q([(nw + S[0]) / 2, S[1] * 0.25], S);
    let cuff = null;
    if (sl) {
      const a = (sl.ang * Math.PI) / 180;
      const dir = [Math.sin(a), Math.cos(a)];
      const nrm = [-Math.cos(a), Math.sin(a)];
      const P4 = [S[0] + dir[0] * sl.len, S[1] + dir[1] * sl.len];
      const P3 = [P4[0] + nrm[0] * sl.cuff, P4[1] + nrm[1] * sl.cuff];
      if (sl.puff) {
        const bulge = sl.puff;
        h.C([S[0] + dir[0] * sl.len * 0.25 - nrm[0] * bulge, S[1] + dir[1] * sl.len * 0.25 - nrm[1] * bulge], [P4[0] - dir[0] * sl.len * 0.3 - nrm[0] * bulge, P4[1] - dir[1] * sl.len * 0.3 - nrm[1] * bulge], P4);
        h.L(P3);
        h.C([P3[0] - dir[0] * sl.len * 0.3 + nrm[0] * bulge * 0.5, P3[1] - dir[1] * sl.len * 0.3 + nrm[1] * bulge * 0.5], [U[0] + 20, U[1] + 40], U);
      } else if (sl.bell) {
        h.C([S[0] + dir[0] * sl.len * 0.5, S[1] + dir[1] * sl.len * 0.5], [P4[0] - nrm[0] * sl.bell, P4[1] - dir[1] * 40], [P4[0] - nrm[0] * sl.bell, P4[1]]);
        h.L([P3[0] + nrm[0] * sl.bell * 0.4, P3[1] + 10]);
        h.L(U);
      } else {
        h.L(P4);
        h.L(P3);
        h.L(U);
      }
      cuff = { outer: P4, inner: P3, dir, nrm };
    } else {
      h.C([S[0] - 2, S[1] + 70], [U[0] - 34, U[1] - 26], U);
    }
    const waist = o.waist ?? 0;
    h.C([U[0] - waist, U[1] + (Hm[1] - U[1]) * 0.42], [Hm[0] - waist * 0.4, Hm[1] - (Hm[1] - U[1]) * 0.3], Hm);
    const middle = o.hemPath || ` L${P([-Hm[0], Hm[1]])}`;
    const topEdge = o.neck === 'hood-closed' ? ` L${P([nw, 0])}` : ` Q0 9 ${P([nw, 0])}`;
    const d = closed(h, topEdge, middle);
    const side = (y) => interp([[U[0], U[1]], [Hm[0], Hm[1]]], y);

    let seamsF = '';
    let stitchF = '';
    let partsF = '';
    let partsB = '';
    let seamsB = '';
    let stitchB = '';
    const fab = o.fabric || '#cccccc';
    const trim = o.trim || fab;

    // costura de hombro / sisa
    if (sl) {
      const arm = (s) => `M${P([s * S[0], S[1]])} Q${P([s * (U[0] + 10), (S[1] + U[1]) / 2])} ${P([s * U[0], U[1]])}`;
      seamsF += both((s) => path(arm(s), { stroke: seam, 'stroke-width': 1.3 }));
      seamsB += both((s) => path(arm(s), { stroke: seam, 'stroke-width': 1.3 }));
      if (sl.cuffBand) {
        const cb = (s) => {
          const a = [cuff.outer[0] - cuff.dir[0] * sl.cuffBand, cuff.outer[1] - cuff.dir[1] * sl.cuffBand];
          const b = [cuff.inner[0] - cuff.dir[0] * sl.cuffBand, cuff.inner[1] - cuff.dir[1] * sl.cuffBand];
          return poly([[s * a[0], a[1]], [s * cuff.outer[0], cuff.outer[1]], [s * cuff.inner[0], cuff.inner[1]], [s * b[0], b[1]]], true);
        };
        const band = (s) => path(cb(s), { fill: trim, stroke: seam, 'stroke-width': 1.4 });
        partsF += both(band);
        partsB += both(band);
        if (o.rib !== false) {
          const ribs = (s) => {
            let dd = '';
            for (let t = 0.12; t < 0.95; t += 0.11) {
              const p0 = K.lerp(cuff.outer, cuff.inner, t);
              dd += `M${P([s * (p0[0] - cuff.dir[0] * (sl.cuffBand - 3)), p0[1] - cuff.dir[1] * (sl.cuffBand - 3)])} L${P([s * (p0[0] - cuff.dir[0] * 3), p0[1] - cuff.dir[1] * 3])} `;
            }
            return path(dd, { stroke: seam, 'stroke-width': 0.8 });
          };
          stitchF += both(ribs);
          stitchB += both(ribs);
        }
      }
    }
    // ruedo / pretina inferior
    if (o.hemBand) {
      const hb = o.hemBand;
      const band = poly([[-Hm[0], Hm[1] - hb], [Hm[0], Hm[1] - hb], [Hm[0], Hm[1]], [-Hm[0], Hm[1]]], true);
      partsF += path(band, { fill: trim, stroke: seam, 'stroke-width': 1.4 });
      partsB += path(band, { fill: trim, stroke: seam, 'stroke-width': 1.4 });
      if (o.rib !== false) {
        let dd = '';
        for (let x = -Hm[0] + 9; x < Hm[0] - 4; x += 9) dd += `M${K.r1(x)} ${K.r1(Hm[1] - hb + 3)} V${K.r1(Hm[1] - 3)} `;
        stitchF += path(dd, { stroke: seam, 'stroke-width': 0.8 });
        stitchB += path(dd, { stroke: seam, 'stroke-width': 0.8 });
      }
    } else if (!o.rawHem && !o.hemPath) {
      stitchF += stitch(`M${P([-Hm[0] + 4, Hm[1] - 12])} L${P([Hm[0] - 4, Hm[1] - 12])}`, seam);
      stitchB += stitch(`M${P([-Hm[0] + 4, Hm[1] - 12])} L${P([Hm[0] - 4, Hm[1] - 12])}`, seam);
    }

    // cuellos
    let behind = '';
    let behindB = '';
    let headTop = 0;
    const clipExtra = [];
    const neckFront = `M${P([-nw, 0])} C${P([-nw, nd * 0.8])} ${P([-nw * 0.55, nd])} ${P([0, nd])} C${P([nw * 0.55, nd])} ${P([nw, nd * 0.8])} ${P([nw, 0])}`;
    if (o.neck === 'crew') {
      partsF += path(`${neckFront} L${P([nw + 10, -2])} C${P([nw + 9, nd + 14])} ${P([nw * 0.6, nd + 14])} ${P([0, nd + 14])} C${P([-nw * 0.6, nd + 14])} ${P([-nw - 9, nd + 14])} ${P([-nw - 10, -2])} Z`, { fill: trim, stroke: seam, 'stroke-width': 1.3 });
      partsF += path(neckFront, { fill: o.inside || K.mix(fab, '#000000', 0.25), stroke: seam, 'stroke-width': 1.3 });
      partsB += path(`M${P([-nw - 10, -2])} Q0 16 ${P([nw + 10, -2])} L${P([nw, 0])} Q0 9 ${P([-nw, 0])} Z`, { fill: trim, stroke: seam, 'stroke-width': 1.3 });
    } else if (o.neck === 'mock') {
      const mh = o.mockH ?? 46;
      const collar = `M${P([-nw * 0.9, -mh])} L${P([nw * 0.9, -mh])} L${P([nw + 2, 4])} Q0 14 ${P([-nw - 2, 4])} Z`;
      behind += path(collar, { fill: trim, stroke: seam, 'stroke-width': 1.5 });
      behindB += path(collar, { fill: trim, stroke: seam, 'stroke-width': 1.5 });
      clipExtra.push(collar);
      partsF += path(`M${P([-nw * 0.9, -mh])} Q0 ${K.r1(-mh + 14)} ${P([nw * 0.9, -mh])}`, { stroke: seam, 'stroke-width': 1.2 });
      if (o.rib !== false) {
        let dd = '';
        for (let x = -nw * 0.8; x <= nw * 0.8; x += 8) dd += `M${K.r1(x)} ${K.r1(-mh + 8)} L${K.r1(x * 1.06)} ${K.r1(2)} `;
        stitchF += path(dd, { stroke: seam, 'stroke-width': 0.7 });
      }
      headTop = -mh;
    } else if (o.neck === 'hood' || o.neck === 'hood-zip' || o.neck === 'hood-closed') {
      const hw = o.hoodW ?? 112;
      const ht = o.hoodH ?? 228;
      const hood = `M${P([-nw - 22, 10])} C${P([-nw - 72, -80])} ${P([-hw, -ht + 20])} ${P([0, -ht])} C${P([hw, -ht + 20])} ${P([nw + 72, -80])} ${P([nw + 22, 10])} Z`;
      behind += path(hood, { fill: fab, stroke: K.INK, 'stroke-width': 2.6 });
      behindB += path(hood, { fill: fab, stroke: K.INK, 'stroke-width': 2.6 });
      clipExtra.push(hood);
      seamsB += path(`M0 ${K.r1(-ht)} L0 4`, { stroke: seam, 'stroke-width': 1.3 });
      if (o.neck !== 'hood-closed') {
        const open = `M${P([-nw + 4, 8])} C${P([-nw - 30, -80])} ${P([-hw * 0.62, -ht + 52])} ${P([0, -ht + 44])} C${P([hw * 0.62, -ht + 52])} ${P([nw + 30, -80])} ${P([nw - 4, 8])} Z`;
        partsF += path(open, { fill: o.inside || K.mix(fab, '#000000', 0.32), stroke: K.INK, 'stroke-width': 2 });
        stitchF += stitch(`M${P([-nw - 10, 6])} C${P([-nw - 46, -84])} ${P([-hw * 0.7, -ht + 40])} ${P([0, -ht + 30])} C${P([hw * 0.7, -ht + 40])} ${P([nw + 46, -84])} ${P([nw + 10, 6])}`, seam);
        if (o.neck === 'hood') {
          // capucha de buzo cerrado: los bordes se cruzan en el cuello
          partsF += path(`M${P([-nw + 4, 8])} Q${P([-10, 30])} ${P([nw * 0.5, 30])} M${P([nw - 4, 8])} Q${P([12, 24])} ${P([-nw * 0.3, 36])}`, { stroke: K.INK, 'stroke-width': 1.6 });
        }
      }
      headTop = -ht;
    } else if (o.neck === 'collar') {
      const band = `M${P([-nw - 8, -6])} Q0 -22 ${P([nw + 8, -6])} L${P([nw, 4])} Q0 -6 ${P([-nw, 4])} Z`;
      const leafPts = (s) => [[s * (nw + 2), -6], [s * (nw + 58), 14], [s * 24, 106], [s * 4, 62]];
      behind += path(band, { fill: trim, stroke: seam, 'stroke-width': 1.5 });
      behindB += path(`M${P([-nw - 10, -8])} Q0 -24 ${P([nw + 10, -8])} L${P([nw + 4, 20])} Q0 6 ${P([-nw - 4, 20])} Z`, { fill: trim, stroke: seam, 'stroke-width': 1.5 });
      partsF += both((s) => path(poly(leafPts(s), true), { fill: trim, stroke: seam, 'stroke-width': 1.5 }) + stitch(poly(K.inset(leafPts(s), 0.16), true), seam, 0.9));
      headTop = -24;
    }

    // cierres
    if (o.closure === 'zip') {
      const y0 = o.neck === 'hood-closed' ? -(o.hoodH ?? 228) + 6 : 4;
      partsF += K.zipper(0, y0, Hm[1] - (o.hemBand ? 0 : 2), { sliderY: o.sliderY ?? (o.neck === 'hood-closed' ? y0 + 4 : 10) });
    } else if (o.closure === 'buttons') {
      seamsF += path(`M${P([14, 62])} L${P([14, Hm[1]])}`, { stroke: seam, 'stroke-width': 1.4 });
      stitchF += stitch(`M${P([20, 66])} L${P([20, Hm[1] - 4])} M${P([-14, 66])} L${P([-14, Hm[1] - 4])}`, seam);
      const ys = o.buttons || [80, 150, 220, 290];
      partsF += ys.map((y) => K.button(0, y, 7)).join('');
    } else if (o.closure === 'open') {
      // delanteros abiertos: se ve el interior entre los dos bordes
      const gap = o.gap || [[-nw + 12, 4], [nw - 12, 4], [o.gapBottom ?? 44, Hm[1]], [-(o.gapBottom ?? 44), Hm[1]]];
      partsF += path(poly(gap, true), { fill: o.inside || K.mix(fab, '#000000', 0.3), stroke: K.INK, 'stroke-width': 2 });
    }

    const wide = Math.max(Hm[0], U[0], S[0], cuff ? Math.max(cuff.outer[0], cuff.inner[0]) + (sl && sl.bell ? sl.bell : 0) + (sl && sl.puff ? sl.puff : 0) : 0);
    const bottom = Math.max(Hm[1], cuff ? Math.max(cuff.outer[1], cuff.inner[1]) + 12 : 0) + (o.extraBottom || 0);
    return {
      kind: 'top',
      d,
      behind,
      behindB,
      clipExtra,
      bbox: [-wide - 10, Math.min(headTop, 0) - 10, wide + 10, bottom + 12],
      front: { seams: seamsF, stitches: stitchF, parts: partsF },
      back: { seams: seamsB, stitches: stitchB, parts: partsB },
      a: { nw, nd, S, U, Hm, headTop },
      cuff,
      side,
    };
  }

  window.HT = { jeans, top, Half, closed, interp };
})();
