#!/usr/bin/env python3
"""Los 15 posts de la campaña sin texto, en 1080 × 1350, y los carruseles de cada colección.

La campaña es un cuarto oscuro: el Drop 01 se revela en público. Antes del lanzamiento solo se ve la luz y la textura
de las prendas (mármol, negativos, la luz roja, fantasmas); el día del lanzamiento las 20 piezas aparecen limpias, y
después cada colección sale con su proceso y sus prendas una por una. No hay letras en ninguna imagen: la marca firma
con la estrella. Los posts alternan papel (claros) y noche (oscuros), así que la cuadrícula del perfil queda en tablero.

Deja en posts/: 01.jpg a 15.jpg (la portada de cada post) y, en los carruseles, 10-2.jpg, 10-3.jpg, ... (cada prenda
limpia sobre carbón, la que se etiqueta con su producto). Al lado deja vista-previa.jpg, la cuadrícula del perfil.

Uso, desde la raíz del repo: python3 bocetos/lanzamiento-sin-texto/posts.py [número ...]
"""
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import procesos as pr

W, H = 1080, 1350
SALIDA = pr.AQUI / 'posts'
FOTO_CORREAS = pr.AQUI / 'fuentes' / 'correas-foto.jpg'

# Las colecciones con sus prendas, en el orden de los carruseles (como en la tienda)
COLECCIONES = {
    'acido': ['chaqueta-smiley-acido', 'jean-flare-costura-neon', 'jean-flare-destroyed-verde', 'jean-flare-dragon-acido'],
    'carmin': ['camiseta-celula-carmin', 'top-halftone-carmin', 'top-malla-asimetrico-rojo'],
    'indigo': ['tejido-anillos-indigo', 'jean-wide-patchwork-indigo', 'jean-wide-fleco-indigo'],
    'magenta': ['jean-patchwork-estrellas-violeta', 'chaqueta-blood-rose', 'short-camuflado-leopardo-rosa'],
    'ceniza': ['buzo-multitud-termica', 'buzo-destroyed-ceniza', 'chaqueta-trouble-maker', 'chaqueta-trouble-maker-espalda',
               'tejido-deshilado-ceniza', 'top-crop-rostros'],
    'leopardo': ['jean-flare-patchwork-leopardo', 'jean-patchwork-cuadros'],
}
# Lo que queda fuera de cuadro arriba en la foto limpia: el Top Crop Rostros trae en el cuello una etiqueta con letras
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


def guarda(img, n):
    ruta = SALIDA / f'{n}.jpg'
    pr.guardar(img, ruta)
    print(ruta.relative_to(pr.RAIZ))


def limpia(nombre):
    return pr.estudio(recorte(nombre), fuera_arriba=FUERA_ARRIBA.get(nombre, 0.0))


# ---------- Los posts ----------

def p01():
    """Día −6, papel: el Buzo Destroyed Ceniza derretido en mármol."""
    return pr.marmol(recorte('buzo-destroyed-ceniza'), W, H, seed=8, bandas=1.6, fuerza=0.3)


def p02():
    """Día −5, noche: la Chaqueta Blood Rose como un fantasma azul que se corre."""
    return pr.fantasma(recorte('chaqueta-blood-rose'), W, H, seed=21, corrido=0.2, zoom=0.82)


def p03():
    """Día −4, papel: la manga de la espiral de la Chaqueta Trouble Maker en negativo (el denim negro sale papel y la
    pintura blanca sale tinta), con manchones de tinta azul y la estrella."""
    return pr.negativo(recorte('chaqueta-trouble-maker'), W, H, seed=31, estrella_en=(0.34, 0.3), zoom=2.5, foco=(0.9, 0.5))


def p04():
    """Día −3, noche: las hebillas de las correas en la luz roja, de grano suelto (de una copia de la foto real)."""
    foto = np.asarray(Image.open(FOTO_CORREAS).convert('RGBA'), np.float32) / 255
    return pr.luz_roja(foto[170:520, 120:400], W, H, seed=41, celda=3)


def p05():
    """Día −2, papel: el Jean Wide Patchwork Índigo y el Jean Wide Fleco Índigo en doble exposición, escaneados, con
    la línea blanca y fugas de luz."""
    a, b = recorte('jean-wide-patchwork-indigo'), recorte('jean-wide-fleco-indigo')
    return pr.escaneo([(a, 0.44, 0.5, 0.95), (b, 0.62, 0.53, 0.88)], W, H, [pr.ACIDO, pr.MAGENTA, pr.AZUL], seed=51)


