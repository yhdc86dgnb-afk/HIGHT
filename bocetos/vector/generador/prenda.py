# Dibujo en vector (estilo Illustrator, con texturas) y volumen 3D de una prenda, a partir de su foto de la tienda
# (una copia) y su máscara de recorte. Uso: python3 vec/prenda.py <prenda> [<prenda> ...]
#
# Salidas en productos/<prenda>/:
#   frente-texturas.svg, espalda-texturas.svg  dibujos para Illustrator (la espalda al derecho)
#   3d-frente.svg, 3d-espalda.svg              mapas del 3D (sin contorno, canto en la tela del borde)
#   alto.png, lado.png, datos.json             volumen: alto de cada punto, tela del canto, borde y medidas
#   tintas.json                                tintas y texturas de la prenda
import sys, os, json, time, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import potrace   # pip install potracer

# Carpeta de trabajo: la que tiene productos/<prenda>/ (por defecto, la carpeta desde donde se corre).
ROOT = os.environ.get('HIGHT_360', os.getcwd())


def gauss(a, sigma):
    """Desenfoque gaussiano separable en float (sin scipy)."""
    r = int(3 * sigma + 0.5)
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-x * x / (2 * sigma * sigma)); k /= k.sum()
    p = np.pad(a, ((r, r), (0, 0)), mode='edge')
    a = sum(k[i] * p[i:i + a.shape[0]] for i in range(2 * r + 1))
    p = np.pad(a, ((0, 0), (r, r)), mode='edge')
    return sum(k[i] * p[:, i:i + a.shape[1]] for i in range(2 * r + 1))
CARBON = '#0d0c0b'
LONGER = 1100          # lado largo del dibujo, en px
STEP = 4               # paso de la grilla del volumen, en px

# Tipo de tela según el tipo de prenda: trama que va encima de las tintas de tela.
WEAVE = {'Jean': 'sarga', 'Short': 'sarga', 'Pantalón': 'sarga', 'Chaqueta': 'sarga', 'Buzo': 'punto',
         'Tejido': 'punto', 'Camiseta': 'jersey', 'Top': 'jersey'}

# Cómo se arma la espalda cuando no hay foto de la espalda:
#   'estampado': el mismo dibujo del frente (estampados y parches que dan toda la vuelta), con la pretina lisa;
#   'lisa': la tela de base, con las terminaciones del borde (puños, ruedo, capucha) del frente;
#   ('sin', tintas): el estampado del frente sin esas tintas (letras, parches), con la tela de alrededor.
BACK = {
    'buzo-destroyed-ceniza': 'lisa', 'buzo-multitud-termica': 'lisa', 'buzo-sakura-rosa': 'lisa',
    'camiseta-celula-carmin': 'estampado', 'chaqueta-smiley-acido': 'lisa', 'short-camuflado-leopardo-rosa': ('sin', ['rojo', 'carmin']),
    'tejido-anillos-indigo': 'lisa', 'tejido-deshilado-ceniza': 'estampado', 'top-crop-rostros': 'estampado',
    'top-halftone-carmin': 'lisa', 'top-malla-asimetrico-rojo': 'estampado', 'pantalon-hojas-carbon': 'estampado',
}

# Arreglos del recorte: fotos con la prenda puesta (torso, botas, pies). Fracciones de la foto. Con 'huecos': 'oscuro',
# lo que se ve por los huecos chicos de la prenda (la mesa entre las tiras sueltas) va del color más oscuro de la
# prenda, como la tela de adentro.
FIX = {
    'pantalon-hibrido-carmin': {'cut_top': 0.098, 'rects': [(0.30, 0.875, 0.50, 1.0)]},
    'jean-wide-fleco-indigo': {'rects': [(0.25, 0.94, 0.46, 1.0)], 'exclude_hue': (35, 95, 14)},
    'chaqueta-blood-rose': {'huecos': 'oscuro'},
}

# Trama propia de algunas prendas.
WEAVE_PRODUCT = {'top-malla-asimetrico-rojo': 'malla'}

TYPES = {}


# ---------------------------------------------------------------- color

def srgb_to_lab(rgb):
    c = np.clip(rgb, 0, 255) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def lab_to_srgb(lab):
    lab = np.asarray(lab, np.float64)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    fy = (L + 16) / 116; fx = fy + a / 500; fz = fy - b / 200
    def finv(t): return np.where(t ** 3 > 0.008856, t ** 3, (t - 16 / 116) / 7.787)
    xyz = np.stack([finv(fx) * 0.95047, finv(fy), finv(fz) * 1.08883], -1)
    Mi = np.linalg.inv(np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]))
    c = np.clip(xyz @ Mi.T, 0, 1)
    c = np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
    return np.clip(np.round(c * 255), 0, 255).astype(int)

def hexof(rgb):
    return '#%02x%02x%02x' % tuple(int(v) for v in rgb)

def shade(lab, dl, dc=1.0):
    L, a, b = lab
    return hexof(lab_to_srgb([np.clip(L + dl, 2, 98), a * dc, b * dc]))

