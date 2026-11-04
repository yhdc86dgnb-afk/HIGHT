#!/usr/bin/env python3
"""Las imágenes fijas de la campaña sin texto: los dos posts, el carrusel de las 20 piezas y las portadas de los reels.

La campaña es un cuarto oscuro: el Drop 01 se revela en público. Casi todo sale en reels (15 de las 17
publicaciones); quedan dos posts, los dos el día del lanzamiento: la estrella al mediodía y las 20 piezas a las
8:00 p. m., con una imagen por colección detrás para etiquetar cada prenda. No hay letras en ninguna imagen: la marca
firma con la estrella.

La cuadrícula del perfil tiene 15 cuadros: 13 reels y los dos posts (el adelanto y el revelado salen de la
cuadrícula). Cada cuadro tiene su imagen, de p01 a p15, y los cuadros alternan papel (claros) y noche (oscuros), así
que la cuadrícula queda en tablero. Las de los reels salen en 1080 × 1920 como portada; en la cuadrícula se ven
recortadas al centro en 3:4, así que en vertical las prendas y las hojas caben en ese centro.

Deja en posts/: 07.jpg y 08.jpg (los dos posts) y 08-2.jpg a 08-7.jpg (las colecciones detrás de las 20 piezas); en
portadas/: la portada de cada reel; y al lado, vista-previa.jpg, la cuadrícula del perfil.

Uso, desde la raíz del repo: python3 bocetos/lanzamiento-sin-texto/posts.py
"""
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import procesos as pr

W, H = 1080, 1350
VERTICAL = 1920
SALIDA = pr.AQUI / 'posts'
PORTADAS_DIR = pr.AQUI / 'portadas'
FOTO_CORREAS = pr.AQUI / 'fuentes' / 'correas-foto.jpg'

# Las colecciones con sus prendas, en el orden de la tienda
COLECCIONES = {
    'acido': ['chaqueta-smiley-acido', 'jean-flare-costura-neon', 'jean-flare-destroyed-verde', 'jean-flare-dragon-acido'],
    'carmin': ['camiseta-celula-carmin', 'top-halftone-carmin', 'top-malla-asimetrico-rojo'],
    'indigo': ['tejido-anillos-indigo', 'jean-wide-patchwork-indigo', 'jean-wide-fleco-indigo'],
    'magenta': ['jean-patchwork-estrellas-violeta', 'chaqueta-blood-rose', 'short-camuflado-leopardo-rosa'],
    'ceniza': ['buzo-multitud-termica', 'buzo-destroyed-ceniza', 'chaqueta-trouble-maker', 'chaqueta-trouble-maker-espalda',
               'tejido-deshilado-ceniza', 'top-crop-rostros'],
    'leopardo': ['jean-flare-patchwork-leopardo', 'jean-patchwork-cuadros'],
}
# Lo que se corta arriba de la prenda limpia: el Top Crop Rostros trae en el cuello una etiqueta con letras
FUERA_ARRIBA = {'top-crop-rostros': 0.13}
# Un acercamiento de cada prenda para la hoja de contactos, sin letras: centro (x, y) y lado, en partes de la prenda
DETALLES = {
    'chaqueta-smiley-acido': (0.66, 0.22, 0.32), 'jean-flare-costura-neon': (0.34, 0.36, 0.32),
    'jean-flare-destroyed-verde': (0.45, 0.46, 0.32), 'jean-flare-dragon-acido': (0.3, 0.32, 0.34),
    'camiseta-celula-carmin': (0.5, 0.45, 0.45), 'top-halftone-carmin': (0.5, 0.42, 0.5),
    'top-malla-asimetrico-rojo': (0.45, 0.45, 0.45), 'jean-wide-fleco-indigo': (0.5, 0.45, 0.4),
    'jean-wide-patchwork-indigo': (0.3, 0.36, 0.34), 'tejido-anillos-indigo': (0.5, 0.32, 0.34),
    'chaqueta-blood-rose': (0.5, 0.45, 0.4), 'jean-patchwork-estrellas-violeta': (0.3, 0.36, 0.3),
    'short-camuflado-leopardo-rosa': (0.19, 0.24, 0.15), 'buzo-destroyed-ceniza': (0.5, 0.62, 0.4),
    'buzo-multitud-termica': (0.65, 0.42, 0.34), 'chaqueta-trouble-maker': (0.85, 0.42, 0.3),
    'tejido-deshilado-ceniza': (0.5, 0.5, 0.45), 'top-crop-rostros': (0.66, 0.42, 0.34),
    'jean-flare-patchwork-leopardo': (0.56, 0.46, 0.3), 'jean-patchwork-cuadros': (0.4, 0.6, 0.34),
}
ORDEN_20 = [p for c in ('acido', 'carmin', 'magenta', 'indigo', 'ceniza', 'leopardo') for p in COLECCIONES[c]
            if not p.endswith('-espalda')]


