#!/usr/bin/env python3
"""La versión en video de cada post del desfile: la misma imagen en 1080 × 1350, con un acercamiento lento que va y
vuelve (así el video se repite sin salto) y su pedazo de música propia de fondo. La luz late apenas en cada compás, como
la luz del escenario al ritmo. Sirve para subir el post con nuestra música, que Instagram no silencia; las fotos sueltas
solo aceptan canciones de la biblioteca de Instagram.

Cada pedazo dura compases enteros, cerca de 12 segundos: 5 compases de neo-psicodelia (98 bpm), 6 de rock psicodélico
(112 bpm) o 5 de pop psicodélico (104 bpm). La tabla MUSICA dice qué pista y desde qué compás lleva cada post, igual que
textos.md.

Requiere los posts (posts.py), la música (musica.py) y ffmpeg. Deja videos/01.mp4 a 20.mp4.
Uso, desde la raíz del repo: python3 bocetos/desfile/videos.py [número ...]
"""
import math
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

AQUI = Path(__file__).resolve().parent
POSTS = AQUI / 'posts'
MUSICA_DIR = AQUI / 'musica'
SALIDA = AQUI / 'videos'
W, H, FPS = 1080, 1350, 30

# pista: (bpm, compases del pedazo)
PISTAS = {'neo-psicodelia': (98, 5), 'rock-psicodelico': (112, 6), 'pop-psicodelico': (104, 5)}
# post: (pista, compás donde empieza, contando desde 0)
MUSICA = {
    1: ('rock-psicodelico', 2), 2: ('pop-psicodelico', 2), 3: ('neo-psicodelia', 2), 4: ('neo-psicodelia', 0),
    5: ('rock-psicodelico', 6), 6: ('neo-psicodelia', 6), 7: ('pop-psicodelico', 6), 8: ('neo-psicodelia', 4),
    9: ('rock-psicodelico', 10), 10: ('rock-psicodelico', 4), 11: ('pop-psicodelico', 4), 12: ('rock-psicodelico', 8),
    13: ('neo-psicodelia', 8), 14: ('neo-psicodelia', 3), 15: ('neo-psicodelia', 7), 16: ('pop-psicodelico', 8),
    17: ('rock-psicodelico', 0), 18: ('neo-psicodelia', 9), 19: ('neo-psicodelia', 10), 20: ('pop-psicodelico', 10),
}


def hacer(n):
    pista, desde = MUSICA[n]
    bpm, compases = PISTAS[pista]
    bar = 4 * 60 / bpm
    dur = compases * bar
    total = round(dur * FPS)
    base = cv2.imread(str(POSTS / f'{n:02d}.jpg'))
    salida = SALIDA / f'{n:02d}.mp4'
    ffmpeg = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS),
         '-i', '-', '-ss', f'{desde * bar:.3f}', '-t', f'{dur:.3f}', '-i', str(MUSICA_DIR / f'{pista}.mp3'),
         '-af', f'afade=t=in:d=0.05,afade=t=out:st={dur - 0.35:.3f}:d=0.35',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '4M', '-bufsize', '8M', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(salida)],
        stdin=subprocess.PIPE)
    for f in range(total):
        t = f / FPS
        # el acercamiento va y vuelve en todo el video
        z = 1 + 0.035 * (0.5 - 0.5 * math.cos(2 * math.pi * t / dur))
        m = cv2.getRotationMatrix2D((W / 2, H * 0.47), 0, z)
        img = cv2.warpAffine(base, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        # la luz late en cada compás y, más suave, en cada tiempo
        en_bar, en_tiempo = t % bar, t % (bar / 4)
        pulso = 0.025 * math.exp(-en_bar / 0.25) + 0.008 * math.exp(-en_tiempo / 0.12)
        if pulso > 0.002:
            img = cv2.convertScaleAbs(img, alpha=1 + pulso, beta=0)
        ffmpeg.stdin.write(img.tobytes())
    ffmpeg.stdin.close()
    if ffmpeg.wait() != 0:
        raise SystemExit(f'ffmpeg falló en el post {n}')
    print(f'{salida.relative_to(AQUI.parent.parent)}: {pista}, desde el compás {desde + 1}, {dur:.1f} s')


def main():
    SALIDA.mkdir(exist_ok=True)
    for n in [int(x) for x in sys.argv[1:]] or list(MUSICA):
        hacer(n)


if __name__ == '__main__':
    main()
