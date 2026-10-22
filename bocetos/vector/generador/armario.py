"""Modelos livianos del clóset del inicio: cada prenda del visor 360 con una grilla más gruesa y texturas chicas.

Uso: python3 armario.py <assets del tema> [prenda ...]

Lee de la carpeta de trabajo productos/<prenda>/mapas.npz (máscara y campo de la silueta) y, del tema, los archivos
360 de la prenda (datos, canto y texturas). Si la prenda no tiene mapas.npz, la silueta sale de su propio volumen.
Escribe en el tema 360-<prenda>-armario.json, -armario-frente.webp y -armario-espalda.webp.
"""
import base64
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

STEP = 8        # paso de la grilla del clóset, en px del dibujo (el visor 360 usa 4)
LONGER = 768    # lado largo de las texturas del clóset
ROOT = os.environ.get('HIGHT_360', os.getcwd())


def sample(field, x, y):
    h, w = field.shape
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = x - x0
    fy = y - y0
    a = field[y0, x0]
    b = field[y0, x0 + 1]
    c = field[y0 + 1, x0]
    d = field[y0 + 1, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def mesh_mask(meta, alto):
    """Silueta a partir del volumen del visor: los triángulos de la grilla fina, con el borde exacto."""
    gw, gh = meta['grid']
    w, h = meta['tex']
    step = meta['step']
    X = np.minimum(np.arange(gw) * step, w - 1).astype(np.float32) + 0.5
    Y = np.minimum(np.arange(gh) * step, h - 1).astype(np.float32) + 0.5
    PX, PY = [a.ravel() for a in np.meshgrid(X, Y)]
    PX[meta['rim']['i']] = np.array(meta['rim']['x']) + 0.5
    PY[meta['rim']['i']] = np.array(meta['rim']['y']) + 0.5
    img = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(img)
    on = alto > 0
    cells = on[:-1, :-1] | on[:-1, 1:] | on[1:, :-1] | on[1:, 1:]
    for j, i in zip(*np.nonzero(cells)):
        a = j * gw + i
        b, c, d = a + 1, a + gw, a + gw + 1
        for tri in ((a, c, b), (b, c, d)):
            draw.polygon([(float(PX[k]), float(PY[k])) for k in tri], fill=255)
    S = np.asarray(img) > 127
    F = np.asarray(img.filter(ImageFilter.GaussianBlur(1.0)), np.float32) / 255
    return S, F


def solid(S, F):
    """Lo mismo que build_solid de prenda.py, con la grilla del clóset: alto de cada punto y borde exacto."""
    h, w = S.shape
    gh, gw = (h + STEP - 1) // STEP + 1, (w + STEP - 1) // STEP + 1
    gy = np.minimum(np.arange(gh) * STEP, h - 1)
    gx = np.minimum(np.arange(gw) * STEP, w - 1)
    GX, GY = np.meshgrid(gx.astype(np.float32), gy.astype(np.float32))
    G = S[np.ix_(gy, gx)]
    inner = S & np.roll(S, 1, 0) & np.roll(S, -1, 0) & np.roll(S, 1, 1) & np.roll(S, -1, 1)
    by, bx = np.nonzero(S & ~inner)
    bxf, byf = bx.astype(np.float32), by.astype(np.float32)
    for _ in range(4):
        v = sample(F, bxf, byf) - 0.5
        gxv = sample(F, bxf + 0.5, byf) - sample(F, bxf - 0.5, byf)
        gyv = sample(F, bxf, byf + 0.5) - sample(F, bxf, byf - 0.5)
        g2 = gxv ** 2 + gyv ** 2 + 1e-9
        bxf -= np.clip(v * gxv / g2, -1, 1)
        byf -= np.clip(v * gyv / g2, -1, 1)
    ins = np.nonzero(G.ravel())[0]
    px = GX.ravel()[ins]
    py = GY.ravel()[ins]
    dist = np.empty(len(ins), np.float32)
    for s in range(0, len(ins), 1500):
        dx = px[s:s + 1500, None] - bxf[None]
        dy = py[s:s + 1500, None] - byf[None]
        dist[s:s + 1500] = np.sqrt((dx * dx + dy * dy).min(1))
    D = np.zeros(gh * gw, np.float32)
    D[ins] = dist
    D = D.reshape(gh, gw)
    width_px = int(np.ptp(np.nonzero(S.any(axis=0))[0]) + 1)
    R = min(0.11 * width_px, 0.9 * float(np.percentile(D[G], 97)))
    k = np.minimum(D / max(R, 1), 1.0)
    prof = np.sqrt(np.clip(1 - (1 - k) ** 2, 0, 1))
    prof[~G] = 0
    for _ in range(2):
        p = np.pad(prof, 1, mode='edge')
        sm = sum(p[1 + dy:1 + dy + gh, 1 + dx:1 + dx + gw] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
        prof = np.where(G, sm, 0)
    alto = np.where(G, np.maximum(1, (prof * 255).round()), 0).astype(np.uint8)
    near = np.zeros_like(G)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            sh = np.zeros_like(G)
            sh[max(0, dy):gh + min(0, dy), max(0, dx):gw + min(0, dx)] = G[max(0, -dy):gh + min(0, -dy), max(0, -dx):gw + min(0, -dx)]
            near |= sh
    rim = near & ~G
    ri = np.nonzero(rim.ravel())[0]
    rx = GX.ravel()[ri].copy()
    ry = GY.ravel()[ri].copy()
    for s in range(0, len(ri), 1500):
        dx = rx[s:s + 1500, None] - bxf[None]
        dy = ry[s:s + 1500, None] - byf[None]
        j = (dx * dx + dy * dy).argmin(1)
        rx[s:s + 1500] = bxf[j]
        ry[s:s + 1500] = byf[j]
    X = GX.ravel().copy()
    Y = GY.ravel().copy()
    X[ri] = rx
    Y[ri] = ry
    return alto, (gw, gh), ri, rx, ry, X, Y, width_px


def side_colors(lado, fine_step, X, Y, used):
    """Tela del canto en cada punto: la del punto más cercano de la grilla fina que la tenga (negro = sin canto)."""
    fh, fw = lado.shape[:2]
    rgb = np.zeros((len(X), 3), np.uint8)
    has = lado.reshape(-1, 3).sum(1) > 0
    for k in np.nonzero(used)[0]:
        fi, fj = X[k] / fine_step, Y[k] / fine_step
        best = None
        for r in (0, 1, 2):
            i0, i1 = max(0, int(fi) - r), min(fw - 1, int(fi) + 1 + r)
            j0, j1 = max(0, int(fj) - r), min(fh - 1, int(fj) + 1 + r)
            cand = [(abs(i - fi) + abs(j - fj), j, i) for j in range(j0, j1 + 1) for i in range(i0, i1 + 1) if has[j * fw + i]]
            if cand:
                best = min(cand)
                break
        if best is not None:
            rgb[k] = lado[best[1], best[2]]
    return rgb


def texture(src, dst):
    im = Image.open(src).convert('RGB')
    s = LONGER / max(im.size)
    im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS).save(dst, 'WEBP', quality=80, method=6)


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, np.uint8).tobytes()).decode('ascii')