def recorte(nombre):
    return pr.cargar(f'{nombre}-recorte')


def foto_correas():
    return np.asarray(Image.open(FOTO_CORREAS).convert('RGBA'), np.float32) / 255


def guarda(img, ruta, h=H):
    pr.guardar(img, ruta, W, h)
    print(ruta.relative_to(pr.RAIZ))


def sin_etiqueta(nombre):
    """La prenda sin la parte de arriba que tiene letras (la etiqueta del cuello del Top Crop Rostros): esa parte se
    corta y el corte se funde en la sombra, así la prenda puede ir centrada."""
    pz = recorte(nombre)
    corte = FUERA_ARRIBA.get(nombre)
    if not corte:
        return pz
    pz = pz[int(corte * pz.shape[0]):].copy()
    pz[..., 3] *= np.clip(np.arange(pz.shape[0], dtype=np.float32) / (0.1 * pz.shape[0]), 0, 1)[:, None]
    return pz


def limpia(nombre, w=W, h=H):
    """La prenda limpia sobre carbón. En vertical queda más chica y un poco arriba del centro, lejos de los botones y
    del pie que Instagram pone abajo en los reels."""
    vertical = h > w * 4 / 3
    return pr.estudio(sin_etiqueta(nombre), w, h, alto=0.56 if vertical else 0.8, centro=0.45 if vertical else 0.5)


def caja(w, h):
    """El alto y el comienzo del centro en 3:4, el que muestra la cuadrícula del perfil. En 4:5 es el cuadro entero."""
    alto = min(h, round(w * 4 / 3))
    return alto, (h - alto) // 2


def zoom34(pieza, w, h, zoom=1.0):
    """El zoom que deja la pieza dentro del centro en 3:4 del cuadro: los procesos encajan la prenda en el cuadro
    entero, y en vertical una prenda alta se saldría de lo que muestra la cuadrícula."""
    alto, _ = caja(w, h)
    entero = min(w / pieza.shape[1], h / pieza.shape[0])
    centro = min(w / pieza.shape[1], alto / pieza.shape[0])
    return zoom * centro / entero


# ---------- Los quince cuadros ----------

def p01(w=W, h=H):
    """Día −6, papel: el Buzo Destroyed Ceniza derretido en mármol. En vertical, la página es la del cuadro en 3:4, en
    el centro, y el papel sigue arriba y abajo."""
    alto, arriba = caja(w, h)
    hoja = pr.marmol(recorte('buzo-destroyed-ceniza'), w, alto, seed=8, bandas=1.6, fuerza=0.3)
    if alto == h:
        return hoja
    img = pr.grano(pr.lienzo(w, h, pr.hexa('#f3f1ec')), 0.05, 9, 0.7)
    img[arriba:arriba + alto] = hoja
    return img


def p02(w=W, h=H):
    """Día −5, noche: la Chaqueta Blood Rose como un fantasma azul que se corre."""
    pz = recorte('chaqueta-blood-rose')
    return pr.fantasma(pz, w, h, seed=21, corrido=0.2, zoom=zoom34(pz, w, h, 0.82))


def p03(w=W, h=H):
    """Día −4, papel: la manga de la espiral de la Chaqueta Trouble Maker en negativo (el denim negro sale papel y la
    pintura blanca sale tinta), con manchones de tinta azul y la estrella."""
    return pr.negativo(recorte('chaqueta-trouble-maker'), w, h, seed=31, estrella_en=(0.34, 0.3), zoom=2.5, foco=(0.9, 0.5))


def p04(w=W, h=H):
    """Día −3, noche: las hebillas de las correas en la luz roja, de grano suelto (de una copia de la foto real). En
    vertical el recorte de la foto es más alto, para llenar el cuadro."""
    trozo = foto_correas()[170:520, 120:400] if h <= w * 4 / 3 else foto_correas()[150:683, 110:410]
    return pr.luz_roja(trozo, w, h, seed=41, celda=3)


