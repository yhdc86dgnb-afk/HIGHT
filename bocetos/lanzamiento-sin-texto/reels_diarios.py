#!/usr/bin/env python3
"""Los reels de los cuadros de la campaña sin texto, en 1080 × 1920 y a 30 cuadros por segundo, sin una sola letra.
Cada uno anima el proceso de su cuadro y se asienta en la imagen de su portada; los de las colecciones muestran después
sus prendas limpias, una por golpe, para etiquetarlas. Todos cierran con la estrella que cae: sobre negro los de noche
y quemada en el papel los de papel.

  marmol     día −6  El mármol se revuelve y se asienta en la página: el Buzo Destroyed Ceniza derretido.
  fantasma   día −5  La Chaqueta Blood Rose pasa tres veces como luz azul que se corre.
  negativo   día −4  Caen gotas de tinta azul y se revela la espiral de la Chaqueta Trouble Maker en negativo.
  luz-roja   día −3  Las hebillas de las correas en la luz roja, con el grano que hierve y destellos en las tachas.
  escaneo    día −2  La barra del escáner baja sobre los dos jeans wide de Medianoche y se encienden las fugas de luz.
  contactos  día −1  Entran las tiras de la hoja de contactos y el lápiz rojo marca tres cuadros.
  acido      día +2  Radiactivo: la Chaqueta Smiley pasa como luz ácida y salen sus cuatro prendas.
  carmin     día +3  Sangre Fría: gotas de tinta roja revelan la camiseta en negativo y salen sus tres prendas.
  indigo     día +4  Medianoche: la cianotipia se expone, el Tejido Anillos queda en blanco y salen sus tres prendas.
  magenta    día +5  Chicle: el escáner baja sobre el jean de estrellas, se enciende la luz magenta y salen sus tres prendas.
  ceniza     día +6  Asfalto: el Buzo Multitud sale de la noche en plata y salen sus seis fotos (la Chaqueta Trouble
                     Maker de frente y de espalda).
  leopardo   día +7  Fiera: el escáner baja sobre los dos jeans virados al leopardo y salen sus dos prendas.

Cada reel viene con música (<reel>.mp4) y solo con los efectos (<reel>-sin-musica.mp4). Usa lo de reels.py (el grano,
el cierre, el sonido y ffmpeg) y las imágenes de los cuadros de posts.py.
Uso, desde la raíz del repo: python3 bocetos/lanzamiento-sin-texto/reels_diarios.py [reel ...]
"""
import math
import sys

import cv2
import numpy as np

import procesos as pr
import posts
import reels
from reels import FPS, H, W, Cierre, Granos, camara, destello, entre, suave, temblor


# ---------- Movimientos de los procesos ----------

def orden(img, claro_primero=False, seed=0):
    """El turno de cada punto al revelarse, de 0 a 1. En papel sale primero lo oscuro, como una copia en la cubeta; de
    noche, lo claro. Un poco de ruido lo vuelve parejo, como el revelador que no moja todo a la vez."""
    L = pr.suave(pr.lum(img), 3)
    L = (L - L.min()) / max(1e-6, float(L.max() - L.min()))
    o = 1 - L if claro_primero else L
    return np.clip(0.8 * o + 0.2 * pr.ruido(H, W, W * 0.2, seed, 3), 0, 1)


def revelar(final, fondo, u, turnos, ancho=0.4):
    """La imagen que aparece sobre el fondo cuando u va de 0 a 1: cada punto pasa en su turno, en un tramo de ancho."""
    k = np.clip((u * (1 + ancho) - turnos) / ancho, 0, 1)
    k = k * k * (3 - 2 * k)
    return fondo + (final - fondo) * k[..., None]


