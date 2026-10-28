#!/usr/bin/env python3
"""Las fotos de la ficha de las correas: los dibujos de las 12 correas sobre el fondo de logos plateados, con la receta
de las fotos de las prendas (bocetos/fondos/prendas.py): 1600 × 2000 y una sombra suave debajo.

Deja en fotos/:
  correas.jpg     las doce de pie, con la hebilla arriba y en el orden de la foto, como están en la mesa
  correa-XX.jpg   cada una sola, en diagonal, con la hebilla arriba a la izquierda

Los dibujos pasan a PNG con dibujos.js (requiere Node con Playwright y Chromium).

Uso, desde la raíz del repo: python3 bocetos/correas/fotos.py
"""
import math
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent / 'fondos'))
import prendas as foto  # noqa: E402

SALIDA = AQUI / 'fotos'


def main():
    SALIDA.mkdir(exist_ok=True)
    fondo = Image.open(AQUI.parent / 'fondos' / 'prenda-plata.png').convert('RGB')
    with tempfile.TemporaryDirectory() as carpeta:
        subprocess.run(['node', str(AQUI / 'dibujos.js'), carpeta, '2'], check=True)
        correas = [Image.open(Path(carpeta) / f'correa-{i:02d}.png').convert('RGBA') for i in range(1, 13)]
    correas = [c.crop(c.getchannel('A').getbbox()) for c in correas]

    # las doce de pie: el 84 % del ancho, con un espacio de un 8 % del ancho de una correa entre una y otra
    ancho = foto.W * 0.84 / (12 + 11 * 0.08)
    de_pie = [c.transpose(Image.ROTATE_270) for c in correas]
    de_pie = [c.resize((round(ancho), round(ancho * c.height / c.width)), Image.LANCZOS) for c in de_pie]
    x0 = round((foto.W - (12 + 11 * 0.08) * ancho) / 2)
    arriba = (foto.H - max(c.height for c in de_pie)) // 2  # las hebillas a la misma altura
    piezas = [(c, x0 + round(i * ancho * 1.08), arriba) for i, c in enumerate(de_pie)]
    foto.pon(fondo, piezas).save(SALIDA / 'correas.jpg', quality=90, optimize=True)

    # cada una en diagonal, con el largo en el 85 % de la diagonal de la foto
    angulo = math.degrees(math.atan2(foto.H, foto.W))
    largo = 0.85 * math.hypot(foto.W, foto.H)
    for i, c in enumerate(correas, 1):
        c = c.resize((round(largo), round(largo * c.height / c.width)), Image.LANCZOS)
        c = c.rotate(-angulo, resample=Image.BICUBIC, expand=True)
        c = c.crop(c.getchannel('A').getbbox())
        img = foto.pon(fondo, [(c, (foto.W - c.width) // 2, (foto.H - c.height) // 2)])
        img.save(SALIDA / f'correa-{i:02d}.jpg', quality=90, optimize=True)
        print(f'fotos/correa-{i:02d}.jpg')


if __name__ == '__main__':
    main()
