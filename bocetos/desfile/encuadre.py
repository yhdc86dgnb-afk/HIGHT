#!/usr/bin/env python3
"""El encuadre de referencia para generar las fotos de desfile: una pasarela de concreto que se pierde al fondo, el
público en la sombra a los lados, ventanales altos con luz azul fría detrás y una sola figura gris, sin cara, que camina
de frente, de cuerpo entero. No es una foto de nadie: es un dibujo hecho aquí, para que la IA arme una sola salida a
sangre en vez de un collage, con la luz y el lugar de las referencias de pasarela.

Deja fuentes/encuadre-pasarela.png. Uso, desde la raíz del repo: python3 bocetos/desfile/encuadre.py
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent / 'lanzamiento-sin-texto'))
import procesos as pr  # noqa: E402

W, H = 1136, 1408


def encuadre():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = np.zeros((H, W, 3), np.float32) + pr.hexa('#07090d')
    # los ventanales del fondo: paños de luz azul fría con sus parales
    fondo = (yy < H * 0.46)
    luz = np.clip(1 - np.abs(yy - H * 0.2) / (H * 0.26), 0, 1) ** 0.8
    paral = ((xx % 150) < 14) | ((yy % 170) < 10)
    vidrio = fondo & ~paral & (yy > H * 0.04)
    img[vidrio] = (pr.hexa('#2d4a78') * 0.55 + pr.hexa('#9fb8de') * 0.45 * luz[vidrio][:, None])
    img[fondo & paral] = pr.hexa('#a9bbd6') * (0.35 + 0.5 * luz[fondo & paral][:, None])
    # la pasarela: un piso de concreto claro en perspectiva hacia el centro
    fuga_y = H * 0.46
    piso = yy > fuga_y
    ancho = (yy - fuga_y) / (H - fuga_y)
    dentro = piso & (np.abs(xx - W / 2) < W * (0.06 + 0.62 * ancho))
    tono = 0.32 + 0.38 * ancho
    img[dentro] = pr.hexa('#9b958c') * tono[dentro][:, None]
    img[piso & ~dentro] = pr.hexa('#0d0e10')
    # el público en la sombra a los lados: cabezas y hombros que se pierden
    rng = np.random.default_rng(3)
    publico = np.zeros((H, W), np.float32)
    for _ in range(140):
        lado = rng.choice([-1, 1])
        d = rng.uniform(0.05, 1.0)
        y = fuga_y + d * (H - fuga_y) * 0.95
        x = W / 2 + lado * W * (0.08 + 0.62 * d + rng.uniform(0.0, 0.25))
        r = 8 + 40 * d
        cv2.ellipse(publico, (int(x), int(y - 1.6 * r)), (int(r * 0.55), int(r * 0.7)), 0, 0, 360, 1.0, -1)
        cv2.ellipse(publico, (int(x), int(y)), (int(r * 1.3), int(r)), 0, 0, 360, 1.0, -1)
    publico = pr.suave(publico, 3)[..., None]
    img = img * (1 - 0.85 * publico) + pr.hexa('#15171b') * 0.85 * publico
    # los reflectores: puntos de luz blanca con su halo
    for x, y, r in ((W * 0.18, H * 0.47, 10), (W * 0.82, H * 0.46, 10), (W * 0.33, H * 0.44, 7), (W * 0.67, H * 0.44, 7)):
        halo = np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * (r * 4) ** 2))
        img = img + (1 - img) * halo[..., None] * 0.9
    # la figura: gris, sin cara ni ropa definida, de cuerpo entero y caminando de frente
    figura = np.zeros((H, W), np.uint8)
    cx = W / 2
    cabeza_y, pies_y = H * 0.17, H * 0.9
    alto = pies_y - cabeza_y
    cv2.ellipse(figura, (int(cx), int(cabeza_y + alto * 0.05)), (int(alto * 0.042), int(alto * 0.058)), 0, 0, 360, 255, -1)
    torso = np.array([[cx - alto * 0.11, cabeza_y + alto * 0.14], [cx + alto * 0.11, cabeza_y + alto * 0.14],
                      [cx + alto * 0.095, cabeza_y + alto * 0.5], [cx - alto * 0.095, cabeza_y + alto * 0.5]], np.int32)
    cv2.fillPoly(figura, [torso], 255)
    cv2.line(figura, (int(cx), int(cabeza_y + alto * 0.1)), (int(cx), int(cabeza_y + alto * 0.15)), 255, int(alto * 0.035))
    for lado, paso in ((-1, -0.02), (1, 0.03)):
        cadera = (int(cx + lado * alto * 0.05), int(cabeza_y + alto * 0.48))
        pie = (int(cx + lado * alto * 0.06 + paso * alto), int(pies_y))
        cv2.line(figura, cadera, pie, 255, int(alto * 0.07))
        hombro = (int(cx + lado * alto * 0.105), int(cabeza_y + alto * 0.17))
        mano = (int(cx + lado * alto * 0.13), int(cabeza_y + alto * 0.5))
        cv2.line(figura, hombro, mano, 255, int(alto * 0.04))
    m = pr.suave(figura.astype(np.float32) / 255, 2.5)[..., None]
    sombra = pr.suave(m[..., 0], 6)
    img = img * (1 - 0.5 * np.roll(sombra, 18, axis=0)[..., None] * (yy > pies_y - 30)[..., None])
    gris = pr.hexa('#8a8d92') * (0.75 + 0.35 * np.clip(1 - (yy - cabeza_y) / alto, 0, 1))[..., None]
    img = img * (1 - m) + gris * m
    return pr.grano(np.clip(img, 0, 1), 0.03, 5, 0.8)


if __name__ == '__main__':
    ruta = AQUI / 'fuentes' / 'encuadre-pasarela.png'
    Image.fromarray((encuadre() * 255).astype(np.uint8)).save(ruta, optimize=True)
    print(ruta.relative_to(AQUI.parent.parent))