def run(assets, handle):
    base = os.path.join(assets, '360-' + handle)
    meta = json.load(open(base + '.json'))
    fine_alto = np.asarray(Image.open(base + '-alto.png').convert('L'))
    lado = np.asarray(Image.open(base + '-lado.png').convert('RGB'))
    npz = os.path.join(ROOT, 'productos', handle, 'mapas.npz')
    if os.path.exists(npz):
        d = np.load(npz)
        S, F = d['S'], d['F']
    else:
        S, F = mesh_mask(meta, fine_alto)
    alto, (gw, gh), ri, rx, ry, X, Y, _ = solid(S, F)
    # Puntos que usa la malla: los de adentro y los del borde.
    used = (alto.ravel() > 0)
    used[ri] = True
    rgb = side_colors(lado, meta['step'], X, Y, used)
    colors = sorted({tuple(c) for c in rgb[rgb.sum(1) > 0]})
    index = {c: n + 1 for n, c in enumerate(colors)}
    side = np.array([index.get(tuple(c), 0) for c in rgb], np.uint8)
    out = {
        'v': 1, 'step': STEP, 'grid': [int(gw), int(gh)], 'tex': meta['tex'], 'widthPx': meta['widthPx'],
        'tela': meta.get('tela', 'sarga'),
        'rim': {'i': ri.tolist(), 'x': [round(float(v), 1) for v in rx], 'y': [round(float(v), 1) for v in ry]},
        'alto': b64(alto),
        'lado': {'pal': ['#%02x%02x%02x' % c for c in colors], 'i': b64(side)},
    }
    with open(base + '-armario.json', 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    texture(base + '-frente.webp', base + '-armario-frente.webp')
    texture(base + '-espalda.webp', base + '-armario-espalda.webp')
    sizes = [os.path.getsize(base + s) for s in ('-armario.json', '-armario-frente.webp', '-armario-espalda.webp')]
    print(f'{handle}: grilla {gw}×{gh}, borde {len(ri)}, {len(colors)} telas de canto · {sum(sizes) / 1024:.0f} KB'
          + ('' if os.path.exists(npz) else ' · silueta del volumen'))


if __name__ == '__main__':
    assets = sys.argv[1]
    handles = sys.argv[2:] or [f[4:-5] for f in sorted(os.listdir(assets))
                               if f.startswith('360-') and f.endswith('.json') and not f.endswith('-armario.json')]
    for h in handles:
        run(assets, h)
