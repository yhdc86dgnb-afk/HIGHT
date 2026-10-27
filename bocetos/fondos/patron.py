#!/usr/bin/env python3
"""Fondo de logos de Hight, como un estampado de perchas: el logo gótico en contorno, repetido en filas corridas,
cada uno un poco girado y de un color distinto al de sus vecinos. El patrón empalma por los cuatro lados, así que se
puede repetir sin que se note la unión.

Sale en tres paletas (pastel, marca y carbón) y en dos tamaños: el cuadro de 2400 × 2400 para repetir (web, papel de
seda, bolsas) y la historia de 1080 × 1920.

Uso, desde la raíz del repo: python3 bocetos/fondos/patron.py
"""
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

AQUI = Path(__file__).resolve().parent
LOGO = AQUI.parent.parent / 'assets' / 'hight-logo-tinta.webp'

PALETAS = {
    # los colores suaves de la imagen de referencia, sobre blanco
    'pastel': {'fondo': '#ffffff', 'colores': ['#6cb6d8', '#f2a5d6', '#9edfb5', '#f3e98f', '#b3b3b3']},
    # los colores de las seis colecciones de la tienda, sobre papel
    'marca': {'fondo': '#faf6ee', 'colores': ['#dff04a', '#c3142d', '#5b7cfa', '#e0218a', '#c4beb2', '#c08a4e']},
    # los mismos seis sobre carbón
    'carbon': {'fondo': '#0d0c0b', 'colores': ['#dff04a', '#c3142d', '#5b7cfa', '#e0218a', '#c4beb2', '#c08a4e']},
}
# ancho, alto, columnas, filas (pares, para que las filas corridas empalmen) y grosor del trazo en px
FORMATOS = {
    'cuadro': (2400, 2400, 6, 8, 3),
    'historia': (1080, 1920, 5, 12, 2),
}


def silueta():
    """El logo como silueta limpia: se cierran los poros de la textura para que el contorno no salga picado."""
    alfa = Image.open(LOGO).convert('RGBA').getchannel('A')
    return alfa.point(lambda v: 255 if v > 90 else 0).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))


def contorno(sil, ancho, trazo):
    """El borde del logo a `ancho` px, con un trazo de `trazo` px, suavizado."""
    alto = round(ancho * sil.height / sil.width)
    grande = sil.resize((ancho * 3, alto * 3), Image.LANCZOS).point(lambda v: 255 if v > 127 else 0)
    anillo = ImageChops.subtract(grande.filter(ImageFilter.MaxFilter(6 * trazo + 1)), grande)
    return anillo.resize((ancho, alto), Image.LANCZOS)


def patron(sil, w, h, cols, filas, trazo, fondo, colores, semilla=7):
    rnd = random.Random(semilla)
    lienzo = Image.new('RGB', (w, h), fondo)
    cw, ch = w / cols, h / filas
    color = {}
    for r in range(filas):
        corrida = 0.5 if r % 2 else 0
        for c in range(cols):
            # ningún vecino del mismo color, contando los del otro lado de la unión; si con cinco colores no alcanza,
            # cuentan solo los de al lado y los de arriba
            lado = 1 if r % 2 else -1
            cerca = {(r, c - 1), (r - 1, c), (r - 1, c + lado)}
            union = set()
            if c == cols - 1:
                union.add((r, 0))
            if r == filas - 1:
                union |= {(0, c), (0, (c - lado) % cols)}
            usado = lambda celdas: {color.get((vr % filas, vc % cols)) for vr, vc in celdas}
            libres = [k for k in range(len(colores)) if k not in usado(cerca | union)]
            libres = libres or [k for k in range(len(colores)) if k not in usado(cerca)]
            color[(r, c)] = rnd.choice(libres)
            x = (c + 0.5 + corrida) * cw + rnd.uniform(-0.08, 0.08) * cw
            y = (r + 0.5) * ch + rnd.uniform(-0.08, 0.08) * ch
            ancho = round(0.62 * cw * rnd.uniform(0.9, 1.1))
            marca = contorno(sil, ancho, trazo).rotate(rnd.uniform(-40, 40), resample=Image.BICUBIC, expand=True)
            tinta = Image.new('RGB', marca.size, colores[color[(r, c)]])
            # se dibuja también del otro lado de cada borde, para que el patrón empalme
            for dx in (-w, 0, w):
                for dy in (-h, 0, h):
                    lienzo.paste(tinta, (round(x - marca.width / 2) + dx, round(y - marca.height / 2) + dy), marca)
    return lienzo


def main():
    sil = silueta()
    for nombre, p in PALETAS.items():
        for formato, (w, h, cols, filas, trazo) in FORMATOS.items():
            img = patron(sil, w, h, cols, filas, trazo, p['fondo'], p['colores'])
            destino = AQUI / f'{formato}-{nombre}.png'
            img.save(destino, optimize=True)
            print(destino.name, img.size)


if __name__ == '__main__':
    main()