def p05(w=W, h=H):
    """Día −2, papel: el Jean Wide Patchwork Índigo y el Jean Wide Fleco Índigo en doble exposición, escaneados, con
    la línea blanca y fugas de luz."""
    a, b = recorte('jean-wide-patchwork-indigo'), recorte('jean-wide-fleco-indigo')
    return pr.escaneo([(a, 0.44, 0.5, zoom34(a, w, h, 0.95)), (b, 0.62, 0.53, zoom34(b, w, h, 0.88))], w, h,
                      [pr.ACIDO, pr.MAGENTA, pr.AZUL], seed=51)


def hoja_contactos(w=W, h=H):
    """Las partes de la hoja de contactos: el papel, las tiras de película con un acercamiento de cada una de las 20
    prendas en blanco y negro, y los tres óvalos de lápiz rojo. En vertical la hoja ocupa el centro en 3:4.
    Devuelve (papel, tiras, ovalos): tiras es [(x, y, imagen de la tira)] y ovalos, los puntos de cada óvalo."""
    papel = pr.lienzo(w, h, pr.HUESO)
    alto, arriba = caja(w, h)
    filas, cols = 5, 4
    margen, sep = 64, 10  # 64: la cuadrícula del perfil le quita 34 px a cada lado del post y así no corta los óvalos
    franja_h = (alto - 2 * margen - (filas - 1) * sep) / filas
    hueco = franja_h * 0.13
    cuadro_h = franja_h - 2 * hueco
    cuadro_w = (w - 2 * margen - (cols + 1) * 12) / cols
    rng = np.random.default_rng(61)
    tiras, marcos = [], []
    for f in range(filas):
        y0 = arriba + margen + f * (franja_h + sep)
        # la tira de película: negra, con las perforaciones arriba y abajo
        tira = pr.lienzo(w - 2 * margen, int(y0 + franja_h) - int(y0), pr.hexa('#0b0b0b'))
        for k in range(int((w - 2 * margen) / 22)):
            x = 8 + k * 22
            for yy in (hueco * 0.3, franja_h - hueco * 0.7):
                tira[int(yy):int(yy + hueco * 0.42), int(x):int(x + 11)] = pr.hexa('#2a2a2a')
        for c in range(cols):
            nombre = ORDEN_20[f * cols + c]
            pz = recorte(nombre)
            cx, cy, lado = DETALLES[nombre]
            ph, pw = pz.shape[:2]
            s = lado * max(ph, pw)
            sw, sh = s, s * cuadro_h / cuadro_w
            x1, y1 = int(max(0, cx * pw - sw / 2)), int(max(0, cy * ph - sh / 2))
            trozo = pz[y1:int(y1 + sh), x1:int(x1 + sw)]
            fondo = pr.lienzo(trozo.shape[1], trozo.shape[0], (0.08, 0.08, 0.08))
            trozo = pr.pegar(fondo, trozo, 0, 0)
            gris = pr.curva(pr.lum(trozo), 1.5, 0.45)
            gris = cv2.resize(gris, (int(cuadro_w), int(cuadro_h)), interpolation=cv2.INTER_AREA)
            x0 = 12 + c * (cuadro_w + 12)
            tira[int(hueco):int(hueco) + gris.shape[0], int(x0):int(x0) + gris.shape[1]] = gris[..., None] * np.array([0.98, 0.97, 0.95], np.float32)
            marcos.append((margen + x0, y0 + hueco, cuadro_w, cuadro_h))
        tiras.append((margen, int(y0), tira))
    # tres elegidas con lápiz rojo: un óvalo a mano alzada, que no cierra justo
    ovalos = []
    for i in (2, 9, 15):
        x0, y0, cw, ch = marcos[i]
        t = np.linspace(0, 2 * math.pi * 1.08, 90)
        rx, ry = cw * 0.6, ch * 0.66
        jit = np.cumsum(rng.normal(0, 0.8, (len(t), 2)), 0)
        ovalos.append(np.stack([x0 + cw / 2 + rx * np.cos(t + 0.3) + jit[:, 0], y0 + ch / 2 + ry * np.sin(t + 0.3) + jit[:, 1]], 1))
    return papel, tiras, ovalos


def lapiz(img, ovalos, hasta=None):
    """Los óvalos de lápiz rojo sobre la hoja. hasta dice cuánto de cada óvalo va dibujado (de 0 a 1)."""
    h, w = img.shape[:2]
    capa = np.zeros((h, w), np.uint8)
    for i, pts in enumerate(ovalos):
        k = len(pts) if hasta is None else int(len(pts) * float(np.clip(hasta[i], 0, 1)))
        if k >= 2:
            cv2.polylines(capa, [pts[:k].astype(np.int32).reshape(-1, 1, 2)], False, 255, 7, cv2.LINE_AA)
    a = pr.suave(capa.astype(np.float32) / 255, 0.8)[..., None] * 0.9
    return img * (1 - a) + pr.CARMIN * a


