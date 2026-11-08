#!/usr/bin/env python3
"""Las fotos originales del desfile: cada salida tal como la generó Canva, recortada de su hoja sin la línea que la separa
de las otras, con las caras tapadas con la misma barra de los posts (un pedazo del fondo de la misma foto; la dice
fuentes/caras.json, que arma caras.py). Fuera de la barra no cambia nada: sin color, sin agrandar y sin el diseño de los
posts. Las espaldas y los detalles no llevan barra.

Deja originales/salidas/<hoja>-NN.jpg (las 42 salidas, en calidad 95 sin submuestreo de color, para no perder nada más de
lo que ya trae el JPG de Canva) y originales/vista-previa.jpg, la hoja de contactos con el nombre de cada archivo.
Las 7 hojas completas, como las entregó Canva, son las de fuentes/pasarela-*.jpg.
Uso, desde la raíz del repo: python3 bocetos/desfile/originales.py
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

import posts  # la barra de las caras, la misma de los posts

AQUI = Path(__file__).resolve().parent
FUENTES = AQUI / 'fuentes'
SALIDA = AQUI / 'originales'
TOMAS = json.loads((FUENTES / 'tomas.json').read_text())


# cada archivo lleva el nombre de su hoja; la de la Chaqueta Trouble Maker con cargos y faldas se pidió con un jean
# patchwork que no salió, así que va solo con el nombre de la chaqueta
PREFIJO = {'trouble-maker-patchwork': 'trouble-maker'}


def nombres():
    """Cada salida con el nombre de su hoja y su número, seguido, en el orden de tomas.json: c1-3 → blood-rose-04."""
    cuenta = {}
    out = {}
    for clave, t in TOMAS.items():
        cuenta[t['collage']] = cuenta.get(t['collage'], 0) + 1
        out[clave] = f"{PREFIJO.get(t['collage'], t['collage'])}-{cuenta[t['collage']]:02d}"
    return out


def main():
    (SALIDA / 'salidas').mkdir(parents=True, exist_ok=True)
    for viejo in (SALIDA / 'salidas').glob('*.jpg'):
        viejo.unlink()
    fotos = []
    nombre = nombres()
    for clave, t in TOMAS.items():
        # el mismo recorte de arriba, ya con la barra en las caras
        foto = Image.fromarray(np.round(np.clip(posts.toma(clave), 0, 1) * 255).astype(np.uint8))
        ruta = SALIDA / 'salidas' / f'{nombre[clave]}.jpg'
        foto.save(ruta, quality=95, subsampling=0)
        fotos.append((ruta.stem, foto))
    # hoja de contactos: cada salida al mismo alto, con el nombre de su archivo debajo
    alto, pie, sep, ancho_max = 300, 22, 10, 1600
    medir = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    filas, fila, x = [], [], 0
    for nombre, foto in fotos:
        w = round(foto.width * alto / foto.height)
        celda = max(w, round(medir.textlength(nombre)) + 6)  # que el nombre no pise la foto de al lado
        if fila and x + celda > ancho_max:
            filas.append(fila)
            fila, x = [], 0
        fila.append((nombre, foto.resize((w, alto), Image.LANCZOS), celda))
        x += celda + sep
    filas.append(fila)
    ancho = max(sum(c for _, _, c in fila) + sep * (len(fila) - 1) for fila in filas)
    hoja = Image.new('RGB', (ancho + 2 * sep, len(filas) * (alto + pie + sep) + sep), (20, 19, 18))
    d = ImageDraw.Draw(hoja)
    y = sep
    for fila in filas:
        x = sep
        for nombre, foto, celda in fila:
            hoja.paste(foto, (x + (celda - foto.width) // 2, y))
            d.text((x + 2, y + alto + 5), nombre, fill=(236, 227, 208))
            x += celda + sep
        y += alto + pie + sep
    hoja.save(SALIDA / 'vista-previa.jpg', quality=86, optimize=True)
    print(len(fotos), 'salidas en', (SALIDA / 'salidas').relative_to(AQUI.parent.parent), '· tamaños de',
          min(f.width for _, f in fotos), 'a', max(f.width for _, f in fotos), 'px de ancho y de',
          min(f.height for _, f in fotos), 'a', max(f.height for _, f in fotos), 'de alto')


if __name__ == '__main__':
    main()
