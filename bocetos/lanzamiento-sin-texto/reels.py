#!/usr/bin/env python3
"""Los tres reels de la campaña sin texto, en 1080 × 1920 y a 30 cuadros por segundo, sin una sola letra:

  adelanto  día −4  La luz que se cuela por las orillas, el mármol que se revuelve, seis cortes al golpe con los
                    procesos (negativo, luz roja, fantasma, cianotipia, escaneo, plata) y la estrella que cae.
  revelado  día 0   El cuarto oscuro: con la luz roja, las prendas aparecen una por una en el papel, como una copia en
                    la cubeta; se prende la luz y salen las 20 piezas a color; cae la estrella.
  correas   día +1  Las correas en la luz roja de grano suelto, con destellos en las tachas; un latigazo parte la
                    pantalla en dos y cae la estrella.

Los tres cierran igual que los reels anteriores de la marca: la estrella cae de arriba, golpea y suena lo mismo, el
golpe grave y las tres campanas en re mayor. El sonido sale de ../reels/sonido.py (música propia y efectos); cada reel
viene con música (<reel>.mp4) y solo con los efectos (<reel>-sin-musica.mp4), para ponerle una canción en Instagram.

Requiere lo de procesos.py, ffmpeg y la foto de las correas en fuentes/.
Uso, desde la raíz del repo: python3 bocetos/lanzamiento-sin-texto/reels.py [adelanto] [revelado] [correas]
"""
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import procesos as pr
import posts

W, H, FPS = 1080, 1920, 30
SALIDA = pr.AQUI / 'reels'
SONIDO = pr.RAIZ / 'bocetos' / 'reels' / 'sonido.py'


# ---------- Utilidades de movimiento ----------

def entre(t, a, b):
    return float(np.clip((t - a) / (b - a), 0, 1))


def suave(x):
    return x * x * (3 - 2 * x)


