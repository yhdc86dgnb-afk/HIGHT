#!/usr/bin/env python3
"""Arma el sonido de un reel: la música y los efectos. El segundo en que va cada efecto y cómo va la música salen de
window.SFX, que cuadros.js guarda en sonido.json junto a los cuadros. Todo se hace aquí mismo con ruido y senos, sin
archivos de sonido, así que la música es propia y Instagram no la silencia por derechos de autor.

La música es psicodelia de sintetizadores: acordes soñadores (Dmaj9, F#m7, Gmaj7 y Gm6, un compás cada uno), un bajo
melódico que salta de octava, batería con cuerpo y mucha sala, platillos de semicorcheas con algo de swing, un arpegio
que rebota de un lado al otro con eco, fase que gira sobre los acordes y un poco de vaivén de cinta. Va al tempo de los
cortes de cada reel y por secciones (entrada, ritmo, redoble, golpes, subida, pausa, acelera y caída). La caída empieza
cuando el logo golpea y trae el sonido de la marca: tres campanas en re mayor (re, fa sostenido, la), las mismas en los
cuatro reels. En cada golpe de la imagen la música se agacha un poco para que el golpe se sienta.

Los efectos, encima de la música:

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


# ---------- Efectos ----------

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


EFECTOS = {'golpe': (golpe, 0.55), 'boom': (boom, 0.9), 'subida': (subida, 0.3), 'whoosh': (whoosh, 0.42),
           'latigo': (latigo, 1.0), 'tic': (tic, 0.22), 'pop': (pop, 0.3)}


# ---------- Instrumentos de la música ----------

NOMBRES = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
           'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(nota):
    return 440 * 2 ** ((NOMBRES[nota[:-1]] + 12 * (int(nota[-1]) + 1) - 69) / 12)


# Un acorde por compás: Dmaj9, F#m7, Gmaj7 y Gm6 (el paso de mayor a menor sobre el sol es el giro soñador).
PROGRESION = [
    {'raiz': 'D2', 'acorde': ['D3', 'F#3', 'A3', 'C#4', 'E4'], 'arpegio': ['D4', 'F#4', 'A4', 'C#5', 'E5', 'C#5', 'A4', 'F#4']},
    {'raiz': 'F#2', 'acorde': ['F#3', 'A3', 'C#4', 'E4'], 'arpegio': ['F#4', 'A4', 'C#5', 'E5', 'F#5', 'E5', 'C#5', 'A4']},
    {'raiz': 'G2', 'acorde': ['G3', 'B3', 'D4', 'F#4'], 'arpegio': ['G4', 'B4', 'D5', 'F#5', 'G5', 'F#5', 'D5', 'B4']},
    {'raiz': 'G2', 'acorde': ['G3', 'Bb3', 'D4', 'E4'], 'arpegio': ['G4', 'Bb4', 'D5', 'E5', 'G5', 'E5', 'D5', 'Bb4']},
]
# El bajo de cada compás, en semicorcheas: (paso, nota) con R raíz, O octava, Q quinta y P la nota de paso hacia el
# acorde que sigue.
BAJO = [(0, 'R'), (3, 'O'), (6, 'Q'), (8, 'R'), (10, 'R'), (11, 'O'), (14, 'P')]
BOMBO = (0, 7, 8)
CAJA = (4, 12)


def bombo():
    t = tiempo(0.45)
    cuerpo = seno(58 + 120 * np.exp(-t / 0.022), t) * np.exp(-t / 0.15)
    parche = banda(ruido(len(t), 30), 600, 5000) * np.exp(-t / 0.008)
    return normal(np.tanh(1.8 * (cuerpo + 0.5 * normal(parche))))


def caja():
    t = tiempo(0.45)
    aire = banda(ruido(len(t), 31), 1200, 9000) * np.exp(-t / 0.13)
    tono = seno(185 + 40 * np.exp(-t / 0.01), t) * np.exp(-t / 0.07)
    return normal(normal(aire) + 0.55 * tono)


def platillo(abierto=False, seed=32):
    t = tiempo(0.32 if abierto else 0.08)
    aire = banda(ruido(len(t), seed + abierto), 6000, 15000) + 0.4 * banda(ruido(len(t), seed + 5), 3500, 7000)
    return normal(aire * np.exp(-t / (0.17 if abierto else 0.028)))


def crash():
    t = tiempo(2.2)
    return normal(banda(ruido(len(t), 34), 3000, 16000) * np.exp(-t / 0.7) * np.clip(t / 0.003, 0, 1))


def tom(f):
    t = tiempo(0.4)
    return normal(seno(f * (1 + 0.6 * np.exp(-t / 0.03)), t) * np.exp(-t / 0.2) + 0.15 * banda(ruido(len(t), 35), 300, 4000) * np.exp(-t / 0.02))


def bajo(f, dur):
    """Bajo de sintetizador redondo: sierra filtrada con un seno debajo, que pulsa y se sostiene."""
    t = tiempo(dur)
    sierra = sum(np.sin(2 * np.pi * k * f * t) / k for k in range(1, max(2, int(1400 / f))))
    sub = np.sin(2 * np.pi * f * t)
    env = np.clip(t / 0.005, 0, 1) * (0.55 + 0.45 * np.exp(-t / 0.09)) * np.clip((dur - t) / 0.03, 0, 1)
    return np.tanh(1.8 * (0.9 * normal(sierra) + 0.45 * sub) * env) / np.tanh(1.8)


def pad(notas, dur, corte=1800):
    """Colchón de sierras desafinadas entre sí (tres voces por nota) con el filtro que respira despacio."""
    t = tiempo(dur)
    out = np.zeros(len(t))
    for f in notas:
        for det in (-0.006, 0, 0.006):
            ff = f * (1 + det)
            for k in range(1, max(2, int(corte / ff))):
                out += np.sin(2 * np.pi * k * ff * t + 1.7 * k * det * 100) / k ** 1.15
    env = np.clip(t / 0.12, 0, 1) * np.clip((dur - t) / 0.15, 0, 1)
    return normal(out) * env


def pulsado(f, dur=0.32):
    """La nota del arpegio: un pulso suave con algo de brillo al empezar."""
    t = tiempo(dur)
    i = 1.2 * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * f * t + i * np.sin(2 * np.pi * 2 * f * t))
    return y * np.exp(-t / 0.12) * np.clip(t / 0.003, 0, 1)


def campana(notas=('D5', 'F#5', 'A5')):
    """El sonido de la marca: tres campanas de FM en re mayor que suenan cuando cae el logo."""
    t = tiempo(2.4)
    out = np.zeros(len(t))
    for k, n in enumerate(notas):
        f = hz(n)
        i = 5 * np.exp(-t / 0.25) + 0.3
        out += np.sin(2 * np.pi * f * t + i * np.sin(2 * np.pi * 3.5 * f * t)) * np.exp(-t / (1.1 - 0.15 * k)) * np.clip((t - 0.035 * k) / 0.002, 0, 1)
    return normal(out)


def reverso(d):
    """Platillo al revés: sube hasta el golpe."""
    t = tiempo(d)
    return normal(banda(ruido(len(t), 36), 2500, 15000)) * (t / d) ** 3


# ---------- Efectos de la música ----------

def reverb(x, dur=2.4, seed=40):
    """Sala grande en estéreo: ruido que se apaga y se oscurece, convolucionado por FFT."""
    t = tiempo(dur)
    salas = []
    for s in (seed, seed + 1):
        ir = ruido(len(t), s) * np.exp(-t / (dur / 5))
        ir = banda_movil(ir, 9000, 1500, 1.1)
        ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        salas.append(ir / np.sqrt((ir ** 2).sum()))
    n = len(x) + len(t)
    m = 1 << int(np.ceil(np.log2(n)))
    X = np.fft.rfft(x, m)
    return [np.fft.irfft(X * np.fft.rfft(ir, m), m)[:len(x)] for ir in salas]


def eco(x, retardo, vueltas=5, caida=0.48):
    """Eco que rebota de un lado al otro y se oscurece en cada vuelta."""
    izq = np.zeros(len(x))
    der = np.zeros(len(x))
    y = x.copy()
    for k in range(1, vueltas + 1):
        y = banda(y, 120, 6000 - 700 * k) * caida
        d = int(retardo * k * SR)
        if d >= len(x):
            break
        (izq if k % 2 else der)[d:] += y[:len(x) - d]
    return izq, der


def coro(x, base, prof, vel, fase=0.0):
    """Una copia con un retardo que oscila: ensancha y hace ondular los acordes."""
    n = np.arange(len(x))
    d = (base + prof * np.sin(2 * np.pi * vel * n / SR + fase)) * SR
    return np.interp(n - d, n, x, left=0)


def fase_giratoria(x, vel=0.22, notchs=4):
    """Fase: unas muescas que suben y bajan por el espectro, el remolino de la psicodelia."""
    n = len(x)
    win, hop = 2048, 512
    w = np.hanning(win)
    f = np.maximum(np.fft.rfftfreq(win, 1 / SR), 1)
    out = np.zeros(n + win)
    norm = np.zeros(n + win)
    for s in range(0, n, hop):
        blk = np.zeros(win)
        part = x[s:s + win]
        blk[:len(part)] = part
        lfo = np.sin(2 * np.pi * vel * s / SR)
        m = np.ones(len(f))
        for k in range(notchs):
            fc = 220 * 2 ** (k * 1.1 + 1.4 + 1.3 * lfo)
            m *= 1 - 0.85 * np.exp(-0.5 * (np.log(f / fc) / 0.12) ** 2)
        out[s:s + win] += np.fft.irfft(np.fft.rfft(blk * w) * m, win) * w
        norm[s:s + win] += w * w
    return out[:n] / np.maximum(norm[:n], 1e-6)


def ecualiza(x):
    """La curva para el teléfono: sin graves que no se oyen, el grave un poco abajo y algo de brillo arriba."""
    spec = np.fft.rfft(x)
    f = np.maximum(np.fft.rfftfreq(len(x), 1 / SR), 1)
    db = np.interp(np.log10(f), np.log10([20, 32, 60, 110, 200, 300, 2000, 4500, 9000, 16000]), [-40, -18, -9, -4, -1, 0, 1, 4, 3, 0])
    return np.fft.irfft(spec * 10 ** (db / 20), len(x))


def cinta(x, prof=0.0012, vel=0.55):
    """Vaivén de cinta: el tono sube y baja apenas, como un casete."""
    n = np.arange(len(x))
    d = prof * SR * (1 + np.sin(2 * np.pi * vel * n / SR)) / 2
    return np.interp(n - d, n, x, left=0)


# ---------- La música ----------

def musica(m, total, fin):
    n = total + 3 * SR
    pistas = {k: np.zeros(n) for k in ('bateria', 'sala', 'bajo', 'pad', 'arpegio', 'campana')}
    paso = 60 / m['bpm'] / 4
    cache = {}

    def pone(pista, x, t0, g=1.0):
        i = int(round(t0 * SR))
        if i < 0 or i >= n:
            return
        x = x[:n - i]
        pistas[pista][i:i + len(x)] += g * x

    def una(nombre, fn):
        if nombre not in cache:
            cache[nombre] = fn()
        return cache[nombre]

    def pasos(a, b, origen):
        k0 = int(np.ceil((a - origen) / paso - 1e-6))
        k1 = int(np.ceil((b - origen) / paso - 1e-6))
        return [(k, origen + k * paso) for k in range(k0, k1)]

    def swing(k):
        # las semicorcheas de contratiempo llegan un poco tarde
        return 0.12 * paso if k % 2 else 0.0

    def compas(k):
        return PROGRESION[(k // 16) % 4]

    def acordes(a, b, origen, g=0.5, corte=1800):
        largo = 16 * paso
        c = int(np.floor((a - origen) / largo))
        while origen + c * largo < b:
            ta = max(a, origen + c * largo)
            tb = min(b, origen + (c + 1) * largo)
            if tb - ta > 0.06:
                notas = [hz(x) for x in PROGRESION[c % 4]['acorde']]
                pone('pad', pad(notas, tb - ta + 0.15, corte), ta, g)
            c += 1

    def bajos(a, b, origen, g=0.8, solo_raiz=False):
        golpes = []
        for k, t0 in pasos(a, b, origen):
            st = k % 16
            ac = compas(k)
            sig = PROGRESION[(k // 16 + 1) % 4]
            for p, cual in ([(0, 'R'), (8, 'R')] if solo_raiz else BAJO):
                if st != p:
                    continue
                r = hz(ac['raiz'])
                f = {'R': r, 'O': 2 * r, 'Q': 1.5 * r, 'P': hz(sig['raiz']) * 2 ** (-1 / 12)}[cual]
                golpes.append((t0 + swing(k), f))
        for j, (t0, f) in enumerate(golpes):
            hasta = golpes[j + 1][0] if j + 1 < len(golpes) else b
            pone('bajo', bajo(f, max(0.08, min(hasta, b) - t0 - 0.01)), t0, g)

    def arpegios(a, b, origen, g=0.32):
        for k, t0 in pasos(a, b, origen):
            notas = compas(k)['arpegio']
            pone('arpegio', pulsado(hz(notas[k % len(notas)])), t0 + swing(k), g * (1 if k % 4 == 0 else 0.75))

    def bateria(a, b, origen, platillos=1, rellenos=True):
        for k, t0 in pasos(a, b, origen):
            st = k % 16
            if st in BOMBO and not (st == 7 and (k // 16) % 2 == 0):
                pone('bateria', una('bombo', bombo), t0, 0.95)
            if st in CAJA:
                pone('bateria', una('caja', caja), t0, 0.8)
                pone('sala', una('caja', caja), t0, 0.6)
            sub = platillos(t0) if callable(platillos) else platillos
            if k % sub == 0:
                acento = 0.4 if st % 4 == 0 else 0.28 if st % 2 == 0 else 0.18
                pone('bateria', una('hat', platillo), t0 + swing(k), acento)
            if st == 14 and (k // 16) % 2 == 1:
                pone('bateria', una('abierto', lambda: platillo(True)), t0 + swing(k), 0.16)
            if rellenos and st >= 13 and (k // 16) % 4 == 3:
                pone('bateria', tom([196, 165, 131][st - 13]), t0, 0.45)
                pone('sala', tom([196, 165, 131][st - 13]), t0, 0.3)

    def ritmo(a, b, origen):
        acordes(a, b, origen)
        bajos(a, b, origen)
        arpegios(a, b, origen)
        bateria(a, b, origen)

    for a, b, tipo in m['secciones']:
        o = m['origen']
        if tipo == 'entrada':
            acordes(a, b, o, 0.4, 900)
            pone('bateria', reverso(b - a), a, 0.35)
            arpegios(a, b, o, 0.18)
        elif tipo == 'ritmo':
            ritmo(a, b, o)
        elif tipo == 'redoble':
            acordes(a, b, o, 0.45, 2600)
            pone('bateria', reverso(b - a), a, 0.4)
            for k, t0 in pasos(a, b, o):
                u = (t0 - a) / max(1e-6, b - a)
                pone('bateria', tom(220 - 90 * u), t0, 0.35 + 0.3 * u)
                pone('sala', tom(220 - 90 * u), t0, 0.25)
        elif tipo == 'golpes':
            acordes(a, b, o, 0.4, 1200)
            hits = [h for h in m.get('golpes', []) if a - 1e-6 <= h < b]
            for j, h in enumerate(hits):
                hasta = hits[j + 1] if j + 1 < len(hits) else b
                pone('bateria', una('bombo', bombo), h, 0.9)
                pone('sala', una('caja', caja), h, 0.35)
                pone('bajo', bajo(hz(PROGRESION[0]['raiz']), max(0.12, min(hasta - h, 1.4))), h, 0.75)
                if j == 0:
                    pone('bateria', una('crash', crash), h, 0.3)
        elif tipo == 'subida':
            acordes(a, b, o, 0.4, 3200)
            pone('bateria', reverso(b - a), a, 0.5)
            t0 = a
            while t0 < b - 0.02:
                u = (t0 - a) / max(1e-6, b - a)
                pone('bateria', una('caja', caja), t0, 0.12 + 0.4 * u)
                pone('sala', una('caja', caja), t0, 0.2)
                t0 += paso * (2 if u < 0.5 else 1 if u < 0.8 else 0.5)
            bajos(a, b, o, 0.6, solo_raiz=True)
        elif tipo == 'pausa':
            acordes(a, b, o, 0.22, 700)
        elif tipo == 'acelera':
            # los platillos pasan de corcheas a semicorcheas, como las franjas que se aceleran
            acordes(a, b, o)
            bajos(a, b, o)
            bateria(a, b, o, platillos=lambda t: 2 if t < a + (b - a) * 0.45 else 1, rellenos=False)
            arpegios(a + (b - a) * 0.5, b, o, 0.26)
            for h in [h for h in m.get('golpes', []) if a <= h < b]:
                pone('bateria', una('crash', crash), h, 0.28)
        elif tipo == 'caida':
            pone('campana', una('campana', campana), a, 0.8)
            pone('bateria', una('crash', crash), a, 0.35)
            ritmo(a, b, a)

    # Mezcla de la música: la batería empuja a lo demás (bombeo), los acordes giran con la fase y se abren con el coro,
    # el arpegio rebota de un lado al otro y todo pasa por la sala y por la cinta.
    bombeo = np.ones(n)
    for a, b, tipo in m['secciones']:
        origen = a if tipo == 'caida' else m['origen']
        if tipo in ('ritmo', 'caida', 'acelera'):
            for k, t0 in pasos(a, b, origen):
                if k % 16 in BOMBO and not (k % 16 == 7 and (k // 16) % 2 == 0):
                    i = int(t0 * SR)
                    d = np.arange(min(int(0.3 * SR), n - i))
                    bombeo[i:i + len(d)] = np.minimum(bombeo[i:i + len(d)], 1 - 0.42 * np.exp(-d / (0.09 * SR)))
    pad_f = fase_giratoria(pistas['pad'] * bombeo)
    pad_i = coro(pad_f, 0.012, 0.003, 0.7)
    pad_d = coro(pad_f, 0.016, 0.003, 0.53, 1.3)
    arp_i, arp_d = eco(pistas['arpegio'], 0.75 * 4 * paso)
    arp_i += pistas['arpegio']
    arp_d += 0.6 * pistas['arpegio']
    bajo_m = pistas['bajo'] * (0.6 + 0.4 * bombeo)
    sala_i, sala_d = reverb(0.55 * pistas['sala'] + 0.35 * pistas['pad'] + 0.5 * pistas['arpegio'] + 0.9 * pistas['campana'])
    izq = 0.8 * pistas['bateria'] + 0.5 * bajo_m + 0.95 * pad_i + 0.75 * arp_i + 0.85 * pistas['campana'] + 0.7 * sala_i
    der = 0.8 * pistas['bateria'] + 0.5 * bajo_m + 0.95 * pad_d + 0.75 * arp_d + 0.85 * pistas['campana'] + 0.7 * sala_d
    izq = cinta(np.tanh(1.3 * izq / max(1e-9, np.abs(izq).max())))
    der = cinta(np.tanh(1.3 * der / max(1e-9, np.abs(der).max())), vel=0.57)
    # se apaga en el último medio segundo del video
    f = int(0.5 * SR)
    for ch in (izq, der):
        ch[fin - f:fin] *= np.linspace(1, 0, f)
        ch[fin:] = 0
    return izq[:total], der[:total]


def main():
    datos = json.load(open(sys.argv[1]))
    # el WAV dura 0,2 s más que el video para que ffmpeg -shortest corte por la imagen; ese sobrante va en silencio
    fin = int(datos['seconds'] * SR)
    total = fin + int(0.2 * SR)
    efectos = np.zeros(total + 3 * SR)
    agache = np.ones(total + 3 * SR)
    cache = {}
    for t0, kind, gain in datos['events']:
        if kind not in cache:
            cache[kind] = EFECTOS[kind][0]()
        x = cache[kind] * EFECTOS[kind][1] * gain
        i = max(0, int(round(t0 * SR)))
        efectos[i:i + len(x)] += x[:len(efectos) - i]
        # la música se agacha en cada golpe de la imagen y vuelve en 0,2 s
        if kind in ('golpe', 'boom', 'latigo'):
            d = np.arange(int(0.25 * SR))
            caida = 1 - 0.4 * gain * np.exp(-d / (0.08 * SR))
            j = min(len(agache), i + len(d))
            agache[i:j] = np.minimum(agache[i:j], caida[:j - i])
    efectos = efectos[:total]
    izq = der = efectos
    if datos.get('musica'):
        mi, md = musica(datos['musica'], total, fin)
        pico = max(np.abs(mi).max(), np.abs(md).max(), 1e-9)
        # la música manda (pico en 0,95) y los efectos quedan encima, más suaves que antes
        izq = efectos + 0.95 * mi * agache[:total] / pico
        der = efectos + 0.95 * md * agache[:total] / pico
    izq, der = ecualiza(izq), ecualiza(der)
    # un limitador suave: se junta todo en el pico y se redondean las puntas; queda en 0,84 porque el AAC del video
    # sube los picos hasta un 10 %
    pico = max(np.abs(izq).max(), np.abs(der).max(), 1e-9)
    izq = 0.84 * np.tanh(1.5 * izq / pico) / np.tanh(1.5)
    der = 0.84 * np.tanh(1.5 * der / pico) / np.tanh(1.5)
    # un respiro de 30 ms al principio y al final del video para que no haga clic cuando el reel vuelve a empezar
    f = int(0.03 * SR)
    for ch in (izq, der):
        ch[:f] *= np.linspace(0, 1, f)
        ch[fin - f:fin] *= np.linspace(1, 0, f)
        ch[fin:] = 0
    pcm = np.empty(2 * total, dtype='<i2')
    pcm[0::2] = (np.clip(izq, -1, 1) * 32767).astype('<i2')
    pcm[1::2] = (np.clip(der, -1, 1) * 32767).astype('<i2')
    with wave.open(sys.argv[2], 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())


if __name__ == '__main__':
    main()
