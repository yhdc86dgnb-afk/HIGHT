#!/usr/bin/env python3
"""Los 20 posts del desfile de HIGHT, en 1080 × 1350, con el estilo de la tienda (la versión final del tema): solo la
ropa en la pasarela, sin una sola letra.

Las salidas son fotos generadas con IA en Canva a partir de las prendas reales de la tienda, con modelos de rasgos,
estaturas y orígenes distintos. Canva las entrega en hojas de varias salidas (fuentes/pasarela-*.jpg); tomas.json dice
dónde está cada una.

Las caras van tapadas, como en las referencias de la campaña: cada una con un rectángulo hecho de un pedazo del fondo
de la misma foto, tomado al lado de la cabeza y pegado con bordes duros, de las cejas a debajo de la boca. La barbilla
queda a la vista. fuentes/caras.json dice dónde está cada cara (lo arma caras.py); las espaldas y los detalles no llevan
barra. Solo cambian las caras: la ropa queda igual.

Los posts se arman en posts.html con las piezas de la tienda: carbón y hueso de base y el ácido de acento, las texturas
de las seis colecciones (las mismas de assets/hight.css), cada salida como una copia impresa con su borde claro, su
sombra suave, un giro de menos de un grado y medio y, en algunas, la cinta de papel; el sello de la estrella, sin letras,
y el grano de fotocopia de toda la página. Alternan para que la cuadrícula del perfil quede en tablero: los impares en
carbón, con la textura de la colección de la prenda, y los pares en hueso o en ácido. El último reúne una salida de cada
conjunto, como el final de un desfile.

Este script saca cada salida con su cara tapada a imagenes/ (al doble de tamaño y con un poco de nitidez, porque cada
salida viene de una hoja de varias), saca los JPG de posts.html con render.js y arma la vista previa. Deja posts/01.jpg
a 20.jpg y vista-previa.jpg al lado. Las descripciones están en textos.md.
Requiere Node con Playwright (Chromium).
Uso, desde la raíz del repo: python3 bocetos/desfile/posts.py [número ...]
"""
import functools
import http.server
import json
import math
import os
import subprocess
import sys
import threading
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
IMAGENES = AQUI / 'imagenes'
TOMAS = json.loads((FUENTES / 'tomas.json').read_text())
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


# ---------- Las imágenes de cada salida ----------

def agrandar(img, k=2):
    """La salida al doble de tamaño, con Lanczos y un poco de nitidez, para que la copia se vea nítida en el post."""
    h, w = img.shape[:2]
    out = cv2.resize(img, (w * k, h * k), interpolation=cv2.INTER_LANCZOS4)
    blando = cv2.GaussianBlur(out, (0, 0), 0.6 * k)
    return np.clip(out + 0.45 * (out - blando), 0, 1)


def imagenes(nombres):
    IMAGENES.mkdir(exist_ok=True)
    for nombre in nombres:
        img = (agrandar(toma(nombre)) * 255 + 0.5).astype(np.uint8)
        Image.fromarray(img).save(IMAGENES / f'{nombre}.jpg', quality=90, optimize=True)


# ---------- Los 20 posts ----------
# En el orden de publicación: el texto alternativo de cada post y las salidas que muestra. Cómo va cada uno (su fondo,
# sus copias y su sello) está en posts.html.

POSTS = {
    1: ('Tres salidas de la Chaqueta Trouble Maker: de frente, de frente y de espalda.', ['c5-0', 'c5-2', 'c5-3']),
    2: ('El Buzo Multitud Térmica con el Jean Flare Destroyed Verde, de frente.', ['c6-0']),
    3: ('Tres salidas de la Chaqueta Blood Rose, cada modelo a su estatura.', ['c1-1', 'c1-3', 'c1-6']),
    4: ('El Tejido Anillos Índigo con el Jean Wide Fleco Índigo, caminando.', ['c7-4']),
    5: ('La Chaqueta Trouble Maker con el Jean Patchwork Cuadros, tres salidas.', ['c3-0', 'c3-1', 'c3-2']),
    6: ('El Tejido Anillos Índigo de cerca: el punto grueso y las argollas.', ['c7-5']),
    7: ('Dos salidas del Buzo Multitud Térmica con el Jean Flare Destroyed Verde.', ['c6-2', 'c6-6']),
    8: ('La Chaqueta Blood Rose con el Jean Patchwork Estrellas Violeta.', ['c4-4']),
    9: ('Tres salidas del Jean Patchwork Estrellas Violeta.', ['c4-5', 'c4-6', 'c4-7']),
    10: ('La Chaqueta Trouble Maker de cerca: las espirales pintadas y el cuello oliva.', ['c5-1']),
    11: ('De cerca: la Camiseta Célula Carmín y el Jean Flare Dragón Ácido.', ['c8-d1', 'c8-d2']),
    12: ('La Chaqueta Trouble Maker con el Jean Patchwork Cuadros.', ['c3-5']),
    13: ('El Tejido Anillos Índigo con el Jean Wide Fleco Índigo: de frente, de lado y de espalda.', ['c7-0', 'c7-1', 'c7-2']),
    14: ('La Chaqueta Blood Rose, de cerca.', ['c1-5']),
    15: ('Dos salidas de la Chaqueta Blood Rose con el Jean Patchwork Estrellas Violeta.', ['c4-0', 'c4-3']),
    16: ('El Buzo Multitud Térmica, de espalda.', ['c6-5']),
    17: ('La salida en grupo de la Chaqueta Trouble Maker con el Jean Patchwork Cuadros.', ['c3-3']),
    18: ('El Tejido Anillos Índigo de espalda y el Jean Wide Fleco Índigo de cerca.', ['c7-7', 'c7-6']),
    19: ('Dos salidas de la Chaqueta Blood Rose.', ['c1-0', 'c1-2']),
    20: ('El final: una salida de cada conjunto, todas juntas.', ['c5-2', 'c6-0', 'c7-4', 'c4-6', 'c1-4']),
}


class _Callado(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def render(numeros):
    """Saca los JPG de posts.html. El repo se sirve en un puerto libre para que la página encuentre el grano y las
    texturas de assets/."""
    entorno = dict(os.environ)
    if 'NODE_PATH' not in entorno:
        try:
            entorno['NODE_PATH'] = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
        except OSError:
            pass
    manejador = functools.partial(_Callado, directory=str(pr.RAIZ))
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), manejador) as servidor:
        threading.Thread(target=servidor.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{servidor.server_address[1]}/{(AQUI / "posts.html").relative_to(pr.RAIZ)}'
        subprocess.run(['node', str(AQUI / 'render.js'), url, *[f'{n:02d}' for n in numeros]], check=True, env=entorno)
        servidor.shutdown()


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
    pedidos = [int(n) for n in sys.argv[1:]] or list(POSTS)
    imagenes(sorted({nombre for n in pedidos for nombre in POSTS[n][1]}))
    render(pedidos)
    for n in pedidos:
        print((SALIDA / f'{n:02d}.jpg').relative_to(pr.RAIZ))
    if all((SALIDA / f'{n:02d}.jpg').exists() for n in POSTS):
        vista_previa()


if __name__ == '__main__':
    main()
