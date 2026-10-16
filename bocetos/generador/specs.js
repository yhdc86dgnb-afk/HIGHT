// Boceto de cada prenda: silueta base + detalles + llamadas. Coordenadas locales de la plantilla.
(function () {
  const K = window.HK;
  const HT = window.HT;
  const { P, path, poly, stitch, rect, circle, INK } = K;
  const S = {};
  const both = (fn) => fn(1) + fn(-1);
  const WHITE = '#f6f3ec';

  function legPoly(j, side, y0, y1, t0 = 0, t1 = 1) {
    const at = (y, t) => side * (j.inner(y) + (j.outer(y) - j.inner(y)) * t);
    return [[at(y0, t0), y0], [at(y0, t1), y0], [at(y1, t1), y1], [at(y1, t0), y1]];
  }
  function rawEdges(rnd, pts, color = WHITE, len = 6) {
    let s = '';
    for (let i = 0; i < pts.length; i++) s += K.fringe([pts[i], pts[(i + 1) % pts.length]], len, 3.6, { stroke: color }, rnd);
    return s;
  }
  function patch(rnd, pts, fill, o = {}) {
    let s = path(poly(pts, true), { fill, stroke: o.stroke || INK, 'stroke-width': 1.3 });
    if (o.inner) s += o.inner;
    if (o.raw) s += rawEdges(rnd, pts, o.fringe || WHITE, o.fringeLen || 6);
    if (o.stitch !== false) s += stitch(poly(K.inset(pts, 0.1), true), o.stitchColor || INK, 0.9);
    return s;
  }
  function clipTo(id, d, inner) {
    return K.tag('clipPath', { id }, K.tag('path', { d })) + K.g({ 'clip-path': `url(#${id})` }, inner);
  }
  function hemFringe(j, rnd, color, len = 12) {
    const a = j.a;
    return both((s) => K.fringe([[s * a.hi, a.hemY + 2], [s * a.ho, a.hemY + 2]], len, 3.2, { stroke: color }, rnd, -s));
  }
  function laceUp(j, side, y0, y1, cordColor = '#f0e6d8') {
    let s = '';
    const pts = [];
    for (let y = y0; y <= y1; y += 34) {
      const x = side * (j.outer(y) - 14);
      pts.push([x, y]);
    }
    let zig = [];
    pts.forEach((p, i) => {
      zig.push([p[0] - side * 9, p[1]]);
      zig.push([p[0] + side * 9, p[1] + 17]);
    });
    s += path(poly(zig), { stroke: INK, 'stroke-width': 4 }) + path(poly(zig), { stroke: cordColor, 'stroke-width': 2.4 });
    pts.forEach((p) => (s += K.eyelet(p[0] - side * 9, p[1], 4.5) + K.eyelet(p[0] + side * 9, p[1] + 17, 4.5)));
    return s;
  }

  /* ===================== CHAQUETAS Y BUZOS ===================== */

  S['chaqueta-blood-rose'] = (k) => {
    const fab = '#c9b6ee';
    const t = HT.top({ neck: 'hood-closed', hoodW: 118, hoodH: 236, closure: 'zip', S: [162, 26], U: [152, 214], Hm: [150, 575], sleeve: { ang: 24, len: 420, cuff: 74, cuffBand: 34 }, fabric: fab, trim: '#7a1018' });
    const fire = (y) => K.mix('#e0402a', '#140808', Math.max(0, Math.min(1, (y + 240) / 860)));
    const holes = (rnd, n, x0, x1, y0, y1) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * (x1 - x0);
        const y = y0 + rnd() * (y1 - y0);
        const w = 10 + rnd() * 22;
        s += path(K.blob(x, y, w, rnd, 0.45, 8, w * (0.4 + rnd() * 0.5)), { fill: fire(y), stroke: INK, 'stroke-width': 1.1 });
      }
      return s;
    };
    const r = k.rnd;
    const pattern = holes(r, 70, -300, 300, -230, 570);
    const patternB = holes(K.rng(7), 60, -300, 300, -230, 570);
    return {
      tpl: t,
      fabric: fab,
      palette: [[fab, 'Lavanda (capa de fuera)'], ['#e0402a', 'Rojo fuego'], ['#140808', 'Negro'], ['#7a1018', 'Puños en degradado']],
      front: { pattern },
      back: { pattern: patternB },
      marks: [
        { at: [0, -170], text: 'Cremallera metálica continua: sube del ruedo hasta la cima de la capucha.' },
        { at: [80, 250], text: 'Calados hechos a mano en la capa lavanda: dejan ver la base teñida.' },
        { at: [-95, 470], text: 'Doble capa: cubierta lavanda sobre un degradado de fuego, de rojo a negro.' },
        { at: [t.cuff.inner[0] + 10, t.cuff.inner[1] - 18], text: 'Puños acanalados en degradado.' },
      ],
      fits: [
        { at: [-118, -110], text: 'Cerrada queda envolvente, hasta la cabeza.' },
        { at: [0, 380], text: 'Abierta se usa como chaqueta.' },
        { at: [-t.cuff.inner[0] - 6, t.cuff.inner[1] - 18], text: 'Los puños la ajustan a las muñecas.' },
      ],
    };
  };

  S['buzo-destroyed-ceniza'] = (k) => {
    const fab = '#aaa8a2';
    const t = HT.top({ neck: 'hood', hoodW: 116, hoodH: 226, S: [160, 28], U: [150, 206], Hm: [148, 420], hemBand: 30, sleeve: { ang: 24, len: 400, cuff: 76 }, fabric: fab, trim: K.mix(fab, '#000', 0.08), inside: '#55534e', rawHem: true });
    const r = k.rnd;
    const lower = '#6d6b66';
    const ripsF =
      K.rip(k.id + 'r1', 60, 150, 70, 46, r, { fill: lower, threadColor: '#d8d5ce', fringe: true }) +
      K.rip(k.id + 'r2', -70, 250, 52, 34, r, { fill: lower, threadColor: '#d8d5ce', fringe: true }) +
      K.rip(k.id + 'r3', 40, 300, 40, 26, r, { fill: '#4a4844', threadColor: '#d8d5ce', fringe: true }) +
      K.rip(k.id + 'r4', -92, -150, 46, 30, r, { fill: lower, threadColor: '#d8d5ce', fringe: true }) +
      K.rip(k.id + 'r5', 70, -120, 34, 26, r, { fill: lower, threadColor: '#d8d5ce', fringe: true }) +
      K.rip(k.id + 'r6', 230, 300, 40, 30, r, { fill: lower, threadColor: '#d8d5ce', fringe: true }) +
      K.rip(k.id + 'r7', -250, 330, 46, 30, r, { fill: lower, threadColor: '#d8d5ce', fringe: true });
    const gothic = K.g({}, K.cross(0, -116, 13, { fill: '#cfccc4', stroke: 'none' }) + K.spiral(-26, -86, 14, 2, { stroke: '#cfccc4' }) + K.spiral(26, -86, 14, 2, { stroke: '#cfccc4' }) + path('M-40 -60 Q0 -40 40 -60', { stroke: '#cfccc4', 'stroke-width': 1.6 }));
    const cuffs = both((s) => K.fringe([[s * t.cuff.outer[0], t.cuff.outer[1]], [s * t.cuff.inner[0], t.cuff.inner[1]]], 10, 3.4, { stroke: '#8a8781' }, r, s));
    return {
      tpl: t,
      fabric: fab,
      palette: [[fab, 'Gris lavado'], [lower, 'Capa de abajo'], ['#55534e', 'Interior de la capucha']],
      front: { pattern: ripsF, details: gothic, over: cuffs },
      back: { pattern: K.rip(k.id + 'b1', 50, 200, 60, 40, K.rng(3), { fill: lower, threadColor: '#d8d5ce', fringe: true }) + K.rip(k.id + 'b2', -80, -120, 50, 34, K.rng(4), { fill: lower, threadColor: '#d8d5ce', fringe: true }), over: cuffs },
      marks: [
        { at: [60, 150], text: 'Roto por capas en el pecho, las mangas y la capucha: deja ver la tela de abajo.' },
        { at: [0, -60], text: 'Gráfico gótico estampado dentro de la capucha.' },
        { at: [t.cuff.outer[0] - 20, t.cuff.outer[1] - 4], text: 'Mangas largas con bordes crudos.' },
        { at: [-120, 392], text: 'Felpa lavada; los calados la hacen más fresca que un buzo normal.' },
      ],
      fits: [
        { at: [130, 405], text: 'Corto y holgado, con capucha.' },
        { at: [-150, 300], text: 'Al levantar los brazos deja ver la cintura.' },
      ],
    };
  };

  S['buzo-multitud-termica'] = (k) => {
    const fab = '#3a3a3a';
    const seam = '#e9e3d6';
    const t = HT.top({ neck: 'hood-zip', hoodW: 120, hoodH: 226, closure: 'zip', S: [172, 30], U: [162, 214], Hm: [168, 430], sleeve: { ang: 26, len: 400, cuff: 84 }, fabric: fab, seam, inside: '#1f1f1f', rawHem: true });
    const r = k.rnd;
    const thermal = ['#7a3cff', '#e0302a', '#ff8a1e', '#3fc35a', '#ff5fa8', '#ffd23a'];
    const crowd = (rnd) => {
      let s = '';
      for (let row = 0; row < 14; row++) {
        const base = -200 + row * 52;
        for (let i = 0; i < 16; i++) {
          const x = -340 + i * 44 + (row % 2) * 22 + (rnd() - 0.5) * 10;
          s += K.person(x, base, 44 + rnd() * 10, thermal[(i + row * 3) % thermal.length]);
        }
      }
      return s;
    };
    const rips =
      K.rip(k.id + 'm1', -60, 170, 66, 40, r, { fill: '#9a9a9a', threadColor: WHITE, fringe: true }) +
      K.rip(k.id + 'm2', -56, 172, 34, 20, r, { fill: '#c3142d', threads: false }) +
      K.rip(k.id + 'm3', 70, 250, 50, 32, r, { fill: '#c3142d', threadColor: WHITE, fringe: true });
    const blanket = K.blanket([[-60, 8], [-160, 30]], 9, 9, { stroke: WHITE });
    const hem = K.fringe([[-168, 432], [168, 432]], 16, 3, { stroke: '#8a8a8a' }, r, -1);
    return {
      tpl: t,
      fabric: fab,
      palette: [[fab, 'Negro lavado'], ['#7a3cff', 'Violeta térmico'], ['#e0302a', 'Rojo'], ['#ff8a1e', 'Naranja'], ['#3fc35a', 'Verde']],
      front: { pattern: crowd(r) + rips, details: blanket, over: hem },
      back: { pattern: crowd(K.rng(11)), over: hem },
      marks: [
        { at: [120, 360], text: 'Estampado de multitud en colores de cámara térmica, con el borde blanco.' },
        { at: [-60, 170], text: 'Rotos con capas de tela gris y roja en el pecho.' },
        { at: [-112, 18], text: 'Costura de manta en contraste en un hombro.' },
        { at: [-100, 446], text: 'Ruedo deshilachado con hilos sueltos, a propósito.' },
        { at: [0, 300], text: 'Cremallera y capucha.' },
      ],
      fits: [
        { at: [150, 420], text: 'Corto y amplio.' },
        { at: [-235, 300], text: 'Se usa abierto o cerrado; los brazos se mueven sin tirar.' },
      ],
    };
  };

  S['buzo-sakura-rosa'] = (k) => {
    const fab = '#f2a9c4';
    const trim = '#8f8f8f';
    const t = HT.top({ neck: 'hood-zip', hoodW: 116, hoodH: 222, closure: 'zip', S: [160, 28], U: [150, 210], Hm: [150, 560], hemBand: 36, sleeve: { ang: 24, len: 420, cuff: 74, cuffBand: 34 }, fabric: fab, trim, inside: '#c97c99' });
    const r = k.rnd;
    const branch = (x, y, len, ang, rnd) => {
      let s = '';
      const a = (ang * Math.PI) / 180;
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push([x + Math.cos(a) * len * (i / 6) + (rnd() - 0.5) * 12, y + Math.sin(a) * len * (i / 6) + (rnd() - 0.5) * 12]);
      s += path(K.smooth(pts), { stroke: '#5a3a2a', 'stroke-width': 3.2 });
      pts.slice(1).forEach((p) => {
        const fx = p[0] + (rnd() - 0.5) * 30;
        const fy = p[1] + (rnd() - 0.5) * 30;
        s += path(`M${P(p)} L${P([fx, fy])}`, { stroke: '#5a3a2a', 'stroke-width': 1.6 });
        for (let q = 0; q < 5; q++) {
          const pa = (q / 5) * Math.PI * 2;
          s += circle(fx + Math.cos(pa) * 4.5, fy + Math.sin(pa) * 4.5, 4, { fill: q % 2 ? '#ffffff' : '#ffd6e6', 'stroke-width': 0.6 });
        }
        s += circle(fx, fy, 1.8, { fill: '#c3142d', stroke: 'none' });
      });
      return s;
    };
    const print = branch(-200, 80, 330, 18, r) + branch(60, 420, 260, -24, r) + branch(-120, -170, 200, 10, r);
    const script = K.scribble(30, 120, 90, r, { h: 5 }) + K.scribble(-250, 250, 55, r, { h: 4 });
    const pockets = both((s) => path(`M${P([s * 20, 420])} L${P([s * 120, 420])} L${P([s * 136, 520])} L${P([s * 20, 520])} Z`, { fill: fab, 'stroke-width': 1.4 }) + path(`M${P([s * 120, 420])} L${P([s * 136, 520])}`, { stroke: trim, 'stroke-width': 6 }) + path(`M${P([s * 120, 420])} L${P([s * 136, 520])}`, { stroke: INK, 'stroke-width': 1 }));
    const strings = K.drawstring(-30, 12, 110, -1) + K.drawstring(30, 12, 110, 1);
    return {
      tpl: t,
      fabric: fab,
      palette: [[fab, 'Rosa'], [trim, 'Bordes grises'], ['#5a3a2a', 'Ramas'], ['#ffd6e6', 'Flores']],
      front: { pattern: print, details: pockets + script, over: strings },
      back: { pattern: branch(-180, 60, 360, 14, K.rng(5)) + branch(-40, 330, 260, -18, K.rng(6)) },
      marks: [
        { at: [-150, 110], text: 'Ramas de cerezo estampadas sobre el rosa.' },
        { at: [75, 120], text: 'Texto en letra cursiva en el pecho y las mangas.' },
        { at: [100, 470], text: 'Bolsillos con borde en contraste.' },
        { at: [-75, 545], text: 'Bordes grises en contraste en el ruedo y los puños.' },
      ],
      fits: [
        { at: [-150, 380], text: 'Amplio, con cremallera y capucha.' },
        { at: [0, 260], text: 'Se usa abierto o cerrado.' },
      ],
    };
  };

  function trucker(o) {
    return HT.top({ neck: 'collar', S: [158, 26], U: [150, 206], Hm: [150, o.hemY || 400], sleeve: { ang: 22, len: 380, cuff: 78, cuffBand: o.cuffBand ?? 30 }, rib: false, hemBand: o.hemBand ?? 0, rawHem: !o.hemBand, ...o });
  }
  function truckerDetails(t, seam, fab, withPockets = true) {
    let s = '';
    const yoke = (sd) => path(`M${P([sd * 14, 112])} L${P([sd * 70, 132])} L${P([sd * t.side(108), 104])}`, { stroke: seam, 'stroke-width': 1.4 }) + stitch(`M${P([sd * 14, 118])} L${P([sd * 70, 138])} L${P([sd * t.side(114), 110])}`, seam, 0.9);
    s += both(yoke);
    if (withPockets) {
      const flap = (sd) => [[sd * 30, 150], [sd * 110, 150], [sd * 110, 176], [sd * 70, 190], [sd * 30, 176]];
      s += both((sd) => path(poly([[sd * 32, 176], [sd * 108, 176], [sd * 108, 236], [sd * 32, 236]], true), { fill: fab, stroke: seam, 'stroke-width': 1.3 }) + path(poly(flap(sd), true), { fill: fab, stroke: seam, 'stroke-width': 1.4 }) + stitch(poly(K.inset(flap(sd), 0.15), true), seam, 0.8) + K.button(sd * 70, 178, 5.5));
      s += both((sd) => path(`M${P([sd * 70, 240])} L${P([sd * 70, t.a.Hm[1] - 4])}`, { stroke: seam, 'stroke-width': 1.2 }));
    }
    return s;
  }

  S['chaqueta-smiley-acido'] = (k) => {
    const fab = '#e7d43a';
    const t = trucker({ fabric: fab, trim: fab, closure: 'buttons', buttons: [84, 160, 236, 312], hemY: 400 });
    const r = k.rnd;
    const paint =
      K.smiley(-90, 110, 40, { fill: '#f6ec6a' }) +
      K.smiley(95, 300, 34, { fill: '#f6ec6a' }) +
      K.smiley(-250, 300, 30, { fill: '#f6ec6a' }) +
      K.checker(-150, 300, 56, 42, 14) +
      K.checker(170, 120, 56, 70, 14) +
      K.spray(40, 60, 60, r, INK, 160) +
      K.spray(-60, 340, 50, r, INK, 120) +
      K.flame(-40, 395, 34, 1, { fill: '#ff6a1e' }) +
      K.flame(130, 398, 30, -1, { fill: '#ff6a1e' }) +
      K.letters(-140, 272, 20, 'IN DUST WE TRUST', { rot: -5 }) +
      K.scribble(20, 210, 80, r, { h: 5 }) +
      K.scribble(-130, 40, 70, r, { h: 4 });
    const under = path(poly([[-146, 380], [146, 380], [146, 418], [-146, 418]], true), { fill: '#fbfaf6', 'stroke-width': 1.6 }) + K.fringe([[-146, 418], [146, 418]], 8, 3.4, { stroke: '#cfcabc' }, r, -1);
    const hem = K.fringe([[-150, 400], [150, 400]], 9, 3.2, { stroke: '#b9a92a' }, r, -1);
    const strap = rect(96, 300, 30, 80, { fill: '#2a2a2a', 'stroke-width': 1.3 }) + rect(92, 352, 38, 22, { fill: K.METAL, rx: 3, 'stroke-width': 1.2 }) + K.chain([[111, 376], [124, 430], [100, 482], [70, 470], [60, 420]], 11, '#62f07c', 2.6);
    return {
      tpl: t,
      fabric: fab,
      palette: [[fab, 'Amarillo teñido'], ['#0d0c0b', 'Pintura negra'], ['#62f07c', 'Cadena verde neón'], ['#fbfaf6', 'Capa interior blanca']],
      front: { under, pattern: paint, details: truckerDetails(t, INK, fab) + hem, over: strap },
      back: { under, pattern: K.smiley(0, 160, 56, { fill: '#f6ec6a' }) + K.letters(-110, 290, 26, 'DUST OF GODS', { rot: -4 }) + K.checker(-150, 60, 60, 60, 15) + K.spray(90, 330, 50, K.rng(9), INK, 120), details: hem },
      marks: [
        { at: [-90, 110], text: 'Pintada a mano: caras sonrientes con ojos de rayo.' },
        { at: [-122, 321], text: 'Cuadros blanco y negro, aerosol negro y llamas.' },
        { at: [-150, 246], text: 'Textos escritos a mano, entre ellos “In dust we trust”.' },
        { at: [111, 440], text: 'Cadena verde neón que cuelga de una correa con placa metálica; se quita.' },
        { at: [0, 160], text: 'Botones metálicos.' },
        { at: [-120, 412], text: 'Ruedo cortado en crudo; asoma una capa interior blanca.' },
        { at: [-132, 282], view: 'back', text: 'Firma de Dust of Gods pintada en la tela.' },
      ],
      fits: [
        { at: [150, 380], text: 'Corta y holgada, a la cintura.' },
        { at: [-200, 200], text: 'Se mueve bien y se lleva abierta encima de cualquier camiseta.' },
      ],
    };
  };

  S['chaqueta-trouble-maker'] = (k) => {
    const fab = '#2a2a2a';
    const seam = '#e9e3d6';
    const olive = '#9aa356';
    const t = trucker({ fabric: fab, trim: olive, seam, hemY: 400, cuffBand: 34 });
    const r = k.rnd;
    const W = WHITE;
    const front =
      K.spiral(-250, 260, 26, 3, { stroke: W }) +
      K.spiral(255, 250, 26, 3, { stroke: W }) +
      K.spiral(-215, 150, 18, 2, { stroke: W }) +
      K.spiral(220, 140, 18, 2, { stroke: W }) +
      K.face(-80, 280, 30, { color: W }) +
      K.face(90, 300, 26, { color: W }) +
      K.face(-40, 160, 18, { color: W }) +
      K.cross(118, 216, 9, { fill: '#d4a5a5', stroke: 'none' }) +
      K.cross(-118, 350, 8, { fill: '#d4a5a5', stroke: 'none' }) +
      K.scribble(30, 360, 70, r, { color: '#d4a5a5', h: 4 }) +
      K.scribble(-120, 80, 50, r, { color: '#d4a5a5', h: 3 }) +
      path('M-130 330 q20 -40 40 0 q20 40 40 0', { stroke: W, 'stroke-width': 1.5 }) +
      path('M40 230 l30 -30 l30 30 l-30 30 z', { stroke: W, 'stroke-width': 1.5 });
    const oliveBand = (pts) => path(poly(pts, true), { fill: olive, stroke: INK, 'stroke-width': 1.2 }) + K.fringe([pts[3], pts[2]], 8, 3, { stroke: '#c9cf8a' }, r, -1);
    const hemBand = oliveBand([[-152, 384], [152, 384], [152, 404], [-152, 404]]);
    const ties = K.bow(0, 120, 9) + K.bow(0, 250, 9) + both((sd) => K.bow(sd * (t.cuff.outer[0] + t.cuff.inner[0]) / 2, (t.cuff.outer[1] + t.cuff.inner[1]) / 2 - 20, 7));
    const back = K.wingedHeart(0, 170, 34, { color: W }) + K.letters(0, 300, 40, 'TROUBLE MAKER', { fill: W, anchor: 'middle' }) + K.cross(-100, 90, 8, { fill: '#d4a5a5', stroke: 'none' });
    const centre = path('M0 60 L0 398', { stroke: seam, 'stroke-width': 1.3 });
    return {
      tpl: t,
      fabric: fab,
      backKnown: true,
      palette: [[fab, 'Denim negro'], [W, 'Pintura blanca'], ['#d4a5a5', 'Rosa viejo'], [olive, 'Tela oliva deshilachada']],
      front: { pattern: front, details: truckerDetails(t, seam, fab, false) + centre + hemBand, over: ties },
      back: { pattern: back, details: hemBand },
      marks: [
        { at: [-80, 280], text: 'Pintada a mano en blanco, como un grabado: caras y figuras en el frente.' },
        { at: [-250, 260], text: 'Espirales en las mangas.' },
        { at: [118, 216], text: 'Cruces y firmas en rosa viejo.' },
        { at: [-60, 394], text: 'Capas de tela verde oliva deshilachada en el cuello, el ruedo y los puños.' },
        { at: [0, 120], text: 'Tiras para amarrar en el frente y en los puños.' },
        { at: [0, 210], view: 'back', text: 'En la espalda, un corazón con alas y el texto “Trouble Maker”; la parte de atrás de las mangas va en negro liso.' },
      ],
      fits: [
        { at: [150, 380], text: 'Corta y recta, a la cintura.' },
        { at: [-30, 200], text: 'Se cierra con tiras al frente o se lleva abierta.' },
      ],
    };
  };

  S['tejido-deshilado-ceniza'] = (k) => {
    const fab = '#b8b5ae';
    const t = HT.top({ nw: 60, neck: 'none', closure: 'open', gapBottom: 52, S: [178, 34], U: [184, 250], Hm: [186, 600], sleeve: { ang: 18, len: 360, cuff: 140, bell: 22 }, fabric: fab, inside: '#7d7a74', rawHem: true });
    const r = k.rnd;
    let p = '';
    const greys = ['#d6d3cc', '#a19e97', '#8a8782', '#c4c1ba'];
    for (let i = 0; i < 10; i++) p += rect(-420, -10 + i * 64, 840, 64, { fill: greys[i % greys.length], stroke: 'none', opacity: 0.55 });
    p += K.knitMarks(-420, 0, 840, 620, r, '#6f6c66', 12);
    for (let i = 0; i < 16; i++) {
      const x = -180 + r() * 360;
      const y = 60 + r() * 500;
      p += path(K.blob(x, y, 8 + r() * 14, r, 0.5, 8, 6 + r() * 12), { fill: '#6f6c66', stroke: INK, 'stroke-width': 1 });
    }
    const strip = (pts) => path(K.smooth(pts), { stroke: INK, 'stroke-width': 9 }) + path(K.smooth(pts), { stroke: '#9b9892', 'stroke-width': 6.5 });
    const strips = strip([[-150, 120], [-110, 260], [-130, 420], [-100, 640]]) + strip([[120, 80], [150, 300], [130, 520], [150, 690]]) + strip([[-60, 380], [-40, 520], [-70, 660]]) + strip([[60, 420], [40, 560], [70, 700]]);
    const edges = both((s) => K.fringe([[s * 12, 6], [s * 52, 600]], 7, 3.4, { stroke: '#8a8782' }, r, s));
    return {
      tpl: t,
      fabric: fab,
      palette: [['#d6d3cc', 'Gris claro'], [fab, 'Gris medio'], ['#8a8782', 'Gris oscuro'], ['#6f6c66', 'Calados']],
      front: { pattern: p, details: edges, over: strips },
      back: { pattern: p, over: strip([[-80, 120], [-60, 400], [-90, 650]]) + strip([[90, 140], [70, 380], [100, 640]]) },
      marks: [
        { at: [-150, 480], text: 'Tejido abierto en malla, en varios grises.' },
        { at: [70, 200], text: 'Calados irregulares, a propósito: cada hueco es parte del diseño.' },
        { at: [150, 640], text: 'Tiras tejidas que cuelgan sueltas.' },
        { at: [t.cuff.outer[0] - 40, t.cuff.outer[1] - 20], text: 'Mangas anchas.' },
        { at: [0, 300], text: 'Se usa abierto, como una capa encima de lo que tengas puesto.' },
      ],
      fits: [
        { at: [-200, 560], text: 'Oversize: se pone encima de todo.' },
        { at: [-t.cuff.outer[0] + 50, t.cuff.outer[1] - 60], text: 'Las mangas anchas dejan mover los brazos sin tirar.' },
      ],
    };
  };

  S['tejido-anillos-indigo'] = (k) => {
    const fab = '#22305e';
    const seam = '#cfd6ea';
    const t = HT.top({ neck: 'mock', mockH: 52, nw: 50, S: [132, 30], U: [134, 186], Hm: [134, 360], hemBand: 30, sleeve: { ang: 30, len: 330, cuff: 52, cuffBand: 28, puff: 44 }, fabric: fab, trim: '#1b264d', seam });
    const r = k.rnd;
    const tube = (pts) => path(K.smooth(pts), { stroke: INK, 'stroke-width': 14 }) + path(K.smooth(pts), { stroke: '#34488a', 'stroke-width': 11 }) + path(K.smooth(pts), { stroke: '#4d63a8', 'stroke-width': 3 });
    const tubes = tube([[-120, 70], [-60, 150], [0, 190], [60, 150], [120, 70]]) + tube([[-110, 230], [-40, 260], [40, 260], [110, 230]]) + tube([[-150, 60], [-210, 160], [-262, 280]]) + tube([[150, 60], [210, 160], [262, 280]]) + tube([[0, 20], [0, 190]]);
    const rings = K.ring(0, 190, 9) + K.ring(-60, 150, 8) + K.ring(60, 150, 8) + K.ring(-40, 260, 7) + K.ring(40, 260, 7) + K.ring(-210, 160, 7) + K.ring(210, 160, 7);
    const hang = (x, y, len) => path(`M${P([x, y])} q8 ${K.r1(len / 2)} 0 ${K.r1(len)}`, { stroke: INK, 'stroke-width': 9 }) + path(`M${P([x, y])} q8 ${K.r1(len / 2)} 0 ${K.r1(len)}`, { stroke: '#34488a', 'stroke-width': 6.5 }) + K.ring(x, y + len + 8, 8);
    const knit = K.knitMarks(-300, -60, 600, 430, r, '#3a4a80', 11);
    return {
      tpl: t,
      fabric: fab,
      palette: [[fab, 'Azul noche'], ['#34488a', 'Tiras tubulares'], [K.METAL, 'Argollas metálicas']],
      front: { pattern: knit, details: tubes, over: rings + hang(-30, 270, 90) + hang(30, 270, 120) + hang(90, 240, 70) },
      back: { pattern: knit, details: tube([[-120, 120], [0, 170], [120, 120]]) },
      marks: [
        { at: [-75, 135], text: 'Tiras tubulares que recorren el pecho y las mangas.' },
        { at: [0, 190], text: 'Argollas metálicas que unen las tiras.' },
        { at: [30, 400], text: 'Tiras sueltas con argolla que cuelgan del frente.' },
        { at: [0, -26], text: 'Cuello alto.' },
        { at: [-262, 230], text: 'Mangas abombadas, recogidas en el puño.' },
      ],
      fits: [
        { at: [134, 345], text: 'Corto, a la altura de la cintura.' },
        { at: [-134, 345], text: 'Queda mejor con pantalones de tiro alto.' },
      ],
    };
  };

  /* ===================== TOPS Y CAMISETA ===================== */

  S['camiseta-celula-carmin'] = (k) => {
    const fab = '#c3142d';
    const t = HT.top({ neck: 'crew', nw: 50, nd: 44, S: [150, 24], U: [148, 176], Hm: [148, 560], sleeve: { ang: 40, len: 120, cuff: 86 }, fabric: fab, trim: fab, inside: '#7a0b18' });
    const p = K.cells(-300, -20, 600, 620, k.rnd, fab, '#f0e3cf');
    return {
      tpl: t,
      fabric: fab,
      backKnown: true,
      palette: [[fab, 'Carmín'], ['#f0e3cf', 'Crema']],
      front: { pattern: p },
      back: { pattern: K.cells(-300, -20, 600, 620, K.rng(21), fab, '#f0e3cf') },
      marks: [
        { at: [-70, 300], text: 'Estampado total de pintura fluida: frente, espalda y mangas.' },
        { at: [0, 52], text: 'Cuello redondo con rib.' },
        { at: [196, 120], text: 'Manga corta.' },
      ],
      fits: [
        { at: [148, 520], text: 'Corte regular: se mueve contigo.' },
        { at: [-148, 520], text: 'Viene en S, M, L y XL; si la quieres más suelta, sube una talla.' },
      ],
    };
  };

  S['top-halftone-carmin'] = (k) => {
    const fab = '#c3142d';
    const t = HT.top({ neck: 'mock', mockH: 44, nw: 46, S: [98, 18], U: [124, 156], Hm: [120, 470], waist: 12, fabric: fab, trim: fab });
    const shape = (x, y) => {
      const b1 = Math.hypot((x + 46) / 58, (y - 210) / 52);
      const b2 = Math.hypot((x - 46) / 58, (y - 210) / 52);
      const torso = Math.abs(x) / (64 + Math.max(0, (y - 260) * 0.12)) + Math.max(0, (y - 120) / 380 - 1);
      const v = Math.max(1 - Math.min(b1, b2) * 0.75, y > 150 ? 1 - torso * 0.9 : 0.15);
      return Math.max(0.12, Math.min(1, v + (x < 0 ? 0.12 : -0.05)));
    };
    const p = K.halftone(-160, -50, 320, 540, 9, shape);
    return {
      tpl: t,
      fabric: fab,
      palette: [[fab, 'Rojo'], ['#0d0c0b', 'Puntos negros']],
      front: { pattern: p },
      back: { pattern: K.halftone(-160, -50, 320, 540, 9, () => 0.25) },
      marks: [
        { at: [-46, 210], text: 'Estampado en semitono: puntos negros sobre rojo que dibujan una silueta.' },
        { at: [0, -22], text: 'Cuello alto.' },
        { at: [100, 92], text: 'Sin mangas.' },
      ],
      fits: [
        { at: [-118, 330], text: 'Ajustado al cuerpo.' },
        { at: [-104, 92], text: 'Los brazos quedan libres; con el cuello alto va bien debajo de una chaqueta.' },
      ],
    };
  };

  S['top-crop-rostros'] = (k) => {
    const fab = '#dadada';
    const t = HT.top({ neck: 'crew', nw: 44, nd: 34, S: [98, 16], U: [124, 150], Hm: [116, 330], waist: 8, fabric: fab, trim: '#1c1c1c', inside: '#5a5a5a' });
    const r = k.rnd;
    let p = '';
    const greys = ['#f2f2f2', '#bdbdbd', '#8a8a8a', '#e3e3e3', '#5f5f5f'];
    for (let y = -10; y < 360; y += 58)
      for (let x = -170; x < 170; x += 68) {
        const g = greys[Math.floor(r() * greys.length)];
        p += rect(x + 2, y + 2, 64, 54, { fill: g, 'stroke-width': 1.2 });
        const dark = K.lum(g) < 140 ? '#f2f2f2' : INK;
        if (r() < 0.5) p += path(`M${P([x + 14, y + 28])} Q${P([x + 34, y + 12])} ${P([x + 54, y + 28])} Q${P([x + 34, y + 42])} ${P([x + 14, y + 28])} Z`, { stroke: dark, 'stroke-width': 1.3 }) + circle(x + 34, y + 28, 6, { fill: dark, stroke: 'none' });
        else p += path(`M${P([x + 14, y + 30])} Q${P([x + 34, y + 16])} ${P([x + 54, y + 30])} Q${P([x + 34, y + 46])} ${P([x + 14, y + 30])} Z M${P([x + 14, y + 30])} L${P([x + 54, y + 30])}`, { stroke: dark, 'stroke-width': 1.3 });
      }
    return {
      tpl: t,
      fabric: fab,
      palette: [['#f2f2f2', 'Blanco'], ['#8a8a8a', 'Gris'], ['#1c1c1c', 'Negro']],
      front: { pattern: p },
      back: { pattern: p },
      marks: [
        { at: [-60, 200], text: 'Estampado de foto: rostros, ojos y labios recortados, como una hoja de contactos.' },
        { at: [0, 42], text: 'Cuello redondo.' },
        { at: [80, 316], text: 'Etiqueta SHEIN.' },
      ],
      fits: [
        { at: [116, 320], text: 'Corto: deja ver la cintura.' },
        { at: [-108, 90], text: 'Ajustado al cuerpo y sin mangas: los brazos quedan libres.' },
      ],
    };
  };

  S['top-malla-asimetrico-rojo'] = (k) => {
    const fab = '#1e1e1e';
    const seam = '#e9e3d6';
    const t = HT.top({ neck: 'mock', mockH: 44, nw: 46, S: [98, 18], U: [124, 156], Hm: [120, 470], waist: 12, fabric: fab, trim: fab, seam, hemPath: ' C60 500 -40 560 -96 616 L-120 470', extraBottom: 150 });
    let mesh = '';
    for (let i = -60; i < 60; i++) mesh += `M${i * 10} -60 l700 700 M${i * 10} -60 l-700 700 `;
    const panel = path(poly([[48, 0], [104, 16], [130, 150], [40, 490], [-70, 600], [-10, 300]], true), { fill: '#c3142d', stroke: INK, 'stroke-width': 1.5 });
    const p = path(mesh, { stroke: '#6d6d6d', 'stroke-width': 0.8 }) + panel;
    const chainF = K.chain([[-112, 112], [-40, 150], [40, 150], [96, 120]], 11) + K.eyelet(-112, 112, 7, '#1e1e1e') + K.eyelet(96, 120, 7, '#c3142d');
    return {
      tpl: t,
      fabric: fab,
      palette: [[fab, 'Malla negra'], ['#c3142d', 'Jersey rojo'], [K.METAL, 'Cadena y broches']],
      front: { pattern: p, over: chainF },
      backMirror: true,
      back: { pattern: path(mesh, { stroke: '#6d6d6d', 'stroke-width': 0.8 }) },
      marks: [
        { at: [-80, 330], text: 'Malla negra abierta.' },
        { at: [70, 260], text: 'Panel en diagonal de jersey rojo.' },
        { at: [0, 152], text: 'Cadena metálica con broches que cruza el pecho.' },
        { at: [-80, 590], text: 'Ruedo asimétrico que baja en punta hacia un lado.' },
        { at: [0, -22], text: 'Cuello alto.' },
      ],
      fits: [
        { at: [118, 380], text: 'Ajustado al cuerpo.' },
        { at: [-104, 92], text: 'Sin mangas: los brazos quedan libres.' },
      ],
    };
  };

  /* ===================== JEANS, PANTALONES Y SHORT ===================== */

  const FLARE = { ko: 150, ki: 44, ho: 228, hi: 8 };
  const WIDE = { ko: 196, ki: 22, ho: 214, hi: 14 };
  const STRAIGHT = { ko: 166, ki: 40, ho: 160, hi: 44 };

  S['jean-flare-patchwork-leopardo'] = (k) => {
    const fab = '#6f8fbf';
    const j = HT.jeans({ ...FLARE, fabric: fab });
    const r = k.rnd;
    let p = '';
    p += patch(r, [[-176, 120], [-60, 104], [-48, 214], [-180, 230]], '#3f5f8f', { raw: true });
    p += patch(r, [[40, 214], [168, 200], [172, 300], [44, 318]], '#a9c1df', { raw: true });
    p += patch(r, [[-150, 470], [-40, 455], [-36, 560], [-160, 575]], '#8eaad3', { raw: true });
    p += patch(r, [[60, 600], [180, 590], [196, 690], [64, 700]], '#4f6fa0', { raw: true });
    const flameD = K.flame(-112, 760, 128, 1);
    const flameShape = flameD.match(/d="([^"]+)"/)[1];
    p += flameD + K.snakeScales(k.id, flameShape, -220, 330, 220, 440);
    p += K.butterfly(70, 450, 24, -14) + K.butterfly(118, 520, 22, 10) + K.butterfly(84, 650, 24, -6);
    const fur = both((s) => {
      const band = [[s * (j.inner(760) - 4), 758], [s * (j.outer(760) + 6), 758], [s * (j.a.ho + 6), 880], [s * (j.a.hi - 4), 880]];
      return path(poly(band, true), { fill: '#d9a35c', stroke: 'none' }) + K.leopard(Math.min(band[0][0], band[1][0], band[2][0], band[3][0]), 758, Math.abs(band[2][0] - band[3][0]) + 10, 122, r, { count: 42 }) + K.fringe([band[0], band[1]], 9, 2.6, { stroke: '#b07a3a' }, r, 1);
    });
    p += fur;
    const cargoPts = [[92, 300], [162, 296], [158, 410], [96, 414]];
    const cargo = path(poly(cargoPts, true), { fill: '#6b7344', 'stroke-width': 1.4 }) + clipTo(`${k.id}-cargo`, poly(cargoPts, true), K.camo(88, 292, 80, 126, r)) + path(poly(cargoPts, true), { 'stroke-width': 1.4 }) + path(poly([[88, 290], [166, 286], [166, 322], [90, 326]], true), { fill: '#5d6438', 'stroke-width': 1.4 }) + K.ring(127, 330, 6) + K.skull(127, 356, 12, { fill: '#e8e4da' });
    const chains = K.chain([[-70, 40], [-110, 92], [-160, 120]], 10) + K.chain([[-74, 44], [-130, 80], [-176, 100]], 10);
    const lace = laceUp(j, 1, 440, 700) + laceUp(j, -1, 440, 700);
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Denim medio'], ['#a9c1df', 'Denim claro'], ['#3f5f8f', 'Denim oscuro'], ['#d9a35c', 'Pelo leopardo'], ['#c3142d', 'Flama roja']],
      front: { pattern: p, details: cargo + lace, over: chains },
      back: { pattern: fur + patch(r, [[30, 330], [160, 320], [166, 430], [36, 440]], '#a9c1df', { raw: true }), details: laceUp(j, 1, 440, 700) + laceUp(j, -1, 440, 700) },
      marks: [
        { at: [-110, 560], text: 'Flama roja con textura de serpiente que sube por una pierna.' },
        { at: [126, 520], text: 'Tres mariposas bordadas en la otra pierna.' },
        { at: [127, 392], text: 'Bolsillo cargo camuflado con dije de calavera.' },
        { at: [j.outer(570) - 14, 570], text: 'Cordón cruzado con ojales en los costados.' },
        { at: [-120, 96], text: 'Cadenas en el bolsillo delantero.' },
        { at: [-150, 820], text: 'Bota de pelo sintético estampado leopardo.' },
        { at: [-115, 165], text: 'Parches de denim en varios lavados, con el borde deshilachado a propósito: el fleco crece con el uso.' },
      ],
      fits: [
        { at: [j.outer(400) + 2, 400], text: 'Ajustado arriba, hasta la rodilla.' },
        { at: [j.a.ho - 10, 846], text: 'Abre desde la rodilla; la bota cae sobre el zapato.' },
      ],
    };
  };

  S['jean-flare-dragon-acido'] = (k) => {
    const fab = '#aaae31';
    const j = HT.jeans({ ...FLARE, fabric: fab });
    const r = k.rnd;
    const panel = (s) => {
      const pts = [];
      for (let y = 120; y <= 860; y += 40) pts.push([s * (j.outer(y) - 4), y]);
      for (let y = 860; y >= 120; y -= 40) pts.push([s * (j.outer(y) - 46 - (y > 545 ? (y - 545) * 0.08 : 0)), y]);
      return pts;
    };
    const dragon = (s) => {
      const pts = [];
      for (let y = 190; y <= 800; y += 30) pts.push([s * (j.outer(y) - 26 + Math.sin(y / 46) * 10), y]);
      let d = path(K.smooth(pts), { stroke: '#2d3a1e', 'stroke-width': 7 });
      pts.forEach((p, i) => {
        if (i % 2) d += path(`M${P(p)} l${K.r1(s * 10)} -8 l${K.r1(-s * 4)} 12 z`, { fill: '#2d3a1e', 'stroke-width': 0.8 });
      });
      d += path(`M${P(pts[0])} l${K.r1(-s * 14)} -14 l${K.r1(s * 24)} -6 l${K.r1(s * 6)} 18 z`, { fill: '#2d3a1e', 'stroke-width': 1 }) + circle(pts[0][0] + s * 2, pts[0][1] - 12, 2.4, { fill: '#dff04a', stroke: 'none' });
      return d;
    };
    let p = both((s) => path(poly(panel(s), true), { fill: '#7d8122', stroke: INK, 'stroke-width': 1.3 }) + dragon(s));
    const rip = (x, y, w, h) => K.rip(k.id + x + y, x, y, w, h, r, { fill: '#3c4a6a', threadColor: '#f2f0e6', zig: true, zigColor: '#2d3a1e' });
    p += rip(-80, 330, 60, 30) + rip(70, 420, 54, 26) + rip(-96, 520, 46, 22) + rip(90, 600, 50, 24) + rip(-60, 700, 40, 20);
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Sobreteñido ácido'], ['#7d8122', 'Paneles laterales'], ['#2d3a1e', 'Dragones'], ['#3c4a6a', 'Denim de base']],
      front: { pattern: p },
      back: { pattern: both((s) => path(poly(panel(s), true), { fill: '#7d8122', stroke: INK, 'stroke-width': 1.3 }) + dragon(s)) + rip(-70, 420, 50, 24) },
      marks: [
        { at: [-(j.outer(400) - 26), 400], text: 'Dragones pintados en los paneles laterales.' },
        { at: [-80, 330], text: 'Rotos reforzados con costura en zigzag: el destroyed aguanta el uso diario.' },
        { at: [70, 420], text: 'Hilos sueltos: son parte del diseño.' },
        { at: [-40, 160], text: 'Denim oscuro sobreteñido en amarillo ácido; con el tiempo el amarillo se suaviza.' },
      ],
      fits: [
        { at: [j.outer(400) + 2, 400], text: 'Flare: ajustado arriba y abierto desde la rodilla.' },
        { at: [-j.outer(260) - 4, 260], text: 'Al sentarte se siente como un jean normal.' },
      ],
    };
  };

  S['jean-flare-destroyed-verde'] = (k) => {
    const fab = '#3f5a2e';
    const seam = '#e9e3d6';
    const j = HT.jeans({ ...FLARE, fabric: fab, seam, rawHem: true });
    const r = k.rnd;
    const big = (x, y, w, h) => {
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const kk = 1 + (r() - 0.5) * 0.45;
        pts.push([x + Math.cos(a) * (w / 2) * kk, y + Math.sin(a) * (h / 2) * kk]);
      }
      const ring = pts.concat([pts[0]]);
      return path(K.smooth(pts, true), { fill: '#a8c98a', stroke: INK, 'stroke-width': 1.3 }) + K.zigzag(ring, 3, 4.5, { stroke: '#e9e3d6' }) + K.fringe(ring, 6, 3.4, { stroke: '#d6e6c4' }, r, -1);
    };
    const p = big(-90, 330, 90, 120) + big(80, 470, 80, 130) + big(-110, 640, 70, 90) + big(110, 300, 50, 60) + big(60, 720, 60, 70);
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Verde sobreteñido'], ['#a8c98a', 'Relleno verde claro']],
      front: { pattern: p, over: hemFringe(j, r, '#7f9a6a') },
      back: { pattern: big(-70, 420, 70, 90) + big(90, 600, 60, 80), over: hemFringe(j, r, '#7f9a6a') },
      marks: [
        { at: [-90, 330], text: 'Rotos grandes rellenos de tela verde clara.' },
        { at: [80, 400], text: 'Bordes deshilachados cosidos en zigzag para que el destroyed quede firme.' },
        { at: [-150, 872], text: 'Ruedo deshilachado.' },
        { at: [40, 160], text: 'Denim verde oscuro sobreteñido: puede soltar color al principio.' },
      ],
      fits: [
        { at: [j.outer(400) + 2, 400], text: 'Flare: ajustado arriba.' },
        { at: [j.a.ho - 10, 846], text: 'Bota amplia que cae sobre el zapato. Al sentarte se siente como un jean normal.' },
      ],
    };
  };

  S['jean-musgo'] = (k) => {
    const fab = '#c3d1a5';
    const j = HT.jeans({ ...FLARE, fabric: fab, rawHem: true });
    const r = k.rnd;
    let p = '';
    const spots = [[-90, 150, 30], [-60, 330, 40], [-110, 470, 34], [-140, 640, 46], [-60, 780, 40], [80, 200, 36], [110, 380, 42], [60, 520, 30], [140, 700, 50], [90, 820, 34], [-20, 260, 22], [30, 90, 24]];
    spots.forEach(([x, y, rr]) => (p += K.moss(x, y, rr, r)));
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Verde pálido'], ['#4f7a3a', 'Musgo'], ['#6f9a4a', 'Musgo claro']],
      front: { pattern: p, over: hemFringe(j, r, '#93a07a') },
      back: { pattern: K.moss(-80, 400, 40, K.rng(2)) + K.moss(90, 600, 44, K.rng(3)) + K.moss(-120, 760, 36, K.rng(4)), over: hemFringe(j, r, '#93a07a') },
      marks: [
        { at: [-60, 330], text: 'Aplicaciones de fibra verde que imitan musgo creciendo sobre la tela.' },
        { at: [-150, 872], text: 'Bota deshilachada.' },
        { at: [40, 150], text: 'Denim teñido en verde pálido.' },
      ],
      fits: [
        { at: [j.outer(400) + 2, 400], text: 'Flare: ajustado arriba.' },
        { at: [j.a.ho - 10, 846], text: 'Abierto desde la rodilla.' },
      ],
    };
  };

  S['jean-flare-costura-neon'] = (k) => {
    const fab = '#2f4a2e';
    const seam = '#e9e3d6';
    const neon = '#62f07c';
    const j = HT.jeans({ ...FLARE, fabric: fab, seam });
    const r = k.rnd;
    let p = both((s) => {
      const pts = [];
      for (let y = 300; y <= 870; y += 30) pts.push([s * j.inner(y), y]);
      for (let y = 870; y >= 300; y -= 30) pts.push([s * (j.inner(y) + (j.outer(y) - j.inner(y)) * 0.32), y]);
      return path(poly(pts, true), { fill: '#1f331f', stroke: INK, 'stroke-width': 1.2 });
    });
    const xs = both((s) => {
      let d = '';
      for (const [y0, y1] of [[240, 420], [480, 660], [700, 840]]) {
        const a = [s * j.inner(y0) + s * 14, y0];
        const b = [s * j.outer(y1) - s * 18, y1];
        const c = [s * j.outer(y0) - s * 18, y0];
        const e = [s * j.inner(y1) + s * 14, y1];
        d += K.zigzag([a, b], 4, 6, { stroke: neon, 'stroke-width': 2 }) + K.zigzag([c, e], 4, 6, { stroke: neon, 'stroke-width': 2 });
      }
      return d;
    });
    p += xs;
    const cargo = both((s) => {
      const pts = [[s * 120, 300], [s * 196, 296], [s * 200, 400], [s * 124, 404]];
      return path(poly(pts, true), { fill: '#3a5a38', stroke: INK, 'stroke-width': 1.4 }) + K.fringe([pts[0], pts[1]], 6, 3.4, { stroke: '#a8c4a2' }, r, -s) + path(`M${P([s * 128, 388])} L${P([s * 196, 384])} M${P([s * 128, 394])} L${P([s * 196, 390])}`, { stroke: neon, 'stroke-width': 1.6 });
    });
    const straps = both((s) => [620, 690].map((y) => path(poly([[s * (j.inner(y) - 4), y], [s * (j.outer(y) + 4), y], [s * (j.outer(y + 22) + 4), y + 22], [s * (j.inner(y + 22) - 4), y + 22]], true), { fill: '#141414', stroke: INK, 'stroke-width': 1.2 }) + [0.25, 0.5, 0.75].map((t) => K.eyelet(s * (j.inner(y + 11) + (j.outer(y + 11) - j.inner(y + 11)) * t), y + 11, 5, '#141414')).join('')).join(''));
    const hemNeon = both((s) => path(`M${P([s * (j.a.hi + 6), 836])} L${P([s * (j.a.ho - 6), 836])} M${P([s * (j.a.hi + 6), 843])} L${P([s * (j.a.ho - 6), 843])}`, { stroke: neon, 'stroke-width': 1.8 }));
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Denim verde oscuro'], ['#1f331f', 'Paneles interiores'], [neon, 'Costura neón'], ['#141414', 'Correas negras']],
      front: { pattern: p + hemNeon, details: cargo + straps },
      back: { pattern: both((s) => K.zigzag([[s * 30, 420], [s * 160, 600]], 4, 6, { stroke: neon, 'stroke-width': 2 }) + K.zigzag([[s * 160, 420], [s * 30, 600]], 4, 6, { stroke: neon, 'stroke-width': 2 })) + hemNeon, details: straps },
      marks: [
        { at: [-95, 330], text: 'Costuras en zigzag verde neón que dibujan equis sobre las piernas.' },
        { at: [-(j.inner(560) + 18), 560], text: 'Paneles de denim más oscuro por dentro de las piernas.' },
        { at: [160, 350], text: 'Bolsillos cargo con borde crudo.' },
        { at: [-(j.outer(631) - 24), 631], text: 'Correas negras con ojales metálicos sobre las espinillas.' },
        { at: [150, 840], text: 'Bordado de rayas neón en bolsillos y botas.' },
      ],
      fits: [
        { at: [j.outer(400) + 2, 400], text: 'Flare: ajustado arriba.' },
        { at: [-j.a.ho + 10, 846], text: 'Abierto desde la rodilla, con la bota sobre el zapato.' },
      ],
    };
  };

  S['jean-wide-patchwork-indigo'] = (k) => {
    const fab = '#3f5f9f';
    const j = HT.jeans({ ...WIDE, fabric: fab });
    const r = k.rnd;
    const tones = ['#2f4f8f', '#4f6fb0', '#7f9fd0', '#26365c', '#3a3a3a', '#8c8c8c', '#5b7cc0'];
    let p = '';
    for (let i = -14; i < 14; i++) {
      const y0 = i * 70;
      const pts = [[-320, y0 + 140], [320, y0 - 140], [320, y0 - 70], [-320, y0 + 210]];
      p += path(poly(pts, true), { fill: tones[(i + 14) % tones.length], stroke: INK, 'stroke-width': 1 }) + K.fringe([pts[3], pts[2]], 5, 4, { stroke: '#d8e2f2' }, r, 1) + stitch(poly([[-320, y0 + 150], [320, y0 - 130]]), '#d8e2f2', 0.8);
    }
    for (let i = 0; i < 9; i++) p += K.spray(-180 + r() * 360, 120 + r() * 700, 22 + r() * 18, r, '#e4ebf6', 60);
    return {
      tpl: j,
      fabric: fab,
      palette: [['#2f4f8f', 'Índigo'], ['#7f9fd0', 'Índigo claro'], ['#3a3a3a', 'Negro'], ['#8c8c8c', 'Gris'], ['#e4ebf6', 'Cloro']],
      front: { pattern: p },
      back: { pattern: p },
      marks: [
        { at: [-120, 420], text: 'Tiras de denim índigo en lavados distintos, cosidas en diagonal.' },
        { at: [100, 560], text: 'Efecto de cloro y paneles en negro y gris.' },
        { at: [-150, 700], text: 'Borde crudo a propósito: el deshilachado arma la textura y cambia con cada uso.' },
        { at: [30, 200], text: 'Bragueta con cremallera metálica.' },
      ],
      fits: [
        { at: [j.outer(500) + 2, 500], text: 'Wide: pierna amplia que no aprieta al sentarte ni al caminar.' },
        { at: [-j.a.W - 4, 17], text: 'Si prefieres el tiro más arriba, úsalo con cinturón.' },
      ],
    };
  };

  S['jean-wide-fleco-indigo'] = (k) => {
    const fab = '#33528f';
    const j = HT.jeans({ ...WIDE, ko: 204, ho: 226, hi: 10, fabric: fab, rawHem: true });
    const r = k.rnd;
    const tones = ['#1f3a73', '#33528f', '#4d6cad', '#6b88c4', '#2a4680'];
    let p = '';
    for (let i = -16; i < 18; i++) {
      const y0 = i * 46;
      const pts = [[-340, y0 + 120], [340, y0 - 40], [340, y0 + 2], [-340, y0 + 162]];
      p += path(poly(pts, true), { fill: tones[(i + 16) % tones.length], stroke: INK, 'stroke-width': 0.9 }) + K.fringe([pts[3], pts[2]], 9, 3, { stroke: '#cfdaf0' }, r, 1);
    }
    return {
      tpl: j,
      fabric: fab,
      palette: [['#1f3a73', 'Índigo profundo'], ['#4d6cad', 'Índigo medio'], ['#6b88c4', 'Índigo claro']],
      front: { pattern: p, over: hemFringe(j, r, '#8fa6d4', 14) },
      back: { pattern: p, over: hemFringe(j, r, '#8fa6d4', 14) },
      marks: [
        { at: [-110, 420], text: 'Franjas de índigo con el borde crudo de arriba abajo: el fleco es la textura.' },
        { at: [110, 300], text: 'Paneles cosidos en diagonal.' },
        { at: [-160, 876], text: 'El fleco se suelta un poco con cada lavada: así envejece esta pieza.' },
      ],
      fits: [
        { at: [j.outer(600) + 2, 600], text: 'Pierna muy amplia que cae sobre el zapato.' },
        { at: [-j.a.W - 4, 17], text: 'Con cinturón queda más arriba en la cadera.' },
      ],
    };
  };

  S['jean-wide-ojales-ceniza'] = (k) => {
    const fab = '#9b9a96';
    const j = HT.jeans({ ...WIDE, fabric: fab, rawHem: true });
    const r = k.rnd;
    let p = both((s) => {
      let d = '';
      for (let i = 0; i < 6; i++) {
        const y = 250 + i * 95;
        const a = [s * (j.inner(y) + 6), y + 30];
        const c = [s * ((j.inner(y) + j.outer(y)) / 2), y - 14];
        const b = [s * (j.outer(y) - 6), y + 30];
        const d1 = `M${P(a)} Q${P(c)} ${P(b)} L${P([b[0], b[1] + 24])} Q${P([c[0], c[1] + 24])} ${P([a[0], a[1] + 24])} Z`;
        d += path(d1, { fill: '#1d1d1d', stroke: INK, 'stroke-width': 1 }) + K.fringe([a, c, b], 5, 3.4, { stroke: '#d0cfca' }, r, -s);
      }
      return d;
    });
    let ey = '';
    for (let x = -130; x <= 130; x += 37) ey += K.eyelet(x, 17, 5, '#9b9a96');
    for (let y = 70; y <= 270; y += 40) ey += K.eyelet(-22, y, 4.5, '#9b9a96');
    ey += both((s) => [0.15, 0.35, 0.55, 0.75, 0.92].map((t) => K.eyelet(s * (j.a.hi + (j.a.ho - j.a.hi) * t), 828, 5, '#9b9a96')).join(''));
    const label = rect(46, 6, 58, 22, { fill: '#f2f2f2', 'stroke-width': 1 }) + K.letters(75, 22, 11, 'SXYSU', { anchor: 'middle', family: 'Space Mono' });
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Gris lavado'], ['#1d1d1d', 'Paneles negros'], [K.METAL, 'Ojales metálicos']],
      front: { pattern: p, details: ey + label, over: hemFringe(j, r, '#bcbab4') },
      back: { pattern: p, over: hemFringe(j, r, '#bcbab4') },
      marks: [
        { at: [-(j.inner(345) + j.outer(345)) / 2, 340], text: 'Paneles negros curvos, como costillas, cosidos con el borde crudo.' },
        { at: [-93, 17], text: 'Ojales metálicos en la pretina.' },
        { at: [-22, 190], text: 'Ojales en el tiro.' },
        { at: [-(j.a.hi + (j.a.ho - j.a.hi) * 0.55), 828], text: 'Ojales en la bota.' },
        { at: [75, 17], text: 'Etiqueta SXYSU en la pretina.' },
      ],
      fits: [{ at: [j.outer(600) + 2, 600], text: 'Wide con bota amplia: cómodo para sentarte y caminar.' }],
    };
  };

  S['jean-pintado-fucsia'] = (k) => {
    const fab = '#e0218a';
    const j = HT.jeans({ ko: 190, ki: 26, ho: 204, hi: 16, fabric: fab });
    const r = k.rnd;
    let p = '';
    p += K.cross(-120, 170, 14) + K.cross(80, 260, 12, { fill: '#ffffff' }) + K.cross(-60, 640, 12, { fill: '#ffffff' }) + K.cross(140, 720, 14);
    p += K.star(110, 160, 18, { fill: '#ffffff' }) + K.star(-150, 420, 16) + K.star(60, 780, 18, { fill: '#ffffff' }) + K.star(-100, 760, 14);
    p += K.skull(-90, 300, 20, { bow: '#ffffff' }) + K.skull(120, 500, 18, { bow: INK, fill: '#ffffff' });
    p += K.checkerHeart(k.id, 40, 420, 22) + K.checkerHeart(k.id, -140, 560, 20);
    p += K.scribble(-170, 230, 90, r, { color: '#ffffff', w: 2.2, h: 8 }) + K.scribble(30, 600, 110, r, { w: 2.2, h: 8 }) + K.scribble(-60, 860, 90, r, { color: '#ffffff', w: 2, h: 6 });
    const xPatch = (cx, cy, s) => {
      const arm = (a) => {
        const rad = (a * Math.PI) / 180;
        const dx = Math.cos(rad) * s;
        const dy = Math.sin(rad) * s;
        const nx = -Math.sin(rad) * 9;
        const ny = Math.cos(rad) * 9;
        return [[cx - dx + nx, cy - dy + ny], [cx + dx + nx, cy + dy + ny], [cx + dx - nx, cy + dy - ny], [cx - dx - nx, cy - dy - ny]];
      };
      return patch(r, arm(45), '#5f7fbf', { raw: true }) + patch(r, arm(-45), '#5f7fbf', { raw: true });
    };
    p += xPatch(-60, 470, 40) + xPatch(110, 360, 34);
    const knees = K.rip(k.id + 'k1', -110, 550, 64, 30, r, { fill: '#f4efe4', threadColor: '#ffffff' }) + K.rip(k.id + 'k2', 110, 560, 60, 28, r, { fill: '#f4efe4', threadColor: '#ffffff' });
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Fucsia'], ['#0d0c0b', 'Pintura negra'], ['#ffffff', 'Pintura blanca'], ['#5f7fbf', 'Parches de denim']],
      front: { pattern: p + knees },
      back: { pattern: K.star(-80, 300, 20, { fill: '#ffffff' }) + K.cross(90, 420, 14) + K.skull(-60, 620, 18, { bow: '#ffffff' }) + K.scribble(20, 700, 100, K.rng(8), { color: '#ffffff', w: 2, h: 7 }) },
      marks: [
        { at: [-90, 300], text: 'Pintado a mano: cruces, estrellas, calaveras con moño y corazones a cuadros.' },
        { at: [-60, 470], text: 'Parches de denim en X.' },
        { at: [110, 560], text: 'Rotos en las rodillas.' },
        { at: [30, 600], text: 'Trazos en blanco y negro.' },
      ],
      fits: [{ at: [j.outer(500) + 2, 500], text: 'Wide: holgado de la cadera a la bota.' }],
    };
  };

  S['jean-patchwork-estrellas-violeta'] = (k) => {
    const fab = '#8f6fd6';
    const j = HT.jeans({ ...WIDE, fabric: fab });
    const r = k.rnd;
    let p = path(`M-200 -10 L200 -10 L200 118 Q0 136 -200 118 Z`, { fill: '#1b1b1b', stroke: 'none' }) + path('M-200 118 Q0 136 200 118', { stroke: INK, 'stroke-width': 1.6 }) + stitch('M-200 112 Q0 130 200 112', '#e9e3d6', 0.9);
    for (let i = 0; i < 10; i++) p += K.spray(-180 + r() * 360, 180 + r() * 660, 16 + r() * 20, r, '#efe8ff', 50);
    const zp = (pts) => patch(r, pts, '#1b1b1b', { stitchColor: '#e9e3d6', inner: K.zipper((pts[0][0] + pts[1][0]) / 2, Math.min(pts[0][1], pts[1][1]) + 8, Math.max(pts[2][1], pts[3][1]) - 8, { slider: true }) });
    p += zp([[-170, 300], [-80, 296], [-78, 420], [-172, 424]]) + zp([[60, 520], [160, 516], [164, 640], [62, 644]]);
    p += K.spiralStar(90, 240, 34, 4) + K.spiralStar(-110, 560, 30, -6) + K.spiralStar(-40, 780, 26, 8) + K.spiralStar(150, 760, 28, 0);
    p += K.scribble(-150, 680, 110, r, { color: '#ffffff', w: 2, h: 7 }) + K.scribble(30, 400, 90, r, { color: '#ffffff', w: 2, h: 6 });
    const chains = K.chain([[-150, 140], [-90, 200], [-20, 190]], 10) + K.chain([[60, 150], [130, 220], [180, 180]], 10);
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Violeta con cloro'], ['#1b1b1b', 'Pretina y parches negros'], ['#ffffff', 'Trazos blancos'], [K.METAL, 'Cadenas']],
      front: { pattern: p, over: chains },
      back: { pattern: path(`M-200 -10 L200 -10 L200 118 Q0 136 -200 118 Z`, { fill: '#1b1b1b', stroke: 'none' }) + K.spiralStar(-80, 420, 32, 0) + K.spiralStar(100, 650, 28, 10) },
      marks: [
        { at: [0, 80], text: 'Dos jeans en uno: la pretina negra arriba y, debajo, un jean violeta con salpicaduras de cloro.' },
        { at: [-125, 360], text: 'Parches negros con cremalleras.' },
        { at: [90, 240], text: 'Estrellas en espiral blanco y negro.' },
        { at: [-90, 200], text: 'Cadenas cosidas encima.' },
        { at: [-100, 680], text: 'Trazos dibujados en blanco.' },
      ],
      fits: [
        { at: [j.outer(500) + 2, 500], text: 'Wide: pierna amplia que no aprieta al sentarte.' },
        { at: [-j.a.W - 4, 60], text: 'La pretina negra marca la cintura.' },
      ],
    };
  };

  S['jean-patchwork-cuadros'] = (k) => {
    const fab = '#a7bfdc';
    const j = HT.jeans({ ...STRAIGHT, fabric: fab, fly: false });
    const r = k.rnd;
    const plaids = [
      ['#b03030', [['#6a1414', 18, 5, 0.8], ['#f0d0a0', 18, 1.4, 0.8]]],
      ['#d6a43a', [['#7a5a10', 16, 4, 0.7], ['#ffffff', 16, 1.2, 0.7]]],
      ['#4e7a4a', [['#22401e', 18, 5, 0.8], ['#e8d27a', 18, 1.3, 0.8]]],
      ['#3b5a9a', [['#162a55', 16, 4, 0.8], ['#d8e2f2', 16, 1.2, 0.8]]],
    ];
    let p = '';
    const shapes = [
      [[-170, 110], [-50, 100], [-46, 220], [-176, 230]],
      [[30, 210], [160, 196], [166, 330], [36, 340]],
      [[-160, 380], [-50, 370], [-46, 500], [-164, 510]],
      [[50, 560], [160, 550], [164, 680], [54, 690]],
      [[-150, 700], [-60, 696], [-56, 800], [-152, 806]],
      [[70, 90], [140, 86], [144, 160], [74, 164]],
    ];
    shapes.forEach((pts, i) => {
      const [base, lines] = plaids[i % plaids.length];
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      const inner = clipTo(`${k.id}-pl${i}`, poly(pts, true), K.plaid(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), base, lines));
      p += patch(r, pts, base, { raw: true, inner, fringe: '#f4ead8' });
    });
    const cowboy =
      path('M70 470 q30 -24 70 -10 q14 4 22 -8 l8 6 q-6 14 -20 18 l-4 34 l-8 0 l0 -28 q-30 6 -54 0 l-6 30 l-8 0 l2 -34 q-10 -4 -2 -8 z', { fill: '#5a3a1e', 'stroke-width': 1.1 }) +
      path('M104 452 l-6 -24 q8 -10 18 0 l-4 24 z', { fill: '#5a3a1e', 'stroke-width': 1 }) +
      path('M92 428 l36 0 l-4 -6 l-8 0 l-2 -10 l-8 0 l-2 10 l-8 0 z', { fill: '#5a3a1e', 'stroke-width': 1 });
    const fly = [70, 120, 170, 220].map((y) => K.button(-14, y, 5.5)).join('') + stitch(`M24 ${j.a.WB + 2} L24 ${j.a.R - 30}`, INK);
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Denim claro'], ['#b03030', 'Franela roja'], ['#d6a43a', 'Mostaza'], ['#4e7a4a', 'Verde'], ['#3b5a9a', 'Azul']],
      front: { pattern: p + cowboy, details: fly },
      back: { pattern: patch(r, [[-160, 330], [-40, 320], [-36, 460], [-164, 468]], '#b03030', { raw: true, inner: clipTo(`${k.id}-plb`, poly([[-160, 330], [-40, 320], [-36, 460], [-164, 468]], true), K.plaid(-164, 320, 128, 148, '#b03030', plaids[0][1])) }) },
      marks: [
        { at: [-110, 165], text: 'Parches de franela a cuadros en rojo, mostaza, verde y azul.' },
        { at: [-50, 440], text: 'Borde crudo a propósito: los parches se deshilachan un poco con el uso.' },
        { at: [118, 470], text: 'Vaquero a caballo estampado en una pierna.' },
        { at: [-14, 145], text: 'Bragueta de botones.' },
      ],
      fits: [
        { at: [j.outer(500) + 2, 500], text: 'Corte recto: ni ajustado ni ancho.' },
        { at: [-j.outer(260) - 4, 260], text: 'Cómodo para sentarte y moverte todo el día.' },
      ],
    };
  };

  S['pantalon-hojas-carbon'] = (k) => {
    const fab = '#2b2b2b';
    const seam = '#e9e3d6';
    const j = HT.jeans({ ko: 202, ki: 24, ho: 186, hi: 34, pointHem: true, fabric: fab, seam, rawHem: true });
    const r = k.rnd;
    let p = '';
    for (let y = 110; y < 960; y += 30)
      for (let x = -230; x < 230; x += 34) {
        const lx = x + (r() - 0.5) * 16 + ((y / 30) % 2) * 17;
        p += K.leaf(lx, y + (r() - 0.5) * 10, 34 + r() * 16, 70 + (r() - 0.5) * 60, r() < 0.5 ? '#3d3d3d' : '#4a4a4a', r);
      }
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Negro'], ['#3d3d3d', 'Hojas carbón'], ['#4a4a4a', 'Hojas grafito']],
      front: { pattern: p },
      back: { pattern: p },
      marks: [
        { at: [-110, 400], text: 'Hojas de tela arrugada cosidas por capas, de la cadera a la bota.' },
        { at: [110, 600], text: 'Las hojas se mueven al caminar.' },
        { at: [-118, 910], text: 'Bota que cae en punta.' },
      ],
      fits: [{ at: [j.outer(500) + 2, 500], text: 'Baggy: amplio en todo el largo.' }],
    };
  };

  S['pantalon-hibrido-carmin'] = (k) => {
    const fab = '#4b3527';
    const seam = '#e9e3d6';
    const j = HT.jeans({ ko: 204, ki: 18, ho: 214, hi: 12, waist: 'drawstring', fly: false, coin: false, fabric: fab, seam });
    const r = k.rnd;
    const open = both((s) => {
      const x = s * 110;
      const pts = [];
      for (let y = 280; y <= 820; y += 30) pts.push([x + s * Math.sin(y / 40) * 18 + s * 24, y]);
      for (let y = 820; y >= 280; y -= 30) pts.push([x - s * Math.sin(y / 40 + 1) * 18 - s * 24, y]);
      let d = path(K.smooth(pts, true), { fill: '#c3142d', stroke: INK, 'stroke-width': 1.4 });
      for (let off = -10; off <= 10; off += 10) d += path(K.smooth(pts.slice(0, pts.length / 2).map((q) => [q[0] - s * (24 - off), q[1]])), { stroke: '#ffffff', 'stroke-width': 2 });
      d += K.zipper(x - s * 34, 280, 820, { slider: false, tape: '#2a2a2a' }) + K.zipper(x + s * 34, 280, 820, { sliderY: 300, tape: '#2a2a2a' });
      return d;
    });
    const cords = K.drawstring(-14, 22, 90, -1) + K.drawstring(14, 22, 100, 1) + K.eyelet(-14, 20, 4) + K.eyelet(14, 20, 4);
    return {
      tpl: j,
      fabric: fab,
      palette: [[fab, 'Denim café oscuro'], ['#c3142d', 'Tela deportiva roja'], ['#ffffff', 'Franjas blancas']],
      front: { pattern: open, over: cords },
      back: { pattern: open },
      marks: [
        { at: [-(110 + 34), 520], text: 'Cremalleras que abren el denim.' },
        { at: [110, 560], text: 'De cada corte sale un panel ondulado de tela deportiva roja con franjas blancas.' },
        { at: [14, 72], text: 'Pretina con cordón.' },
        { at: [-170, 200], text: 'Denim lavado en café oscuro.' },
      ],
      fits: [
        { at: [j.outer(500) + 2, 500], text: 'Pierna muy amplia.' },
        { at: [-j.a.W - 4, 17], text: 'Se ajusta a la cintura con el cordón y no aprieta al sentarte.' },
      ],
    };
  };

  S['short-camuflado-leopardo-rosa'] = (k) => {
    const fab = '#6b7344';
    const j = HT.jeans({ short: true, H: 182, R: 290, hemY: 520, ho: 200, hi: 22, WB: 34, waist: 'drawstring', fly: false, coin: false, fabric: '#9a9a9a', backPockets: true });
    const r = k.rnd;
    const print = (sfx, rr) =>
      path(`M-260 60 L260 60 L260 560 L-260 560 Z`, { fill: fab, stroke: 'none' }) +
      K.camo(-260, 60, 520, 500, rr) +
      clipTo(`${k.id}-leo-${sfx}`, poly([[10, 60], [260, 60], [260, 560], [30, 560]], true), path('M10 60 L260 60 L260 560 L30 560 Z', { fill: '#d9a35c', stroke: 'none' }) + K.leopard(10, 60, 250, 500, rr, { count: 120 })) +
      path('M-200 60 L200 60 L200 72 L-200 72 Z', { fill: '#e0218a', stroke: 'none' });
    const p = print('f', r);
    const pink = path(`M${P([-148, 34])} L${P([148, 34])} L${P([150, 70])} L${P([-150, 70])} Z`, { fill: '#e0218a', 'stroke-width': 1.4 }) + [-120, -80, -40, 40, 80, 120].map((x) => K.stud(x, 52, 4)).join('');
    const letters = K.letters(-150, 250, 30, 'EZTACLY', { fill: '#ff8ac0', stroke: INK, sw: 1, rot: -78 });
    const patchP = patch(r, [[60, 380], [150, 374], [154, 450], [64, 456]], '#ff6fb0', { stitchColor: '#ffffff' }) + K.star(107, 415, 16, { fill: '#ffffff' });
    const exposed = both((s) => stitch(poly([[s * 150, 70], [s * 190, 300], [s * 198, 510]]), '#d0d0d0', 1.4));
    const cords = K.drawstring(-14, 22, 70, -1) + K.drawstring(14, 22, 80, 1) + K.eyelet(-14, 20, 4) + K.eyelet(14, 20, 4);
    return {
      tpl: j,
      fabric: '#9a9a9a',
      palette: [[fab, 'Camuflado'], ['#d9a35c', 'Leopardo'], ['#e0218a', 'Pretina rosada'], ['#9a9a9a', 'Pretina gris']],
      front: { pattern: p, parts: pink, details: letters + patchP + exposed, over: cords },
      back: { pattern: print('b', K.rng(31)), parts: pink, details: exposed },
      marks: [
        { at: [-100, 52], text: 'Doble pretina: una gris con cordón y otra rosada con taches.' },
        { at: [-80, 400], text: 'Camuflado y leopardo en una sola bermuda.' },
        { at: [-112, 292], text: 'Letras rosadas aplicadas con la palabra EZTACLY.' },
        { at: [107, 450], text: 'Parche rosado estampado en una pierna.' },
        { at: [190, 300], text: 'Costuras expuestas en gris, a propósito.' },
      ],
      fits: [
        { at: [j.outer(400) + 2, 400], text: 'Bermuda amplia, fresca para clima cálido.' },
        { at: [0, 100], text: 'La pretina de cordón se ajusta a la cintura y no aprieta al sentarte.' },
      ],
    };
  };

  window.SPECS = S;
})();