def barrido(final, fondo, u):
    """La barra del escáner que baja cuando u va de 0 a 1: arriba de la barra ya está la imagen y abajo el papel. La
    barra es una línea de luz con los canales un poco corridos y su resplandor, con la sombra del cabezal justo debajo,
    que es lo que la deja ver sobre el papel claro."""
    y = -60 + u * (H + 120)
    yy = np.arange(H, dtype=np.float32)
    k = np.clip((y - yy) / 30 + 0.5, 0, 1)[:, None, None]
    img = fondo + (final - fondo) * k
    img = img * (1 - 0.24 * np.exp(-((yy - y - 22) / 16) ** 2))[:, None, None]
    luz = np.zeros((H, 1, 3), np.float32)
    for c, dy in zip(range(3), (6, 0, -6)):
        d = yy - y - dy
        luz[:, 0, c] = np.exp(-(d / 4) ** 2) + 0.45 * np.exp(-(d / 55) ** 2)
    return pr.pantalla(img, np.broadcast_to(luz, img.shape) * 0.85)


def corrida(img, dx, barre=0):
    """La imagen corrida dx píxeles de lado y barrida en horizontal, como una luz que se mueve en una toma larga."""
    m = np.float32([[1, 0, dx], [0, 1, 0]])
    out = cv2.warpAffine(img, m, (W, H), borderMode=cv2.BORDER_CONSTANT)
    k = int(barre) | 1
    return cv2.blur(out, (k, 1)) if k > 1 else out


def pasadas(fantasmas, inicios, t, dura=0.5):
    """El fantasma que pasa: en cada inicio entra el siguiente desde la izquierda mientras el anterior se va por la
    derecha, los dos barridos; entre pasadas la luz titila."""
    i = max(0, min(len(fantasmas) - 1, sum(t >= a for a in inicios) - 1))
    e = 1 - (1 - min(1.0, max(0.0, (t - inicios[i]) / dura))) ** 3
    img = corrida(fantasmas[i], -W * 0.8 * (1 - e), 150 * (1 - e))
    if i > 0 and e < 1:
        img = np.maximum(img, corrida(fantasmas[i - 1], W * 0.8 * e, 150 * e))
    return img * (0.9 + 0.1 * math.cos(t * 23))


class Gotas:
    """Gotas de tinta que caen en el papel: cada una se abre en un círculo de borde irregular, primero de tinta y
    después transparente, de modo que deja ver la imagen; al caer suelta un anillo de luz, como los de la referencia."""

    def __init__(self, tiempos, seed, tinta):
        rng = np.random.default_rng(seed)
        self.gotas = [(rng.uniform(0.18, 0.82) * W, rng.uniform(0.2, 0.78) * H, rng.uniform(0.07, 0.15) * W, t0,
                       rng.uniform(0, 2 * math.pi, 3)) for t0 in tiempos]
        self.tinta = np.asarray(tinta, np.float32)

    def __call__(self, img, final, t):
        img = img.copy()
        for x, y, r, t0, fases in self.gotas:
            if t < t0:
                continue
            rr = r * (1 - (1 - min(1.0, (t - t0) / 0.2)) ** 3)
            borde_r = int(r * 1.6) + 8
            x0, x1 = max(0, int(x - borde_r)), min(W, int(x + borde_r))
            y0, y1 = max(0, int(y - borde_r)), min(H, int(y + borde_r))
            yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
            d = np.hypot(xx - x, yy - y)
            th = np.arctan2(yy - y, xx - x)
            borde = rr * (1 + 0.08 * np.sin(5 * th + fases[0]) + 0.05 * np.sin(9 * th + fases[1]) + 0.03 * np.sin(14 * th + fases[2]))
            m = np.clip((borde - d) / 2 + 0.5, 0, 1)[..., None]
            s = entre(t, t0 + 0.3, t0 + 0.8)
            dentro = self.tinta * (1 - s) + final[y0:y1, x0:x1] * s
            parche = img[y0:y1, x0:x1] * (1 - m) + dentro * m
            if t - t0 < 0.4:
                k = 1 - (t - t0) / 0.4
                anillo = np.exp(-((d - rr * (1.05 + 0.35 * (1 - k))) / 5) ** 2) * k
                parche = parche + (1 - parche) * anillo[..., None] * 0.85
            img[y0:y1, x0:x1] = parche
        return img


