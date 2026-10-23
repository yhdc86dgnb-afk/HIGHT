#!/usr/bin/env python3
"""Prepara las imágenes de los posts a partir de copias de las fotos de la tienda (las fotos originales no se tocan).

Por prenda deja en imagenes/:
  <prenda>-recorte.webp   la prenda sola, sobre fondo transparente (con la máscara del generador 360)
  <prenda>-ciano.webp     la misma, en cianotipo: azul de Prusia, sombras de noche y luces casi blancas
  <prenda>-bn.webp        la misma, en blanco y negro con contraste de revista
  <prenda>-dibujo.webp    el dibujo en vector del visor 360, sin el fondo blanco
  detalle-<nombre>.webp   un detalle de cerca, cuadrado, para las hojas de detalles y la lupa

Uso: python3 preparar.py <carpeta de trabajo del 360 (con productos/<prenda>/foto.jpg y foto-mascara.png)> <carpeta del tema>
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter, ImageOps, ImageEnhance

PRENDAS = [
    'jean-flare-patchwork-leopardo', 'jean-flare-dragon-acido', 'camiseta-celula-carmin', 'top-malla-asimetrico-rojo',
    'jean-wide-patchwork-indigo', 'jean-wide-fleco-indigo', 'top-crop-rostros', 'top-halftone-carmin',
    'tejido-deshilado-ceniza', 'buzo-destroyed-ceniza', 'tejido-anillos-indigo', 'jean-patchwork-cuadros',
    'short-camuflado-leopardo-rosa', 'jean-patchwork-estrellas-violeta', 'jean-flare-destroyed-verde',
    'chaqueta-smiley-acido', 'buzo-multitud-termica', 'chaqueta-trouble-maker', 'jean-flare-costura-neon',
]
MAX = 1500


def crop_alpha(im, margin=0.02):
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box:
        return im
    m = int(max(im.size) * margin)
    box = (max(0, box[0] - m), max(0, box[1] - m), min(im.width, box[2] + m), min(im.height, box[3] + m))
    im = im.crop(box)
    if max(im.size) > MAX:
        s = MAX / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return im


def box(x, r):
    """Promedio en una caja de 2r + 1 píxeles de lado, con los bordes repetidos."""
    for axis in (0, 1):
        pad = [(r + 1, r) if k == axis else (0, 0) for k in range(x.ndim)]
        c = np.cumsum(np.pad(x, pad, mode='edge'), axis=axis, dtype=np.float64)
        n = c.shape[axis] - 2 * r - 1
        x = (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(n), axis=axis)) / (2 * r + 1)
    return x


def defringe(im, r=4):
    """El borde del recorte trae algo del fondo blanco de la foto, que sobre la noche se ve como un halo. Los píxeles a
    medio cubrir toman el color de la tela que tienen al lado; el alfa no cambia."""
    rgba = np.asarray(im, dtype=np.float32)
    a = rgba[..., 3] / 255
    weight = (a > 0.94).astype(np.float32)
    color = rgba[..., :3] * weight[..., None]
    for _ in range(3):
        weight, color = box(weight, r), box(color, r)
    edge = (a <= 0.94) & (weight > 0.002)
    out = rgba.copy()
    out[..., :3][edge] = (color / np.maximum(weight, 1e-6)[..., None])[edge]
    return Image.fromarray(out.round().clip(0, 255).astype(np.uint8), 'RGBA')


def tone(rgba, stops):
    """Pasa la luminancia por una escala de colores (sombras → medios → luces) y deja el alfa como estaba."""
    gray = ImageOps.autocontrast(rgba.convert('L'), cutoff=1)
    colored = ImageOps.colorize(gray, black=stops[0], mid=stops[1], white=stops[2], midpoint=118)
    colored.putalpha(rgba.getchannel('A'))
    return colored


def drawing_alpha(path):
    """El dibujo del 360 viene sobre blanco: lo blanco que toca el borde se vuelve transparente."""
    im = Image.open(path).convert('RGB')
    small = im.resize((im.width // 2, im.height // 2), Image.BILINEAR)
    w, h = small.size
    px = small.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        q.extend([(0, y), (w - 1, y)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        r, g, b = px[x, y]
        if r < 236 or g < 236 or b < 236:
            continue
        seen[y * w + x] = 1
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    mask = Image.frombytes('L', (w, h), bytes(0 if s else 255 for s in seen))
    mask = mask.resize(im.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
    im.putalpha(mask)
    return crop_alpha(im, 0.01)


# Detalles de cerca: (prenda, nombre, centro x, centro y, lado), en fracciones del recorte.
DETALLES = [
    ('jean-flare-patchwork-leopardo', 'mariposas', 0.67, 0.47, 0.36),
    ('chaqueta-smiley-acido', 'pintura', 0.65, 0.22, 0.36),
    ('top-halftone-carmin', 'semitono', 0.5, 0.36, 0.42),
    ('jean-wide-fleco-indigo', 'flecos', 0.42, 0.5, 0.5),
    ('tejido-anillos-indigo', 'argollas', 0.48, 0.36, 0.32),
    ('chaqueta-trouble-maker', 'espiral', 0.82, 0.32, 0.32),
    ('chaqueta-smiley-acido', 'lupa', 0.62, 0.24, 0.44),
]


def detail(cut, cx, cy, side):
    s = side * max(cut.size)
    x0, y0 = cut.width * cx - s / 2, cut.height * cy - s / 2
    box = tuple(round(v) for v in (max(0, x0), max(0, y0), min(cut.width, x0 + s), min(cut.height, y0 + s)))
    flat = Image.new('RGBA', cut.size, (196, 199, 205, 255))
    flat.alpha_composite(cut)
    return flat.crop(box).convert('RGB').resize((900, 900), Image.LANCZOS)


def main():
    work, theme = sys.argv[1], sys.argv[2]
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'imagenes')
    os.makedirs(out, exist_ok=True)
    for h in PRENDAS:
        d = os.path.join(work, 'productos', h)
        foto = Image.open(os.path.join(d, 'foto.jpg')).convert('RGB')
        mask = Image.open(os.path.join(d, 'foto-mascara.png')).convert('L').resize(foto.size, Image.BILINEAR)
        mask = mask.filter(ImageFilter.GaussianBlur(1.0))
        cut = foto.copy()
        cut.putalpha(mask)
        cut = defringe(crop_alpha(cut))
        cut.save(os.path.join(out, f'{h}-recorte.webp'), quality=88)
        tone(cut, ('#040b1c', '#1d4f8a', '#e6efff')).save(os.path.join(out, f'{h}-ciano.webp'), quality=86)
        bn = ImageEnhance.Contrast(cut.convert('LA').convert('RGBA')).enhance(1.25)
        bn.putalpha(cut.getchannel('A'))
        bn.save(os.path.join(out, f'{h}-bn.webp'), quality=86)
        dib = os.path.join(theme, 'assets', f'360-{h}-frente.webp')
        if os.path.exists(dib):
            drawing_alpha(dib).save(os.path.join(out, f'{h}-dibujo.webp'), quality=88)
        print(h, cut.size)
    for h, name, cx, cy, side in DETALLES:
        cut = Image.open(os.path.join(out, f'{h}-recorte.webp')).convert('RGBA')
        detail(cut, cx, cy, side).save(os.path.join(out, f'detalle-{name}.webp'), quality=88)
    # La Chaqueta blood rose todavía no tiene foto: solo su dibujo, sacado de su boceto.
    dib = os.path.join(theme, 'assets', '360-chaqueta-blood-rose-frente.webp')
    drawing_alpha(dib).save(os.path.join(out, 'chaqueta-blood-rose-dibujo.webp'), quality=88)


if __name__ == '__main__':
    main()