def p06(w=W, h=H):
    """Día −1, noche: la hoja de contactos con un acercamiento de cada una de las 20 prendas, en blanco y negro, y tres
    elegidas con lápiz rojo."""
    img, tiras, ovalos = hoja_contactos(w, h)
    for x, y, tira in tiras:
        img[y:y + tira.shape[0], x:x + tira.shape[1]] = tira
    img = lapiz(img, ovalos)
    img = pr.rayas(img, 62, n=5, polvo=120, color=pr.CARBON, fuerza=0.25)
    return pr.grano(img, 0.035, 62, 0.6)


def p07(w=W, h=H):
    """Día 0 al mediodía, papel: la estrella de Hight quemada en el papel, como una luz que entra de golpe."""
    img = pr.lienzo(w, h, pr.HUESO)
    # los seis colores se cuelan por las orillas del papel
    luz = np.zeros_like(img)
    esquinas = [(0.02, 0.06), (0.98, 0.1), (1.0, 0.55), (0.96, 0.97), (0.04, 0.94), (0.0, 0.5)]
    for i, (color, (ex, ey)) in enumerate(zip(pr.SEIS.values(), esquinas)):
        luz += pr.fuga(h, w, ex * w, ey * h, w * 0.24, color, 71 + i)
    img = pr.colar(img, luz, 0.6)
    # el destello en cruz detrás de la estrella, como una luz que entra de golpe
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = np.abs(xx - w / 2) / w, np.abs(yy - h * 0.47) / h
    cruz = np.exp(-dy * 90) * np.exp(-dx * 2.2) + np.exp(-dx * 90) * np.exp(-dy * 2.2)
    img = img * (1 - 0.5 * cruz[..., None]) + pr.AZUL * 0.5 * cruz[..., None]
    img = pr.brillo_estrella(img, w / 2, h * 0.47, int(w * 0.5), pr.AZUL_HONDO, halo=pr.AZUL * 0.6 + 0.4, fuerza=1.0)
    # el centro de la estrella se quema en blanco, como una luz muy fuerte
    nucleo = np.exp(-((xx - w / 2) ** 2 + (yy - h * 0.47) ** 2) / (2 * (w * 0.045) ** 2)) * pr.estrella_en(w, h, w / 2, h * 0.47, int(w * 0.5))
    img = img + (1 - img) * nucleo[..., None] * 0.95
    img = pr.rayas(img, 72, n=8, polvo=150, color=pr.CARBON, fuerza=0.3)
    return pr.grano(img, 0.04, 72, 0.7)


def estudio_con(piezas, w, h, cols, mx, my, llenado=0.86, seed=81):
    """Varias prendas limpias sobre carbón, en filas de cols, cada una centrada en su celda con su sombra. Una fila
    corta queda centrada."""
    img = pr.estudio(np.zeros((10, 10, 4), np.float32), w, h)
    filas = math.ceil(len(piezas) / cols)
    cw, ch = (w - 2 * mx) / cols, (h - 2 * my) / filas
    for i, nombre in enumerate(piezas):
        f, c = divmod(i, cols)
        en_fila = min(cols, len(piezas) - f * cols)
        corrido = (cols - en_fila) * cw / 2
        pz = sin_etiqueta(nombre)
        k = min(ch * llenado / pz.shape[0], cw * llenado / pz.shape[1])
        p = pr.escala(pz, k)
        x = int(mx + corrido + c * cw + (cw - p.shape[1]) / 2)
        y = int(my + f * ch + (ch - p.shape[0]) / 2)
        a = pr.alfa_en(img.shape, p, x, y + 6)
        img = img * (1 - pr.suave(a, 10)[..., None] * 0.5)
        img = pr.pegar(img, p, x, y)
    return pr.grano(img, 0.015, seed, 0.4)


def p08(w=W, h=H):
    """Día 0 a las 8:00 p. m., noche: las 20 piezas reveladas, limpias, en el orden de los colores."""
    return estudio_con(ORDEN_20, w, h, 4, 50, 60)


