#!/usr/bin/env python3
"""Fondo de logos de Hight, como un estampado de perchas: el logo en plateado sobre negro, repetido en filas
corridas y cada uno un poco girado. El patrón empalma por los cuatro lados, así que se puede repetir sin que se note
la unión.

Sale en cuatro versiones, todas con los logos en el mismo lugar: el logo plateado tal cual, con su brillo de metal; el
logo en contorno plateado, más liviano; el logo en los colores de las seis colecciones de la tienda, sobre el mismo
negro, y el de colores contrarios, el logo en tinta sobre plata. Cada una en dos tamaños: el cuadro de 2400 × 2400 para
repetir (web, papel de seda, bolsas) y la historia de 1080 × 1920.

Uso, desde la raíz del repo: python3 bocetos/fondos/patron.py
"""
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

AQUI = Path(__file__).resolve().parent
ASSETS = AQUI.parent.parent / 'assets'
FONDO = '#0d0c0b'  # el negro carbón de la marca
# el fondo de cada versión, si no es el carbón: el de colores contrarios va sobre plata
FONDOS = {'tinta': '#c8cacd'}
# los colores de las colecciones, en el orden en que rota la tienda: Radiactivo, Sangre Fría, Medianoche, Chicle,
# Asfalto y Fiera
COLECCIONES = ['#dff04a', '#c3142d', '#5b7cfa', '#e0218a', '#c4beb2', '#c08a4e']
# el contorno se pinta con un degradé de plata, como una pieza de metal: claro, brillo, sombra y otra vez claro
PLATA = [(0.0, (196, 198, 201)), (0.3, (246, 246, 244)), (0.5, (128, 130, 135)), (0.72, (214, 215, 217)), (1.0, (150, 152, 156))]
# ancho, alto, columnas, filas (pares, para que las filas corridas empalmen) y grosor del trazo del contorno en px
FORMATOS = {
    'cuadro': (2400, 2400, 6, 8, 3),
    'historia': (1080, 1920, 5, 12, 2),
}


def logo_plata(ancho, plata):
    """El logo de la marca (el plateado o el de tinta) a `ancho` px."""
    return plata.resize((ancho, round(ancho * plata.height / plata.width)), Image.LANCZOS)


def logo_color(ancho, plata, color):
    """El logo plateado a `ancho` px, teñido de `color`: el brillo del metal pasa de la sombra del color, al color y a
    un reflejo claro del mismo color."""
    logo = np.asarray(logo_plata(ancho, plata), float) / 255
    luz = np.clip((logo[..., :3] @ [0.299, 0.587, 0.114] - 0.4) / 0.55, 0, 1)[..., None]
    tono = np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)], float) / 255
    sombra, reflejo = tono * 0.18, tono + (1 - tono) * 0.55
    metal = np.where(luz < 0.5, sombra + (tono - sombra) * luz / 0.5, tono + (reflejo - tono) * (luz - 0.5) / 0.5)
    return Image.fromarray((np.dstack([metal, logo[..., 3:]]) * 255).round().astype(np.uint8), 'RGBA')


def logo_contorno(ancho, silueta, trazo):
    """El borde del logo a `ancho` px, con un trazo de `trazo` px, pintado con el degradé de plata."""
    alto = round(ancho * silueta.height / silueta.width)
    grande = silueta.resize((ancho * 3, alto * 3), Image.LANCZOS).point(lambda v: 255 if v > 127 else 0)
    anillo = ImageChops.subtract(grande.filter(ImageFilter.MaxFilter(6 * trazo + 1)), grande).resize((ancho, alto), Image.LANCZOS)
    degrade = Image.new('RGB', (1, alto))
    for y in range(alto):
        u = y / max(1, alto - 1)
        for (a, ca), (b, cb) in zip(PLATA, PLATA[1:]):
            if a <= u <= b:
                k = (u - a) / (b - a)
                degrade.putpixel((0, y), tuple(round(x + (z - x) * k) for x, z in zip(ca, cb)))
                break
    marca = degrade.resize((ancho, alto)).convert('RGBA')
    marca.putalpha(anillo)
    return marca


def patron(w, h, cols, filas, dibuja, semilla=7, fondo=FONDO):
    """El patrón sobre `fondo`; con fondo=None devuelve solo los logos, sobre transparente."""
    rnd = random.Random(semilla)
    lienzo = Image.new('RGBA', (w, h), fondo or (0, 0, 0, 0))
    cw, ch = w / cols, h / filas
    for r in range(filas):
        corrida = 0.5 if r % 2 else 0
        for c in range(cols):
            x = (c + 0.5 + corrida) * cw + rnd.uniform(-0.08, 0.08) * cw
            y = (r + 0.5) * ch + rnd.uniform(-0.08, 0.08) * ch
            ancho = round(0.62 * cw * rnd.uniform(0.9, 1.1))
            marca = dibuja(ancho, r, c).rotate(rnd.uniform(-40, 40), resample=Image.BICUBIC, expand=True)
            # se dibuja también del otro lado de cada borde, para que el patrón empalme
            for dx in (-w, 0, w):
                for dy in (-h, 0, h):
                    pega(lienzo, marca, round(x - marca.width / 2) + dx, round(y - marca.height / 2) + dy)
    return lienzo.convert('RGB') if fondo else lienzo


def pega(lienzo, marca, x, y):
    """Compone `marca` sobre `lienzo` en (x, y), recortando lo que cae afuera."""
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(lienzo.width, x + marca.width), min(lienzo.height, y + marca.height)
    if x1 > x0 and y1 > y0:
        lienzo.alpha_composite(marca, (x0, y0), (x0 - x, y0 - y, x1 - x, y1 - y))


def logos(trazo):
    """Las formas de dibujar el logo a un ancho dado, en la fila y la columna del patrón: plateado tal cual, en
    contorno plateado, en los colores de las colecciones (cada uno sigue al de su izquierda y se corre dos en cada
    fila, así que los seis bajan en diagonal) y en tinta."""
    # el logo plateado con un poco más de brillo, para que en tamaño chico siga viéndose como metal sobre el negro
    plata = Image.open(ASSETS / 'hight-logo-plata.webp').convert('RGBA')
    brillo = [round(255 * (i / 255) ** 0.8) for i in range(256)]
    r, g, b, a = plata.split()
    plata = Image.merge('RGBA', (r.point(brillo), g.point(brillo), b.point(brillo), a))
    # la silueta limpia para el contorno: se cierran los poros de la textura para que el borde no salga picado
    silueta = (Image.open(ASSETS / 'hight-logo-tinta.webp').convert('RGBA').getchannel('A')
               .point(lambda v: 255 if v > 90 else 0).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7)))
    tinta = Image.open(ASSETS / 'hight-logo-tinta.webp').convert('RGBA')
    return {
        'plata': lambda ancho, r, c: logo_plata(ancho, plata),
        'plata-contorno': lambda ancho, r, c: logo_contorno(ancho, silueta, trazo),
        'colecciones': lambda ancho, r, c: logo_color(ancho, plata, COLECCIONES[(c + 2 * r) % len(COLECCIONES)]),
        'tinta': lambda ancho, r, c: logo_plata(ancho, tinta),
    }


def main():
    for formato, (w, h, cols, filas, trazo) in FORMATOS.items():
        for nombre, dibuja in logos(trazo).items():
            img = patron(w, h, cols, filas, dibuja, fondo=FONDOS.get(nombre, FONDO))
            destino = AQUI / f'{formato}-{nombre}.png'
            img.save(destino, optimize=True)
            print(destino.name, img.size)


if __name__ == '__main__':
    main()