def camara(base, z=1.0, cx=0.5, cy=0.5, ang=0.0, dx=0.0, dy=0.0):
    """Encuadra la base: z mayor que 1 acerca, (cx, cy) es el punto que queda en el centro, dx y dy corren el cuadro
    (en píxeles) para los temblores."""
    h, w = base.shape[:2]
    m = cv2.getRotationMatrix2D((cx * w, cy * h), ang, z)
    m[0, 2] += w / 2 - cx * w + dx
    m[1, 2] += h / 2 - cy * h + dy
    return cv2.warpAffine(base, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def destello(img, k, color=(1, 1, 1)):
    return img + (np.asarray(color, np.float32) - img) * float(np.clip(k, 0, 1))


class Granos:
    """Ocho capas de grano que se turnan cada dos cuadros, para que el grano se mueva como en película. Es un poco
    grueso a propósito: el grano de un píxel que cambia en cada cuadro hace pesar el video más de 100 MB y la
    compresión de Instagram lo vuelve una mancha."""

    def __init__(self, fuerza=0.045):
        rng = np.random.default_rng(5)
        self.capas = [pr.suave(rng.normal(0, 1, (H, W)).astype(np.float32), 1.0) * 2.8 for _ in range(8)]
        self.fuerza = fuerza

    def __call__(self, img, f, fuerza=None):
        return np.clip(img + (fuerza or self.fuerza) * self.capas[(f // 2) % 8][..., None], 0, 1)


def temblor(t, golpes, amp=26, dura=0.22, seed=0):
    """El corrimiento del cuadro después de cada golpe: fuerte al golpe y se apaga rápido."""
    dx = dy = 0.0
    for g in golpes:
        if 0 <= t - g < dura:
            k = (1 - (t - g) / dura) ** 2
            rng = np.random.default_rng(int(g * 1000) + seed + int((t - g) * FPS))
            dx += rng.uniform(-1, 1) * amp * k
            dy += rng.uniform(-1, 1) * amp * k
    return dx, dy


def fugas_lienzo(seed=3):
    """Un lienzo grande de luces de colores (los seis de las colecciones) a media resolución, para pasearlo detrás."""
    h, w = H, W
    luz = np.zeros((h, w, 3), np.float32)
    rng = np.random.default_rng(seed)
    for i, c in enumerate(pr.SEIS.values()):
        luz += pr.fuga(h, w, rng.uniform(0, w), rng.uniform(0, h), rng.uniform(0.12, 0.2) * w, c, seed + i)
    return cv2.resize(np.clip(luz, 0, 1), (w // 2, h // 2), interpolation=cv2.INTER_AREA)


def ventana_fugas(lienzo_f, t, vel=(0.05, 0.03), escala=1.6):
    """Un pedazo del lienzo de luces que se mueve con el tiempo, del tamaño del cuadro."""
    h, w = lienzo_f.shape[:2]
    z = escala
    cx = 0.5 + 0.25 * math.sin(t * vel[0] * 2 * math.pi + 0.7)
    cy = 0.5 + 0.25 * math.cos(t * vel[1] * 2 * math.pi)
    m = cv2.getRotationMatrix2D((cx * w, cy * h), t * 4, z)
    m[0, 2] += w / 2 - cx * w
    m[1, 2] += h / 2 - cy * h
    v = cv2.warpAffine(lienzo_f, m, (w, h), borderMode=cv2.BORDER_REFLECT)
    return cv2.resize(v, (W, H), interpolation=cv2.INTER_LINEAR)


class Cierre:
    """El cierre de los tres reels: sobre negro, la estrella cae de arriba, golpea en el centro con un destello y se
    queda encendida, con su resplandor y su cruz de luz, y las luces de colores entrando tenues por las orillas."""

    def __init__(self):
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.yy, self.xx = yy, xx
        self.fugas = np.zeros((H, W, 3), np.float32)
        esquinas = [(0.0, 0.05), (1.0, 0.12), (1.02, 0.55), (0.95, 0.98), (0.05, 0.95), (-0.02, 0.5)]
        for i, (c, (ex, ey)) in enumerate(zip(pr.SEIS.values(), esquinas)):
            self.fugas += pr.fuga(H, W, ex * W, ey * H, W * 0.22, c, 300 + i)
        self.fugas = np.clip(self.fugas, 0, 1)
        self.tam = int(W * 0.44)

    def pintar(self, t, golpe, cy, tam, aparece):
        base = pr.pantalla(np.zeros((H, W, 3), np.float32), self.fugas * (0.12 + 0.13 * aparece))
        brillo = 0.55 + 0.45 * aparece
        img = pr.brillo_estrella(base, W / 2, cy, tam, pr.AZUL_HONDO, halo=pr.AZUL * 0.6 + 0.4, fuerza=brillo)
        if t >= golpe:
            dx, dy = np.abs(self.xx - W / 2) / W, np.abs(self.yy - cy) / H
            cruz = (np.exp(-dy * 90) * np.exp(-dx * 2.0) + np.exp(-dx * 90) * np.exp(-dy * 2.4)) * (0.4 + 0.6 * aparece)
            img = pr.pantalla(img, (pr.AZUL * 0.7 + 0.3) * cruz[..., None] * 0.8)
            nucleo = np.exp(-((self.xx - W / 2) ** 2 + (self.yy - cy) ** 2) / (2 * (W * 0.04) ** 2))
            nucleo = nucleo * pr.estrella_en(W, H, W / 2, cy, tam)
            img = img + (1 - img) * nucleo[..., None] * 0.95
        return img

    def __call__(self, t, golpe):
        """t es el segundo del reel; golpe, el segundo en que la estrella toca el centro."""
        if t < golpe - 0.28:
            return pr.pantalla(np.zeros((H, W, 3), np.float32), self.fugas * 0.12)
        aparece = entre(t, golpe, golpe + 0.8)
        cy_fin = H * 0.47
        if t < golpe + 0.18:
            # cae de arriba y, al golpear, se aplasta un poco y vuelve
            cy = H * (-0.15 + 0.62 * suave(entre(t, golpe - 0.28, golpe)))
            apl = 1 - 0.16 * math.sin(entre(t, golpe, golpe + 0.18) * math.pi) if t >= golpe else 1.0
            img = self.pintar(t, golpe, cy, int(self.tam * apl), aparece)
        else:
            # quieta: se mezclan dos estados guardados, recién llegada y encendida del todo
            if not hasattr(self, 'quieta'):
                self.quieta = [self.pintar(golpe + 1, golpe, cy_fin, self.tam, a) for a in (0.0, 1.0)]
            img = self.quieta[0] * (1 - aparece) + self.quieta[1] * aparece
        img = destello(img, (1 - entre(t, golpe, golpe + 0.35)) ** 2) if t >= golpe else img
        return np.clip(img, 0, 1)


def proceso_vertical(fn, *args, **kw):
    return np.clip(fn(*args, **kw), 0, 1).astype(np.float32)


# ---------- Adelanto ----------

def adelanto():
    b = 60 / 112
    luces, ritmo, cortes, subida, golpe = 0, 4 * b, 10 * b, 16 * b, 18 * b
    fin = golpe + 3.3
    print('adelanto: preparando')
    fugas = fugas_lienzo(11)
    marmol = proceso_vertical(pr.marmol, posts.recorte('buzo-destroyed-ceniza'), W, H, seed=12, bandas=1.6, fuerza=0.3, papel=False)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    fx, fy = pr.ruido(H, W, W * 0.5, 13, 3) - 0.5, pr.ruido(H, W, W * 0.5, 14, 3) - 0.5
    foto_correas = np.asarray(Image.open(posts.FOTO_CORREAS).convert('RGBA'), np.float32) / 255
    planos = [
        proceso_vertical(pr.negativo, posts.recorte('chaqueta-trouble-maker'), W, H, seed=15, estrella_en=(0.32, 0.28), zoom=2.6, foco=(0.9, 0.5)),
        proceso_vertical(pr.luz_roja, foto_correas[170:620, 120:400], W, H, seed=16, celda=3),
        proceso_vertical(pr.fantasma, posts.recorte('chaqueta-blood-rose'), W, H, seed=17, corrido=0.2, zoom=0.9),
        proceso_vertical(pr.cianotipia, posts.recorte('tejido-anillos-indigo'), W, H, seed=18, zoom=1.0),
        proceso_vertical(pr.escaneo, [(posts.recorte('jean-wide-patchwork-indigo'), 0.44, 0.5, 0.95),
                                      (posts.recorte('jean-wide-fleco-indigo'), 0.62, 0.53, 0.9)], W, H,
                         [pr.ACIDO, pr.MAGENTA, pr.AZUL], seed=19),
        proceso_vertical(pr.plata, posts.recorte('buzo-multitud-termica'), W, H, seed=20, fuga_color=pr.CENIZA),
    ]
    fantasma = proceso_vertical(pr.fantasma, posts.recorte('chaqueta-blood-rose'), W, H, seed=22, corrido=0.3, zoom=0.95)
    cierre, granos = Cierre(), Granos()
    golpes = [cortes + i * b for i in range(6)]

    def cuadro(f):
        t = f / FPS
        if t < ritmo:
            # las luces se cuelan por las orillas, cada vez más
            k = suave(entre(t, 0.2, ritmo))
            img = pr.pantalla(np.zeros((H, W, 3), np.float32), ventana_fugas(fugas, t) * (0.1 + 0.6 * k))
            img = destello(img, 0.25 * max(0, math.sin(t * 9)) * k)
        elif t < cortes:
            # el mármol se revuelve: la corriente crece y va girando, con las luces encima
            u = (t - ritmo) / (cortes - ritmo)
            d, a = W * 0.22 * u, u * math.pi * 0.9
            gx, gy = fx * math.cos(a) - fy * math.sin(a), fx * math.sin(a) + fy * math.cos(a)
            img = cv2.remap(marmol, xx + d * gx, yy + d * gy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            img = camara(img, 1.05 + 0.12 * u, 0.5, 0.5, ang=-3 + 9 * u)
            img = pr.colar(img, ventana_fugas(fugas, t), 0.18)
            img = destello(img, (1 - entre(t, ritmo, ritmo + 0.3)) * 0.8)
        elif t < subida:
            i = min(5, int((t - cortes) / b))
            u = (t - golpes[i]) / b
            dx, dy = temblor(t, golpes, 30)
            img = camara(planos[i], 1.08 + 0.1 * u, 0.5, 0.5, dx=dx, dy=dy)
            img = destello(img, (1 - entre(t, golpes[i], golpes[i] + 0.16)) * 0.9)
        elif t < golpe - 0.28:
            # el fantasma se arrastra de lado, cada vez más rápido, y se apaga
            u = (t - subida) / (golpe - 0.28 - subida)
            img = camara(fantasma, 1.0 + 0.25 * u, 0.5 - 0.2 * u, 0.5, dx=math.sin(t * 40) * 12 * u)
            img = cv2.blur(img, (int(1 + 80 * u) | 1, 1)) * (1 - 0.6 * u)
        else:
            img = cierre(t, golpe)
        return granos(img, f)

    sonido = {
        'seconds': round(fin, 2),
        'events': [[0.3, 'whoosh', 0.5], [ritmo, 'golpe', 0.7], [ritmo, 'whoosh', 0.4]]
                  + [[g, 'golpe', 1.0] for g in golpes] + [[subida, 'whoosh', 0.8], [golpe - 0.6, 'subida', 0.9],
                                                            [golpe, 'boom', 1.0]],
        'musica': {'bpm': 112, 'origen': 0, 'golpes': golpes,
                   'secciones': [[0, ritmo, 'entrada'], [ritmo, cortes, 'ritmo'], [cortes, subida, 'golpes'],
                                 [subida, golpe, 'subida'], [golpe, fin, 'caida']]},
    }
    return cuadro, fin, sonido


# ---------- Revelado ----------

def copia(nombre, w, h, alto=0.62):
    """La copia en el papel: la prenda en grises sobre papel, para revelar bajo la luz roja (1 = papel)."""
    pz = posts.recorte(nombre)
    k = min(alto * h / pz.shape[0], 0.7 * w / pz.shape[1])
    p = pr.escala(pz, k)
    img = pr.lienzo(w, h, (1, 1, 1))
    img = pr.pegar(img, p, (w - p.shape[1]) // 2, (h - p.shape[0]) // 2)
    return pr.curva(pr.lum(img), 1.3, 0.5)


def grilla_20(w, h):
    """Las 20 piezas a color sobre carbón, en cuatro columnas, como el post de las 20 reveladas."""
    img = pr.estudio(np.zeros((10, 10, 4), np.float32), w, h)
    cols, filas = 4, 5
    mx, my = 50, 150
    cw, ch = (w - 2 * mx) / cols, (h - 2 * my) / filas
    for i, nombre in enumerate(posts.ORDEN_20):
        f, c = divmod(i, cols)
        pz = posts.recorte(nombre)
        k = min(ch * 0.84 / pz.shape[0], cw * 0.88 / pz.shape[1])
        p = pr.escala(pz, k)
        x, y = int(mx + c * cw + (cw - p.shape[1]) / 2), int(my + f * ch + (ch - p.shape[0]) / 2)
        a = pr.alfa_en(img.shape, p, x, y + 6)
        img = img * (1 - pr.suave(a, 10)[..., None] * 0.5)
        img = pr.pegar(img, p, x, y)
    return img


def revelado():
    b = 60 / 100
    cubeta, piezas, sube, luz = 0, 4 * b, 12 * b, 14 * b
    estrella = luz + 2 * b
    fin = estrella + 3.0
    print('revelado: preparando')
    elegidas = ['jean-flare-dragon-acido', 'top-halftone-carmin', 'tejido-anillos-indigo', 'chaqueta-blood-rose',
                'chaqueta-trouble-maker', 'jean-flare-patchwork-leopardo', 'buzo-multitud-termica', 'jean-wide-patchwork-indigo']
    # el papel en la cubeta: 80 % del cuadro, con la cubeta oscura alrededor
    pw, ph = int(W * 0.82), int(H * 0.74)
    px, py = (W - pw) // 2, (H - ph) // 2
    copias = [copia(n, pw, ph) for n in elegidas]
    grilla = grilla_20(W, H)
    grilla_gris = pr.curva(pr.lum(grilla), 1.2, 0.45)
    cierre, granos = Cierre(), Granos(0.05)
    yy, xx = np.mgrid[0:ph, 0:pw].astype(np.float32)
    rojo_papel, rojo_sombra = pr.hexa('#e0392f'), pr.hexa('#1a0404')
    cubeta_img = np.zeros((H, W, 3), np.float32) + pr.hexa('#0c0202')
    golpes = [piezas + i * b for i in range(8)]

    def bajo_luz_roja(v):
        return pr.mapa(np.clip(v, 0, 1), [(0, rojo_sombra), (0.55, rojo_papel * 0.55), (1, rojo_papel)])

    def cuadro(f):
        t = f / FPS
        if t < sube:
            img = cubeta_img.copy()
            if t < piezas:
                v = np.ones((ph, pw), np.float32)
                onda = 1.0
            else:
                i = min(7, int((t - piezas) / b))
                u = (t - golpes[i]) / b
                d = suave(entre(u, 0.05, 0.85))
                v = 1 - d * (1 - copias[i])
                onda = 1 - u
            # el líquido de la cubeta mueve el papel un poco
            a = 5 * onda + 1.5
            mx_ = xx + a * np.sin(yy / 55 + t * 3.1)
            my_ = yy + a * np.cos(xx / 70 + t * 2.3)
            v = cv2.remap(v, mx_, my_, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            papel = bajo_luz_roja(v)
            img[py:py + ph, px:px + pw] = papel
            # el borde del papel se pierde en la cubeta
            img = pr.suave(img, 1.2)
            luzr = 0.85 + 0.08 * math.sin(t * 2.0)
            img = img * luzr
        elif t < luz:
            # las 20 piezas aparecen juntas bajo la luz roja
            u = suave(entre(t, sube, luz - 0.1))
            v = 1 - u * (1 - grilla_gris)
            img = bajo_luz_roja(v) * (0.85 + 0.15 * u)
            dx, dy = temblor(t, [luz - 0.25], 10)
            img = camara(img, 1.0 + 0.03 * u, dx=dx, dy=dy)
        elif t < estrella - 0.28:
            # se prende la luz: las 20 a color
            u = entre(t, luz, estrella)
            img = camara(grilla, 1.0 + 0.04 * u)
            img = destello(img, (1 - entre(t, luz, luz + 0.4)) ** 2)
        else:
            img = cierre(t, estrella)
        return granos(img, f)

    sonido = {
        'seconds': round(fin, 2),
        'events': [[0.2, 'whoosh', 0.4]] + [[g, 'tic', 0.9] for g in golpes] + [[sube, 'whoosh', 0.6],
                                                                                  [luz - 0.6, 'subida', 0.8],
                                                                                  [luz, 'boom', 1.0], [estrella, 'golpe', 0.8],
                                                                                  [estrella, 'pop', 0.6]],
        'musica': {'bpm': 100, 'origen': 0, 'golpes': [luz],
                   'secciones': [[0, piezas, 'entrada'], [piezas, sube, 'ritmo'], [sube, luz, 'subida'], [luz, fin, 'caida']]},
    }
    return cuadro, fin, sonido


# ---------- Correas ----------

def correas():
    b = 60 / 115
    paseo, cortes, latigo, golpe = 0, 8 * b, 10 * b, 12 * b
    fin = golpe + 3.2
    print('correas: preparando')
    foto = np.asarray(Image.open(posts.FOTO_CORREAS).convert('RGBA'), np.float32) / 255
    fh, fw = foto.shape[:2]
    # los acercamientos de los cortes: de noche y en papel, alternados
    cerca = [proceso_vertical(pr.luz_roja, foto[300:900, 420:760], W, H, seed=31, celda=3),
             proceso_vertical(pr.luz_roja, foto[700:1300, 600:940], W, H, seed=32, papel=True, celda=3),
             proceso_vertical(pr.luz_roja, foto[150:650, 820:1100], W, H, seed=33, celda=3),
             proceso_vertical(pr.luz_roja, foto[900:1500, 250:590], W, H, seed=34, papel=True, celda=3)]
    tira = proceso_vertical(pr.luz_roja, foto[400:1400, 0:1200], W, H, seed=35, celda=2)
    cierre, granos = Cierre(), Granos(0.04)
    golpes_cortes = [cortes + i * b / 2 for i in range(4)]
    destellos_t = [i * b for i in range(1, 8)]

    def cuadro(f):
        t = f / FPS
        if t < cortes:
            # paseo por las hebillas: la ventana baja y se corre, con el grano que hierve
            u = t / cortes
            cw, ch = 360, 640
            x0 = int(40 + u * (fw - cw - 80))
            y0 = int(140 + 120 * math.sin(u * math.pi))
            trozo = foto[y0:y0 + ch, x0:x0 + cw]
            img = pr.luz_roja(trozo, W, H, seed=40 + f // 2, celda=3)
            # destellos en las tachas: estrellitas en los puntos más claros, al golpe
            for d in destellos_t:
                if 0 <= t - d < 0.35:
                    k = 1 - (t - d) / 0.35
                    L = pr.suave(pr.lum(img), 6)
                    yx = np.unravel_index(np.argmax(L[200:-200, 100:-100]), L[200:-200, 100:-100].shape)
                    img = pr.brillo_estrella(img, yx[1] + 100, yx[0] + 200, int(90 * k + 20), (1, 1, 1),
                                             halo=(1, 0.85, 0.8), fuerza=k)
        elif t < latigo:
            i = min(3, int((t - cortes) / (b / 2)))
            dx, dy = temblor(t, golpes_cortes, 24)
            img = camara(cerca[i], 1.06 + 0.06 * ((t - golpes_cortes[i]) / (b / 2)), dx=dx, dy=dy)
            img = destello(img, (1 - entre(t, golpes_cortes[i], golpes_cortes[i] + 0.12)) * 0.7)
        elif t < golpe - 0.28:
            # el latigazo: una correa cruza corrida y la pantalla se parte en dos
            u = entre(t, latigo, latigo + 0.25)
            img = np.zeros((H, W, 3), np.float32) + pr.hexa('#0c0202')
            if u < 1:
                banda = cv2.blur(tira[H // 2 - 150:H // 2 + 150], (161, 1))
                x = int(-W + 2 * W * suave(u))
                img = pr.pegar(img, np.dstack([banda, np.ones(banda.shape[:2], np.float32)]), x, H // 2 - 150)
            s = suave(entre(t, latigo + 0.12, golpe - 0.28))
            arriba = camara(cerca[0], 1.08)[:H // 2]
            abajo = camara(cerca[1], 1.08)[H // 2:]
            sep = int(s * H * 0.5)
            if s > 0:
                img[:H // 2 - sep] = arriba[sep:]
                img[H // 2 + sep:] = abajo[:H // 2 - sep]
                img = destello(img, (1 - entre(t, latigo + 0.12, latigo + 0.3)) * 0.9)
        else:
            img = cierre(t, golpe)
        return granos(img, f)

    sonido = {
        'seconds': round(fin, 2),
        'events': [[d, 'tic', 0.8] for d in destellos_t] + [[g, 'golpe', 0.9] for g in golpes_cortes]
                  + [[latigo, 'latigo', 1.0], [latigo + 0.12, 'whoosh', 0.7], [golpe - 0.6, 'subida', 0.9], [golpe, 'boom', 1.0]],
        'musica': {'bpm': 115, 'origen': 0, 'golpes': golpes_cortes,
                   'secciones': [[0, cortes, 'acelera'], [cortes, latigo, 'golpes'], [latigo, latigo + b, 'pausa'],
                                 [latigo + b, golpe, 'subida'], [golpe, fin, 'caida']]},
    }
    return cuadro, fin, sonido


REELS = {'adelanto': adelanto, 'revelado': revelado, 'correas': correas}


def hacer(nombre):
    cuadro, fin, sonido = REELS[nombre]()
    total = round(fin * FPS)
    SALIDA.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for f in range(total):
            img = cuadro(f)
            Image.fromarray(np.clip(img * 255, 0, 255).round().astype(np.uint8)).save(tmp / f'{f:04d}.jpg', quality=94)
            if f % 60 == 0:
                print(f'{nombre}: cuadro {f} de {total}')
        (tmp / 'sonido.json').write_text(json.dumps(sonido))
        con_musica = SALIDA / f'{nombre}.mp4'
        for sufijo, extra in (('', []), ('-sin-musica', ['--solo-efectos'])):
            wav = tmp / f'sonido{sufijo}.wav'
            subprocess.run([sys.executable, str(SONIDO), str(tmp / 'sonido.json'), str(wav)] + extra, check=True)
            if sufijo:
                # el mismo video de la versión con música, con el otro sonido
                video = ['-i', str(con_musica), '-i', str(wav), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy']
            else:
                # con tope de 10 Mbps, cerca de lo que pesan los reels anteriores: cada reel queda en menos de 20 MB
                video = ['-framerate', str(FPS), '-i', str(tmp / '%04d.jpg'), '-i', str(wav), '-c:v', 'libx264',
                         '-preset', 'slow', '-crf', '20', '-maxrate', '10M', '-bufsize', '20M', '-pix_fmt', 'yuv420p']
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *video, '-c:a', 'aac', '-b:a', '192k', '-shortest',
                            '-movflags', '+faststart', str(SALIDA / f'{nombre}{sufijo}.mp4')], check=True)
            print((SALIDA / f'{nombre}{sufijo}.mp4').relative_to(pr.RAIZ))


def main():
    for nombre in sys.argv[1:] or list(REELS):
        hacer(nombre)


if __name__ == '__main__':
    main()
