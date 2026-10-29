#!/usr/bin/env python3
"""Los procesos de imagen de la campaña sin texto. Cada uno toma una copia de una prenda (de los recortes de
bocetos/instagram/imagenes/, nunca las fotos de la tienda) y la pasa por un proceso de copia o de luz, como las
referencias: el negativo con tinta azul, el mármol en blanco y negro, el escaneo con fugas de luz, el fantasma azul que
se corre, la copia roja de grano suelto y la cianotipia. Ninguno escribe letras: la única marca es la estrella de Hight.

Los colores son los de la marca: carbón, hueso y plata, el azul de Medianoche (la luz que se cuela de noche) y los seis
colores de las colecciones, que entran como fugas de luz.

Requiere Python 3 con NumPy, Pillow y OpenCV (opencv-python-headless).
"""
import math
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
IMAGENES = RAIZ / 'bocetos' / 'instagram' / 'imagenes'


def hexa(c):
    return np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


CARBON = hexa('#0d0c0b')
HUESO = hexa('#ece3d0')
PLATA = hexa('#c8cacd')
ACIDO = hexa('#dff04a')
CARMIN = hexa('#c3142d')
AZUL = hexa('#5b7cfa')
MAGENTA = hexa('#e0218a')
CENIZA = hexa('#c4beb2')
LEOPARDO = hexa('#c08a4e')
# El azul de Medianoche más hondo, como tinta, y el rojo de Sangre Fría más claro, como la luz del cuarto oscuro
AZUL_HONDO = hexa('#2a46d8')
ROJO_LUZ = hexa('#e2352f')
SEIS = {'acido': ACIDO, 'carmin': CARMIN, 'indigo': AZUL, 'magenta': MAGENTA, 'ceniza': CENIZA, 'leopardo': LEOPARDO}

# La estrella de la marca (el ícono flare del tema), en un cuadro de 24 × 24
ESTRELLA = ('M12.56 4.41l.26 1.29 .29 1.11 .32 .96 .39 .8 .36 .51 1.46-1.03 1.29-.98 .16-.16-.16 .16-.98 1.29-1.03 1.46 '
            '.51 .36 .8 .39 .96 .32 1.11 .29 1.29 .26 3.21 .56-3.21 .56-1.29 .26-1.11 .29-.96 .32-.8 .39-.51 .36 1.03 1.46 '
            '.98 1.29 .16 .16-.16-.16-1.29-.98-1.46-1.03-.36 .51-.39 .8-.32 .96-.29 1.11-.26 1.29-.56 3.21-.56-3.21-.26-1.29'
            '-.29-1.11-.32-.96-.39-.8-.36-.51-1.46 1.03-1.29 .98-.16 .16 .16-.16 .98-1.29 1.03-1.46-.51-.36-.79-.39-.97-.32'
            '-1.11-.29-1.29-.26-3.21-.56 3.21-.56 1.29-.26 1.11-.29 .97-.32 .79-.39 .51-.36-1.03-1.46-.98-1.29-.16-.16 .16 '
            '.16 1.29 .98 1.46 1.03 .36-.51 .39-.8 .32-.96 .29-1.11 .26-1.29 .56-3.21z')


# ---------- Utilidades ----------

def cargar(nombre):
    """Una copia de una imagen de bocetos/instagram/imagenes/ como RGBA de 0 a 1, recortada a lo que se ve."""
    a = np.asarray(Image.open(IMAGENES / f'{nombre}.webp').convert('RGBA'), np.float32) / 255
    # los restos casi transparentes del recorte dejan un recuadro en la sombra: se quitan
    a[..., 3] = np.where(a[..., 3] < 0.1, 0, a[..., 3])
    ys, xs = np.nonzero(a[..., 3] > 0.02)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def escala(a, k):
    h, w = a.shape[:2]
    return cv2.resize(a, (max(1, round(w * k)), max(1, round(h * k))), interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC)


def lienzo(w, h, color):
    return np.ones((h, w, 3), np.float32) * np.asarray(color, np.float32)