def destellos(img, t, tiempos, zonas):
    """Estrellitas blancas en el punto más claro de cada zona, al golpe: los brillos de las tachas."""
    for d, (y0, y1, x0, x1) in zip(tiempos, zonas):
        if 0 <= t - d < 0.35:
            k = 1 - (t - d) / 0.35
            L = pr.suave(pr.lum(img[y0:y1, x0:x1]), 6)
            yx = np.unravel_index(np.argmax(L), L.shape)
            img = pr.brillo_estrella(img, x0 + yx[1], y0 + yx[0], int(110 * k + 24), (1, 1, 1), halo=(1, 0.85, 0.8), fuerza=k)
    return img


class Desfile:
    """Las prendas limpias de una colección, una por paso desde inicio: cada una entra con un destello y un temblor y
    se acerca despacio, con la luz de su color que se cuela por una orilla."""

    def __init__(self, coleccion, inicio, paso):
        self.piezas = [posts.limpia(n, W, H) for n in posts.COLECCIONES[coleccion]]
        self.golpes = [inicio + i * paso for i in range(len(self.piezas))]
        self.paso = paso
        self.fin = inicio + len(self.piezas) * paso
        self.luz = pr.fuga(H, W, W * 0.98, H * 0.3, W * 0.36, pr.SEIS[coleccion], 400) * 0.35

    def __call__(self, t):
        i = max(0, min(len(self.piezas) - 1, sum(t >= g for g in self.golpes) - 1))
        u = (t - self.golpes[i]) / self.paso
        dx, dy = temblor(t, self.golpes, 14)
        img = camara(self.piezas[i], 1.0 + 0.05 * u, 0.5, 0.45, dx=dx, dy=dy)
        img = pr.pantalla(img, self.luz)
        return destello(img, (1 - entre(t, self.golpes[i], self.golpes[i] + 0.14)) * 0.6)


def sonido(fin, bpm, secciones, eventos, golpes=()):
    return {'seconds': round(fin, 2), 'events': eventos,
            'musica': {'bpm': bpm, 'origen': 0, 'golpes': list(golpes), 'secciones': secciones}}


def cierre_y(granos, cierre, golpe, antes):
    """El cuadro del reel: antes de que caiga la estrella, lo del proceso (antes); después, el cierre. Con el grano."""
    def cuadro(f):
        t = f / FPS
        img = antes(t) if t < golpe - 0.28 else cierre(t, golpe)
        return granos(np.clip(img, 0, 1), f)
    return cuadro


def colores(*cs):
    return [np.asarray(c, np.float32) for c in cs]


# ---------- Antes del lanzamiento ----------