def p06():
    """Día −1, noche: la hoja de contactos con un acercamiento de cada una de las 20 prendas, en blanco y negro, y tres
    elegidas con lápiz rojo."""
    img = pr.lienzo(W, H, pr.HUESO)
    filas, cols = 5, 4
    margen, sep = 64, 10  # 64: la cuadrícula del perfil le quita 34 px a cada lado y así no corta los óvalos
    franja_h = (H - 2 * margen - (filas - 1) * sep) / filas
    hueco = franja_h * 0.13
    cuadro_h = franja_h - 2 * hueco
    cuadro_w = (W - 2 * margen - (cols + 1) * 12) / cols
    rng = np.random.default_rng(61)
    marcos = []
    for i, nombre in enumerate(ORDEN_20):
        f, c = divmod(i, cols)
        y0 = margen + f * (franja_h + sep)
        if c == 0:
            # la tira de película: negra, con las perforaciones arriba y abajo
            img[int(y0):int(y0 + franja_h), margen:W - margen] = pr.hexa('#0b0b0b')
            for k in range(int((W - 2 * margen) / 22)):
                x = margen + 8 + k * 22
                for yy in (y0 + hueco * 0.3, y0 + franja_h - hueco * 0.7):
                    img[int(yy):int(yy + hueco * 0.42), int(x):int(x + 11)] = pr.hexa('#2a2a2a')
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
        x0 = margen + 12 + c * (cuadro_w + 12)
        yc = y0 + hueco
        img[int(yc):int(yc) + gris.shape[0], int(x0):int(x0) + gris.shape[1]] = gris[..., None] * np.array([0.98, 0.97, 0.95], np.float32)
        marcos.append((x0, yc, cuadro_w, cuadro_h))
    # tres elegidas con lápiz rojo: un óvalo a mano alzada, que no cierra justo
    capa = np.zeros((H, W), np.uint8)
    for i in (2, 9, 15):
        x0, y0, cw, ch = marcos[i]
        t = np.linspace(0, 2 * math.pi * 1.08, 90)
        rx, ry = cw * 0.6, ch * 0.66
        jit = np.cumsum(rng.normal(0, 0.8, (len(t), 2)), 0)
        xs = x0 + cw / 2 + rx * np.cos(t + 0.3) + jit[:, 0]
        ys = y0 + ch / 2 + ry * np.sin(t + 0.3) + jit[:, 1]
        cv2.polylines(capa, [np.stack([xs, ys], 1).astype(np.int32).reshape(-1, 1, 2)], False, 255, 7, cv2.LINE_AA)
    a = pr.suave(capa.astype(np.float32) / 255, 0.8)[..., None] * 0.9
    img = img * (1 - a) + pr.CARMIN * a
    img = pr.rayas(img, 62, n=5, polvo=120, color=pr.CARBON, fuerza=0.25)
    return pr.grano(img, 0.035, 62, 0.6)


def p07():
    """Día 0 al mediodía, papel: la estrella de Hight quemada en el papel, como una luz que entra de golpe."""
    img = pr.lienzo(W, H, pr.HUESO)
    # los seis colores se cuelan por las orillas del papel
    luz = np.zeros_like(img)
    esquinas = [(0.02, 0.06), (0.98, 0.1), (1.0, 0.55), (0.96, 0.97), (0.04, 0.94), (0.0, 0.5)]
    for i, (color, (ex, ey)) in enumerate(zip(pr.SEIS.values(), esquinas)):
        luz += pr.fuga(H, W, ex * W, ey * H, W * 0.24, color, 71 + i)
    img = pr.colar(img, luz, 0.6)
    # el destello en cruz detrás de la estrella, como una luz que entra de golpe
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = np.abs(xx - W / 2) / W, np.abs(yy - H * 0.47) / H
    cruz = np.exp(-dy * 90) * np.exp(-dx * 2.2) + np.exp(-dx * 90) * np.exp(-dy * 2.2)
    img = img * (1 - 0.5 * cruz[..., None]) + pr.AZUL * 0.5 * cruz[..., None]
    img = pr.brillo_estrella(img, W / 2, H * 0.47, int(W * 0.5), pr.AZUL_HONDO, halo=pr.AZUL * 0.6 + 0.4, fuerza=1.0)
    # el centro de la estrella se quema en blanco, como una luz muy fuerte
    nucleo = np.exp(-((xx - W / 2) ** 2 + (yy - H * 0.47) ** 2) / (2 * (W * 0.045) ** 2)) * pr.estrella_en(W, H, W / 2, H * 0.47, int(W * 0.5))
    img = img + (1 - img) * nucleo[..., None] * 0.95
    img = pr.rayas(img, 72, n=8, polvo=150, color=pr.CARBON, fuerza=0.3)
    return pr.grano(img, 0.04, 72, 0.7)