def pegar(fondo, pieza, x, y):
    """Pone una pieza RGBA sobre el fondo RGB en (x, y), recortando lo que se sale."""
    h, w = pieza.shape[:2]
    H, W = fondo.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return fondo
    p = pieza[y0 - y:y1 - y, x0 - x:x1 - x]
    a = p[..., 3:4]
    fondo[y0:y1, x0:x1] = fondo[y0:y1, x0:x1] * (1 - a) + p[..., :3] * a
    return fondo


def alfa_en(fondo_shape, pieza, x, y):
    """La transparencia de la pieza puesta en (x, y), del tamaño del fondo."""
    H, W = fondo_shape[:2]
    m = np.zeros((H, W), np.float32)
    h, w = pieza.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 > x0 and y1 > y0:
        m[y0:y1, x0:x1] = pieza[y0 - y:y1 - y, x0 - x:x1 - x, 3]
    return m


def lum(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)


def suave(x, sigma):
    return cv2.GaussianBlur(x, (0, 0), sigma) if sigma > 0 else x


def ruido(h, w, tam, seed, octavas=4):
    """Ruido suave de 0 a 1: manchas del tamaño tam (en píxeles) con detalle más fino encima."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octavas):
        s = max(1.0, tam / 2 ** o)
        gh, gw = int(h / s) + 3, int(w / s) + 3
        g = rng.random((gh, gw), dtype=np.float32)
        out += amp * cv2.resize(g, (int(gw * s), int(gh * s)), interpolation=cv2.INTER_CUBIC)[:h, :w]
        total += amp
        amp *= 0.5
    out /= total
    return (out - out.min()) / max(1e-6, out.max() - out.min())


def curva(x, contraste=1.0, centro=0.5):
    """Una S: más contraste alrededor del centro, sin pasarse de 0 a 1."""
    y = 0.5 + 0.5 * np.tanh(contraste * (x - centro) * 2) / math.tanh(contraste)
    return np.clip(y, 0, 1)


def grano(img, fuerza=0.05, seed=0, tam=0.0):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, img.shape[:2]).astype(np.float32)
    if tam > 0:
        n = suave(n, tam) * (1 + 2 * tam)
    return np.clip(img + fuerza * n[..., None], 0, 1)


def rayas(img, seed, n=12, polvo=160, color=(1, 1, 1), fuerza=0.55):
    """Rayas finas y motas de polvo, como en una copia vieja escaneada."""
    h, w = img.shape[:2]
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    rng = np.random.default_rng(seed)
    for _ in range(n):
        x0, y0 = rng.random() * w, rng.random() * h
        ang = rng.normal(math.pi / 2, 0.2) if rng.random() < 0.6 else rng.random() * math.pi
        largo = rng.uniform(0.08, 0.5) * h
        d.line([(x0, y0), (x0 + largo * math.cos(ang), y0 + largo * math.sin(ang))], fill=int(rng.uniform(70, 190)), width=1)
    for _ in range(polvo):
        x, y, r = rng.random() * w, rng.random() * h, rng.uniform(0.5, 2.2)
        d.ellipse([x - r, y - r, x + r, y + r], fill=int(rng.uniform(90, 230)))
    a = np.asarray(m, np.float32)[..., None] / 255 * fuerza
    return img * (1 - a) + np.asarray(color, np.float32) * a


def estrella(tam):
    """La estrella de la marca como máscara de tam × tam, de 0 a 1."""
    nums = [float(v) for v in re.findall(r'-?\d*\.\d+|-?\d+', ESTRELLA)]
    x, y = nums[0], nums[1]
    pts = [(x, y)]
    for i in range(2, len(nums) - 1, 2):
        x += nums[i]
        y += nums[i + 1]
        pts.append((x, y))
    k = 4
    s = tam * k / 24
    m = Image.new('L', (tam * k, tam * k), 0)
    ImageDraw.Draw(m).polygon([(px * s, py * s) for px, py in pts], fill=255)
    return np.asarray(m.resize((tam, tam), Image.LANCZOS), np.float32) / 255


def estrella_en(w, h, cx, cy, tam):
    """La máscara de la estrella de tam × tam puesta con el centro en (cx, cy), del tamaño w × h."""
    capa = np.zeros((h, w), np.float32)
    m = estrella(tam)
    x, y = int(cx - tam / 2), int(cy - tam / 2)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(w, x + tam), min(h, y + tam)
    if x1 > x0 and y1 > y0:
        capa[y0:y1, x0:x1] = m[y0 - y:y1 - y, x0 - x:x1 - x]
    return capa


def brillo_estrella(img, cx, cy, tam, color, halo=(1, 1, 1), fuerza=1.0):
    """La estrella con su resplandor: el núcleo del color, un halo claro alrededor y un destello en cruz."""
    h, w = img.shape[:2]
    capa = estrella_en(w, h, cx, cy, tam)
    # el resplandor es blando, así que se calcula a un cuarto del tamaño y se agranda: sale igual y mucho más rápido
    q = cv2.resize(capa, (max(1, w // 4), max(1, h // 4)), interpolation=cv2.INTER_AREA)
    q = suave(q, tam * 0.02) * 0.9 + suave(q, tam * 0.0625) * 0.7 + suave(q, tam * 0.175) * 0.5
    resplandor = cv2.resize(q, (w, h), interpolation=cv2.INTER_LINEAR)
    out = img + np.asarray(halo, np.float32) * np.clip(resplandor * fuerza, 0, 1)[..., None] * (1 - img)
    a = np.clip(capa * 1.2, 0, 1)[..., None]
    return np.clip(out * (1 - a) + np.asarray(color, np.float32) * a, 0, 1)


def mapa(v, paradas):
    """Pinta un valor de 0 a 1 con un degradé de [(posición, color), ...]."""
    pos = np.array([p for p, _ in paradas], np.float32)
    cols = np.array([c for _, c in paradas], np.float32)
    out = np.empty(v.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(v, pos, cols[:, c])
    return out


def contorno(alfa, grosor, separacion, seed, adentro=False):
    """Una línea blanca que sigue la silueta de la pieza, temblorosa, como la de la referencia: un poco afuera o, con
    adentro, un poco adentro, encima de la prenda."""
    m = (alfa > 0.5).astype(np.uint8)
    k = max(1, int(separacion))
    elemento = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1))
    m = cv2.erode(m, elemento) if adentro else cv2.dilate(m, elemento)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    lienzo_l = np.zeros(alfa.shape, np.uint8)
    rng = np.random.default_rng(seed)
    for c in cs:
        if len(c) < 50:
            continue
        pts = c[:, 0, :].astype(np.float32)
        # temblor suave a lo largo del contorno
        t = np.arange(len(pts))
        ruido_l = np.cumsum(rng.normal(0, 0.5, (len(pts), 2)), 0)
        ruido_l -= np.linspace(0, 1, len(pts))[:, None] * ruido_l[-1]
        pts = pts + suave(ruido_l.reshape(-1, 1, 2), 6).reshape(-1, 2) * 0.6
        cv2.polylines(lienzo_l, [pts.astype(np.int32).reshape(-1, 1, 2)], True, 255, int(grosor), cv2.LINE_AA)
    return lienzo_l.astype(np.float32) / 255


def fuga(h, w, cx, cy, radio, color, seed=0):
    """Una fuga de luz (la luz que se cuela): un manchón blando del color, de borde irregular, con el centro que se
    quema casi blanco y los canales un poco corridos en el borde, como un lente."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    rng = np.random.default_rng(seed)
    ang = rng.uniform(0, math.pi)
    sx = 1 + rng.uniform(0.2, 1.0)
    dx, dy = x - cx, y - cy
    rx = (dx * math.cos(ang) + dy * math.sin(ang)) / sx
    ry = (-dx * math.sin(ang) + dy * math.cos(ang))
    r = np.sqrt(rx * rx + ry * ry) / radio
    # el borde no es redondo: el radio cambia con el ruido
    r = r * (0.8 + 0.45 * ruido(h, w, radio * 0.9, seed + 3, 2))
    col = np.asarray(color, np.float32)
    out = np.zeros((h, w, 3), np.float32)
    for c, k in zip(range(3), (0.93, 1.0, 1.09)):
        out[..., c] = col[c] * np.exp(-((r * k) / 0.85) ** 2) * 0.95
    nucleo = np.exp(-(r / 0.32) ** 2)
    out += np.array([1, 0.96, 0.88], np.float32) * nucleo[..., None] * 0.8
    return out