def coleccion(nombre, w=W, h=H):
    """Una colección del carrusel de las 20: sus prendas limpias sobre carbón (sin la espalda de la Trouble Maker) y
    la luz de su color que se cuela por una orilla. Cada prenda se etiqueta con su producto."""
    piezas = [p for p in COLECCIONES[nombre] if not p.endswith('-espalda')]
    cols = {2: 2, 3: 2, 4: 2, 5: 3}[len(piezas)]
    img = estudio_con(piezas, w, h, cols, 70, 110, 0.84, seed=82 + list(COLECCIONES).index(nombre))
    n = list(COLECCIONES).index(nombre)
    rng = np.random.default_rng(90 + n)
    luz = pr.fuga(h, w, (0.02, 0.98)[n % 2] * w, rng.uniform(0.1, 0.9) * h, w * 0.3, pr.SEIS[nombre], 90 + n)
    return pr.pantalla(img, luz * 0.45)


def p09(w=W, h=H):
    """Día +1, papel: las doce correas en tinta roja y negra sobre hueso, de una copia de la foto real (sin la funda
    de leopardo que quedó arriba a la derecha de la foto)."""
    return pr.luz_roja(foto_correas()[100:1560, 0:1200], w, h, seed=91, papel=True, zoom=1.0, celda=2)


def p10(w=W, h=H):
    """Radiactivo, noche: la Chaqueta Smiley Ácido como luz ácida que se corre."""
    pz = recorte('chaqueta-smiley-acido')
    return pr.fantasma(pz, w, h, color=pr.ACIDO, seed=101, corrido=0.16, zoom=zoom34(pz, w, h, 0.82), intensidad=0.62)


def p11(w=W, h=H):
    """Sangre Fría, papel: la Camiseta Célula Carmín en negativo con tinta roja."""
    pz = recorte('camiseta-celula-carmin')
    return pr.negativo(pz, w, h, tinta=pr.CARMIN, seed=111, estrella_en=(0.7, 0.24), zoom=zoom34(pz, w, h, 0.95))


def p12(w=W, h=H):
    """Medianoche, noche: el Tejido Anillos Índigo en cianotipia."""
    pz = recorte('tejido-anillos-indigo')
    return pr.cianotipia(pz, w, h, seed=121, zoom=zoom34(pz, w, h, 0.9))


def p13(w=W, h=H):
    """Chicle, papel: el Jean Patchwork Estrellas Violeta escaneado, con fugas de luz magenta."""
    j = recorte('jean-patchwork-estrellas-violeta')
    return pr.escaneo([(j, 0.5, 0.52, zoom34(j, w, h, 0.92))], w, h, [pr.MAGENTA, pr.MAGENTA, pr.MAGENTA], seed=131, luz_fuerza=1.0)


def p14(w=W, h=H):
    """Asfalto, noche: el Buzo Multitud Térmica en plata, de noche."""
    pz = recorte('buzo-multitud-termica')
    return pr.plata(pz, w, h, seed=141, fuga_color=pr.CENIZA, zoom=zoom34(pz, w, h, 0.86))


def p15(w=W, h=H):
    """Fiera, papel: el Jean Flare Patchwork Leopardo y el Jean Patchwork Cuadros escaneados y virados, con una fuga
    del color del leopardo."""
    a, b = recorte('jean-flare-patchwork-leopardo'), recorte('jean-patchwork-cuadros')
    img = pr.escaneo([(a, 0.42, 0.5, zoom34(a, w, h, 0.92)), (b, 0.6, 0.52, zoom34(b, w, h, 0.9))], w, h,
                     [pr.LEOPARDO, pr.LEOPARDO], seed=151)
    return pr.tonificar(img, pr.LEOPARDO, 0.5)


# Los dos posts y, detrás del de las 20 piezas, una imagen por colección
POSTS = {7: p07, 8: p08}
CARRUSEL_08 = ['acido', 'carmin', 'magenta', 'indigo', 'ceniza', 'leopardo']
# La cuadrícula del perfil, de la primera publicación a la última: el reel o el post de cada cuadro
CUADRICULA = [('reel', 'marmol', p01), ('reel', 'fantasma', p02), ('reel', 'negativo', p03), ('reel', 'luz-roja', p04),
              ('reel', 'escaneo', p05), ('reel', 'contactos', p06), ('post', '07', p07), ('post', '08', p08),
              ('reel', 'correas', p09), ('reel', 'acido', p10), ('reel', 'carmin', p11), ('reel', 'indigo', p12),
              ('reel', 'magenta', p13), ('reel', 'ceniza', p14), ('reel', 'leopardo', p15)]
PORTADAS = {nombre: fn for clase, nombre, fn in CUADRICULA if clase == 'reel'}


