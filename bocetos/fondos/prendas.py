#!/usr/bin/env python3
"""Fondo para las fotos de las prendas: el patrón de logos plateados sobre negro, apagado y con una luz suave en el
centro, como un fondo de estudio, para que la prenda sea lo primero que se ve. Sigue la receta de foto de producto del
manual de marca: vertical 4:5, 2.000 px por el lado largo, la prenda centrada y ocupando el 80 % del alto, sin sombras
duras y el mismo fondo para toda la colección.

Saca los dos fondos solos (prenda-plata.png y prenda-plata-contorno.png) y las prendas del Drop 01 puestas encima del
fondo plateado, en prendas/. Las prendas salen de copias recortadas de las fotos de la tienda (bocetos/instagram/
imagenes/); las fotos de la tienda no se tocan.

Uso, desde la raíz del repo: python3 bocetos/fondos/prendas.py
"""
import numpy as np
from PIL import Image, ImageFilter

from patron import AQUI, FONDO, logos, patron

W, H = 1600, 2000
COLS, FILAS, TRAZO = 6, 12, 2
RECORTES = AQUI.parent / 'instagram' / 'imagenes'
# Las prendas que la foto original corta por un lado: ese lado va contra el borde de la foto, para que el corte se vea
# a propósito (igual que en los posts).
CORTES = {'jean-wide-patchwork-indigo': 'der', 'tejido-anillos-indigo': 'der', 'jean-flare-dragon-acido': 'lados'}
LUZ = (40, 38, 35)  # el gris cálido del centro, donde cae la luz


def luz():
    """La luz del estudio: 1 en el centro, un poco arriba, y baja suave hacia los bordes."""
    y, x = np.mgrid[0:H, 0:W]
    d = np.hypot((x - 0.5 * W) / (0.7 * W), (y - 0.46 * H) / (0.7 * H))
    return np.clip(1 - d, 0, 1) ** 1.5


def fondo(dibuja):
    l = luz()[..., None]
    base = np.array([int(FONDO[i:i + 2], 16) for i in (1, 3, 5)], float)
    img = base + (np.array(LUZ, float) - base) * l
    capa = np.array(patron(W, H, COLS, FILAS, dibuja, fondo=None)).astype(float)
    # los logos apagados: casi no se ven en las orillas y un poco más donde cae la luz
    a = capa[..., 3:4] / 255 * (0.14 + 0.3 * l)
    img = img * (1 - a) + capa[..., :3] * a
    return Image.fromarray(np.clip(img, 0, 255).round().astype(np.uint8))


def con_prenda(fondo_img, prenda):
    rec = Image.open(RECORTES / f'{prenda}-recorte.webp').convert('RGBA')
    rec = rec.crop(rec.getchannel('A').getbbox())
    corte = CORTES.get(prenda, '')
    w, h = rec.size
    k = min(W / w, 0.92 * H / h) if corte == 'lados' else min(0.8 * H / h, 0.84 * W / w)
    rec = rec.resize((round(w * k), round(h * k)), Image.LANCZOS)
    x, y = (W - rec.width) // 2, (H - rec.height) // 2
    if corte == 'der':
        x = W - rec.width
    if corte == 'abajo':
        y = H - rec.height
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
        fondos[nombre] = fondo(dibuja)
        fondos[nombre].save(AQUI / f'prenda-{nombre}.png', optimize=True)
        print(f'prenda-{nombre}.png', fondos[nombre].size)
    salida = AQUI / 'prendas'
    salida.mkdir(exist_ok=True)
    for f in sorted(RECORTES.glob('*-recorte.webp')):
        prenda = f.name.replace('-recorte.webp', '')
        con_prenda(fondos['plata'], prenda).save(salida / f'{prenda}.jpg', quality=90, optimize=True)
        print(f'prendas/{prenda}.jpg')


if __name__ == '__main__':
    main()
