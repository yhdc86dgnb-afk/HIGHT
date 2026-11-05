#!/usr/bin/env python3
"""Los 20 posts del desfile de HIGHT, en 1080 × 1350: solo la ropa en la pasarela, sin una sola letra.

Las salidas son fotos generadas con IA en Canva a partir de las prendas reales de la tienda, con modelos de rasgos,
estaturas y orígenes distintos. Canva las entrega en hojas de varias salidas (fuentes/pasarela-*.jpg); tomas.json dice
dónde está cada una. Aquí no se pasan por ningún proceso que tape la ropa: todas llevan el mismo color de archivo (los
negros apenas levantados, el color un poco lavado y grano de película) para que el desfile se vea como una sola noche.

Las caras van tapadas, como en las referencias de la campaña: cada una con un rectángulo hecho de un pedazo del fondo
de la misma foto, tomado al lado de la cabeza y pegado con bordes duros, de las cejas a debajo de la boca. La barbilla
queda a la vista. fuentes/caras.json dice dónde está cada cara (lo arma caras.py); las espaldas y los detalles no llevan
barra. Solo cambian las caras: la ropa queda igual.

Los posts alternan, para que la cuadrícula del perfil quede en tablero:
  impares  noche: varias salidas seguidas sobre negro, como se ven en la pasarela.
  pares    papel: una sola salida, o un detalle, como una copia de archivo con su margen.
El último reúne una salida de cada conjunto, como el final de un desfile.

Deja posts/01.jpg a 20.jpg y vista-previa.jpg al lado. Las descripciones están en textos.md.
Uso, desde la raíz del repo: python3 bocetos/desfile/posts.py [número ...]
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent / 'lanzamiento-sin-texto'))
import procesos as pr  # noqa: E402

W, H = 1080, 1350
FUENTES = AQUI / 'fuentes'
SALIDA = AQUI / 'posts'
TOMAS = json.loads((FUENTES / 'tomas.json').read_text())
PAPEL = pr.hexa('#ece3d0')
NOCHE = pr.hexa('#0b0a09')
# en las hojas nuevas las líneas que separan las salidas son más gruesas: se recorta un poco más
MARGEN = {'trouble-maker-patchwork': 8, 'multitud-destroyed': 5, 'anillos-fleco': 5, 'celula-dragon': 5}
CARAS = json.loads((FUENTES / 'caras.json').read_text())
BORDE = 8  # los pedazos de fondo no se toman del borde de la toma, donde queda la línea que separa las salidas

_hojas = {}


def toma(nombre):
    """Una salida de su hoja, como RGB de 0 a 1, sin el borde de la línea que la separa de las otras y con las caras
    tapadas."""
    t = TOMAS[nombre]
    if t['collage'] not in _hojas:
        _hojas[t['collage']] = np.asarray(Image.open(FUENTES / f"pasarela-{t['collage']}.jpg").convert('RGB'), np.float32) / 255
    m = MARGEN.get(t['collage'], 3)
    img = _hojas[t['collage']][t['y'] + m:t['y'] + t['h'] - m, t['x'] + m:t['x'] + t['w'] - m].copy()
    caras = [{'x': c['x'] - m, 'y': c['y'] - m, 'w': c['w'], 'h': c['h'], 'puntos': [[x - m, y - m] for x, y in c['puntos']]}
             for c in CARAS.get(nombre, [])]
    return tapar(img, caras) if caras else img


# ---------- Las caras tapadas ----------

def barras(caras):
    """La barra de cada cara, puesta por los ojos y la boca para que siga a las cabezas inclinadas y de perfil: de las
    cejas a debajo de la boca, y 1,75 veces el ancho de la cara."""
    out = []
    for c in caras:
        p = c['puntos']
        ojos = (p[0][1] + p[1][1]) / 2
        d = p[3][1] - ojos
        cx = 0.5 * (c['x'] + c['w'] / 2) + 0.5 * np.mean([p[0][0], p[1][0], p[2][0], p[3][0]])
        out.append((cx - c['w'] * 0.875, ojos - 0.45 * d, cx + c['w'] * 0.875, p[3][1] + 0.6 * d))
    return out


def sumas(integral, bh, bw):
    """La suma de cada ventana de bh × bw, para todas sus esquinas a la vez."""
    I = integral
    return I[bh:, bw:] - I[:-bh, bw:] - I[bh:, :-bw] + I[:-bh, :-bw]


def tapar(img, caras):
    """Tapa cada cara con un pedazo del fondo de la misma foto, a la altura de la cara y pegado con bordes duros. Se
    escoge el pedazo más liso que tenga el tono del fondo alrededor de la cabeza y que no pise ninguna cara; si no cabe
    uno del ancho de la barra, uno más angosto se repite en espejo, y si tampoco, la barra va lisa del tono del fondo."""
    H, W = img.shape[:2]
    out = img.copy()
    gris = img.mean(2)
    energia = np.hypot(cv2.Sobel(gris, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(gris, cv2.CV_32F, 0, 1, ksize=3))
    E = cv2.integral(energia.astype(np.float64))
    C, C2 = cv2.integral2(gris.astype(np.float64))[:2]
    lista = barras(caras)
    prohibido = np.zeros((H, W), np.uint8)
    for c, (bx0, by0, bx1, by1) in zip(caras, lista):
        ex, ey = 0.3 * c['w'], 0.3 * c['h']
        prohibido[max(0, int(c['y'] - ey)):max(0, int(c['y'] + c['h'] + ey)),
                  max(0, int(c['x'] - ex)):max(0, int(c['x'] + c['w'] + ex))] = 1
        prohibido[max(0, int(by0)):max(0, int(by1) + 1), max(0, int(bx0)):max(0, int(bx1) + 1)] = 1
    prohibido[:BORDE] = prohibido[-BORDE:] = 1
    prohibido[:, :BORDE] = prohibido[:, -BORDE:] = 1
    P = cv2.integral(prohibido).astype(np.float64)
    quieto = energia < 0.06
    usados = []
    for bx0, by0, bx1, by1 in lista:
        x0, y0 = int(round(max(0, bx0))), int(round(max(0, by0)))
        x1, y1 = int(round(min(W, bx1))), int(round(min(H, by1)))
        bw, bh = x1 - x0, y1 - y0
        if bw < 3 or bh < 3:
            continue
        # el tono del fondo a la altura de la cara: lo liso que hay a los lados, sin caras
        zona = np.zeros((H, W), bool)
        zona[y0:y1, max(0, x0 - 2 * bw):min(W, x1 + 2 * bw)] = True
        zona &= (prohibido == 0) & quieto
        tono = np.median(gris[zona]) if zona.sum() > 30 else np.median(gris[y0:y1, x0:x1])
        # ni una raya de luz: el pedazo no puede tener puntos mucho más claros u oscuros que el fondo
        R = cv2.integral((np.abs(gris - tono) > 0.15).astype(np.uint8)).astype(np.float64)
        pedazo = None
        for partes in (1, 2, 3, 4):
            pw = max(3, bw // partes)
            n = pw * bh
            e = sumas(E, bh, pw) / n
            media = sumas(C, bh, pw) / n
            s = np.sqrt(np.maximum(sumas(C2, bh, pw) / n - media * media, 0))
            pisa = sumas(P, bh, pw)
            raros = sumas(R, bh, pw)
            sy, sx = np.mgrid[0:e.shape[0], 0:e.shape[1]]
            puntaje = e + 1.2 * np.abs(media - tono) + 1.5 * s + 0.05 * np.abs(sx - x0) / W
            lejos = np.abs(sy - y0) > max(6, 0.5 * bh)
            malo = (pisa > 0) | lejos | (np.abs(media - tono) > 0.1) | (e > 0.09) | (s > 0.07) | (raros > 0.002 * n)
            puntaje[malo] = np.inf
            for ux, uy in usados:  # que dos barras no repitan el mismo pedazo
                puntaje[max(0, uy - bh // 2):uy + bh // 2 + 1, max(0, ux - pw // 2):ux + pw // 2 + 1] = np.inf
            i = np.unravel_index(np.argmin(puntaje), puntaje.shape)
            if np.isfinite(puntaje[i]):
                base = img[i[0]:i[0] + bh, i[1]:i[1] + pw]
                pedazo = np.concatenate([base if k % 2 == 0 else base[:, ::-1] for k in range(partes + 1)], 1)[:, :bw]
                usados.append((i[1], i[0]))
                break
        if pedazo is None:
            ruido = np.random.default_rng(x0 * 31 + y0).normal(0, 0.012, (bh, bw, 1)).astype(np.float32)
            color = np.median(img[zona], 0) if zona.sum() > 30 else np.full(3, tono, np.float32)
            pedazo = np.clip(color[None, None] + ruido, 0, 1)
        out[y0:y1, x0:x1] = pedazo
    return out


def cubrir(img, w, h, foco=(0.5, 0.45)):
    """La salida escalada para cubrir w × h, recortada alrededor del foco, con un poco de nitidez al agrandarla."""
    ih, iw = img.shape[:2]
    k = max(w / iw, h / ih)
    nw, nh = max(w, round(iw * k)), max(h, round(ih * k))
    out = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LANCZOS4 if k > 1 else cv2.INTER_AREA)
    if k > 1.2:
        blando = cv2.GaussianBlur(out, (0, 0), 0.6 * k)
        out = np.clip(out + 0.45 * (out - blando), 0, 1)
    x = int(np.clip(foco[0] * nw - w / 2, 0, nw - w))
    y = int(np.clip(foco[1] * nh - h / 2, 0, nh - h))
    return out[y:y + h, x:x + w]


def color(img, seed):
    """El color del desfile: un poco de contraste, los negros apenas levantados, sombras frías y luces tibias, el color
    un poco lavado y el grano de una copia de película. La ropa conserva su color."""
    L = pr.lum(img)[..., None]
    img = L + (img - L) * 0.92
    img = 0.5 + 0.5 * np.tanh(1.15 * (img - 0.5) * 2) / math.tanh(1.15)
    sombra = np.clip(1 - L * 2.2, 0, 1)
    luz = np.clip(L * 1.8 - 0.8, 0, 1)
    img = img + sombra * np.array([-0.004, 0.0, 0.014], np.float32) + luz * np.array([0.012, 0.004, -0.008], np.float32)
    img = 0.03 + img * 0.96
    return pr.grano(np.clip(img, 0, 1), 0.028, seed, 0.6)


def papel(seed):
    img = pr.lienzo(W, H, PAPEL) * (0.96 + 0.05 * pr.ruido(H, W, W * 0.3, seed, 4)[..., None])
    return pr.rayas(img, seed, n=3, polvo=70, color=pr.CARBON, fuerza=0.18)


def noche(seed):
    return pr.grano(pr.lienzo(W, H, NOCHE), 0.012, seed, 0.6)


def pegar(fondo, foto, x, y, borde=0):
    """Pega una foto; con borde, como una copia de papel con su margen y una sombra suave."""
    h, w = foto.shape[:2]
    if borde:
        marco = pr.lienzo(w + 2 * borde, h + 2 * borde, pr.hexa('#f6f3ec'))
        marco[borde:borde + h, borde:borde + w] = foto
        foto, x, y = marco, x - borde, y - borde
        h, w = foto.shape[:2]
        a = np.zeros(fondo.shape[:2], np.float32)
        a[max(0, y + 8):y + h + 8, max(0, x + 4):x + w + 4] = 1
        fondo = fondo * (1 - pr.suave(a, 14)[..., None] * 0.35)
    fondo[y:y + h, x:x + w] = foto
    return fondo


def salidas(nombres, seed, alto=1150, ancho=None, sep=16, focos=None, fondo=None, borde=0, escalas=None):
    """Varias salidas una al lado de la otra, al mismo alto, como una secuencia de la pasarela. Con escalas, cada una va
    a su tamaño y todas pisan la misma línea."""
    n = len(nombres)
    ancho = ancho or int((W - 2 * 27 - (n - 1) * sep) / n)
    escalas = escalas or [1.0] * n
    anchos = [round(ancho * e) for e in escalas]
    altos = [round(alto * e) for e in escalas]
    x = (W - sum(anchos) - (n - 1) * sep) // 2
    piso = (H - max(altos)) // 2 + max(altos)
    img = noche(seed) if fondo is None else fondo
    for i, nombre in enumerate(nombres):
        foto = color(cubrir(toma(nombre), anchos[i], altos[i], (focos or {}).get(nombre, (0.5, 0.42))), seed + i)
        img = pegar(img, foto, x, piso - altos[i], borde)
        x += anchos[i] + sep
    return img


def copia(nombre, seed, alto=1080, foco=(0.5, 0.45)):
    """Una sola salida, o un detalle, como copia de archivo sobre papel: a su proporción, centrada, con su margen."""
    t = toma(nombre)
    w = round(t.shape[1] * alto / t.shape[0])
    foto = color(cubrir(t, w, alto, foco), seed)
    return pegar(papel(seed), foto, (W - w) // 2, (H - alto) // 2, borde=14)


def ancha(nombre, seed, ancho=1000):
    """Una toma de grupo a casi todo el ancho, sobre negro."""
    t = toma(nombre)
    h = round(t.shape[0] * ancho / t.shape[1])
    foto = color(cubrir(t, ancho, h), seed)
    return pegar(noche(seed), foto, (W - ancho) // 2, (H - h) // 2)


# ---------- Los 20 posts ----------
# En el orden de publicación: los impares de noche y los pares en papel.

POSTS = {
    1: ('Tres salidas de la Chaqueta Trouble Maker: de frente, de frente y de espalda.',
        lambda: salidas(['c5-0', 'c5-2', 'c5-3'], 301)),
    2: ('El Buzo Multitud Térmica con el Jean Flare Destroyed Verde, de frente.',
        lambda: copia('c6-0', 302)),
    3: ('Tres salidas de la Chaqueta Blood Rose, cada modelo a su estatura.',
        lambda: salidas(['c1-1', 'c1-3', 'c1-6'], 303, alto=1100, escalas=[1.0, 0.9, 1.04])),
    4: ('El Tejido Anillos Índigo con el Jean Wide Fleco Índigo, caminando.',
        lambda: copia('c7-4', 304)),
    5: ('La Chaqueta Trouble Maker con el Jean Patchwork Cuadros, tres salidas.',
        lambda: salidas(['c3-0', 'c3-1', 'c3-2'], 305)),
    6: ('El Tejido Anillos Índigo de cerca: el punto grueso y las argollas.',
        lambda: copia('c7-5', 306, alto=1060)),
    7: ('Dos salidas del Buzo Multitud Térmica con el Jean Flare Destroyed Verde.',
        lambda: salidas(['c6-2', 'c6-6'], 307, alto=1150)),
    8: ('La Chaqueta Blood Rose con el Jean Patchwork Estrellas Violeta.',
        lambda: copia('c4-4', 308)),
    9: ('Tres salidas del Jean Patchwork Estrellas Violeta.',
        lambda: salidas(['c4-5', 'c4-6', 'c4-7'], 309)),
    10: ('La Chaqueta Trouble Maker de cerca: las espirales pintadas y el cuello oliva.',
         lambda: copia('c5-1', 310)),
    11: ('De cerca: la Camiseta Célula Carmín y el Jean Flare Dragón Ácido.',
         lambda: salidas(['c8-d1', 'c8-d2'], 311, alto=900, ancho=400, sep=20, focos={'c8-d1': (0.5, 0.5), 'c8-d2': (0.5, 0.5)})),
    12: ('La Chaqueta Trouble Maker con el Jean Patchwork Cuadros.',
         lambda: copia('c3-5', 312, alto=1060)),
    13: ('El Tejido Anillos Índigo con el Jean Wide Fleco Índigo: de frente, de lado y de espalda.',
         lambda: salidas(['c7-0', 'c7-1', 'c7-2'], 313)),
    14: ('La Chaqueta Blood Rose, de cerca.',
         lambda: copia('c1-5', 314, alto=1040)),
    15: ('Dos salidas de la Chaqueta Blood Rose con el Jean Patchwork Estrellas Violeta.',
         lambda: salidas(['c4-0', 'c4-3'], 315, alto=1100, ancho=420, sep=20)),
    16: ('El Buzo Multitud Térmica, de espalda.',
         lambda: copia('c6-5', 316, alto=1060)),
    17: ('La salida en grupo de la Chaqueta Trouble Maker con el Jean Patchwork Cuadros.',
         lambda: ancha('c3-3', 317)),
    18: ('El Tejido Anillos Índigo de espalda y el Jean Wide Fleco Índigo de cerca.',
         lambda: salidas(['c7-7', 'c7-6'], 318, alto=860, ancho=420, sep=24, fondo=papel(318), borde=12)),
    19: ('Dos salidas de la Chaqueta Blood Rose.',
         lambda: salidas(['c1-0', 'c1-2'], 319, alto=1060, ancho=330, sep=24, focos={'c1-0': (0.5, 0.4), 'c1-2': (0.5, 0.4)})),
    20: ('El final: una salida de cada conjunto, todas juntas.',
         lambda: salidas(['c5-2', 'c6-0', 'c7-4', 'c4-6', 'c1-4'], 320, alto=780, ancho=176, sep=14, fondo=papel(320), borde=8)),
}


def vista_previa():
    """La cuadrícula del perfil con los 20 posts, el más nuevo arriba a la izquierda, recortados a 3:4 como los muestra
    Instagram."""
    tw, th, g = 360, 480, 4
    lado = round((W - H * 3 / 4) / 2)
    filas = math.ceil(len(POSTS) / 3)
    hoja = Image.new('RGB', (3 * tw + 2 * g, filas * th + (filas - 1) * g), (255, 255, 255))
    for i, n in enumerate(sorted(POSTS, reverse=True)):
        cuadro = Image.open(SALIDA / f'{n:02d}.jpg').crop((lado, 0, W - lado, H))
        hoja.paste(cuadro.resize((tw, th), Image.LANCZOS), ((i % 3) * (tw + g), (i // 3) * (th + g)))
    ruta = AQUI / 'vista-previa.jpg'
    hoja.save(ruta, quality=86, optimize=True)
    print(ruta.relative_to(pr.RAIZ))


def main():
    SALIDA.mkdir(exist_ok=True)
    pedidos = [int(n) for n in sys.argv[1:]] or list(POSTS)
    for n in pedidos:
        ruta = SALIDA / f'{n:02d}.jpg'
        pr.guardar(np.clip(POSTS[n][1](), 0, 1), ruta)
        print(ruta.relative_to(pr.RAIZ))
    if all((SALIDA / f'{n:02d}.jpg').exists() for n in POSTS):
        vista_previa()


if __name__ == '__main__':
    main()