def marmol():
    """Día −6: el mármol se revuelve y, al compás, se asienta en la página del cuadro."""
    b = 60 / 96
    asienta, golpe = 6 * b, 8 * b
    fin = golpe + 1.8
    print('marmol: preparando')
    portada = posts.p01(W, H)
    alto, arriba = posts.caja(W, H)
    hoja = pr.marmol(posts.recorte('buzo-destroyed-ceniza'), W, alto, seed=8, bandas=1.6, fuerza=0.3, papel=False)
    marmol_v = cv2.copyMakeBorder(hoja, arriba, H - alto - arriba, 0, 0, cv2.BORDER_REFLECT)
    zona = np.zeros((H, W), np.float32)
    zona[arriba:arriba + alto] = pr.pagina(W, alto, 8, 0.07)
    zona = zona[..., None]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    fx, fy = pr.ruido(H, W, W * 0.5, 13, 3) - 0.5, pr.ruido(H, W, W * 0.5, 14, 3) - 0.5

    def antes(t):
        u = suave(entre(t, 0, asienta))
        d, a = W * 0.32 * (1 - u), (1 - u) * math.pi * 0.9
        gx, gy = fx * math.cos(a) - fy * math.sin(a), fx * math.sin(a) + fy * math.cos(a)
        m = cv2.remap(marmol_v, xx + d * gx, yy + d * gy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        img = portada * (1 - zona) + m * zona
        return camara(img, 1.0 + 0.14 * (1 - u) + 0.02 * entre(t, asienta, golpe), ang=6 * (1 - u))

    cuadro = cierre_y(Granos(), Cierre(papel=True), golpe, antes)
    return cuadro, fin, sonido(fin, 96, [[0, 2 * b, 'entrada'], [2 * b, asienta, 'ritmo'], [asienta, golpe, 'subida'],
                                         [golpe, fin, 'caida']],
                               [[0.05, 'whoosh', 0.5], [asienta, 'golpe', 0.7], [golpe - 0.6, 'subida', 0.9],
                                [golpe, 'boom', 1.0]])


def fantasma():
    """Día −5: la Chaqueta Blood Rose pasa tres veces como luz azul, cada vez menos corrida, y se queda."""
    b = 60 / 108
    inicios = [-0.25, 2 * b, 4 * b]
    quieto, golpe = 6 * b, 8 * b
    fin = golpe + 1.8
    print('fantasma: preparando')
    pz = posts.recorte('chaqueta-blood-rose')
    z = posts.zoom34(pz, W, H, 0.82)
    fantasmas = [pr.fantasma(pz, W, H, seed=24, corrido=0.9, zoom=z), pr.fantasma(pz, W, H, seed=27, corrido=0.5, zoom=z),
                 posts.p02(W, H)]

    def antes(t):
        if t < quieto:
            return pasadas(fantasmas, inicios, t)
        return camara(fantasmas[2], 1.0 + 0.05 * entre(t, quieto, golpe))

    cuadro = cierre_y(Granos(), Cierre(), golpe, antes)
    return cuadro, fin, sonido(fin, 108, [[0, quieto, 'golpes'], [quieto, golpe, 'subida'], [golpe, fin, 'caida']],
                               [[0.0, 'whoosh', 0.7], [2 * b - 0.2, 'whoosh', 0.8], [4 * b - 0.2, 'whoosh', 0.8],
                                [2 * b, 'golpe', 0.8], [4 * b, 'golpe', 0.9], [golpe - 0.6, 'subida', 0.9],
                                [golpe, 'boom', 1.0]],
                               golpes=[0.05, 2 * b, 4 * b])


def papel_de(*rayas):
    """El papel hueso con el polvo y las rayas del proceso, para que la imagen se revele en el mismo papel."""
    img = pr.lienzo(W, H, pr.HUESO)
    for seed, n, polvo, color, fuerza in rayas:
        img = pr.rayas(img, seed, n=n, polvo=polvo, color=color, fuerza=fuerza)
    return img


def negativo_que_se_revela(portada, seed, tinta, gotas_t, revela, estrella, destella):
    """El negativo: caen las gotas de tinta, la imagen se revela en el papel y la estrella de la imagen se enciende."""
    papel = papel_de((seed, 10, 140, pr.CARBON, 0.35), (seed + 1, 6, 90, (1, 1, 1), 0.7))
    gotas = Gotas(gotas_t, seed + 2, np.asarray(tinta, np.float32) * 0.8)
    turnos = orden(portada, seed=seed + 3)

    def antes(t):
        img = revelar(portada, papel, entre(t, *revela), turnos)
        img = gotas(img, portada, t)
        if t >= destella:
            k = (1 - entre(t, destella, destella + 0.6)) ** 2
            img = pr.brillo_estrella(img, estrella[0] * W, estrella[1] * H, int(W * 0.11 * (1 + 1.2 * k)), tinta, fuerza=0.9 * k)
        return img
    return antes


def negativo():
    """Día −4: caen gotas de tinta azul, se revela la espiral de la Chaqueta Trouble Maker y se enciende su estrella."""
    b = 60 / 92
    gotas_t = [-0.25, 0.1, 0.4, 0.72, 1.02, 1.36, 1.7]
    destella, golpe = 6 * b, 8 * b
    fin = golpe + 1.8
    print('negativo: preparando')
    antes_n = negativo_que_se_revela(posts.p03(W, H), 31, pr.AZUL_HONDO, gotas_t, (0.9, destella), (0.34, 0.3), destella)

    def antes(t):
        return camara(antes_n(t), 1.0 + 0.06 * suave(entre(t, destella, golpe)), 0.34, 0.3)

    cuadro = cierre_y(Granos(), Cierre(papel=True), golpe, antes)
    return cuadro, fin, sonido(fin, 92, [[0, 2 * b, 'entrada'], [2 * b, destella, 'ritmo'], [destella, 7 * b, 'pausa'],
                                         [7 * b, golpe, 'subida'], [golpe, fin, 'caida']],
                               [[g, 'pop', 0.8] for g in gotas_t] + [[destella, 'golpe', 0.8], [destella, 'tic', 0.6],
                                                                     [golpe - 0.6, 'subida', 0.8], [golpe, 'boom', 1.0]])


def luz_roja():
    """Día −3: las hebillas en la luz roja; la ventana se cierra sobre ellas, el grano hierve y brillan las tachas."""
    b = 60 / 112
    golpe = 8 * b
    fin = golpe + 1.8
    print('luz-roja: preparando')
    foto = posts.foto_correas()
    brillos = [2 * b, 4 * b, 6 * b]
    zonas = [(300, 900, 120, 540), (700, 1300, 540, 960), (1000, 1500, 150, 700)]

    def antes(t):
        f = int(round(t * FPS))
        u = suave(entre(t, 0, golpe))
        cw = 300 - 90 * u
        ch = cw * H / W
        cx, cy = 260, 416 - 90 * u
        trozo = foto[int(cy - ch / 2):int(cy + ch / 2), int(cx - cw / 2):int(cx + cw / 2)]
        img = pr.luz_roja(trozo, W, H, seed=40 + f // 2, celda=3)
        img = img * (0.9 + 0.1 * math.cos(2 * math.pi * t / b))
        return destellos(img, t, brillos, zonas)

    cuadro = cierre_y(Granos(0.04), Cierre(), golpe, antes)
    return cuadro, fin, sonido(fin, 112, [[0, 2 * b, 'entrada'], [2 * b, 7 * b, 'ritmo'], [7 * b, golpe, 'subida'],
                                          [golpe, fin, 'caida']],
                               [[0.05, 'whoosh', 0.4]] + [[d, 'tic', 0.8] for d in brillos]
                               + [[golpe - 0.6, 'subida', 0.9], [golpe, 'boom', 1.0]])


def escaneo_que_baja(piezas, colores_luz, seed, baja, enciende, luz_fuerza=None, virar=None):
    """El escaneo: la barra baja y deja la imagen, y después se encienden las fugas de luz de colores."""
    def escanea(pzs, cols):
        img = pr.escaneo(pzs, W, H, cols, seed=seed, luz_fuerza=luz_fuerza)
        return pr.tonificar(img, virar, 0.5) if virar is not None else img
    con_luz, sin_luz, papel = escanea(piezas, colores_luz), escanea(piezas, []), escanea([], [])

    def antes(t):
        k = suave(entre(t, enciende - 0.3, enciende + 0.5))
        final = sin_luz + (con_luz - sin_luz) * k
        # al empezar, la barra ya va por la pretina: el primer cuadro no queda en blanco
        u = 0.3 + 0.7 * entre(t, 0, baja)
        img = barrido(final, papel, u) if u < 1 else final
        if t >= enciende:
            img = destello(img, (1 - entre(t, enciende, enciende + 0.3)) * 0.35)
        return img
    return antes


def jeans_medianoche():
    a, c = posts.recorte('jean-wide-patchwork-indigo'), posts.recorte('jean-wide-fleco-indigo')
    return [(a, 0.44, 0.5, posts.zoom34(a, W, H, 0.95)), (c, 0.62, 0.53, posts.zoom34(c, W, H, 0.88))]


def escaneo():
    """Día −2: la barra del escáner baja sobre los dos jeans wide de Medianoche y se encienden las fugas de luz."""
    b = 60 / 104
    baja, enciende, golpe = 5 * b, 6 * b, 8 * b
    fin = golpe + 1.8
    print('escaneo: preparando')
    antes_e = escaneo_que_baja(jeans_medianoche(), colores(pr.ACIDO, pr.MAGENTA, pr.AZUL), 51, baja, enciende)

    def antes(t):
        return camara(antes_e(t), 1.0 + 0.04 * entre(t, enciende, golpe))

    cuadro = cierre_y(Granos(), Cierre(papel=True), golpe, antes)
    return cuadro, fin, sonido(fin, 104, [[0, baja, 'ritmo'], [baja, enciende, 'redoble'], [enciende, 7 * b, 'golpes'],
                                          [7 * b, golpe, 'subida'], [golpe, fin, 'caida']],
                               [[0.0, 'whoosh', 0.5], [enciende, 'golpe', 0.9], [enciende, 'whoosh', 0.5],
                                [golpe - 0.6, 'subida', 0.9], [golpe, 'boom', 1.0]],
                               golpes=[enciende])


def contactos():
    """Día −1: las cinco tiras de la hoja de contactos entran al compás y el lápiz rojo marca tres cuadros."""
    b = 60 / 120
    llegan = [i * b for i in range(5)]
    marcas = [6 * b, 7 * b, 8 * b]
    golpe = 10 * b
    fin = golpe + 1.8
    print('contactos: preparando')
    papel, tiras, ovalos = posts.hoja_contactos(W, H)

    def antes(t):
        img = papel.copy()
        for (x, y, tira), t0 in zip(tiras, llegan):
            u = entre(t, t0 - 0.2, t0 + 0.25)
            if u <= 0:
                continue
            x1 = x + int(W * (1 - u) ** 3)
            if x1 < W:
                img[y:y + tira.shape[0], x1:min(W, x1 + tira.shape[1])] = tira[:, :min(W, x1 + tira.shape[1]) - x1]
        img = posts.lapiz(img, ovalos, [entre(t, m, m + 0.45) for m in marcas])
        img = pr.rayas(img, 62, n=5, polvo=120, color=pr.CARBON, fuerza=0.25)
        return camara(img, 1.0 + 0.05 * suave(entre(t, marcas[0], golpe)))

    cuadro = cierre_y(Granos(), Cierre(papel=True), golpe, antes)
    return cuadro, fin, sonido(fin, 120, [[0, 6 * b, 'ritmo'], [6 * b, 9 * b, 'golpes'], [9 * b, golpe, 'subida'],
                                          [golpe, fin, 'caida']],
                               [[t0 + 0.1, 'tic', 0.8] for t0 in llegan] + [[m, 'golpe', 0.6] for m in marcas]
                               + [[m, 'whoosh', 0.3] for m in marcas] + [[golpe - 0.6, 'subida', 0.9], [golpe, 'boom', 1.0]],
                               golpes=marcas)


# ---------- Las colecciones ----------

def con_desfile(coleccion, b, proceso_hasta, antes_p, eventos_p, secciones_p, golpes_p, papel):
    """Una colección: su proceso hasta proceso_hasta, un compás para tomar aire y sus prendas limpias, una cada dos
    tiempos; después cae la estrella."""
    desfile = Desfile(coleccion, proceso_hasta + b, 2 * b)
    golpe = desfile.fin
    fin = golpe + 1.8

    def antes(t):
        return antes_p(t) if t < desfile.golpes[0] else desfile(t)

    cuadro = cierre_y(Granos(), Cierre(papel=papel), golpe, antes)
    eventos = (eventos_p + [[g, 'golpe', 0.7] for g in desfile.golpes] + [[g, 'whoosh', 0.3] for g in desfile.golpes]
               + [[golpe - 0.6, 'subida', 0.8], [golpe, 'boom', 1.0]])
    secciones = secciones_p + [[proceso_hasta, desfile.golpes[0], 'subida'], [desfile.golpes[0], golpe, 'acelera'],
                               [golpe, fin, 'caida']]
    return cuadro, fin, sonido(fin, round(60 / b), secciones, eventos, golpes=golpes_p + desfile.golpes)


def acido():
    """Día +2, Radiactivo: la Chaqueta Smiley pasa dos veces como luz ácida y salen las cuatro prendas."""
    b = 60 / 118
    print('acido: preparando')
    pz = posts.recorte('chaqueta-smiley-acido')
    fantasmas = [pr.fantasma(pz, W, H, color=pr.ACIDO, seed=104, corrido=0.7, zoom=posts.zoom34(pz, W, H, 0.82),
                             intensidad=0.62), posts.p10(W, H)]
    inicios = [-0.25, 2 * b]

    def antes(t):
        return pasadas(fantasmas, inicios, t) if t < 3 * b else camara(fantasmas[1], 1.0 + 0.04 * entre(t, 3 * b, 5 * b))

    return con_desfile('acido', b, 4 * b, antes, [[0.0, 'whoosh', 0.7], [2 * b - 0.2, 'whoosh', 0.8], [2 * b, 'golpe', 0.8]],
                       [[0, 4 * b, 'golpes']], [0.05, 2 * b], papel=False)


def carmin():
    """Día +3, Sangre Fría: gotas de tinta roja revelan la Camiseta Célula en negativo y salen las tres prendas."""
    b = 60 / 100
    gotas_t = [-0.25, 0.1, 0.4, 0.7, 1.0]
    print('carmin: preparando')
    antes_n = negativo_que_se_revela(posts.p11(W, H), 111, pr.CARMIN, gotas_t, (0.6, 4 * b), (0.7, 0.24), 4 * b)
    return con_desfile('carmin', b, 4 * b, antes_n, [[g, 'pop', 0.8] for g in gotas_t] + [[4 * b, 'golpe', 0.7]],
                       [[0, 2 * b, 'entrada'], [2 * b, 4 * b, 'ritmo']], [], papel=True)


def indigo():
    """Día +4, Medianoche: la cianotipia se expone (el amarillo de la emulsión se vuelve azul de Prusia) y el Tejido
    Anillos queda en blanco; salen las tres prendas."""
    b = 60 / 96
    print('indigo: preparando')
    portada = posts.p12(W, H)
    pz = posts.recorte('tejido-anillos-indigo')
    p = pr.escala(pz, posts.zoom34(pz, W, H, 0.9) * min(W / pz.shape[1], H / pz.shape[0]))
    prenda = pr.alfa_en((H, W), p, (W - p.shape[1]) // 2, (H - p.shape[0]) // 2)
    emulsion = np.clip((portada[..., 2] - portada[..., 0]) * 6, 0, 1)
    emulsion = pr.suave(np.maximum(emulsion, prenda), 2)[..., None]
    crudo = pr.hexa('#cfcf8e') * (0.92 + 0.12 * pr.ruido(H, W, W * 0.1, 122, 3)[..., None])
    sin_exponer = portada * (1 - emulsion) + crudo * emulsion
    # se expone de las orillas al centro, con el ruido de la emulsión
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    centro = np.hypot((xx - W / 2) / W, (yy - H / 2) / H)
    turnos = np.clip(1 - centro / centro.max() * 0.85 + 0.25 * pr.ruido(H, W, W * 0.15, 123, 3) - 0.1, 0, 1)

    def antes(t):
        return revelar(portada, sin_exponer, entre(t, -0.8, 4 * b), turnos, 0.5)

    return con_desfile('indigo', b, 4 * b, antes, [[0.05, 'whoosh', 0.4], [4 * b, 'golpe', 0.7]],
                       [[0, 4 * b, 'entrada']], [], papel=False)


def magenta():
    """Día +5, Chicle: el escáner baja sobre el Jean Patchwork Estrellas, se enciende la luz magenta y salen las tres
    prendas."""
    b = 60 / 110
    print('magenta: preparando')
    j = posts.recorte('jean-patchwork-estrellas-violeta')
    antes_e = escaneo_que_baja([(j, 0.5, 0.52, posts.zoom34(j, W, H, 0.92))], colores(pr.MAGENTA, pr.MAGENTA, pr.MAGENTA),
                               131, 4 * b, 4 * b, luz_fuerza=1.0)
    return con_desfile('magenta', b, 4 * b, antes_e, [[0.0, 'whoosh', 0.5], [4 * b, 'golpe', 0.9], [4 * b, 'whoosh', 0.5]],
                       [[0, 4 * b, 'ritmo']], [], papel=True)


def ceniza():
    """Día +6, Asfalto: el Buzo Multitud sale de la noche en plata, se cuela la luz ceniza y salen las seis fotos."""
    b = 60 / 120
    print('ceniza: preparando')
    pz = posts.recorte('buzo-multitud-termica')
    portada = posts.p14(W, H)
    sin_luz = pr.plata(pz, W, H, seed=141, zoom=posts.zoom34(pz, W, H, 0.86))
    turnos = orden(sin_luz, claro_primero=True, seed=142)
    negro = np.zeros((H, W, 3), np.float32)

    def antes(t):
        k = suave(entre(t, 3 * b, 4.5 * b))
        final = sin_luz + (portada - sin_luz) * k
        return camara(revelar(final, negro, entre(t, -0.8, 3.5 * b), turnos, 0.5), 1.0 + 0.04 * entre(t, 0, 5 * b))

    return con_desfile('ceniza', b, 4 * b, antes, [[0.05, 'whoosh', 0.5], [3.5 * b, 'golpe', 0.7]],
                       [[0, 4 * b, 'entrada']], [], papel=False)


def leopardo():
    """Día +7, Fiera: el escáner baja sobre los dos jeans virados al leopardo, se enciende la fuga y salen las dos
    prendas."""
    b = 60 / 112
    print('leopardo: preparando')
    a, c = posts.recorte('jean-flare-patchwork-leopardo'), posts.recorte('jean-patchwork-cuadros')
    piezas = [(a, 0.42, 0.5, posts.zoom34(a, W, H, 0.92)), (c, 0.6, 0.52, posts.zoom34(c, W, H, 0.9))]
    antes_e = escaneo_que_baja(piezas, colores(pr.LEOPARDO, pr.LEOPARDO), 151, 4 * b, 4 * b, virar=pr.LEOPARDO)
    return con_desfile('leopardo', b, 4 * b, antes_e, [[0.0, 'whoosh', 0.5], [4 * b, 'golpe', 0.9], [4 * b, 'whoosh', 0.5]],
                       [[0, 4 * b, 'ritmo']], [], papel=True)


REELS = {'marmol': marmol, 'fantasma': fantasma, 'negativo': negativo, 'luz-roja': luz_roja, 'escaneo': escaneo,
         'contactos': contactos, 'acido': acido, 'carmin': carmin, 'indigo': indigo, 'magenta': magenta,
         'ceniza': ceniza, 'leopardo': leopardo}


def main():
    for nombre in sys.argv[1:] or list(REELS):
        reels.hacer(nombre, REELS[nombre])


if __name__ == '__main__':
    main()