def portada_adelanto(w=W, h=VERTICAL):
    """El adelanto sale de la cuadrícula; su portada, la de la pestaña de reels, junta los seis procesos del reel, de a
    dos por fila, sobre negro."""
    g = 24
    tw, th = (w - 3 * g) // 2, (h - 4 * g) // 3
    jeans = [(recorte('jean-wide-patchwork-indigo'), 0.44, 0.5, 0.95), (recorte('jean-wide-fleco-indigo'), 0.62, 0.53, 0.9)]
    cuadros = [pr.negativo(recorte('chaqueta-trouble-maker'), tw, th, seed=15, estrella_en=(0.32, 0.28), zoom=2.6, foco=(0.9, 0.5)),
               pr.luz_roja(foto_correas()[170:620, 120:400], tw, th, seed=16, celda=3),
               pr.fantasma(recorte('chaqueta-blood-rose'), tw, th, seed=17, corrido=0.2, zoom=0.9),
               pr.cianotipia(recorte('tejido-anillos-indigo'), tw, th, seed=18, zoom=1.0),
               pr.escaneo(jeans, tw, th, [pr.ACIDO, pr.MAGENTA, pr.AZUL], seed=19),
               pr.plata(recorte('buzo-multitud-termica'), tw, th, seed=20, fuga_color=pr.CENIZA)]
    img = pr.lienzo(w, h, pr.CARBON)
    for i, c in enumerate(cuadros):
        x, y = g + (i % 2) * (tw + g), g + (i // 2) * (th + g)
        img[y:y + th, x:x + tw] = np.clip(c, 0, 1)
    return pr.grano(img, 0.02, 11, 0.5)


def portada_revelado(w=W, h=VERTICAL):
    """El revelado también sale de la cuadrícula: su portada son las 20 piezas bajo la luz roja del cuarto oscuro, como
    en el reel antes de que se prenda la luz."""
    v = pr.curva(pr.lum(estudio_con(ORDEN_20, w, h, 4, 50, 150)), 1.2, 0.45)
    rojo = pr.mapa(v, [(0, pr.hexa('#1a0404')), (0.55, pr.hexa('#e0392f') * 0.55), (1, pr.hexa('#e0392f'))])
    return pr.grano(rojo, 0.03, 7, 0.6)


# Las portadas de los dos reels que salen de la cuadrícula (quedan en la pestaña de reels)
FUERA_DE_LA_CUADRICULA = {'adelanto': portada_adelanto, 'revelado': portada_revelado}


def vista_previa():
    """La cuadrícula del perfil con los 15 cuadros, el más nuevo arriba a la izquierda. Instagram muestra cada cuadro en
    3:4: de un post le quita unos 34 píxeles a cada lado y de la portada de un reel muestra el centro."""
    tw, th, g = 360, 480, 4
    hoja = Image.new('RGB', (3 * tw + 2 * g, 5 * th + 4 * g), (255, 255, 255))
    for i, (clase, nombre, _) in enumerate(reversed(CUADRICULA)):
        if clase == 'post':
            lado = round((W - H * 3 / 4) / 2)
            cuadro = Image.open(SALIDA / f'{nombre}.jpg').crop((lado, 0, W - lado, H))
        else:
            alto, arriba = caja(W, VERTICAL)
            cuadro = Image.open(PORTADAS_DIR / f'{nombre}.jpg').crop((0, arriba, W, arriba + alto))
        hoja.paste(cuadro.resize((tw, th), Image.LANCZOS), ((i % 3) * (tw + g), (i // 3) * (th + g)))
    ruta = pr.AQUI / 'vista-previa.jpg'
    hoja.save(ruta, quality=86, optimize=True)
    print(ruta.relative_to(pr.RAIZ))


def main():
    SALIDA.mkdir(exist_ok=True)
    PORTADAS_DIR.mkdir(exist_ok=True)
    for n, fn in POSTS.items():
        guarda(fn(), SALIDA / f'{n:02d}.jpg')
    for i, nombre in enumerate(CARRUSEL_08, 2):
        guarda(coleccion(nombre), SALIDA / f'08-{i}.jpg')
    for nombre, fn in PORTADAS.items():
        guarda(fn(W, VERTICAL), PORTADAS_DIR / f'{nombre}.jpg', VERTICAL)
    for nombre, fn in FUERA_DE_LA_CUADRICULA.items():
        guarda(fn(), PORTADAS_DIR / f'{nombre}.jpg', VERTICAL)
    vista_previa()


if __name__ == '__main__':
    main()
