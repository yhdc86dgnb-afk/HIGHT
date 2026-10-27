#!/usr/bin/env python3
"""Un fondo para cada colección de color de la tienda: el mismo estampado de logos, con los logos en el mismo lugar,
sobre la textura de la colección (la misma que dibuja la tienda: el zigzag de Radiactivo, el semitono de Sangre Fría,
el denim de Medianoche, las manchas de Chicle, la malla de Asfalto y el leopardo de Fiera) y con el logo en un color
que se vea sobre ella.

Deja en por-coleccion/, para cada colección (con su nombre: radiactivo, sangre-fria, medianoche, chicle, asfalto y
fiera):
  prenda-<colección>.jpg    1600 × 2000, para poner detrás de las prendas: la textura apagada en las orillas, una luz
                            suave en el centro y los logos apagados, con la receta del fondo plateado
  historia-<colección>.jpg  1080 × 1920, la textura y los logos enteros
  cuadro-<colección>.png    2400 × 2400, el color de base de la textura con los logos enteros; empalma por los cuatro
                            lados, para repetir
y prendas.jpg, una hoja con las prendas de cada colección sobre su fondo, una fila por colección.

Las texturas salen de assets/hight.css con texturas.js (requiere Node con Playwright y Chromium).

Uso, desde la raíz del repo: python3 bocetos/fondos/por_coleccion.py [prendas]
Con prendas, también deja cada prenda sobre el fondo de su colección, en por-coleccion/prendas/.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from patron import ASSETS, AQUI, FORMATOS, logo_color, patron
import prendas as foto

SALIDA = AQUI / 'por-coleccion'
# Cada colección: su nombre, el color del logo, cuánto se ve la textura (1 entera; las de manchas, que compiten con la
# prenda, más suaves), cuánto se agranda el dibujo de la textura en la foto de 1.600 px y el color de base del cuadro.
# El logo va en el color de la colección, salvo donde se perdería: en Sangre Fría y Chicle va en hueso, como el texto de
# la tienda sobre esos colores, y en Fiera en el café oscuro de las manchas del leopardo.
COLECCIONES = {
    'acido': ('radiactivo', '#dff04a', 1.0, 2.5, '#10150b'),
    'carmin': ('sangre-fria', '#ece3d0', 1.0, 2.5, '#4a050c'),
    'indigo': ('medianoche', '#5b7cfa', 1.0, 2.5, '#141d45'),
    'magenta': ('chicle', '#ece3d0', 0.35, 1.6, '#2b0b20'),
    'ceniza': ('asfalto', '#c4beb2', 1.0, 2.5, '#1c1b19'),
    'leopardo': ('fiera', '#24160a', 0.5, 1.6, '#b98242'),
}
# Las prendas publicadas de cada colección, como en la tienda del 27 de octubre de 2026
PRENDAS = {
    'acido': ['chaqueta-smiley-acido', 'jean-flare-costura-neon', 'jean-flare-destroyed-verde', 'jean-flare-dragon-acido'],
    'carmin': ['camiseta-celula-carmin', 'top-halftone-carmin', 'top-malla-asimetrico-rojo'],
    'indigo': ['jean-wide-fleco-indigo', 'jean-wide-patchwork-indigo', 'tejido-anillos-indigo'],
    'magenta': ['chaqueta-blood-rose', 'jean-patchwork-estrellas-violeta', 'short-camuflado-leopardo-rosa'],
    'ceniza': ['buzo-destroyed-ceniza', 'buzo-multitud-termica', 'chaqueta-trouble-maker', 'chaqueta-trouble-maker-espalda',
               'tejido-deshilado-ceniza', 'top-crop-rostros'],
    'leopardo': ['jean-flare-patchwork-leopardo', 'jean-patchwork-cuadros'],
}


def texturas(carpeta, w, h, escala, coleccion):
    """La textura de la colección a w × h, sacada del CSS de la tienda."""
    subprocess.run(['node', str(AQUI / 'texturas.js'), str(carpeta), str(w), str(h), str(escala), coleccion], check=True)
    tex = Image.open(Path(carpeta) / f'{coleccion}-{w}x{h}.png').convert('RGB')
    return np.asarray(tex.resize((w, h), Image.LANCZOS) if tex.size != (w, h) else tex, float)


def suave(tex, fuerza):
    """La textura acercada a su color medio: con fuerza 1 queda entera."""
    medio = tex.reshape(-1, 3).mean(0)
    return medio + (tex - medio) * fuerza


def con_logos(base, dibuja, w, h, cols, filas, apagado, con_luz=0.0, luz=0.0):
    capa = np.array(patron(w, h, cols, filas, dibuja, fondo=None)).astype(float)
    a = capa[..., 3:4] / 255 * (apagado + con_luz * luz)
    return Image.fromarray(np.clip(base * (1 - a) + capa[..., :3] * a, 0, 255).round().astype(np.uint8))


def main():
    guarda = 'prendas' in sys.argv[1:]
    SALIDA.mkdir(exist_ok=True)
    if guarda:
        (SALIDA / 'prendas').mkdir(exist_ok=True)
    plata = Image.open(ASSETS / 'hight-logo-plata.webp').convert('RGBA')
    brillo = [round(255 * (i / 255) ** 0.8) for i in range(256)]
    r, g, b, a = plata.split()
    plata = Image.merge('RGBA', (r.point(brillo), g.point(brillo), b.point(brillo), a))
    luz = foto.luz()[..., None]
    filas = []
    with tempfile.TemporaryDirectory() as carpeta:
        for coleccion, (nombre, color, fuerza, escala, base) in COLECCIONES.items():
            dibuja = lambda ancho, r, c, color=color: logo_color(ancho, plata, color)
            # detrás de las prendas: la receta del fondo plateado, con la textura en vez del negro
            tex = suave(texturas(carpeta, foto.W, foto.H, escala, coleccion), fuerza)
            fondo = con_logos(tex * (0.32 + 0.68 * luz), dibuja, foto.W, foto.H, foto.COLS, foto.FILAS, 0.16, 0.34, luz)
            fondo.save(SALIDA / f'prenda-{nombre}.jpg', quality=92, optimize=True)
            # la historia, con la textura y los logos enteros
            w, h, cols, filas_h, _ = FORMATOS['historia']
            tex = suave(texturas(carpeta, w, h, round(escala * w / foto.W, 3), coleccion), fuerza)
            con_logos(tex, dibuja, w, h, cols, filas_h, 0.9).save(SALIDA / f'historia-{nombre}.jpg', quality=92, optimize=True)
            # el cuadro, sobre el color de base para que empalme
            w, h, cols, filas_c, _ = FORMATOS['cuadro']
            patron(w, h, cols, filas_c, dibuja, fondo=base).save(SALIDA / f'cuadro-{nombre}.png', optimize=True)
            # la fila de la hoja: el fondo solo y las prendas de la colección encima
            fila = [fondo.resize((240, 300), Image.LANCZOS)]
            for prenda in PRENDAS[coleccion]:
                img = foto.con_prenda(fondo, prenda)
                if guarda:
                    img.save(SALIDA / 'prendas' / f'{prenda}.jpg', quality=90, optimize=True)
                fila.append(img.resize((240, 300), Image.LANCZOS))
            filas.append(fila)
            print(nombre, len(PRENDAS[coleccion]), 'prendas')
    hoja = Image.new('RGB', (max(len(f) for f in filas) * 240, len(filas) * 300), (13, 12, 11))
    for j, fila in enumerate(filas):
        for i, img in enumerate(fila):
            hoja.paste(img, (i * 240, j * 300))
    hoja.save(SALIDA / 'prendas.jpg', quality=88, optimize=True)


if __name__ == '__main__':
    main()