def pantalla(base, luz):
    """Mezcla en modo pantalla: la luz aclara sin quemar del todo."""
    return 1 - (1 - base) * (1 - np.clip(luz, 0, 1))


def colar(img, luz, fuerza=1.0):
    """La luz que se cuela: sobre lo oscuro aclara (pantalla) y sobre lo claro tiñe del color (multiplica), como una
    fuga de luz en una copia de papel."""
    luz = np.clip(luz * fuerza, 0, 1)
    s = luz.max(axis=2, keepdims=True)
    c = luz / np.maximum(s, 1e-4)
    k = lum(img)[..., None]
    return pantalla(img, luz) * (1 - k) + img * (1 - s * (1 - c)) * k


def guardar(img, ruta, w=1080, h=1350, calidad=92):
    im = Image.fromarray(np.clip(img * 255, 0, 255).round().astype(np.uint8))
    if im.size != (w, h):
        im = im.resize((w, h), Image.LANCZOS)
    im.save(ruta, quality=calidad, optimize=True)
    return ruta


# ---------- Los procesos ----------

def negativo(pieza, w, h, tinta=AZUL_HONDO, seed=1, estrella_en=None, zoom=1.0, foco=(0.5, 0.5)):
    """El negativo sobre papel hueso con manchas de tinta (ref. del ojo): lo claro de la prenda sale oscuro, el fondo sale
    papel, y la tinta cae en manchones con su halo blanco. estrella_en: (x, y) en 0 a 1 donde va la estrella."""
    base = lienzo(w, h, (0, 0, 0))
    p = escala(pieza, zoom * min(w / pieza.shape[1], h / pieza.shape[0]))
    x = int(w * foco[0] - p.shape[1] * foco[0])
    y = int(h * foco[1] - p.shape[0] * foco[1])
    base = pegar(base, p, x, y)
    v = 1 - curva(lum(base), 1.6, 0.45)          # el negativo: 1 = papel, 0 = tinta negra
    v = suave(v, 0.6)
    img = mapa(v, [(0, CARBON * 0.9), (0.35, hexa('#4a4744')), (0.7, hexa('#b9b0a1')), (1, HUESO)])
    # los manchones de tinta: unos grandes y blandos, otros chicos y redondos
    n = ruido(h, w, w * 0.35, seed, 3)
    manchas = np.clip((n - 0.66) * 9, 0, 1)
    rng = np.random.default_rng(seed + 7)
    puntos = np.zeros((h, w), np.float32)
    for _ in range(26):
        cx, cy, r = rng.random() * w, rng.random() * h, rng.uniform(4, 22)
        cv2.circle(puntos, (int(cx), int(cy)), int(r), 1.0, -1, cv2.LINE_AA)
    manchas = np.clip(np.maximum(manchas, puntos), 0, 1)
    manchas = suave(manchas, 2.2)
    halo = np.clip(suave(manchas, 14) * 1.8 - manchas * 1.4, 0, 1)
    img = img + (np.array([1, 1, 1], np.float32) - img) * (halo * 0.85)[..., None]
    tinta_c = np.asarray(tinta, np.float32)
    tono = mapa(v, [(0, tinta_c * 0.45), (0.6, tinta_c), (1, tinta_c * 0.75 + 0.25)])
    img = img * (1 - manchas[..., None]) + tono * manchas[..., None]
    # anillos sueltos, como el de la referencia
    for _ in range(3):
        cx, cy, r = rng.random() * w, rng.random() * h, rng.uniform(16, 40)
        anillo = np.zeros((h, w), np.float32)
        cv2.circle(anillo, (int(cx), int(cy)), int(r), 1.0, 3, cv2.LINE_AA)
        img = img * (1 - anillo[..., None] * 0.8) + np.ones(3, np.float32) * anillo[..., None] * 0.8
    if estrella_en:
        img = brillo_estrella(img, estrella_en[0] * w, estrella_en[1] * h, int(w * 0.11), tinta_c, fuerza=0.9)
    img = rayas(img, seed, n=10, polvo=140, color=CARBON, fuerza=0.35)
    img = rayas(img, seed + 1, n=6, polvo=90, color=(1, 1, 1), fuerza=0.7)
    return grano(img, 0.035, seed, 0.6)


