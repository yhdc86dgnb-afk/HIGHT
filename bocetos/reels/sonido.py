#!/usr/bin/env python3
"""Arma el sonido de un reel: la música y los efectos. El segundo en que va cada efecto y cómo va la música salen de
window.SFX, que cuadros.js guarda en sonido.json junto a los cuadros. Todo se hace aquí mismo con ruido y senos, sin
archivos de sonido, así que la música es propia y Instagram no la silencia por derechos de autor.

La música es una base en re menor (Dm, Bb, Gm, A) con bombo, palmas, platillos, bajo 808 y acordes, al tempo de los
cortes de cada reel. Va por secciones: entrada, ritmo, redoble, golpes, subida, pausa, acelera y caída. La caída
empieza cuando el logo golpea y trae la campana de la marca, la misma en los cuatro reels. Debajo de cada golpe la
música baja un poco para que el golpe se sienta.

Los efectos:

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


# ---------- Instrumentos de la música ----------

def bombo():
    t = tiempo(0.42)
    cuerpo = seno(44 + 95 * np.exp(-t / 0.03), t) * np.exp(-t / 0.2)
    clic = banda(ruido(len(t), 20), 1500, 8000) * np.exp(-t / 0.003)
    return normal(np.tanh(2.2 * (cuerpo + 0.25 * normal(clic))))


def palmas():
    t = tiempo(0.32)
    golpes = sum(np.where(t >= d, np.exp(-(t - d) / 0.007), 0) for d in (0, 0.011, 0.023))
    cola = np.exp(-t / 0.11)
    aire = banda(ruido(len(t), 21), 900, 6500)
    cuerpo = seno(190, t) * np.exp(-t / 0.05)
    return normal(normal(aire) * (golpes + 0.6 * cola) + 0.3 * cuerpo)


def platillo(abierto=False):
    t = tiempo(0.3 if abierto else 0.07)
    return normal(banda(ruido(len(t), 22 + abierto), 7000, 15000) * np.exp(-t / (0.16 if abierto else 0.022)))


def bajo(f, dur):
    """El 808: un seno grave que entra un poco más agudo, con saturación para que se oiga en el teléfono."""
    t = tiempo(dur)
    fr = f * (1 + 0.5 * np.exp(-t / 0.04))
    env = np.clip(t / 0.004, 0, 1) * np.exp(-t / max(0.12, dur / 2.4))
    env *= np.clip((dur - t) / 0.02, 0, 1)
    return np.tanh(2.6 * seno(fr, t) * env) / np.tanh(2.6)


def acorde(notas, dur, corte=1400):
    """Sierras un poco desafinadas entre sí, con los armónicos hasta el corte: un colchón oscuro."""
    t = tiempo(dur)
    out = np.zeros(len(t))
    for f in notas:
        for det in (-0.004, 0.004):
            ff = f * (1 + det)
            for k in range(1, max(2, int(corte / ff))):
                out += np.sin(2 * np.pi * k * ff * t) / k
    env = np.clip(t / 0.06, 0, 1) * np.clip((dur - t) / 0.08, 0, 1)
    return normal(out) * env


def campana(notas=(587.33, 698.46, 880.0)):
    """El sonido de la marca: tres campanas de FM (re, fa, la) que suenan cuando cae el logo."""
    t = tiempo(1.8)
    out = np.zeros(len(t))
    for k, f in enumerate(notas):
        i = 5.5 * np.exp(-t / 0.22) + 0.35
        out += np.sin(2 * np.pi * f * t + i * np.sin(2 * np.pi * 3.5 * f * t)) * np.exp(-t / (0.9 - 0.12 * k))
    return normal(out)


def ruido_subida(d):
    t = tiempo(d)
    return normal(banda_movil(ruido(len(t), 23), 400, 9000, 0.5)) * (t / d) ** 2.2


# Re menor: la raíz del bajo y el acorde de cada compás.
ACORDES = [(73.42, (146.83, 174.61, 220.0)), (58.27, (116.54, 146.83, 174.61)),
           (49.0, (98.0, 116.54, 146.83)), (55.0, (110.0, 138.59, 164.81))]
BOMBO = (0, 6, 10)
PALMAS = (4, 12)


def musica(m, total):
    out = np.zeros(total + 3 * SR)

    def pone(x, t0, g=1.0):
        i = int(round(t0 * SR))
        if i < 0 or i >= len(out):
            return
        x = x[:len(out) - i]
        out[i:i + len(x)] += g * x

    paso = 60 / m['bpm'] / 4
    cache = {}

    def una(nombre, fn):
        if nombre not in cache:
            cache[nombre] = fn()
        return cache[nombre]

    def pasos(a, b, origen):
        k0 = int(np.ceil((a - origen) / paso - 1e-6))
        k1 = int(np.ceil((b - origen) / paso - 1e-6))
        return [(k, origen + k * paso) for k in range(k0, k1)]

    def colchon(a, b, origen, g=0.16, corte=1400):
        # un acorde por compás, desde el compás en que cae a
        if b - a < 0.05:
            return
        compas = 16 * paso
        n0 = int(np.floor((a - origen) / compas))
        n = n0
        while origen + n * compas < b:
            ta = max(a, origen + n * compas)
            tb = min(b, origen + (n + 1) * compas)
            if tb - ta > 0.05:
                pone(acorde(ACORDES[n % 4][1], tb - ta, corte), ta, g)
            n += 1

    def ritmo(a, b, origen, densidad=None):
        colchon(a, b, origen)
        golpes_bajo = []
        for k, t0 in pasos(a, b, origen):
            st = k % 16
            compas = k // 16
            raiz = ACORDES[compas % 4][0]
            if st in BOMBO:
                pone(una('bombo', bombo), t0, 0.95)
                golpes_bajo.append((t0, raiz))
            if st in PALMAS:
                pone(una('palmas', palmas), t0, 0.55)
            sub = densidad(t0) if densidad else (2 if st < 12 or compas % 2 == 0 else 1)
            if st % sub == 0:
                pone(una('hat', platillo), t0, 0.22 if st % 4 else 0.3)
            if st == 14 and compas % 2 == 1:
                pone(una('hat-abierto', lambda: platillo(True)), t0, 0.18)
        for j, (t0, f) in enumerate(golpes_bajo):
            fin = golpes_bajo[j + 1][0] if j + 1 < len(golpes_bajo) else b
            pone(bajo(f, max(0.12, min(fin, b) - t0)), t0, 0.75)

    for a, b, tipo in m['secciones']:
        if tipo == 'entrada':
            colchon(a, b, m['origen'], 0.12, 900)
            pone(ruido_subida(b - a), a, 0.18)
            for k, t0 in pasos(a, b, m['origen']):
                if k % 2 == 0:
                    pone(una('hat', platillo), t0, 0.16)
        elif tipo == 'ritmo':
            ritmo(a, b, m['origen'])
        elif tipo == 'redoble':
            colchon(a, b, m['origen'], 0.14, 2200)
            pone(ruido_subida(b - a), a, 0.3)
            for k, t0 in pasos(a, b, m['origen']):
                u = (t0 - a) / max(1e-6, b - a)
                pone(una('hat', platillo), t0, 0.2)
                pone(una('hat', platillo), t0 + paso / 2, 0.16)
                pone(una('palmas', palmas), t0, 0.15 + 0.35 * u)
        elif tipo == 'golpes':
            colchon(a, b, m['origen'], 0.12, 900)
            hits = [h for h in m.get('golpes', []) if a - 1e-6 <= h < b]
            for j, h in enumerate(hits):
                fin = hits[j + 1] if j + 1 < len(hits) else b
                pone(una('bombo', bombo), h, 0.9)
                pone(bajo(ACORDES[0][0], max(0.15, min(fin - h, 1.2))), h, 0.8)
        elif tipo == 'subida':
            colchon(a, b, m['origen'], 0.1, 3000)
            pone(ruido_subida(b - a), a, 0.4)
            # redoble que se acelera hasta el golpe
            t0 = a
            while t0 < b - 0.02:
                u = (t0 - a) / max(1e-6, b - a)
                pone(una('palmas', palmas), t0, 0.12 + 0.4 * u)
                t0 += paso * (2 if u < 0.5 else 1 if u < 0.8 else 0.5)
        elif tipo == 'pausa':
            colchon(a, b, m['origen'], 0.07, 500)
        elif tipo == 'acelera':
            # los platillos pasan de corcheas a semicorcheas y a fusas, como las franjas que se aceleran
            ritmo(a, b, m['origen'], densidad=lambda t: 2 if t < a + (b - a) * 0.4 else 1)
            for k, t0 in pasos(a + (b - a) * 0.75, b, m['origen']):
                pone(una('hat', platillo), t0 + paso / 2, 0.18)
            for h in [h for h in m.get('golpes', []) if a <= h < b]:
                pone(bajo(ACORDES[0][0], 0.9), h, 0.9)
        elif tipo == 'caida':
            pone(una('campana', campana), a, 0.55)
            pone(bajo(ACORDES[0][0], 1.4), a, 0.9)
            ritmo(a, b, a)
    # se apaga en el último medio segundo
    fin = int(total)
    f = int(0.5 * SR)
    out[fin - f:fin] *= np.linspace(1, 0, f)
    out[fin:] = 0
    return out[:total]


EFECTOS = {'golpe': (golpe, 0.8), 'boom': (boom, 1.0), 'subida': (subida, 0.42), 'whoosh': (whoosh, 0.5),
           'latigo': (latigo, 1.0), 'tic': (tic, 0.3), 'pop': (pop, 0.38)}


def main():
    datos = json.load(open(sys.argv[1]))
    total = int((datos['seconds'] + 0.2) * SR)
    efectos = np.zeros(total + 3 * SR)
    cache = {}
    agache = np.ones(total + 3 * SR)
    for t0, kind, gain in datos['events']:
        if kind not in cache:
            cache[kind] = EFECTOS[kind][0]()
        x = cache[kind] * EFECTOS[kind][1] * gain
        i = max(0, int(round(t0 * SR)))
        efectos[i:i + len(x)] += x[:len(efectos) - i]
        # la música se agacha 6 dB en cada golpe y vuelve en 0,2 s
        if kind in ('golpe', 'boom', 'latigo'):
            d = np.arange(int(0.25 * SR))
            caida = 1 - 0.5 * gain * np.exp(-d / (0.08 * SR))
            j = min(len(agache), i + len(d))
            agache[i:j] = np.minimum(agache[i:j], caida[:j - i])
    efectos = efectos[:total]
    mezcla = efectos
    if datos.get('musica'):
        # la música, con su pico en 0,8 (los efectos llegan a 1,2), queda debajo de los golpes
        mus = musica(datos['musica'], total) * agache[:total]
        mezcla = efectos + 0.8 * mus / max(1e-9, np.abs(mus).max())
    # un limitador suave: se junta todo en el pico y se redondean las puntas
    mezcla = mezcla / max(1e-9, np.abs(mezcla).max())
    mezcla = 0.89 * np.tanh(1.6 * mezcla) / np.tanh(1.6)
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
