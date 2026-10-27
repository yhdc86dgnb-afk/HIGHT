#!/usr/bin/env python3
"""Fondo para las fotos de las prendas: el patrón de logos plateados sobre negro, apagado y con una luz suave en el
centro, como un fondo de estudio, para que la prenda sea lo primero que se ve. Sigue la receta de foto de producto del
manual de marca: vertical 4:5, 2.000 px por el lado largo, la prenda centrada y ocupando el 80 % del alto, sin sombras
duras y el mismo fondo para toda la colección.

Saca los fondos solos (prenda-<versión>.png, una por cada versión del patrón: plata, plata-contorno, colecciones y
tinta), las prendas del Drop 01 puestas encima del fondo plateado, en prendas/, y una hoja con todas juntas sobre cada
fondo que lleva prendas (prendas.jpg sobre el plateado, prendas-colecciones.jpg y prendas-tinta.jpg). Las prendas
salen de copias recortadas de las fotos de la tienda (bocetos/instagram/imagenes/); las fotos de la tienda no se tocan.

Uso, desde la raíz del repo: python3 bocetos/fondos/prendas.py [colecciones] [tinta]
Con colecciones o tinta, también deja cada prenda sobre ese fondo, en prendas-colecciones/ o prendas-tinta/.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

from patron import AQUI, FONDO, logos, patron

W, H = 1600, 2000
COLS, FILAS, TRAZO = 6, 12, 2
RECORTES = AQUI.parent / 'instagram' / 'imagenes'
# Las prendas que la foto original corta por un lado: ese lado va contra el borde de la foto, para que el corte se vea
# a propósito (igual que en los posts).
CORTES = {'jean-wide-patchwork-indigo': 'der', 'tejido-anillos-indigo': 'der', 'jean-flare-dragon-acido': 'lados',
          'jean-wide-fleco-indigo': 'alto'}
LUZ = (40, 38, 35)  # el gris cálido del centro, donde cae la luz
# El estudio de cada versión, si no es el del negro: el color de las orillas, el de la luz del centro y cuánto se ven
# los logos en la orilla y donde cae la luz. El de colores contrarios es plata, más clara al centro, con los logos en
# tinta más apagados.
ESTUDIO = {'tinta': ((178, 180, 184), (226, 227, 229), 0.1, 0.22)}
# Los fondos que llevan prendas encima, y la hoja de cada uno
CON_PRENDAS = {'plata': 'prendas.jpg', 'colecciones': 'prendas-colecciones.jpg', 'tinta': 'prendas-tinta.jpg'}


def luz():
    """La luz del estudio: 1 en el centro, un poco arriba, y baja suave hacia los bordes."""
    y, x = np.mgrid[0:H, 0:W]
    d = np.hypot((x - 0.5 * W) / (0.7 * W), (y - 0.46 * H) / (0.7 * H))
    return np.clip(1 - d, 0, 1) ** 1.5


def fondo(nombre, dibuja):
    orilla, centro, apagado, con_luz = ESTUDIO.get(nombre, ([int(FONDO[i:i + 2], 16) for i in (1, 3, 5)], LUZ, 0.14, 0.3))
    l = luz()[..., None]
    base = np.array(orilla, float)
    img = base + (np.array(centro, float) - base) * l
    capa = np.array(patron(W, H, COLS, FILAS, dibuja, fondo=None)).astype(float)
    # los logos apagados: casi no se ven en las orillas y un poco más donde cae la luz
    a = capa[..., 3:4] / 255 * (apagado + con_luz * l)
    img = img * (1 - a) + capa[..., :3] * a
    return Image.fromarray(np.clip(img, 0, 255).round().astype(np.uint8))


def con_prenda(fondo_img, prenda):
    rec = Image.open(RECORTES / f'{prenda}-recorte.webp').convert('RGBA')
    rec = rec.crop(rec.getchannel('A').getbbox())
    corte = CORTES.get(prenda, '')
    w, h = rec.size
    if corte == 'lados':
        k = min(W / w, 0.92 * H / h)
    elif corte == 'alto':
        k = min(H / h, 0.92 * W / w)
    else:
        k = min(0.8 * H / h, 0.84 * W / w)
    rec = rec.resize((round(w * k), round(h * k)), Image.LANCZOS)
    x, y = (W - rec.width) // 2, (H - rec.height) // 2
    if corte == 'der':
        x = W - rec.width
    if corte == 'abajo':
        y = H - rec.height
    if corte == 'alto':
        y = 0
    # una sombra suave debajo, como la de una prenda colgada frente al fondo; nada de sombras duras
    alfa = Image.new('L', (W, H), 0)
    alfa.paste(rec.getchannel('A'), (x, y + round(0.012 * H)))
    alfa = alfa.filter(ImageFilter.GaussianBlur(0.018 * W)).point(lambda v: round(v * 0.55))
    sombra = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sombra.putalpha(alfa)
    out = Image.alpha_composite(fondo_img.convert('RGBA'), sombra)
    out.alpha_composite(rec, (x, y))
    return out.convert('RGB')


def main():
    fondos = {}
    for nombre, dibuja in logos(TRAZO).items():
        fondos[nombre] = fondo(nombre, dibuja)
        fondos[nombre].save(AQUI / f'prenda-{nombre}.png', optimize=True)
        print(f'prenda-{nombre}.png', fondos[nombre].size)
    prendas = [f.name.replace('-recorte.webp', '') for f in sorted(RECORTES.glob('*-recorte.webp'))]
    for nombre, hoja_nombre in CON_PRENDAS.items():
        salida = AQUI / ('prendas' if nombre == 'plata' else f'prendas-{nombre}')
        guarda = nombre == 'plata' or nombre in sys.argv[1:]
        if guarda:
            salida.mkdir(exist_ok=True)
        # la hoja: todas juntas, de siete en siete, para verlas de un vistazo
        hoja = Image.new('RGB', (7 * 240, -(-len(prendas) // 7) * 300))
        for i, prenda in enumerate(prendas):
            foto = con_prenda(fondos[nombre], prenda)
            if guarda:
                foto.save(salida / f'{prenda}.jpg', quality=90, optimize=True)
            hoja.paste(foto.resize((240, 300), Image.LANCZOS), ((i % 7) * 240, (i // 7) * 300))
        hoja.save(AQUI / hoja_nombre, quality=88, optimize=True)
        print(hoja_nombre, len(prendas), 'prendas', f'(y cada una en {salida.name}/)' if guarda else '')


if __name__ == '__main__':
    main()
