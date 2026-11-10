#!/usr/bin/env python3
"""Primeros planos de la ropa del desfile: solo la tela, la textura y los detalles, sin caras. Cada uno sale de una foto
de originales/salidas-hd/ (las de Real-ESRGAN, con la barra en las caras) recortado en 4:5 y llevado a 1080 × 1350 para
Instagram. Deja detalles/<prenda>-<parte>.jpg y detalles/vista-previa.jpg.
Uso, desde la raíz del repo: python3 bocetos/desfile/detalles.py
"""
from pathlib import Path

from PIL import Image, ImageFilter

AQUI = Path(__file__).resolve().parent
HD = AQUI / 'originales' / 'salidas-hd'
SALIDA = AQUI / 'detalles'
W, H = 1080, 1350

# nombre: (foto, centro x, centro y, ancho), en fracciones de la foto; el alto sale del 4:5
RECORTES = {
    'tejido-anillos-indigo-anillos': ('anillos-fleco-06', .5, .52, 1.0),
    'tejido-anillos-indigo-punto': ('anillos-fleco-06', .5, .78, 1.0),
    'tejido-anillos-indigo-espalda': ('anillos-fleco-08', .45, .48, .85),
    'jean-wide-fleco-indigo-rodilla': ('anillos-fleco-07', .5, .38, 1.0),
    'jean-wide-fleco-indigo-bota': ('anillos-fleco-07', .5, .72, 1.0),
    'jean-wide-fleco-indigo-pierna': ('anillos-fleco-03', .5, .72, .95),
    'chaqueta-blood-rose-cremallera': ('blood-rose-06', .5, .76, 1.0),
    'chaqueta-blood-rose-hombro': ('blood-rose-08', .5, .72, 1.0),
    'chaqueta-blood-rose-pecho': ('blood-rose-estrellas-02', .5, .9, .55),
    'chaqueta-blood-rose-tirador': ('blood-rose-estrellas-03', .42, .5, .45),
    'jean-patchwork-estrellas-violeta-estrella': ('blood-rose-estrellas-09', .5, .55, 1.0),
    'jean-patchwork-estrellas-violeta-bota': ('blood-rose-estrellas-10', .5, .38, 1.0),
    'jean-patchwork-estrellas-violeta-pierna': ('blood-rose-estrellas-06', .5, .66, .65),
    'camiseta-celula-carmin-pecho': ('celula-dragon-01', .5, .3, 1.0),
    'camiseta-celula-carmin-ruedo': ('celula-dragon-01', .5, .72, 1.0),
    'jean-flare-dragon-acido-rotos': ('celula-dragon-02', .5, .3, 1.0),
    'jean-flare-dragon-acido-dragon': ('celula-dragon-02', .5, .72, 1.0),
    'buzo-multitud-termica-estampado': ('multitud-destroyed-01', .5, .36, .55),
    'jean-flare-destroyed-verde-rotos': ('multitud-destroyed-01', .5, .65, .65),
    'chaqueta-trouble-maker-manga': ('trouble-maker-02', .5, .58, 1.0),
    'chaqueta-trouble-maker-espalda': ('trouble-maker-cuadros-05', .5, .64, 1.0),
    'chaqueta-trouble-maker-frente': ('trouble-maker-cuadros-02', .6, .39, .42),
    'jean-patchwork-cuadros-pierna': ('trouble-maker-cuadros-01', .5, .7, .6),
}


def recortar(foto, cx, cy, ancho):
    img = Image.open(HD / f'{foto}.jpg').convert('RGB')
    w = ancho * img.width
    h = w * H / W
    if h > img.height:  # una foto apaisada: manda el alto
        h = img.height
        w = h * W / H
    x0 = min(max(0, cx * img.width - w / 2), img.width - w)
    y0 = min(max(0, cy * img.height - h / 2), img.height - h)
    trozo = img.crop((round(x0), round(y0), round(x0 + w), round(y0 + h)))
    k = W / trozo.width
    out = trozo.resize((W, H), Image.LANCZOS)
    if k > 1.2:  # si se agranda mucho, un poco de nitidez para que no quede blando
        out = out.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    return out, trozo.width


def main():
    SALIDA.mkdir(exist_ok=True)
    for viejo in SALIDA.glob('*.jpg'):
        viejo.unlink()
    fotos = []
    for nombre, (foto, cx, cy, ancho) in RECORTES.items():
        out, origen = recortar(foto, cx, cy, ancho)
        out.save(SALIDA / f'{nombre}.jpg', quality=92, subsampling=0)
        fotos.append(out)
        print(nombre, f'de {origen} px de ancho')
    # vista previa: seis por fila
    t, sep = 270, 8
    filas = (len(fotos) + 5) // 6
    hoja = Image.new('RGB', (6 * t + 7 * sep, filas * (t * 5 // 4 + sep) + sep), (20, 19, 18))
    for i, f in enumerate(fotos):
        hoja.paste(f.resize((t, t * 5 // 4)), (sep + (i % 6) * (t + sep), sep + (i // 6) * (t * 5 // 4 + sep)))
    hoja.save(SALIDA / 'vista-previa.jpg', quality=86)


if __name__ == '__main__':
    main()
