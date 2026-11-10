#!/usr/bin/env python3
"""Las fotos originales del desfile en alta: cada una de originales/salidas/ (ya con la barra en las caras) agrandada 4
veces con Real-ESRGAN, un modelo de superresolución que rehace el detalle de la tela, el pelo y la piel en vez de solo
estirar la foto. Deja originales/salidas-hd/<mismo nombre>.jpg, en calidad 95.

Canva entrega varias salidas en una hoja de 1080 × 1350, así que cada salida mide de 157 a 539 px de ancho. Agrandadas
quedan de 628 a 2156 px: sirven para Instagram y para pantallas grandes. El detalle nuevo lo inventa el modelo, así que
la ropa puede cambiar un poco en lo fino (costuras, letras pequeñas): para la ficha de la tienda valen más las fotos reales.

El modelo (RealESRGAN_x4plus.pth, 64 MB) no se guarda en el repo:
  curl -L -o /tmp/RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
Requiere PyTorch y spandrel (pip install torch spandrel).
Uso, desde la raíz del repo: python3 bocetos/desfile/originales_hd.py /tmp/RealESRGAN_x4plus.pth [nombre ...]
"""
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from spandrel import ModelLoader

AQUI = Path(__file__).resolve().parent
ENTRADA = AQUI / 'originales' / 'salidas'
SALIDA = AQUI / 'originales' / 'salidas-hd'
TROZO, SOLAPE = 256, 16  # se agranda por trozos que se pisan, para no llenar la memoria


def agrandar(modelo, img):
    """img: RGB uint8. Devuelve la foto agrandada por la escala del modelo, armada por trozos."""
    k = modelo.scale
    x = torch.from_numpy(img).permute(2, 0, 1).float().div(255)[None]
    _, _, h, w = x.shape
    out = torch.zeros(1, 3, h * k, w * k)
    for y0 in range(0, h, TROZO):
        for x0 in range(0, w, TROZO):
            # cada trozo con un borde de más, que se descarta, para que no se noten las uniones
            a0, b0 = max(0, y0 - SOLAPE), max(0, x0 - SOLAPE)
            a1, b1 = min(h, y0 + TROZO + SOLAPE), min(w, x0 + TROZO + SOLAPE)
            with torch.inference_mode():
                t = modelo(x[:, :, a0:a1, b0:b1])
            y1, x1 = min(h, y0 + TROZO), min(w, x0 + TROZO)
            out[:, :, y0 * k:y1 * k, x0 * k:x1 * k] = t[:, :, (y0 - a0) * k:(y1 - a0) * k, (x0 - b0) * k:(x1 - b0) * k]
    return (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)


def main():
    torch.set_num_threads(max(1, torch.get_num_threads()))
    modelo = ModelLoader().load_from_file(sys.argv[1]).eval()
    SALIDA.mkdir(parents=True, exist_ok=True)
    nombres = sys.argv[2:] or sorted(p.stem for p in ENTRADA.glob('*.jpg'))
    for n in nombres:
        img = np.array(Image.open(ENTRADA / f'{n}.jpg').convert('RGB'))
        hd = Image.fromarray(agrandar(modelo, img))
        hd.save(SALIDA / f'{n}.jpg', quality=95, subsampling=0)
        print(n, f'{img.shape[1]} × {img.shape[0]} →', f'{hd.width} × {hd.height}', flush=True)


if __name__ == '__main__':
    main()