def torcido(h, w, seed, tam, fuerza):
    """Un remolino: las coordenadas de cada punto, corridas dos veces por ruido que se corre a sí mismo (como tinta
    revuelta en agua). Devuelve mapx, mapy para cv2.remap."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    n = [ruido(h, w, tam, seed + 13 * i, 4) - 0.5 for i in range(4)]
    qx, qy = n[0], n[1]
    px, py = xx + fuerza * qx, yy + fuerza * qy
    rx = cv2.remap(n[2], px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    ry = cv2.remap(n[3], px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return xx + fuerza * 1.6 * rx, yy + fuerza * 1.6 * ry


def marmol(pieza, w, h, seed=2, fuerza=0.32, bandas=5.0, margen=0.07, papel=True):
    """La prenda derretida en mármol blanco y negro (ref. del remolino): la luz de la prenda se revuelve en remolinos y
    queda en vetas negras y blancas de borde nítido. Con papel, la mancha queda sobre papel con el borde de arriba
    ondulado y márgenes, como una página."""
    base = lienzo(w, h, (0, 0, 0))
    p = escala(pieza, 1.2 * max(w / pieza.shape[1], h / pieza.shape[0]))
    base = pegar(base, p, (w - p.shape[1]) // 2, (h - p.shape[0]) // 2)
    L = suave(lum(base), 2)
    mx, my = torcido(h, w, seed, w * 0.42, w * fuerza)
    Lw = cv2.remap(L, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    f = cv2.remap(ruido(h, w, w * 0.5, seed + 5, 3), mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    # las vetas: la luz de la prenda y el remolino se doblan en bandas; el contraste las deja en blanco y negro
    fase = bandas * (0.9 * Lw + 0.6 * f) * 2 * math.pi
    v = 0.5 + 0.5 * np.sin(fase)
    v = curva(v, 3.2, 0.5)
    v = np.clip(v * (0.75 + 0.5 * curva(Lw, 1.5, 0.35)), 0, 1)
    img = mapa(v, [(0, CARBON * 0.7), (0.45, hexa('#3b3a38')), (0.62, hexa('#bdbab3')), (1, hexa('#f4f2ed'))])
    if papel:
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        # el borde de arriba ondulado, como la tinta cuando se escurre: ondas de distinto alto
        xs = np.linspace(0, 1, w, dtype=np.float32)
        n1 = ruido(1, w, w * 0.12, seed + 9, 2)[0]
        borde = h * (margen + 0.07) - h * 0.05 * np.abs(np.sin(xs * 6.5 * math.pi + n1 * 2)) * (0.5 + n1) - h * 0.02 * n1
        zona = (yy > borde[None, :]) & (yy < h * (1 - margen * 2.2)) & (xx > w * margen) & (xx < w * (1 - margen))
        zona = suave(zona.astype(np.float32), 1.0)[..., None]
        img = lienzo(w, h, hexa('#f3f1ec')) * (1 - zona) + img * zona
    img = rayas(img, seed, n=4, polvo=120, color=CARBON, fuerza=0.3)
    return grano(img, 0.05, seed, 0.7)


def fantasma(pieza, w, h, color=AZUL, seed=3, corrido=0.22, zoom=0.85, intensidad=1.0):
    """La prenda como luz que se corre sobre negro (ref. de la figura azul): su luz en el color, un arrastre de lado,
    líneas de barrido y un resplandor."""
    base = lienzo(w, h, (0, 0, 0))
    p = escala(pieza, zoom * min(w / pieza.shape[1], h / pieza.shape[0]))
    x, y = (w - p.shape[1]) // 2, (h - p.shape[0]) // 2
    base = pegar(base, p, x, y)
    a = alfa_en(base.shape, p, x, y)
    v = curva(lum(base), 1.2, 0.42) * a * intensidad
    # el arrastre: cada fila se corre distinto, como un escáner que se movió
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    corrimiento = (ruido(h, 1, h * 0.08, seed, 3)[:, 0] - 0.5) * w * corrido
    mx = xx - corrimiento[:, None] * (0.4 + 0.6 * ruido(h, w, w * 0.5, seed + 1, 2))
    arrastre = cv2.remap(v, mx, yy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    estela = cv2.blur(np.maximum(v, arrastre), (int(w * 0.09) | 1, 1))
    v = np.maximum(np.maximum(v * 0.8, arrastre * 0.9), estela * 0.75)
    v = v + (suave(v, w * 0.02) * 0.6 + suave(v, w * 0.07) * 0.5) * intensidad
    lineas = 1 - 0.18 * ((np.arange(h) % 4) < 1).astype(np.float32)[:, None]
    v = np.clip(v * lineas, 0, 1.4)
    c = np.asarray(color, np.float32)
    img = mapa(np.clip(v / 1.2, 0, 1), [(0, np.zeros(3)), (0.25, c * 0.28), (0.6, c), (0.85, c * 0.5 + 0.5), (1, np.ones(3))])
    return grano(img, 0.03, seed, 0.5)


def luz_roja(pieza, w, h, seed=4, papel=False, zoom=1.0, foco=(0.5, 0.5), celda=2):
    """La copia roja de grano suelto (ref. de la pieza roja): la luz en rojo, la sombra en negro y los brillos en blanco,
    con puntos sueltos en vez de grises y un relieve en los bordes. Con papel, es tinta roja y negra sobre hueso."""
    base = lienzo(w, h, (1, 1, 1) if papel else (0, 0, 0))
    p = escala(pieza, zoom * min(w / pieza.shape[1], h / pieza.shape[0]))
    x = int(w * foco[0] - p.shape[1] * foco[0])
    y = int(h * foco[1] - p.shape[0] * foco[1])
    base = pegar(base, p, x, y)
    L = suave(lum(base), 0.8)
    # relieve: los bordes que miran a la luz se encienden
    gx = cv2.Sobel(L, cv2.CV_32F, 1, 0, ksize=5)
    gy = cv2.Sobel(L, cv2.CV_32F, 0, 1, ksize=5)
    relieve = np.clip(-(gx * 0.6 + gy * 0.8) * 0.02, 0, 1)
    L = np.clip(curva(L, 1.4, 0.45) + relieve * 0.9, 0, 1)
    # grano suelto: cada celda se decide sola contra un azar, así los grises quedan en puntos
    hc, wc = h // celda + 1, w // celda + 1
    rng = np.random.default_rng(seed)
    t1 = cv2.resize(rng.random((hc, wc), dtype=np.float32), (wc * celda, hc * celda), interpolation=cv2.INTER_NEAREST)[:h, :w]
    t2 = cv2.resize(rng.random((hc, wc), dtype=np.float32), (wc * celda, hc * celda), interpolation=cv2.INTER_NEAREST)[:h, :w]
    if papel:
        negro = L < t1 * 0.38
        rojo = ~negro & (L < 0.42 + 0.5 * t2)
        img = lienzo(w, h, HUESO)
        img[rojo] = CARMIN * 0.92 + 0.08
        img[negro] = CARBON
    else:
        rojo = L > t1 * 0.7
        blanco = L > 0.62 + 0.38 * t2
        img = lienzo(w, h, hexa('#120606'))
        img[rojo] = ROJO_LUZ
        img[blanco] = hexa('#ffe6dc')
    img = suave(img, 0.5)
    return grano(img, 0.02, seed, 0.4)


def cianotipia(pieza, w, h, seed=5, zoom=0.9):
    """La prenda como cianotipia: azul de Prusia y la silueta en blanco, donde la prenda tapó la luz; lo que deja pasar la
    luz (lo calado, lo fino) queda celeste. El papel lleva el borde de la emulsión pintada a brochazos."""
    base = lienzo(w, h, (0, 0, 0))
    p = escala(pieza, zoom * min(w / pieza.shape[1], h / pieza.shape[0]))
    x, y = (w - p.shape[1]) // 2, (h - p.shape[0]) // 2
    base = pegar(base, p, x, y)
    a = alfa_en(base.shape, p, x, y)
    L = lum(base)
    tapa = np.clip(a * (0.55 + 0.6 * curva(L, 1.2, 0.4)), 0, 1)
    tapa = suave(tapa, 1.6)
    azul_prusia = hexa('#123a6e')
    img = mapa(tapa, [(0, azul_prusia * 0.8), (0.35, azul_prusia), (0.7, hexa('#7fa6cf')), (1, hexa('#eef3f6'))])
    # la emulsión: más oscura y despareja, con los brochazos del borde
    n = ruido(h, w, w * 0.12, seed, 4)
    img = img * (0.86 + 0.2 * n[..., None])
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    borde = np.minimum.reduce([xx, yy, w - xx, h - yy]) / w
    pincel = borde + 0.05 * (ruido(h, w, w * 0.03, seed + 2, 3) - 0.5) + 0.03 * np.sin(yy / 23 + n * 6) * 0.3
    emulsion = np.clip((pincel - 0.045) * 60, 0, 1)[..., None]
    papel = lienzo(w, h, HUESO)
    img = papel * (1 - emulsion) + img * emulsion
    img = rayas(img, seed, n=6, polvo=120, color=(1, 1, 1), fuerza=0.4)
    return grano(img, 0.03, seed, 0.6)


def escaneo(piezas, w, h, colores, seed=6, oscuro=False, linea=True, luz_fuerza=None):
    """El escaneo en blanco y negro con fugas de luz (ref. de las montañas): una o dos prendas, una encima de la otra como
    doble exposición, con bandas de escáner, polvo, una línea blanca que sigue la silueta y fugas de luz de colores.
    piezas: [(pieza RGBA, x, y, zoom), ...] con x, y en 0 a 1 (centro)."""
    fondo = (0.06, 0.06, 0.06) if oscuro else (0.93, 0.93, 0.92)
    img = lienzo(w, h, fondo)
    alfas = np.zeros((h, w), np.float32)
    for i, (pz, cx, cy, zoom) in enumerate(piezas):
        p = escala(pz, zoom * min(w / pz.shape[1], h / pz.shape[0]))
        x, y = int(cx * w - p.shape[1] / 2), int(cy * h - p.shape[0] / 2)
        capa = lienzo(w, h, (0, 0, 0))
        capa = pegar(capa, p, x, y)
        a = alfa_en(img.shape, p, x, y)
        g = curva(lum(capa), 2.4, 0.42)[..., None] * np.ones(3, np.float32)
        opac = 0.92 if i == 0 else 0.55
        if oscuro:
            img = img * (1 - a[..., None] * opac) + g * a[..., None] * opac
        else:
            # sobre papel claro la prenda entra como sombra: oscurece
            img = img * (1 - a[..., None] * opac) + (g * 0.85) * a[..., None] * opac
        alfas = np.maximum(alfas, a)
    # bandas del escáner y un poco de arrastre horizontal
    filas = (ruido(h, 1, h * 0.01, seed, 2)[:, 0] - 0.5) * 0.08
    img = np.clip(img + filas[:, None, None], 0, 1)
    img = cv2.blur(img, (7, 1)) * 0.35 + img * 0.65
    if linea:
        # sobre papel la línea va por dentro de la prenda, encima de lo oscuro; de noche, por fuera
        l = contorno(alfas, 5, w * 0.018, seed, adentro=not oscuro)
        img = img * (1 - l[..., None]) + np.ones(3, np.float32) * l[..., None]
    rng = np.random.default_rng(seed)
    luz = np.zeros_like(img)
    for i, color in enumerate(colores):
        cx = rng.choice([rng.uniform(-0.05, 0.22), rng.uniform(0.78, 1.05)]) * w
        cy = rng.uniform(0.1, 0.9) * h
        luz += fuga(h, w, cx, cy, rng.uniform(0.14, 0.26) * w, color, seed + i)
    img = colar(img, luz, luz_fuerza or (0.9 if oscuro else 0.85))
    img = rayas(img, seed, n=12, polvo=180, color=(1, 1, 1) if oscuro else CARBON, fuerza=0.45)
    return grano(img, 0.045, seed, 0.6)


def estudio(pieza, w=1600, h=2000, alto=0.8, ancho=0.84, fuera_arriba=0.0):
    """La prenda limpia, como foto de producto: centrada sobre carbón con la luz suave del centro y una sombra suave,
    sin el estampado de logos (tiene letras). fuera_arriba deja esa parte de arriba de la prenda fuera de cuadro."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((x - 0.5 * w) / (0.7 * w), (y - 0.46 * h) / (0.7 * h))
    luz = np.clip(1 - d, 0, 1) ** 1.5
    fondo = CARBON + (hexa('#2a2825') - CARBON) * luz[..., None]
    k = min(alto * h / pieza.shape[0], ancho * w / pieza.shape[1]) * (1 + fuera_arriba)
    p = escala(pieza, k)
    px = (w - p.shape[1]) // 2
    py = (h - p.shape[0]) // 2 if not fuera_arriba else -round(fuera_arriba * p.shape[0])
    a = alfa_en((h, w), p, px, py + round(0.012 * h))
    sombra = suave(a, 0.018 * w) * 0.55
    fondo = fondo * (1 - sombra[..., None])
    return grano(pegar(fondo, p, px, py), 0.012, 9, 0.4)