def color_name(lab):
    L, a, b = lab
    C = math.hypot(a, b)
    h = math.degrees(math.atan2(b, a)) % 360
    if C < 9:
        if L < 22: return 'negro'
        if L < 42: return 'gris oscuro'
        if L < 68: return 'gris'
        if L < 86: return 'gris claro'
        return 'blanco'
    if C < 16 and L > 80: return 'crema' if 40 < h < 110 else 'blanco'
    if h < 20 or h >= 345: return 'carmín' if L < 50 else ('rojo' if L < 62 and C > 35 else 'rosa')
    if h < 50: return 'rojo' if (L < 60 and C > 30) else ('rosa' if L >= 60 else 'terracota')
    if h < 75: return 'naranja' if C > 40 else ('marrón' if L < 55 else 'beige')
    if h < 105: return 'amarillo' if (L > 65 and C > 30) else ('oliva' if L < 60 else 'arena')
    if h < 140: return 'verde ácido' if (L > 60 and C > 35) else 'oliva'
    if h < 200: return 'verde'
    if h < 240: return 'azul petróleo' if L < 50 else 'turquesa'
    if h < 290: return 'índigo' if L < 45 else 'azul'
    if h < 330: return 'violeta' if L < 70 else 'lila'
    return 'fucsia' if C > 40 else 'rosa'

def slug(s):
    for a, b in (('á', 'a'), ('é', 'e'), ('í', 'i'), ('ó', 'o'), ('ú', 'u'), ('ñ', 'n'), (' ', '-')):
        s = s.replace(a, b)
    return s


# ---------------------------------------------------------------- máscaras

def to_img(m):
    return Image.fromarray((m * 255).astype(np.uint8)).copy()

def erode(m, n):
    for _ in range(n):
        m = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
    return m

def main_component(m):
    """La pieza más grande: semilla en el punto más hondo (lejos del borde) y relleno desde ahí."""
    small = m[::4, ::4]
    depth = np.zeros(small.shape, np.int32)
    cur = small.copy()
    k = 0
    while cur.any() and k < 200:
        depth[cur] += 1
        cur = erode(cur, 1)
        k += 1
    y, x = np.unravel_index(np.argmax(depth), depth.shape)
    y, x = min(m.shape[0] - 1, y * 4), min(m.shape[1] - 1, x * 4)
    if not m[y, x]:
        ys, xs = np.nonzero(m)
        i = np.argmin((ys - y) ** 2 + (xs - x) ** 2)
        y, x = ys[i], xs[i]
    im = to_img(m)
    ImageDraw.floodfill(im, (int(x), int(y)), 128, thresh=0)
    return np.asarray(im) == 128

def fill_holes(m, max_frac=0.012):
    """Rellena los agujeros chicos (motas, la malla, el tejido abierto). Los grandes, como el hueco entre las
    piernas cuando los ruedos se tocan, quedan afuera."""
    h, w = m.shape
    pad = np.zeros((h + 2, w + 2), bool)
    pad[1:-1, 1:-1] = m
    im = to_img(~pad)
    ImageDraw.floodfill(im, (0, 0), 128, thresh=0)
    outside = np.asarray(im)[1:-1, 1:-1] == 128
    holes = ~outside & ~m
    out = m | holes
    if not holes.any():
        return out
    limit = max_frac * max(1, int(m.sum()))
    work = to_img(holes)
    idx = np.flatnonzero(np.asarray(work) == 255)
    while idx.size:
        y, x = divmod(int(idx[0]), w)
        ImageDraw.floodfill(work, (x, y), 100, thresh=0)
        region = np.asarray(work) == 100
        if region.sum() > limit:
            out[region] = False
        ImageDraw.floodfill(work, (x, y), 0, thresh=0)
        idx = np.flatnonzero(np.asarray(work) == 255)
    return out

def white_background(img):
    """Fondo de estudio: el blanco que toca el borde de la foto (None si el borde no es casi todo blanco)."""
    a = img.astype(np.int16).min(axis=2)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    if (border >= 236).mean() < 0.85:
        return None
    cand = to_img(a >= 236)
    h, w = a.shape
    for x in range(0, w, 16):
        for y in (0, h - 1):
            if cand.getpixel((x, y)) == 255:
                ImageDraw.floodfill(cand, (x, y), 128, thresh=0)
    for y in range(0, h, 16):
        for x in (0, w - 1):
            if cand.getpixel((x, y)) == 255:
                ImageDraw.floodfill(cand, (x, y), 128, thresh=0)
    return np.asarray(cand) == 128

