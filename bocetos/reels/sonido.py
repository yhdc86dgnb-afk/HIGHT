#!/usr/bin/env python3
"""Arma el sonido de un reel con sus efectos: el segundo en que va cada uno sale de window.SFX, que cuadros.js guarda
en sonido.json junto a los cuadros. Los efectos se hacen aquí mismo con ruido y senos, sin archivos de sonido:

  golpe    el golpe seco de cada corte (un bombo que cae de tono y un clic)
  boom     el logo cuando cae al final (grave, largo)
  subida   el ruido que sube antes del boom
  whoosh   el barrido de aire de las franjas y los paneos
  latigo   el chasquido del látigo: el silbido de la correa y el estallido de la punta
  tic      cada letra, cada pieza que cae y cada punto de color
  pop      el botón del cierre

Uso: python3 sonido.py <sonido.json> <salida.wav>
"""
import json
import sys
import wave

import numpy as np

SR = 48000


def tiempo(d):
    return np.arange(int(d * SR)) / SR


def ruido(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def banda(x, lo, hi):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(spec, len(x))


def banda_movil(x, f0, f1, ancho=0.6):
    """Un filtro de banda que se mueve de f0 a f1 Hz a lo largo del sonido (bloques con ventana que se suman)."""
    n = len(x)
    win, hop = 1024, 256
    w = np.hanning(win)
    f = np.maximum(np.fft.rfftfreq(win, 1 / SR), 1)
    out = np.zeros(n + win)
    norm = np.zeros(n + win)
    for s in range(0, n, hop):
        blk = np.zeros(win)
        part = x[s:s + win]
        blk[:len(part)] = part
        fc = f0 * (f1 / f0) ** (s / max(1, n - 1))
        m = np.exp(-0.5 * (np.log(f / fc) / ancho) ** 2)
        out[s:s + win] += np.fft.irfft(np.fft.rfft(blk * w) * m, win) * w
        norm[s:s + win] += w * w
    return out[:n] / np.maximum(norm[:n], 1e-6)


def seno(f, t):
    return np.sin(2 * np.pi * np.cumsum(f) / SR) if np.ndim(f) else np.sin(2 * np.pi * f * t)


def normal(x):
    return x / max(1e-9, np.abs(x).max())


def golpe():
    t = tiempo(0.7)
    cuerpo = seno(46 + 110 * np.exp(-t / 0.035), t) * np.exp(-t / 0.16)
    clic = banda(ruido(len(t), 1), 2000, 9000) * np.exp(-t / 0.004)
    medio = banda(ruido(len(t), 2), 180, 1600) * np.exp(-t / 0.045)
    return normal(np.tanh(2.4 * (cuerpo + 0.5 * normal(clic) + 0.55 * normal(medio))))


def boom():
    t = tiempo(1.9)
    sub = seno(31 + 42 * np.exp(-t / 0.09), t) * np.exp(-t / 0.62)
    grave = banda(ruido(len(t), 3), 20, 220) * np.exp(-t / 0.34)
    impacto = banda(ruido(len(t), 4), 160, 2400) * np.exp(-t / 0.08)
    clic = banda(ruido(len(t), 5), 2500, 10000) * np.exp(-t / 0.003)
    mezcla = sub + 0.5 * normal(grave) + 0.7 * normal(impacto) + 0.3 * normal(clic)
    return normal(np.tanh(1.8 * mezcla))


def subida(d=0.6):
    t = tiempo(d)
    aire = banda_movil(ruido(len(t), 6), 300, 6500, 0.45) * (t / d) ** 2
    tono = seno(110 * (4 ** (t / d)), t) * 0.25 * (t / d) ** 2
    return normal(normal(aire) + tono)


def whoosh(d=0.38):
    t = tiempo(d)
    aire = banda_movil(ruido(len(t), 7), 500, 2600, 0.5)
    return normal(normal(aire) * np.sin(np.pi * t / d) ** 1.5)


def latigo():
    t = tiempo(0.6)
    n = len(t)
    silbido = banda_movil(ruido(n, 8), 1200, 7000, 0.4) * np.clip(t / 0.1, 0, 1) ** 2 * (t < 0.1)
    c = int(0.1 * SR)
    tc = np.clip(t - 0.1, 0, None) * (t >= 0.1)
    estallido = np.zeros(n)
    estallido[c:c + 6] = [1, -0.85, 0.6, -0.4, 0.25, -0.1]
    rafaga = banda(ruido(n, 9), 2000, 14000) * np.exp(-tc / 0.007) * (t >= 0.1)
    cuerpo = banda(ruido(n, 13), 700, 3500) * np.exp(-tc / 0.025) * (t >= 0.1)
    anillo = np.sin(2 * np.pi * 3100 * tc) * np.exp(-tc / 0.012) * (t >= 0.1)
    cola = banda(ruido(n, 10), 900, 8000) * np.exp(-tc / 0.075) * (t >= 0.1)
    sala = banda(ruido(n, 11), 200, 4000) * np.exp(-tc / 0.28) * (t >= 0.1)
    mezcla = 0.5 * normal(silbido) + estallido + 0.9 * normal(rafaga) + 0.7 * normal(cuerpo) + 0.3 * anillo + 0.45 * normal(cola) + 0.08 * normal(sala)
    return normal(mezcla)


def tic():
    t = tiempo(0.09)
    return normal(seno(1900, t) * np.exp(-t / 0.012) + 0.5 * normal(banda(ruido(len(t), 12), 3000, 12000)) * np.exp(-t / 0.002))


def pop():
    t = tiempo(0.16)
    return normal(seno(420 * (1200 / 420) ** (t / 0.16), t) * np.exp(-t / 0.045) * np.clip(t / 0.004, 0, 1))


EFECTOS = {'golpe': (golpe, 0.8), 'boom': (boom, 1.0), 'subida': (subida, 0.42), 'whoosh': (whoosh, 0.5),
           'latigo': (latigo, 1.0), 'tic': (tic, 0.3), 'pop': (pop, 0.38)}


def main():
    datos = json.load(open(sys.argv[1]))
    total = int((datos['seconds'] + 0.2) * SR)
    mezcla = np.zeros(total + 3 * SR)
    cache = {}
    for t0, kind, gain in datos['events']:
        if kind not in cache:
            cache[kind] = EFECTOS[kind][0]()
        x = cache[kind] * EFECTOS[kind][1] * gain
        i = max(0, int(round(t0 * SR)))
        mezcla[i:i + len(x)] += x[:len(mezcla) - i]
    mezcla = mezcla[:total]
    mezcla = np.tanh(1.2 * mezcla) / np.tanh(1.2)
    mezcla *= 0.89 / max(1e-9, np.abs(mezcla).max())
    # un respiro de 30 ms al principio y al final para que no haga clic
    f = int(0.03 * SR)
    mezcla[:f] *= np.linspace(0, 1, f)
    mezcla[-f:] *= np.linspace(1, 0, f)
    pcm = (np.clip(mezcla, -1, 1) * 32767).astype('<i2')
    with wave.open(sys.argv[2], 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(np.repeat(pcm, 2).tobytes())


if __name__ == '__main__':
    main()
