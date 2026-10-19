// Arma la hoja A3 de cada prenda: boceto plano (frente y espalda), llamadas, leyenda, colores y la ficha.
(function () {
  const K = window.HK;
  const { tag, g, esc, r1, INK, MUTED } = K;
  const WPAGE = 1680;
  const HPAGE = 1188;
  const LINE = '#cfc8ba';
  const PAPER = '#ffffff';

  /* ---------- medir y partir texto ---------- */
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  function measure(str, font) {
    ctx.font = font;
    return ctx.measureText(str).width;
  }
  function wrap(str, font, max) {
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (measure(test, font) > max && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  const F = {
    display: (s) => `${s}px Anton`,
    body: (s, wgt = 400) => `${wgt} ${s}px "Space Grotesk"`,
    mono: (s, wgt = 400) => `${wgt} ${s}px "Space Mono"`,
  };
  function textEl(x, y, str, o = {}) {
    return tag(
      'text',
      {
        x: r1(x),
        y: r1(y),
        'font-family': o.family || 'Space Grotesk',
        'font-size': o.size || 14,
        'font-weight': o.weight,
        'letter-spacing': o.ls,
        'text-anchor': o.anchor,
        fill: o.fill || INK,
      },
      esc(str)
    );
  }
  function linesEl(x, y, lines, o = {}) {
    const lh = o.lh || 19;
    const spans = lines.map((l, i) => tag('tspan', { x: r1(x), y: r1(y + i * lh) }, esc(l))).join('');
    return tag('text', { 'font-family': o.family || 'Space Grotesk', 'font-size': o.size || 14, 'font-weight': o.weight, fill: o.fill || INK, 'letter-spacing': o.ls }, spans);
  }
  const money = (n) => '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const onColor = (hex) => (K.lum(hex) < 140 ? '#ffffff' : INK);

  /* ---------- íconos de cuidado ---------- */
  function careIcon(kind, x, y) {
    const s = 34;
    const p = (d, o = {}) => K.path(d, { 'stroke-width': 1.8, ...o });
    const tub = `M${r1(x + 2)} ${r1(y + 12)} L${r1(x + 6)} ${r1(y + s - 4)} L${r1(x + s - 6)} ${r1(y + s - 4)} L${r1(x + s - 2)} ${r1(y + 12)}`;
    const wave = `M${r1(x + 2)} ${r1(y + 12)} q4 -5 7.5 0 q4 5 7.5 0 q4 -5 7.5 0 q4 5 7.5 0`;
    const square = K.rect(x + 3, y + 3, s - 6, s - 6, { 'stroke-width': 1.8 });
    switch (kind) {
      case 'hand':
        return p(tub) + p(wave) + p(`M${r1(x + 11)} ${r1(y + 26)} q1 -9 4 -9 l0 6 m0 -6 q2 -3 4 0 l0 6 m0 -6 q2 -3 4 0 l0 7 q1 -4 3 -2 q0 7 -6 9 l-6 0 q-3 -2 -3 -6`, { 'stroke-width': 1.3 });
      case 'cold':
        return p(tub) + p(wave) + textEl(x + s / 2, y + 27, '30', { family: 'Space Mono', size: 10, weight: 700, anchor: 'middle' });
      case 'nodryer':
        return square + K.circle(x + s / 2, y + s / 2, 9, { 'stroke-width': 1.8 }) + p(`M${r1(x + 1)} ${r1(y + 1)} L${r1(x + s - 1)} ${r1(y + s - 1)} M${r1(x + s - 1)} ${r1(y + 1)} L${r1(x + 1)} ${r1(y + s - 1)}`);
      case 'noiron':
        return p(`M${r1(x + 4)} ${r1(y + 26)} L${r1(x + 30)} ${r1(y + 26)} L${r1(x + 28)} ${r1(y + 14)} Q${r1(x + 27)} ${r1(y + 10)} ${r1(x + 20)} ${r1(y + 10)} L${r1(x + 12)} ${r1(y + 10)} Q${r1(x + 6)} ${r1(y + 12)} ${r1(x + 4)} ${r1(y + 26)} Z`) + p(`M${r1(x + 12)} ${r1(y + 10)} Q${r1(x + 12)} ${r1(y + 5)} ${r1(x + 20)} ${r1(y + 5)}`) + p(`M${r1(x + 2)} ${r1(y + 4)} L${r1(x + 32)} ${r1(y + 31)} M${r1(x + 32)} ${r1(y + 4)} L${r1(x + 2)} ${r1(y + 31)}`);
      case 'flat':
        return square + p(`M${r1(x + 9)} ${r1(y + s / 2)} L${r1(x + s - 9)} ${r1(y + s / 2)}`);
      case 'line':
        return square + p(`M${r1(x + s / 2)} ${r1(y + 9)} L${r1(x + s / 2)} ${r1(y + s - 9)}`);
      case 'shade':
        return square + p(`M${r1(x + 3)} ${r1(y + 13)} L${r1(x + 13)} ${r1(y + 3)} M${r1(x + 3)} ${r1(y + 20)} L${r1(x + 20)} ${r1(y + 3)}`);
      default:
        return '';
    }
  }
  function careKinds(t) {
    const s = t.toLowerCase();
    const out = [];
    if (s.includes('a mano')) out.push(['hand', 'A MANO']);
    else if (s.includes('fría') || s.includes('frio') || s.includes('frío')) out.push(['cold', 'AGUA FRÍA']);
    if (s.includes('secadora')) out.push(['nodryer', 'SIN SECADORA']);
    if (s.includes('no planchar')) out.push(['noiron', s.includes('estampado') ? 'NO SOBRE EL ESTAMPADO' : 'SIN PLANCHA']);
    if (s.includes('en plano')) out.push(['flat', 'EN PLANO']);
    if (s.includes('colgado')) out.push(['line', 'COLGADO']);
    if (s.includes('sombra')) out.push(['shade', 'A LA SOMBRA']);
    return out;
  }

  /* ---------- vistas ---------- */
  function placeView(bbox, box, mirror) {
    const bw = bbox[2] - bbox[0];
    const bh = bbox[3] - bbox[1];
    const s = Math.min(box.w / bw, box.h / bh, box.max || 1);
    const sx = mirror ? -s : s;
    const tx = mirror ? box.x + (box.w - bw * s) / 2 + bbox[2] * s : box.x + (box.w - bw * s) / 2 - bbox[0] * s;
    const ty = box.y - bbox[1] * s;
    return { s, sx, tx, ty, map: (p) => [tx + p[0] * sx, ty + p[1] * s] };
  }
  function viewSvg(id, name, art, which, place) {
    const t = art.tpl;
    const v = art[which] || {};
    const tv = which === 'front' ? t.front : t.back;
    const clipId = `${id}-${name}-clip`;
    const clipPaths = [t.d].concat(t.clipExtra || []).map((d) => tag('path', { d })).join('');
    const fabric = art.fabric;
    const fill = v.fill || K.path(t.d, { fill: fabric, stroke: 'none' });
    const behind = which === 'front' ? t.behind || '' : t.behindB || '';
    const layer = (lid, inner, extra = {}) => (inner ? g({ id: `${id}-${name}-${lid}`, ...extra }, inner) : '');
    return g(
      { id: `${id}-${name}`, transform: `translate(${r1(place.tx)} ${r1(place.ty)}) scale(${(Math.round(place.sx * 1000) / 1000).toString()} ${(Math.round(place.s * 1000) / 1000).toString()})` },
      tag('defs', {}, tag('clipPath', { id: clipId }, clipPaths)) +
        layer('debajo', v.under || '') +
        layer('detras', behind) +
        layer('relleno', fill) +
        layer('estampado', v.pattern || '', { 'clip-path': `url(#${clipId})` }) +
        layer('costuras', tv.seams + tv.stitches) +
        layer('piezas', tv.parts + (v.parts || '')) +
        layer('detalles', v.details || '') +
        layer('silueta', K.path(t.d, { stroke: INK, 'stroke-width': 2.8 })) +
        layer('encima', v.over || '')
    );
  }

  /* ---------- hoja ---------- */
  window.buildSheet = function (d) {
    const id = d.handle;
    const spec = window.SPECS[id];
    if (!spec) throw new Error('sin boceto: ' + id);
    const rnd = K.rng(K.hash(id));
    const art = spec({ id, rnd }, d);
    const accent = d.accent;
    let out = '';

    // Fondo
    out += g({ id: `${id}-fondo` }, K.rect(0, 0, WPAGE, HPAGE, { fill: PAPER, stroke: 'none' }));

    // Encabezado
    let head = textEl(60, 70, 'HIGHT', { family: 'Anton', size: 28, ls: 1 });
    head += textEl(150, 69, 'FICHA TÉCNICA · BOCETO PLANO', { family: 'Space Mono', size: 12, ls: 1.2, fill: MUTED });
    head += textEl(1620, 69, 'hight18.myshopify.com', { family: 'Space Mono', size: 12, anchor: 'end', fill: MUTED });
    head += K.path('M60 86 L1620 86', { stroke: INK, 'stroke-width': 1.6 });
    let titleSize = 66;
    const title = d.title.toUpperCase();
    while (measure(title, F.display(titleSize)) > 1000 && titleSize > 40) titleSize -= 2;
    head += textEl(60, 158, title, { family: 'Anton', size: titleSize });
    const meta = `${d.type.toUpperCase()} · ${d.vendor.toUpperCase()} · ${money(d.price)}`;
    head += textEl(1620, 124, meta, { family: 'Space Mono', size: 15, weight: 700, anchor: 'end' });
    const chips = [d.status === 'ACTIVE' ? 'ACTIVA EN LA TIENDA' : 'BORRADOR'];
    if (d.unique) chips.push('PIEZA ÚNICA');
    else if (d.stock_label) chips.push(d.stock_label);
    if (d.corte) chips.push(d.corte.toUpperCase());
    let cx = 1620;
    let chipSvg = '';
    for (let i = chips.length - 1; i >= 0; i--) {
      const w = measure(chips[i], F.mono(11, 700)) + chips[i].length * 0.6 + 18;
      cx -= w;
      const first = i === 0;
      chipSvg += K.rect(cx, 138, w, 24, { fill: first ? (d.status === 'ACTIVE' ? INK : '#ffffff') : i === 1 && d.unique ? accent : '#ffffff', 'stroke-width': 1.3 });
      chipSvg += textEl(cx + 9, 154, chips[i], { family: 'Space Mono', size: 11, weight: 700, ls: 0.6, fill: first && d.status === 'ACTIVE' ? '#ffffff' : i === 1 && d.unique ? onColor(accent) : INK });
      cx -= 8;
    }
    head += chipSvg;
    head += K.path('M60 178 L1620 178', { stroke: INK, 'stroke-width': 1 });
    out += g({ id: `${id}-encabezado` }, head);

    // Vistas
    const frontBox = { x: 60, y: 232, w: 540, h: 640 };
    const backBox = { x: 650, y: 232, w: 340, h: 420 };
    const pf = placeView(art.tpl.bbox, frontBox);
    const pb = placeView(art.tpl.bbox, backBox, art.backMirror);
    let views = textEl(60, 212, 'FRENTE', { family: 'Space Mono', size: 12, weight: 700, ls: 1.2 });
    views += textEl(650, 212, 'ESPALDA', { family: 'Space Mono', size: 12, weight: 700, ls: 1.2 });
    if (!art.backKnown) views += textEl(722, 212, '(REFERENCIA: CONFÍRMALA CON LA PRENDA)', { family: 'Space Mono', size: 10, ls: 0.6, fill: MUTED });
    views += viewSvg(id, 'frente', art, 'front', pf);
    views += viewSvg(id, 'espalda', art, 'back', pb);
    out += g({ id: `${id}-boceto` }, views);

    // Llamadas
    let calls = '';
    const markers = [];
    (art.marks || []).forEach((m, i) => markers.push({ ...m, label: String(i + 1), kind: 'n' }));
    (art.fits || []).forEach((m, i) => markers.push({ ...m, label: String.fromCharCode(65 + i), kind: 'l' }));
    for (const m of markers) {
      const pl = m.view === 'back' ? pb : pf;
      const [x, y] = pl.map(m.at);
      const fillC = m.kind === 'l' ? accent : '#ffffff';
      calls += K.circle(x, y, 12.5, { fill: fillC, stroke: INK, 'stroke-width': 1.8 });
      calls += textEl(x, y + 4.5, m.label, { family: 'Space Mono', size: 13, weight: 700, anchor: 'middle', fill: m.kind === 'l' ? onColor(accent) : INK });
    }
    out += g({ id: `${id}-llamadas` }, calls);

    // Colores
    let pal = textEl(650, 690, 'COLORES DE LA PIEZA', { family: 'Space Mono', size: 11, weight: 700, ls: 1.2, fill: MUTED });
    (art.palette || []).slice(0, 5).forEach(([hex, name], i) => {
      const y = 706 + i * 34;
      pal += K.rect(650, y, 46, 26, { fill: hex, 'stroke-width': 1.2 });
      let ps = 13;
      while (measure(name, F.body(ps, 500)) > 134 && ps > 10) ps -= 0.5;
      pal += textEl(708, y + 12, name, { size: ps, weight: 500 });
      pal += textEl(708, y + 25, hex.toUpperCase(), { family: 'Space Mono', size: 10, fill: MUTED });
    });
    pal += textEl(850, 690, 'ACENTO EN LA TIENDA', { family: 'Space Mono', size: 11, weight: 700, ls: 1.2, fill: MUTED });
    pal += K.rect(850, 706, 46, 26, { fill: accent, 'stroke-width': 1.2 });
    pal += textEl(908, 724, accent.toUpperCase(), { family: 'Space Mono', size: 11 });
    if (d.coleccion) {
      pal += textEl(850, 768, 'COLECCIÓN', { family: 'Space Mono', size: 11, weight: 700, ls: 1.2, fill: MUTED });
      pal += K.rect(850, 784, 46, 26, { fill: d.coleccion.hex, 'stroke-width': 1.2 });
      pal += textEl(908, 796, d.coleccion.name, { size: 13, weight: 500 });
      pal += textEl(908, 809, d.coleccion.hex.toUpperCase(), { family: 'Space Mono', size: 10, fill: MUTED });
    }
    out += g({ id: `${id}-colores` }, pal);

    // Leyenda: detalles (números) y cómo queda (letras)
    let leg = K.path('M60 892 L1000 892', { stroke: LINE, 'stroke-width': 1, 'stroke-dasharray': '4 4' });
    const legCol = (x, w, heading, items, kind, size) => {
      const lh = Math.round(size * 1.33);
      let s = textEl(x, 918, heading, { family: 'Space Mono', size: 11, weight: 700, ls: 1.2, fill: MUTED });
      let y = 942;
      items.forEach((it, i) => {
        const label = kind === 'l' ? String.fromCharCode(65 + i) : String(i + 1);
        const lines = wrap(it.text, F.body(size), w - 34);
        s += K.circle(x + 10, y - 5, 10, { fill: kind === 'l' ? accent : '#ffffff', stroke: INK, 'stroke-width': 1.4 });
        s += textEl(x + 10, y - 1, label, { family: 'Space Mono', size: 11, weight: 700, anchor: 'middle', fill: kind === 'l' ? onColor(accent) : INK });
        s += linesEl(x + 30, y, lines, { size, lh });
        y += (lines.length - 1) * lh + Math.max(lh, 22) + 5;
      });
      return { s, y };
    };
    let legSize = 13.5;
    let c1 = legCol(60, 480, 'DETALLES DE CONFECCIÓN', art.marks || [], 'n', legSize);
    let c2 = legCol(560, 440, 'CÓMO QUEDA EN EL CUERPO', art.fits || [], 'l', legSize);
    while (Math.max(c1.y, c2.y) > 1144 && legSize > 11) {
      legSize -= 0.5;
      c1 = legCol(60, 480, 'DETALLES DE CONFECCIÓN', art.marks || [], 'n', legSize);
      c2 = legCol(560, 440, 'CÓMO QUEDA EN EL CUERPO', art.fits || [], 'l', legSize);
    }
    leg += c1.s + c2.s;
    out += g({ id: `${id}-leyenda` }, leg);

    // Ficha: las respuestas
    const colX = 1040;
    const colW = 580;
    const rows = [
      ['LO DISTINTO', d.distinto],
      ['CÓMO QUEDA', d.nota_corte],
      ['MATERIAL Y CLIMA', d.material],
      ['CONFECCIÓN', d.confeccion],
      ['CUIDADO Y DURACIÓN', d.cuidado, { care: careKinds(d.cuidado) }],
      ['PARA', null, { chips: d.ocasiones }],
      ['POR PUESTA', `Si la usas 100 veces, cada puesta te sale en ${money(d.por_puesta)}.`],
      ['ORIGEN', d.origen],
      ['COMBÍNALA CON', null, { list: d.combina.map((c) => [c.role.toUpperCase(), c.title]), after: d.basics ? 'Con lo que ya tienes: ' + d.basics.charAt(0).toLowerCase() + d.basics.slice(1) : '' }],
      ['TALLA Y MEDIDAS', d.handle === 'camiseta-celula-carmin' ? 'S, M, L y XL. Las medidas de cada talla están pendientes.' : 'Pendientes: se miden en la prenda y se cargan en la ficha (talla y medidas).'],
    ];
    const layoutInfo = (size) => {
      const lh = Math.round(size * 1.36);
      const font = F.body(size);
      let s = '';
      let y = 214;
      rows.forEach(([label, value, extra = {}], i) => {
        if (i) {
          s += K.path(`M${colX} ${r1(y - 14)} L${colX + colW} ${r1(y - 14)}`, { stroke: LINE, 'stroke-width': 1, 'stroke-dasharray': '4 4' });
        }
        s += textEl(colX, y, label, { family: 'Space Mono', size: 11, weight: 700, ls: 1.2, fill: MUTED });
        y += lh + 2;
        if (value) {
          const lines = wrap(value, font, colW);
          s += linesEl(colX, y, lines, { size, lh });
          y += (lines.length - 1) * lh;
        }
        if (extra.care && extra.care.length) {
          y += 12;
          let x = colX;
          for (const [kind, lab] of extra.care) {
            const lw = Math.max(34, measure(lab, F.mono(9, 700)));
            s += careIcon(kind, x + (lw - 34) / 2, y);
            s += textEl(x + lw / 2, y + 48, lab, { family: 'Space Mono', size: 9, weight: 700, anchor: 'middle', ls: 0.3 });
            x += lw + 18;
          }
          y += 48;
        }
        if (extra.chips) {
          let x = colX;
          for (const c of extra.chips) {
            const label = c.toUpperCase();
            const w = measure(label, F.mono(11, 700)) + label.length * 0.6 + 18;
            s += K.rect(x, y - 13, w, 24, { 'stroke-width': 1.3 });
            s += textEl(x + 9, y + 3, label, { family: 'Space Mono', size: 11, weight: 700, ls: 0.6 });
            x += w + 8;
          }
          y += 10;
        }
        if (extra.list) {
          y -= lh;
          for (const [role, name] of extra.list) {
            y += lh;
            s += textEl(colX, y, role, { family: 'Space Mono', size: 11, weight: 700, fill: MUTED });
            s += textEl(colX + 84, y, name, { size, weight: 500 });
          }
          if (extra.after) {
            const lines = wrap(extra.after, font, colW);
            y += lh + 4;
            s += linesEl(colX, y, lines, { size, lh });
            y += (lines.length - 1) * lh;
          }
        }
        y += 40;
      });
      return { s, bottom: y - 40 };
    };
    let size = 14.5;
    let info = layoutInfo(size);
    while (info.bottom > 1130 && size > 11.5) {
      size -= 0.5;
      info = layoutInfo(size);
    }
    out += g({ id: `${id}-ficha` }, info.s);

    // Pie
    let foot = K.path('M60 1150 L1620 1150', { stroke: INK, 'stroke-width': 1 });
    foot += textEl(60, 1172, `hight18.myshopify.com/products/${id}`, { family: 'Space Mono', size: 11, fill: MUTED });
    foot += textEl(1620, 1172, 'Boceto plano con los datos de la ficha de la tienda · 19 oct 2026 · Medidas en la prenda real', { family: 'Space Mono', size: 11, anchor: 'end', fill: MUTED });
    out += g({ id: `${id}-pie` }, foot);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 ${WPAGE} ${HPAGE}">` + `<title>${esc(d.title)} · ficha técnica HIGHT</title>` + out + '</svg>';
    return { svg, infoSize: size, legendSize: legSize, legendBottom: Math.max(c1.y, c2.y), infoBottom: info.bottom };
  };
})();