def clean_mask(alpha, fix=None, img=None):
    m = alpha > 0.5
    if img is not None:
        bg = white_background(img)
        if bg is not None:
            # Lo que no es fondo blanco y el modelo ve aunque sea un poco (las partes claras de la prenda).
            m |= ~bg & (alpha > 0.12)
    h, w = m.shape
    if fix:
        if fix.get('cut_top'):
            m[: int(h * fix['cut_top'])] = False
        for x0, y0, x1, y1 in fix.get('rects', []):
            m[int(h * y0):int(h * y1), int(w * x0):int(w * x1)] = False
        if fix.get('exclude_hue') and img is not None:
            h0, h1, cmin = fix['exclude_hue']
            lab = srgb_to_lab(img.astype(np.float32))
            chroma = np.hypot(lab[..., 1], lab[..., 2])
            hue = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360
            floor = (chroma > cmin) & (hue >= h0) & (hue <= h1)
            m &= ~(gauss(floor.astype(np.float32), 2) > 0.5)
    m = np.asarray(to_img(m).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))) > 127
    return fill_holes(main_component(m))

def frame(img, m, longer=LONGER, pad_frac=0.035):
    """Recorta a la caja de la prenda con margen y lleva el lado largo a `longer` px."""
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    pad = int(pad_frac * max(x1 - x0, y1 - y0)) + 4
    X0, Y0, X1, Y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    cw, ch = X1 - X0, Y1 - Y0
    canvas = Image.new('RGB', (cw, ch), (255, 255, 255))
    canvas.paste(Image.fromarray(img), (-X0, -Y0))
    mc = Image.new('L', (cw, ch), 0)
    mc.paste(to_img(m), (-X0, -Y0))
    s = longer / max(cw, ch)
    size = (max(8, round(cw * s)), max(8, round(ch * s)))
    out_img = np.asarray(canvas.resize(size, Image.LANCZOS)).astype(np.float32)
    out_m = np.asarray(mc.resize(size, Image.BILINEAR)) > 127
    return out_img, out_m