def p08():
    """Día 0 a las 8:00 p. m., noche: las 20 piezas reveladas, limpias, en el orden de los colores."""
    img = pr.estudio(np.zeros((10, 10, 4), np.float32), W, H)
    cols, filas = 4, 5
    mx, my = 50, 60
    cw, ch = (W - 2 * mx) / cols, (H - 2 * my) / filas
    for i, nombre in enumerate(ORDEN_20):
        f, c = divmod(i, cols)
        pz = recorte(nombre)
        k = min(ch * 0.86 / pz.shape[0], cw * 0.86 / pz.shape[1])
        p = pr.escala(pz, k)
        x = int(mx + c * cw + (cw - p.shape[1]) / 2)
        y = int(my + f * ch + (ch - p.shape[0]) / 2)
        a = pr.alfa_en(img.shape, p, x, y + 6)
        img = img * (1 - pr.suave(a, 10)[..., None] * 0.5)
        img = pr.pegar(img, p, x, y)
    return pr.grano(img, 0.015, 81, 0.4)


def p09():
    """Día +1, papel: las doce correas en tinta roja y negra sobre hueso, de una copia de la foto real."""
    foto = np.asarray(Image.open(FOTO_CORREAS).convert('RGBA'), np.float32) / 255
    return pr.luz_roja(foto[60:1560, 0:1200], W, H, seed=91, papel=True, zoom=1.0, celda=2)


def p10():
    """Radiactivo, noche: la Chaqueta Smiley Ácido como luz ácida que se corre."""
    return pr.fantasma(recorte('chaqueta-smiley-acido'), W, H, color=pr.ACIDO, seed=101, corrido=0.16, zoom=0.82, intensidad=0.62)


def p11():
    """Sangre Fría, papel: la Camiseta Célula Carmín en negativo con tinta roja."""
    return pr.negativo(recorte('camiseta-celula-carmin'), W, H, tinta=pr.CARMIN, seed=111, estrella_en=(0.7, 0.24), zoom=0.95)


def p12():
    """Medianoche, noche: el Tejido Anillos Índigo en cianotipia."""
    return pr.cianotipia(recorte('tejido-anillos-indigo'), W, H, seed=121)


def p13():
    """Chicle, papel: el Jean Patchwork Estrellas Violeta escaneado, con fugas de luz magenta."""
    j = recorte('jean-patchwork-estrellas-violeta')
    return pr.escaneo([(j, 0.5, 0.52, 0.92)], W, H, [pr.MAGENTA, pr.MAGENTA, pr.MAGENTA], seed=131, luz_fuerza=1.0)


def p14():
    """Asfalto, noche: el Buzo Multitud Térmica en plata, de noche."""
    return pr.plata(recorte('buzo-multitud-termica'), W, H, seed=141, fuga_color=pr.CENIZA)


def p15():
    """Fiera, papel: el Jean Flare Patchwork Leopardo y el Jean Patchwork Cuadros escaneados y virados, con una fuga
    del color del leopardo."""
    a, b = recorte('jean-flare-patchwork-leopardo'), recorte('jean-patchwork-cuadros')
    img = pr.escaneo([(a, 0.42, 0.5, 0.92), (b, 0.6, 0.52, 0.9)], W, H, [pr.LEOPARDO, pr.LEOPARDO], seed=151)
    return pr.tonificar(img, pr.LEOPARDO, 0.5)


POSTS = {1: p01, 2: p02, 3: p03, 4: p04, 5: p05, 6: p06, 7: p07, 8: p08, 9: p09, 10: p10, 11: p11, 12: p12, 13: p13,
         14: p14, 15: p15}
# Los carruseles: el post de cada colección y, detrás, sus prendas limpias
CARRUSELES = {10: 'acido', 11: 'carmin', 12: 'indigo', 13: 'magenta', 14: 'ceniza', 15: 'leopardo'}


def vista_previa():
    """La cuadrícula del perfil con los 15 posts, el más nuevo arriba a la izquierda. Instagram muestra cada post de la
    cuadrícula en 3:4: le quita unos 34 píxeles a cada lado, y al abrirlo se ve entero."""
    tw, th, g = 360, 480, 4
    lado = round((W - H * 3 / 4) / 2)
    hoja = Image.new('RGB', (3 * tw + 2 * g, 5 * th + 4 * g), (255, 255, 255))
    for i, n in enumerate(sorted(POSTS, reverse=True)):
        post = Image.open(SALIDA / f'{n:02d}.jpg').crop((lado, 0, W - lado, H))
        hoja.paste(post.resize((tw, th), Image.LANCZOS), ((i % 3) * (tw + g), (i // 3) * (th + g)))
    ruta = pr.AQUI / 'vista-previa.jpg'
    hoja.save(ruta, quality=86, optimize=True)
    print(ruta.relative_to(pr.RAIZ))


def main():
    SALIDA.mkdir(exist_ok=True)
    pedidos = [int(n) for n in sys.argv[1:]] or list(POSTS)
    for n in pedidos:
        guarda(POSTS[n](), f'{n:02d}')
        if n in CARRUSELES:
            for i, nombre in enumerate(COLECCIONES[CARRUSELES[n]], 2):
                guarda(limpia(nombre), f'{n:02d}-{i}')
    if all((SALIDA / f'{n:02d}.jpg').exists() for n in POSTS):
        vista_previa()


if __name__ == '__main__':
    main()