def plata(pieza, w, h, seed=7, zoom=0.86, fuga_color=None):
    """La prenda en plata de noche: blanco y negro de mucho contraste sobre negro, los blancos un poco fríos como el
    metal, una viñeta y, si se pide, una fuga de luz tenue de un color."""
    img = lienzo(w, h, (0, 0, 0))
    p = escala(pieza, zoom * min(w / pieza.shape[1], h / pieza.shape[0]))
    x, y = (w - p.shape[1]) // 2, (h - p.shape[0]) // 2
    img = pegar(img, p, x, y)
    v = np.clip(curva(lum(img), 2.2, 0.36) * 1.12, 0, 1)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    vin = np.clip(1.15 - np.hypot((xx - w / 2) / w, (yy - h / 2) / h) * 1.25, 0, 1)
    v = v * vin
    img = mapa(v, [(0, np.zeros(3)), (0.4, hexa('#2c2d30')), (0.8, hexa('#b9bcc2')), (1, hexa('#f4f6f9'))])
    img = img + suave(np.clip(v - 0.75, 0, 1), w * 0.01)[..., None] * 0.35
    if fuga_color is not None:
        img = pantalla(img, fuga(h, w, w * 0.92, h * 0.18, w * 0.3, fuga_color, seed) * 0.6)
    img = rayas(img, seed, n=8, polvo=140, color=(1, 1, 1), fuerza=0.35)
    return grano(img, 0.04, seed, 0.6)


def tonificar(img, color, fuerza=0.55):
    """Vira el blanco y negro hacia un color, como una copia virada al sepia: las sombras se quedan, los medios toman
    el color y las luces quedan papel."""
    v = lum(img)
    c = np.asarray(color, np.float32)
    tono = mapa(v, [(0, CARBON), (0.5, c * 0.75), (1, HUESO)])
    return img * (1 - fuerza) + tono * fuerza