def align_back(front_m, back_img, back_m):
    """La espalda vista desde adelante (espejada) y llevada a la caja del frente."""
    bimg = np.ascontiguousarray(back_img[:, ::-1])
    bm = np.ascontiguousarray(back_m[:, ::-1])
    def bbox(m):
        ys, xs = np.nonzero(m)
        return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    fx0, fy0, fx1, fy1 = bbox(front_m)
    bx0, by0, bx1, by1 = bbox(bm)
    sx = (fx1 - fx0) / (bx1 - bx0); sy = (fy1 - fy0) / (by1 - by0)
    inv = (1 / sx, 0, bx0 - fx0 / sx, 0, 1 / sy, by0 - fy0 / sy)
    H, W = front_m.shape
    im = Image.fromarray(bimg.clip(0, 255).astype(np.uint8)).transform((W, H), Image.AFFINE, inv, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    mm = to_img(bm).transform((W, H), Image.AFFINE, inv, resample=Image.BILINEAR)
    return np.asarray(im).astype(np.float32), np.asarray(mm) > 127


# ---------------------------------------------------------------- tintas

def blur(m, sigma):
    return gauss(m.astype(np.float32), sigma)

def shift(a, dy, dx, fill):
    h, w = a.shape
    out = np.full_like(a, fill)
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
    return out

def spread(lab, where, steps, n):
    """Cada píxel de where que falta (-1) toma la tinta que más se repite entre sus vecinos, paso a paso."""
    lab = lab.copy()
    for _ in range(steps):
        need = where & (lab < 0)
        if not need.any():
            break
        votes = np.zeros((n,) + lab.shape, np.int16)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    sh = shift(lab, dy, dx, -1)
                    for k in range(n):
                        votes[k] += sh == k
        upd = need & (votes.sum(0) > 0)
        lab[upd] = votes.argmax(0)[upd]
    return lab

def kmeans_palette(labs_px, K=9, seed=7):
    rng = np.random.default_rng(seed)
    X = labs_px[rng.choice(len(labs_px), min(len(labs_px), 120000), replace=False)]
    wgt = np.array([1.0, 1.5, 1.5])
    Xw = X * wgt
    # k-means++
    C = [Xw[rng.integers(len(Xw))]]
    for _ in range(K - 1):
        d = np.min(((Xw[:, None] - np.array(C)[None]) ** 2).sum(-1), 1)
        C.append(Xw[rng.choice(len(Xw), p=d / d.sum())])
    C = np.array(C)
    for _ in range(50):
        lab_k = ((Xw[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        newC = np.array([Xw[lab_k == k].mean(0) if (lab_k == k).any() else C[k] for k in range(len(C))])
        if np.abs(newC - C).max() < 0.05:
            break
        C = newC
    # Juntar tintas muy parecidas y descartar las que casi no aparecen.
    while True:
        lab_k = ((Xw[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        share = np.bincount(lab_k, minlength=len(C)) / len(lab_k)
        Cl = C / wgt
        best = None
        for i in range(len(C)):
            for j in range(i + 1, len(C)):
                d = np.linalg.norm(Cl[i] - Cl[j])
                if d < 10 and (best is None or d < best[0]):
                    best = (d, i, j)
        small = np.argmin(share)
        if best is not None:
            _, i, j = best
            C[i] = (C[i] * share[i] + C[j] * share[j]) / max(1e-9, share[i] + share[j])
            C = np.delete(C, j, 0)
        elif share[small] < 0.012 and len(C) > 3:
            C = np.delete(C, small, 0)
        else:
            break
    lab_k = ((Xw[:, None] - C[None]) ** 2).sum(-1).argmin(1)
    share = np.bincount(lab_k, minlength=len(C)) / len(lab_k)
    order = np.argsort(-share)
    return (C / wgt)[order], share[order], wgt

def classify(L3, C, wgt):
    h, w = L3.shape[:2]
    best = np.full((h, w), np.inf, np.float32)
    ink = np.zeros((h, w), np.int32)
    Lw = L3 * wgt
    for k in range(len(C)):
        d = ((Lw - C[k] * wgt) ** 2).sum(-1)
        u = d < best
        best[u] = d[u]
        ink[u] = k
    return ink

def ink_map(img, m, S, C, wgt, n):
    """Mapa de tintas de una cara: cada píxel de la silueta S con una tinta, sin motas ni rayas."""
    L3 = srgb_to_lab(img)
    ink = classify(L3, C, wgt)
    Ls = C[:, 0]
    extremes = {int(np.argmin(Ls)), int(np.argmax(Ls))}
    # Tintas medias muy finas: suelen ser la mezcla de dos tintas en un borde de la foto. Pasan a la vecina.
    for k in range(n):
        if k in extremes:
            continue
        thin = (ink == k) & (blur(ink == k, 2.0) < 0.38)
        if thin.any():
            others = [j for j in range(n) if j != k]
            votes = np.stack([blur(ink == j, 2.5) for j in others])
            ink[thin] = np.array(others)[votes.argmax(0)][thin]
    # Franja de 6 px del borde de la foto: ahí la tela se mezcla con el fondo. Vota la tela de adentro.
    band = m & ~(np.asarray(to_img(m).filter(ImageFilter.MinFilter(13))) > 127)
    inner = m & ~band
    votes = np.stack([blur(inner & (ink == k), 4) for k in range(n)])
    ink[band] = votes.argmax(0)[band]
    known = (np.asarray(to_img(m).filter(ImageFilter.MinFilter(7))) > 127) & S
    lab = np.where(known, ink, -1)
    lab = spread(lab, S, 4, n)
    need = S & (lab < 0)
    if need.any():
        votes = np.stack([blur(lab == k, 20) for k in range(n)])
        lab[need] = votes.argmax(0)[need]
    soft = np.stack([blur(lab == k, 1.5) for k in range(n)])
    out = soft.argmax(0).astype(np.int32)
    out[~S] = -1
    return out, L3[..., 0]

def edge_distance(inside, steps):
    dist = np.zeros(inside.shape, np.int32)
    cur = inside.copy()
    for step in range(1, steps + 1):
        if step % 2:
            er = cur & np.roll(cur, 1, 0) & np.roll(cur, -1, 0) & np.roll(cur, 1, 1) & np.roll(cur, -1, 1)
        else:
            er = cur.copy()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    er &= np.roll(np.roll(cur, dy, 0), dx, 1)
        dist[cur & ~er] = step
        cur = er
    dist[cur] = steps + 1
    return dist

def make_back(lab_f, base, mode, dist, bottoms, graphic=(), n=1):
    """Espalda de referencia cuando no hay foto: la tela de base con las terminaciones del borde, o el mismo
    estampado del frente con la pretina lisa."""
    lab = lab_f.copy()
    inside = lab_f >= 0
    ys = np.nonzero(inside.any(1))[0]
    top, bottom = ys.min(), ys.max()
    if mode == 'lisa':
        lab[inside & (dist > 30)] = base
        return lab
    if mode == 'sin' and graphic:
        # Las letras y parches (con su sombra) se tapan con la misma tela de otra parte de la prenda, corrida unos
        # centímetros: el camuflado sigue y no queda una mancha lisa.
        graph = np.isin(lab, list(graphic))
        hole = (np.asarray(to_img(graph).filter(ImageFilter.MaxFilter(13))) > 127) & inside & (dist > 30)
        ok = inside & ~hole & ~graph
        src = lab.copy()
        lab[hole] = -1
        H, W = lab.shape
        for dy, dx in ((0, 150), (0, -150), (110, 0), (-110, 0), (120, 120), (-120, -120), (120, -120), (-120, 120),
                       (0, 300), (0, -300), (240, 0), (-240, 0)):
            need = lab < 0
            if not (need & hole).any():
                break
            ys, xs = np.nonzero(need & hole)
            sy, sx = ys + dy, xs + dx
            valid = (sy >= 0) & (sy < H) & (sx >= 0) & (sx < W)
            ys, xs, sy, sx = ys[valid], xs[valid], sy[valid], sx[valid]
            good = ok[sy, sx]
            lab[ys[good], xs[good]] = src[sy[good], sx[good]]
        lab = spread(lab, inside, 60, n)
    if bottoms:
        # La pretina: una franja que sigue el borde de arriba de la prenda, columna por columna, con la tela que
        # más hay en esa franja del frente (no la tinta de base de toda la prenda).
        depth = int(0.13 * (bottom - top))
        first = np.where(inside.any(0), inside.argmax(0), lab.shape[0])
        first = np.round(gauss(first[None].astype(np.float32).repeat(3, 0), 12)[1]).astype(int)
        rows = np.arange(lab.shape[0])[:, None]
        # Solo cerca de la cintura: en un jean fotografiado en diagonal, la pierna que sube no es pretina.
        waist = inside & (rows >= first[None]) & (rows < first[None] + depth) & (rows < top + int(1.6 * depth)) & (dist > 18)
        if waist.any():
            ink = np.bincount(lab_f[waist].ravel()).argmax()
            lab[waist] = ink
    return lab


# ---------------------------------------------------------------- texturas y tramas

def detail_textures(lab, L, inks, n, dist, base_only=None):
    """Texturas sacadas del detalle fino de la foto (lo que cambia en menos de 10 px), adentro de cada tinta:
    un tono más claro donde la foto aclara y uno más oscuro donde oscurece."""
    out = []
    area = np.bincount(lab[lab >= 0].ravel(), minlength=n)
    order = np.argsort(-area)[:4]
    for k in order:
        if area[k] < 0.03 * area.sum():
            continue
        M = lab == k
        if base_only is not None:
            M &= base_only
        Me = erode(M, 2)
        if Me.sum() < 400:
            continue
        w = gauss(Me.astype(np.float32), 5)
        mu = gauss(L * Me, 5) / np.maximum(w, 1e-3)
        dev = (L - mu)
        vals = dev[Me]
        for sign, pct, dl, tid in ((1, 88, 7, 'luces'), (-1, 12, -8, 'sombras')):
            thr = np.percentile(vals, pct)
            if sign > 0:
                thr = max(3.5, thr)
                raw = Me & (dev > thr)
            else:
                thr = min(-3.5, thr)
                raw = Me & (dev < thr)
            mask = (gauss(raw.astype(np.float32), 0.9) > 0.42) & M & (dist > 9)
            if mask.sum() > 50:
                out.append((int(k), tid, shade(inks[k]['lab'], dl), mask))
    return out

def weave_pattern(kind, ink_lab, size_scale=1.0):
    """Trama de tela en vector: (tamaño, ángulo, rectángulos, trazos)."""
    lt = shade(ink_lab, 6); dk = shade(ink_lab, -7)
    if kind == 'sarga':
        return 9, -62, [(0, 0, 9, 3.2, lt), (0, 4.6, 9, 1.3, dk)], []
    if kind == 'punto':
        return 6, 0, [(0, 0, 2.4, 6, lt), (3.6, 0, 1.0, 6, dk)], [('M0.6 1.2 L1.8 2.6 L3 1.2', dk)]
    if kind == 'jersey':
        return 4, 90, [(0, 0, 4, 1.1, shade(ink_lab, 4)), (0, 2.4, 4, 0.7, shade(ink_lab, -4))], []
    if kind == 'malla':
        net = shade(ink_lab, -48)
        return 6, 45, [(0, 0, 6, 1.0, net), (0, 0, 1.0, 6, net)], []
    return 9, -62, [(0, 0, 9, 3.2, lt), (0, 4.6, 9, 1.3, dk)], []


# ---------------------------------------------------------------- trazado

def f1(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s

def path_d(mask, turdsize):
    if not mask.any():
        return ''
    curves = potrace.Bitmap(~mask).trace(turdsize=turdsize, alphamax=1.0, opticurve=True, opttolerance=0.2)
    parts = []
    for c in curves:
        p = c.start_point
        seg = [f'M{f1(p.x)} {f1(p.y)}']
        for s in c.segments:
            if s.is_corner:
                seg.append(f'L{f1(s.c.x)} {f1(s.c.y)} {f1(s.end_point.x)} {f1(s.end_point.y)}')
            else:
                seg.append(f'C{f1(s.c1.x)} {f1(s.c1.y)} {f1(s.c2.x)} {f1(s.c2.y)} {f1(s.end_point.x)} {f1(s.end_point.y)}')
        parts.append(''.join(seg) + 'Z')
    return ''.join(parts)

def stack_order(lab, n, base):
    def edge(k):
        m = lab == k
        inner = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
        return int((m & ~inner).sum())
    rest = sorted([k for k in range(n) if k != base], key=edge, reverse=True)
    return [base] + rest

def write_svg(path, lab, inks, base, face, title, weave, textures, mirror, contour):
    h, w = lab.shape
    n = len(inks)
    order = stack_order(lab, n, base)
    ids = [inks[k]['id'] for k in range(n)]
    sil = path_d(lab >= 0, 8)
    defs = []
    fills = {}
    for k, kind in weave.items():
        size, angle, rects, strokes = weave_pattern(kind, inks[k]['lab'])
        body = f'<rect width="{size}" height="{size}" fill="{inks[k]["hex"]}"/>'
        body += ''.join(f'<rect x="{x}" y="{y}" width="{ww}" height="{hh}" fill="{c}"/>' for x, y, ww, hh, c in rects)
        body += ''.join(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="0.6" stroke-linecap="round"/>' for d, c in strokes)
        pid = f'{face}-{kind}-{ids[k]}'
        defs.append(f'<pattern id="{pid}" width="{size}" height="{size}" patternUnits="userSpaceOnUse" patternTransform="rotate({angle})">{body}</pattern>')
        fills[k] = f'url(#{pid})'
    def tex_layers(k):
        return [f'<path id="{face}-{ids[k]}-{tid}" fill="{color}" fill-rule="evenodd" d="{d}"/>' for kk, tid, color, d in textures if kk == k]
    layers = []
    for j in range(1, len(order)):
        k = order[j]
        d = path_d(np.isin(lab, order[j:]), 8)
        if d:
            hx = inks[k]['hex']
            layers.append(f'<path id="{face}-{ids[k]}" fill="{fills.get(k, hx)}" stroke="{hx}" stroke-width="0.8" stroke-linejoin="round" fill-rule="evenodd" d="{d}"/>')
            layers += tex_layers(k)
    g_open = f'<g id="prenda" transform="matrix(-1 0 0 1 {w} 0)">' if mirror else '<g id="prenda">'
    body = [f'<path id="{face}-silueta" fill="{fills.get(base, inks[base]["hex"])}" fill-rule="evenodd" d="{sil}"/>', *tex_layers(base),
            f'<g id="{face}-tintas">', *layers, '</g>']
    if contour:
        body.append(f'<path id="{face}-contorno" fill="none" stroke="{CARBON}" stroke-width="5" stroke-linejoin="round" d="{sil}"/>')
    svg = (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
           f'<title>{title}</title><defs>{"".join(defs)}</defs>{g_open}<g id="{face}">' + ''.join(body) + '</g></g></svg>')
    open(path, 'w').write(svg)


# ---------------------------------------------------------------- volumen

def sample(field, x, y):
    h, w = field.shape
    x = np.clip(x, 0, w - 1.001); y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = x - x0; fy = y - y0
    a = field[y0, x0]; b = field[y0, x0 + 1]; c = field[y0 + 1, x0]; d = field[y0 + 1, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

def build_solid(S, F, side, inks, outdir):
    h, w = S.shape
    gh, gw = (h + STEP - 1) // STEP + 1, (w + STEP - 1) // STEP + 1
    gy = np.minimum(np.arange(gh) * STEP, h - 1); gx = np.minimum(np.arange(gw) * STEP, w - 1)
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
        bxf -= np.clip(v * gxv / g2, -1, 1); byf -= np.clip(v * gyv / g2, -1, 1)
    ins = np.nonzero(G.ravel())[0]
    px = GX.ravel()[ins]; py = GY.ravel()[ins]
    dist = np.empty(len(ins), np.float32)
    for s in range(0, len(ins), 1500):
        dx = px[s:s + 1500, None] - bxf[None]; dy = py[s:s + 1500, None] - byf[None]
        dist[s:s + 1500] = np.sqrt((dx * dx + dy * dy).min(1))
    D = np.zeros(gh * gw, np.float32); D[ins] = dist; D = D.reshape(gh, gw)
    width_px = int(np.ptp(np.nonzero(S.any(axis=0))[0]) + 1)
    # El abombado: 11 % del ancho, sin pasar de lo que da la parte más angosta (piernas, mangas).
    R = min(0.11 * width_px, 0.9 * float(np.percentile(D[G], 97)))
    k = np.minimum(D / max(R, 1), 1.0)
    prof = np.sqrt(np.clip(1 - (1 - k) ** 2, 0, 1))
    prof[~G] = 0
    for _ in range(2):
        p = np.pad(prof, 1, mode='edge')
        sm = sum(p[1 + dy:1 + dy + gh, 1 + dx:1 + dx + gw] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
        prof = np.where(G, sm, 0)
    q = np.where(G, np.maximum(1, (prof * 255).round()), 0).astype(np.uint8)
    Image.fromarray(q).save(os.path.join(outdir, 'alto.png'), optimize=True)
    near = np.zeros_like(G)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            sh = np.zeros_like(G)
            sh[max(0, dy):gh + min(0, dy), max(0, dx):gw + min(0, dx)] = G[max(0, -dy):gh + min(0, -dy), max(0, -dx):gw + min(0, -dx)]
            near |= sh
    rim = near & ~G
    ri = np.nonzero(rim.ravel())[0]
    rx = GX.ravel()[ri].copy(); ry = GY.ravel()[ri].copy()
    for s in range(0, len(ri), 1500):
        dx = rx[s:s + 1500, None] - bxf[None]; dy = ry[s:s + 1500, None] - byf[None]
        j = (dx * dx + dy * dy).argmin(1)
        rx[s:s + 1500] = bxf[j]; ry[s:s + 1500] = byf[j]
    # Tela del canto en cada punto (negro puro = no es canto).
    sg = spread(side, np.ones(side.shape, bool), 4, len(inks))
    X = GX.ravel().copy(); Y = GY.ravel().copy()
    X[ri] = rx; Y[ri] = ry
    xi = np.clip(np.round(X).astype(int), 0, w - 1); yi = np.clip(np.round(Y).astype(int), 0, h - 1)
    ink = sg[yi, xi]
    pal = np.array([[int(c['hex'][i:i + 2], 16) for i in (1, 3, 5)] for c in inks] + [[0, 0, 0]], np.uint8)
    rgb = pal[np.where(ink >= 0, ink, len(inks))].reshape(gh, gw, 3)
    # Ninguna tinta del canto puede ser negro puro (se leería como "no es canto").
    zero = (rgb.sum(-1) == 0) & (ink.reshape(gh, gw) >= 0)
    rgb[zero] = [1, 1, 1]
    Image.fromarray(rgb).save(os.path.join(outdir, 'lado.png'), optimize=True)
    return {'step': STEP, 'grid': [int(gw), int(gh)], 'tex': [int(w), int(h)], 'widthPx': width_px,
            'rim': {'i': ri.tolist(), 'x': [round(float(v), 1) for v in rx], 'y': [round(float(v), 1) for v in ry]}}

def side_map(lab_f, lab_b, inks, base, reach=126):
    """Tela del canto: la del borde del frente, sin motas; la misma en las dos caras."""
    n = len(inks)
    inside = lab_f >= 0
    dist = edge_distance(inside, reach)
    ring = inside & (dist <= 3)
    area = np.bincount(lab_f[inside].ravel(), minlength=n) / max(1, inside.sum())
    fabric = lab_f.copy()
    # Solo las tres telas principales dan la vuelta al canto; la pintura, las figuras y las costuras no: ahí va la
    # tela de base.
    main = set(int(k) for k in np.argsort(-area)[:3]) | {base}
    fabric[np.isin(fabric, [k for k in range(n) if k not in main or area[k] < 0.08])] = base
    # A lo largo del borde, la tela que más pesa en unos 2 cm: el canto cambia de tela poco y sin franjas.
    soft = np.stack([gauss((ring & (fabric == k)).astype(np.float32), 7) for k in range(n)])
    seed = np.where(ring, soft.argmax(0), -1)
    region = inside & (dist <= reach)
    side = spread(seed, region, reach + 4, n)
    side[region & (side < 0)] = base
    side[~region] = -1
    return side, dist


# ---------------------------------------------------------------- una prenda

def run(handle, kind):
    t0 = time.time()
    d = os.path.join(ROOT, 'productos', handle)
    boceto = os.path.isdir(os.path.join(d, 'boceto'))
    src = os.path.join(d, 'boceto') if boceto else d
    img = np.asarray(Image.open(os.path.join(src, 'foto.jpg')).convert('RGB'))
    if boceto:
        alpha = (np.asarray(Image.open(os.path.join(src, 'foto.jpg')).convert('L')) < 246).astype(np.float32)
    else:
        alpha = np.asarray(Image.open(os.path.join(d, 'foto-mascara.png'))).astype(np.float32) / 255
    m = clean_mask(alpha, FIX.get(handle), None if boceto else img)
    if (FIX.get(handle) or {}).get('huecos') == 'oscuro' and not boceto:
        tela = alpha > 0.5
        luz = img.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
        img = img.copy()
        img[m & ~tela] = np.median(img[tela & (luz <= np.percentile(luz[tela], 8))], axis=0)
    fimg, fm = frame(img, m)
    back_real = None
    back_src = os.path.join(src, 'espalda.jpg')
    if os.path.exists(back_src):
        bimg = np.asarray(Image.open(back_src).convert('RGB'))
        if boceto:
            balpha = (np.asarray(Image.open(back_src).convert('L')) < 246).astype(np.float32)
        else:
            balpha = np.asarray(Image.open(os.path.join(d, 'espalda-mascara.png'))).astype(np.float32) / 255
        bm = clean_mask(balpha, None, None if boceto else bimg)
        bimg_f, bm_f = frame(bimg, bm)
        # Al mismo tamaño del frente antes de alinear.
        bimg_r = np.asarray(Image.fromarray(bimg_f.clip(0, 255).astype(np.uint8)).resize((fm.shape[1], fm.shape[0]), Image.LANCZOS)).astype(np.float32)
        bm_r = np.asarray(to_img(bm_f).resize((fm.shape[1], fm.shape[0]), Image.BILINEAR)) > 127
        back_real = align_back(fm, bimg_r, bm_r)
    # Silueta común, suave.
    S = fm | (back_real[1] if back_real else False)
    S = np.asarray(to_img(S).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))) > 127
    S = fill_holes(main_component(S))
    F = gauss(S.astype(np.float32), 5.0)
    S = fill_holes(main_component(F > 0.5))
    F = np.where(S, np.maximum(F, 0.5 + 1e-4), np.minimum(F, 0.5 - 1e-4))
    # Tintas.
    px = [srgb_to_lab(fimg[erode(fm, 3)])]
    if back_real:
        px.append(srgb_to_lab(back_real[0][erode(back_real[1], 3)]))
    C, share, wgt = kmeans_palette(np.concatenate(px))
    n = len(C)
    inks = []
    used = {}
    for k in range(n):
        name = color_name(C[k])
        used[name] = used.get(name, 0) + 1
        iid = slug(name) + ('' if used[name] == 1 else f'-{used[name]}')
        inks.append({'id': iid, 'nombre': name.capitalize() + ('' if used[name] == 1 else f' {used[name]}'),
                     'hex': hexof(lab_to_srgb(C[k])), 'lab': [float(v) for v in C[k]], 'parte': round(float(share[k]), 3)})
    lab_f, L_f = ink_map(fimg, fm, S, C, wgt, n)
    area = np.bincount(lab_f[lab_f >= 0].ravel(), minlength=n)
    base = int(np.argmax(area))
    dist = edge_distance(S, 40)
    if back_real:
        lab_b, L_b = ink_map(back_real[0], back_real[1], S, C, wgt, n)
        back_kind = 'boceto' if boceto else 'foto'
    else:
        mode = BACK.get(handle, 'estampado')
        graphic = ()
        if isinstance(mode, tuple):
            mode, ids = mode
            graphic = [k for k, ink in enumerate(inks) if ink['id'] in ids]
        lab_b = make_back(lab_f, base, mode, dist, kind in ('Jean', 'Pantalón', 'Short'), graphic, n)
        L_b = L_f
        back_kind = 'referencia'
    # Texturas y tramas.
    weave_kind = WEAVE_PRODUCT.get(handle) or WEAVE.get(kind, 'sarga')
    order = np.argsort(-area)
    weave = {int(order[0]): weave_kind}
    if n > 1 and area[order[1]] > 0.15 * area.sum():
        weave[int(order[1])] = weave_kind
    tex_f = detail_textures(lab_f, L_f, inks, n, dist)
    tex_b = detail_textures(lab_b, L_b, inks, n, dist, base_only=(lab_b == lab_f) if back_kind == 'referencia' else None)
    def traced(tex):
        return [(k, tid, color, path_d(mask, 6)) for k, tid, color, mask in tex]
    tf, tb = traced(tex_f), traced(tex_b)
    # Canto y mapas del 3D.
    side, sdist = side_map(lab_f, lab_b, inks, base)
    def band(lab):
        out = lab.copy()
        bb = (lab >= 0) & (sdist <= 9)
        out[bb] = side[bb]
        return spread(out, np.ones(out.shape, bool), 10, n)
    title = TYPES.get(handle, {}).get('title', handle)
    write_svg(os.path.join(d, 'frente-texturas.svg'), lab_f, inks, base, 'frente', f'{title} · frente · HIGHT', weave, tf, False, True)
    write_svg(os.path.join(d, 'espalda-texturas.svg'), lab_b, inks, base, 'espalda', f'{title} · espalda ({back_kind}) · HIGHT', weave, tb, True, True)
    write_svg(os.path.join(d, '3d-frente.svg'), band(lab_f), inks, base, 'frente', f'{title} · frente · 3D', weave, tf, False, False)
    write_svg(os.path.join(d, '3d-espalda.svg'), band(lab_b), inks, base, 'espalda', f'{title} · espalda · 3D', weave, tb, False, False)
    meta = build_solid(S, F, side, inks, d)
    np.savez_compressed(os.path.join(d, 'mapas.npz'), lab_f=lab_f, lab_b=lab_b, S=S, F=F)
    meta.update({'v': 1, 'espalda': back_kind, 'tela': weave_kind})
    json.dump(meta, open(os.path.join(d, 'datos.json'), 'w'), separators=(',', ':'))
    json.dump({'tintas': [{k: v for k, v in i.items() if k != 'lab'} for i in inks], 'base': inks[base]['id'], 'tela': weave_kind,
               'espalda': back_kind, 'texturas': sorted({f'{inks[k]["id"]}-{tid}' for k, tid, _, _ in tex_f})},
              open(os.path.join(d, 'tintas.json'), 'w'), ensure_ascii=False, indent=1)
    print(handle, kind, 'tintas', n, [i['id'] for i in inks], 'espalda', back_kind, 'tela', weave_kind, round(time.time() - t0, 1), 's', flush=True)


if __name__ == '__main__':
    info = {}
    for line in open(os.path.join(ROOT, 'productos', 'lista.tsv')):
        parts = line.rstrip('\n').split('\t')
        if len(parts) >= 2:
            info[parts[0]] = parts[1]
    titles = json.load(open(os.path.join(ROOT, 'productos', 'titulos.json'))) if os.path.exists(os.path.join(ROOT, 'productos', 'titulos.json')) else {}
    for hnd, t in titles.items():
        TYPES[hnd] = {'title': t}
    for hnd in sys.argv[1:]:
        run(hnd, info.get(hnd, 'Jean'))
