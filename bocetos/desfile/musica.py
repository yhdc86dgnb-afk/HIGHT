#!/usr/bin/env python3
"""La música del desfile: tres pistas propias, de unos 35 segundos cada una, para el fondo de los posts y de sus
versiones en video. Todo sale de senos, ruido y cuerdas pulsadas (Karplus-Strong), sin muestras ni canciones de otros:
es música propia, así que Instagram no la silencia por derechos de autor.

  neo-psicodelia     98 bpm, si menor. Colchones de sintetizador con fase que bombean con el bombo, bajo melódico que
                     salta de octava, batería con mucha sala, un arpegio que rebota con eco y una melodía de
                     sintetizador. Va con la Chaqueta Blood Rose.
  rock-psicodelico  112 bpm, mi dórico. Un bordón de tanpura al empezar, el riff de guitarra con fuzz, órgano de los
                     sesenta con vibrato, pandereta, batería suelta con platillo ride y un solo de guitarra con wah. Va con
                     la Chaqueta Trouble Maker y el Jean Patchwork Estrellas Violeta.
  pop-psicodelico   104 bpm, re mayor. Clavecín en arpegios, flauta de melotrón, un coro de «aah», bajo de dedo,
                     palmas, pandereta, platillos al revés y una frase de sitar; el giro de re a fa sostenido y de sol
                     mayor a sol menor. Va con la Chaqueta Smiley Ácido y el Jean Flare Dragón Ácido.

Las tres terminan con el sonido de la marca: las tres campanas en re mayor de los reels.
Deja musica/<pista>.mp3, que abre en cualquier reproductor y en la muestra. Usa los instrumentos y los efectos de
../reels/sonido.py.
Uso, desde la raíz del repo: python3 bocetos/desfile/musica.py [pista ...]
"""
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent / 'reels'))
import sonido as so  # noqa: E402
from sonido import SR, banda, hz, normal, ruido, tiempo  # noqa: E402

SALIDA = AQUI / 'musica'


# ---------- Instrumentos ----------

def cuerda(f, dur, t60=2.0, brillo=0.7, seed=0):
    """Una cuerda pulsada (Karplus-Strong): un golpe de ruido que da vueltas en un retardo del largo de la nota y se
    oscurece un poco en cada vuelta. t60 es lo que tarda en apagarse; brillo, qué tan duro se pulsa."""
    n = int(dur * SR)
    N = max(2, int(round(SR / f - 0.5)))
    s = 10 ** (-3 / (t60 * f))
    golpe = banda(ruido(4 * N, seed), 30, 1500 + 10000 * brillo)[:N]
    golpe = golpe - golpe.mean()
    y = np.zeros(n + 1)
    m = min(n, N)
    y[1:m + 1] = golpe[:m]
    # cada vuelta depende solo de la anterior, así que se calcula de a un retardo entero por vez
    for a in range(N + 1, n + 1, N):
        b = min(a + N, n + 1)
        y[a:b] = s * 0.5 * (y[a - N:b - N] + y[a - N - 1:b - N - 1])
    t = np.arange(n) / SR
    return y[1:] * np.clip((dur - t) / 0.02, 0, 1)


def quinta(raiz, dur, apagada=False, seed=0):
    """Un acorde de quinta de guitarra (raíz, quinta y octava) rasgueado hacia abajo, con fuzz. Apagada es con la palma
    sobre las cuerdas: corta y seca."""
    f = hz(raiz)
    out = np.zeros(int(dur * SR))
    for k, (r, g) in enumerate(((1, 1.0), (1.5, 0.8), (2, 0.55))):
        c = cuerda(f * r, dur, 0.2 if apagada else 3.0, 0.9, seed + k)
        d = int(0.007 * k * SR)
        out[d:] += g * c[:len(out) - d]
    return fuzz(out, 9 if apagada else 12)


def fuzz(x, ganancia=12, tono=4300):
    """El pedal de fuzz y el parlante: recorta la señal y le quita los agudos que raspan."""
    return normal(banda(np.tanh(ganancia * normal(x)), 90, tono))


def organo(notas, dur, seed=0):
    """Órgano de los sesenta: ondas casi cuadradas con vibrato rápido, el clic al tocar y el vaivén del parlante que
    gira."""
    t = tiempo(dur)
    lfo = 1 + 0.003 * np.sin(2 * np.pi * 6.4 * t)
    out = np.zeros(len(t))
    for nota in notas:
        f = hz(nota)
        fase = 2 * np.pi * np.cumsum(f * lfo) / SR
        for k, g in ((1, 1.0), (2, 0.35), (3, 0.5), (4, 0.15), (5, 0.3), (7, 0.18), (9, 0.1)):
            if k * f < 9000:
                out += g * np.sin(k * fase)
    env = np.clip(t / 0.005, 0, 1) * np.clip((dur - t) / 0.04, 0, 1) * (1 + 0.6 * np.exp(-t / 0.03))
    out = np.tanh(1.4 * normal(out) * env)
    return out * (0.82 + 0.18 * np.sin(2 * np.pi * 5.6 * t + seed))


def zumbido(c):
    """El puente de la tanpura y del sitar (jawari): la cuerda roza el puente y suma agudos que zumban."""
    return normal(c + 0.6 * banda(np.abs(c), 1200, 8000))


def tanpura(notas, dur, cada, seed=0):
    """El bordón de una tanpura: las cuerdas se pulsan una tras otra y suenan largo, zumbando."""
    n = int(dur * SR)
    out = np.zeros(n)
    k, t0 = 0, 0.0
    while t0 < dur - 0.05:
        c = zumbido(cuerda(hz(notas[k % len(notas)]), min(dur - t0, cada * 5), 5.0, 0.95, seed + k))
        i = int(t0 * SR)
        out[i:i + len(c)] += c[:n - i]
        t0, k = t0 + cada, k + 1
    return normal(out)


def pandereta(seed=60):
    t = tiempo(0.2)
    sonajas = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((5300, 6900, 8200, 9700, 11300)))
    aire = banda(ruido(len(t), seed), 4500, 15000)
    return normal((0.7 * normal(sonajas) + normal(aire)) * np.exp(-t / 0.055) * np.clip(t / 0.0015, 0, 1))


def palmas(seed=61):
    t = tiempo(0.3)
    env = sum(np.exp(-np.clip(t - d, 0, None) / 0.005) * (t >= d) for d in (0.0, 0.009, 0.019))
    env = env + 0.5 * np.exp(-np.clip(t - 0.028, 0, None) / 0.08) * (t >= 0.028)
    return normal(banda(ruido(len(t), seed), 900, 5500) * env)


def ride(seed=62):
    t = tiempo(1.2)
    parciales = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d in ((3170, 0.5), (4720, 0.4), (5530, 0.35),
                                                                            (6910, 0.3), (8230, 0.25)))
    aire = banda(ruido(len(t), seed), 5000, 14000) * np.exp(-t / 0.35)
    campanita = np.sin(2 * np.pi * 2350 * t) * np.exp(-t / 0.15) * 0.5
    return normal(0.5 * normal(parciales) + 0.6 * normal(aire) + campanita) * np.clip(t / 0.001, 0, 1)


def flauta(f, dur, seed=0):
    """La flauta del melotrón: casi un seno, con soplo y un vibrato que entra despacio."""
    t = tiempo(dur)
    vib = 1 + 0.0045 * np.sin(2 * np.pi * 5.3 * t) * np.clip(t / 0.35, 0, 1)
    fase = 2 * np.pi * np.cumsum(f * vib) / SR
    tono = np.sin(fase) + 0.22 * np.sin(2 * fase) + 0.07 * np.sin(3 * fase)
    soplo = normal(banda(ruido(len(t), seed), f * 0.9, f * 4)) * 0.15
    return (tono + soplo) * np.clip(t / 0.07, 0, 1) * np.clip((dur - t) / 0.1, 0, 1)


FORMANTES = ((730, 1.0), (1090, 0.55), (2440, 0.3))  # una «a» abierta


def coro_aah(notas, dur):
    """Un coro de «aah»: cada voz es una nota con sus armónicos, más fuertes donde suena la «a», y su propio vibrato."""
    t = tiempo(dur)
    out = np.zeros(len(t))
    for j, nota in enumerate(notas):
        for d, det in enumerate((-0.005, 0.0, 0.006)):
            f = hz(nota) * (1 + det)
            fase = 2 * np.pi * np.cumsum(f * (1 + 0.006 * np.sin(2 * np.pi * (5.1 + 0.4 * d) * t + j + d))) / SR
            for k in range(1, int(4500 / f) + 1):
                a = sum(g * np.exp(-0.5 * ((k * f - F) / (0.14 * F)) ** 2) for F, g in FORMANTES)
                if a > 0.02:
                    out += a / np.sqrt(k) * np.sin(k * fase)
    return normal(out) * np.clip(t / 0.3, 0, 1) * np.clip((dur - t) / 0.35, 0, 1)


def clavecin(f, dur=0.9, seed=0):
    c = cuerda(f, dur, 1.1, 1.0, seed) + 0.35 * cuerda(2 * f, dur, 0.8, 1.0, seed + 1)
    return normal(banda(c, 250, 12000))


def bajo_dedo(f, dur, seed=0):
    """El bajo eléctrico tocado con los dedos: una cuerda redonda con un seno debajo."""
    t = tiempo(dur)
    out = normal(cuerda(f, dur, 1.6, 0.35, seed)) + 0.5 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.8)
    return np.tanh(1.5 * out) / np.tanh(1.5) * np.clip((dur - t) / 0.02, 0, 1)


def filtro_movil(x, fc, ancho=0.5):
    """Un filtro de banda cuyo centro sigue a fc (un valor por muestra), como un pedal de wah."""
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
        m = np.exp(-0.5 * (np.log(f / fc[min(s, n - 1)]) / ancho) ** 2)
        out[s:s + win] += np.fft.irfft(np.fft.rfft(blk * w) * m, win) * w
        norm[s:s + win] += w * w
    return out[:n] / np.maximum(norm[:n], 1e-6)


def linea(frases, b, largo, onda='sierra', glide=0.035):
    """Una melodía continua con portamento, para el sintetizador y la guitarra solista. frases es [(tiempo, duración,
    nota)], con el tiempo y la duración en tiempos; b es lo que dura un tiempo."""
    n = int(largo * SR)
    f = np.zeros(n)
    env = np.zeros(n)
    for t0, d, nota in frases:
        i, j = int(t0 * b * SR), min(n, int((t0 + d) * b * SR))
        f[i:j] = hz(nota)
        r = np.ones(j - i)
        a, z = min(len(r), int(0.012 * SR)), min(len(r), int(0.07 * SR))
        r[:a] *= np.linspace(0, 1, a)
        r[len(r) - z:] *= np.linspace(1, 0, z)
        env[i:j] = np.maximum(env[i:j], r)
    # en los silencios sigue la última nota, así el portamento no baja a cero
    idx = np.where(f > 0, np.arange(n), 0)
    np.maximum.accumulate(idx, out=idx)
    f = f[idx]
    f[f == 0] = f[f > 0][0]
    k = max(1, int(glide * SR))
    cs = np.cumsum(np.concatenate([np.full(k, np.log(f[0])), np.log(f)]))
    f = np.exp((cs[k:] - cs[:-k]) / k)
    t = np.arange(n) / SR
    f = f * (1 + 0.005 * np.sin(2 * np.pi * 5.5 * t))
    fase = np.cumsum(f) / SR % 1
    y = 2 * fase - 1 if onda == 'sierra' else np.where(fase < 0.3, 1.0, -1.0)
    return banda(y, 80, 6000) * env, f


def efectos_frase(x, t0, largo):
    """Recorta un sonido largo al pedazo que va en [t0, t0 + largo] segundos."""
    return x[int(t0 * SR):int((t0 + largo) * SR)]


# ---------- La mezcla ----------

class Mezcla:
    """Una mezcla en estéreo con dos envíos (la sala y el eco) y un bus con fase que bombea con el bombo."""

    def __init__(self, largo):
        self.n = int((largo + 3) * SR)
        self.L, self.R = np.zeros(self.n), np.zeros(self.n)
        self.fL, self.fR = np.zeros(self.n), np.zeros(self.n)
        self.sala, self.eco = np.zeros(self.n), np.zeros(self.n)
        self.patadas = []

    def pone(self, x, t0, g=1.0, pan=0.0, sala=0.0, eco=0.0, fase=False):
        i = int(round(t0 * SR))
        if i >= self.n:
            return
        if i < 0:
            x, i = x[-i:], 0
        x = np.asarray(x[:self.n - i]) * g
        a = (pan + 1) * np.pi / 4
        L, R = (self.fL, self.fR) if fase else (self.L, self.R)
        L[i:i + len(x)] += np.cos(a) * x
        R[i:i + len(x)] += np.sin(a) * x
        if sala:
            self.sala[i:i + len(x)] += sala * x
        if eco:
            self.eco[i:i + len(x)] += eco * x

    def termina(self, largo, retardo_eco, bombeo=0.0, cinta=True):
        n = self.n
        if bombeo:
            env = np.ones(n)
            for tk in self.patadas:
                i = int(tk * SR)
                d = np.arange(min(int(0.3 * SR), n - i))
                env[i:i + len(d)] = np.minimum(env[i:i + len(d)], 1 - bombeo * np.exp(-d / (0.09 * SR)))
            self.fL, self.fR = self.fL * env, self.fR * env
        L, R = self.L.copy(), self.R.copy()
        if self.fL.any():
            L += so.fase_giratoria(self.fL)
            R += so.fase_giratoria(self.fR, vel=0.25)
        si, sd = so.reverb(self.sala)
        ei, ed = so.eco(self.eco, retardo_eco)
        L, R = L + 0.8 * si + 0.6 * ei, R + 0.8 * sd + 0.6 * ed
        if cinta:
            L, R = so.cinta(L), so.cinta(R, vel=0.57)
        L, R = so.ecualiza(L), so.ecualiza(R)
        # el techo queda en 0,8 porque el MP3 y el AAC de los videos suben los picos hasta un 10 %
        pico = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
        L = 0.8 * np.tanh(1.6 * L / pico) / np.tanh(1.6)
        R = 0.8 * np.tanh(1.6 * R / pico) / np.tanh(1.6)
        total = int(largo * SR)
        L, R = L[:total], R[:total]
        f0, f1 = int(0.03 * SR), int(1.2 * SR)
        for ch in (L, R):
            ch[:f0] *= np.linspace(0, 1, f0)
            ch[total - f1:] *= np.linspace(1, 0, f1) ** 2
        return L, R


def bateria(m, a, b, paso, patrones, swing=0.0, sala=1.0, grabar_patadas=False):
    """La batería de a hasta b segundos, con patrones de 16 pasos por compás: x es un golpe, X un acento y g un golpe
    fantasma. Las voces: k bombo, s caja, h platillo cerrado, o abierto, r ride, t pandereta y c palmas."""
    sonidos = {'k': (so.bombo(), 0.95, 0.0, 0.1), 's': (so.caja(), 0.8, 0.0, 0.55), 'h': (so.platillo(), 0.3, 0.25, 0.08),
               'o': (so.platillo(True), 0.22, 0.25, 0.15), 'r': (ride(), 0.28, -0.3, 0.2),
               't': (pandereta(), 0.3, 0.45, 0.15), 'c': (palmas(), 0.55, -0.1, 0.45)}
    k = int(np.ceil(a / paso - 1e-6))
    while k * paso < b - 1e-6:
        t0 = k * paso + (swing * paso if k % 2 else 0.0)
        for voz, cadena in patrones.items():
            golpe = cadena[k % 16]
            if golpe == '.':
                continue
            x, g, pan, sl = sonidos[voz]
            g *= {'x': 1.0, 'X': 1.25, 'g': 0.4}[golpe]
            m.pone(x, t0, g, pan, sala=sl * sala)
            if voz == 'k' and grabar_patadas:
                m.patadas.append(t0)
        k += 1


def relleno(m, t0, paso, tonos=(196, 165, 131)):
    """El redoble de toms al final de un compás, uno por paso."""
    for i, f in enumerate(tonos):
        m.pone(so.tom(f), t0 + i * paso, 0.5, -0.4 + 0.4 * i, sala=0.4)


def escribe(L, R, ruta):
    pcm = np.empty(2 * len(L), dtype='<i2')
    pcm[0::2] = (np.clip(L, -1, 1) * 32767).astype('<i2')
    pcm[1::2] = (np.clip(R, -1, 1) * 32767).astype('<i2')
    with wave.open(str(ruta), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ---------- Neo-psicodelia ----------

def neo():
    bpm, compases = 98, 15
    b = 60 / bpm
    bar, paso = 4 * b, b / 4
    largo = compases * bar + 2.2
    m = Mezcla(largo)
    # un acorde por compás: raíz del bajo, el colchón y el arpegio
    ACORDES = {
        'Bm9': ('B1', ['B2', 'D3', 'F#3', 'A3', 'C#4'], ['B3', 'D4', 'F#4', 'A4', 'C#5', 'A4', 'F#4', 'D4']),
        'Gmaj9': ('G2', ['G2', 'B2', 'D3', 'F#3', 'A3'], ['G3', 'B3', 'D4', 'F#4', 'A4', 'F#4', 'D4', 'B3']),
        'Em9': ('E2', ['E3', 'G3', 'B3', 'D4', 'F#4'], ['E4', 'G4', 'B4', 'D5', 'F#5', 'D5', 'B4', 'G4']),
        'A7sus': ('A2', ['A2', 'D3', 'E3', 'G3', 'B3'], ['A3', 'D4', 'E4', 'G4', 'B4', 'G4', 'E4', 'D4']),
        'Dmaj9': ('D2', ['D3', 'F#3', 'A3', 'C#4', 'E4'], ['D4', 'F#4', 'A4', 'C#5', 'E5', 'C#5', 'A4', 'F#4']),
    }
    vuelta = ['Bm9', 'Gmaj9', 'Em9', 'A7sus']
    orden = [vuelta[c % 4] for c in range(14)] + ['Dmaj9']
    for c, nombre in enumerate(orden):
        raiz, colchon, arpegio = ACORDES[nombre]
        t0 = c * bar
        abierto = 900 if c < 2 else 2600 if 10 <= c < 12 else 1800
        m.pone(so.pad([hz(x) for x in colchon], bar + 0.2, abierto), t0, 0.5, fase=True, sala=0.35)
        # el arpegio en semicorcheas, suave al empezar
        g = 0.13 if c < 2 else 0.2
        for k in range(16):
            nota = arpegio[k % len(arpegio)]
            m.pone(so.pulsado(hz(nota)), t0 + k * paso + (0.12 * paso if k % 2 else 0), g * (1 if k % 4 == 0 else 0.75),
                   pan=0.6 * np.sin(k * 0.8), eco=0.5, sala=0.2)
        # el bajo: raíz, octava, quinta y la nota de paso al acorde siguiente
        if c >= 2:
            f = hz(raiz)
            sig = hz(ACORDES[orden[min(c + 1, len(orden) - 1)]][0])
            if 10 <= c < 12 or c == 14:
                m.pone(so.bajo(f, bar if c < 14 else bar + 1.5), t0, 0.7)
            else:
                golpes = [(0, f), (3, 2 * f), (6, 1.5 * f), (8, f), (10, f), (11, 2 * f), (14, sig * 2 ** (-1 / 12))]
                for j, (st, fr) in enumerate(golpes):
                    hasta = golpes[j + 1][0] if j + 1 < len(golpes) else 16
                    m.pone(so.bajo(fr, (hasta - st) * paso - 0.01), t0 + st * paso + (0.12 * paso if st % 2 else 0), 0.7)
    # la batería: entra en el compás 3, se va en el corte y vuelve
    A = {'k': 'x.....x.x.......', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..............x.'}
    B = {'k': 'x.....x.x.....x.', 's': '....X.......X..g', 'h': 'xgxgxgxgxgxgxgxg', 'o': '..............x.'}
    bateria(m, 2 * bar, 6 * bar, paso, A, swing=0.12, grabar_patadas=True)
    bateria(m, 6 * bar, 10 * bar, paso, B, swing=0.12, grabar_patadas=True)
    bateria(m, 10 * bar, 12 * bar, paso, {'h': 'x.x.x.x.x.x.x.x.'}, swing=0.12)
    bateria(m, 12 * bar, 14 * bar, paso, B, swing=0.12, grabar_patadas=True)
    relleno(m, 9 * bar + 13 * paso, paso)
    for c in (2, 6, 12):
        m.pone(so.crash(), c * bar, 0.35, -0.3, sala=0.3)
    m.pone(so.reverso(bar), 1 * bar, 0.4)
    m.pone(so.reverso(bar), 11 * bar, 0.5)
    # la melodía de sintetizador, con eco y algo de sala
    frases = [(0, 1.5, 'F#4'), (1.5, 0.5, 'A4'), (2, 1, 'B4'), (3, 1, 'A4'), (4, 1.5, 'D5'), (5.5, 0.5, 'C#5'),
              (6, 2, 'B4'), (8, 1, 'E5'), (9, 1, 'D5'), (10, 1, 'B4'), (11, 1, 'A4'), (12, 2, 'F#4'), (14, 1, 'E4'),
              (15, 1, 'F#4')]
    otra = [(0, 1, 'B4'), (1, 1, 'D5'), (2, 1, 'F#5'), (3, 1, 'E5'), (4, 2, 'D5'), (6, 1, 'B4'), (7, 1, 'A4')]
    for t0, fr in ((6 * bar, frases), (12 * bar, otra)):
        voz, _ = linea(fr, b, 16 * b if fr is frases else 8 * b, 'pulso')
        m.pone(np.tanh(2.2 * normal(banda(voz, 120, 3200))), t0, 0.32, pan=-0.15, eco=0.45, sala=0.3)
    # el final en re mayor: el golpe y las campanas de la marca
    m.pone(so.crash(), 14 * bar, 0.45, sala=0.4)
    m.pone(so.bombo(), 14 * bar, 0.9)
    m.pone(so.campana(), 14 * bar, 0.85, sala=0.9)
    return m.termina(largo, 0.75 * bar / 4 * 3, bombeo=0.42)


# ---------- Rock psicodélico ----------

def rock():
    bpm, compases = 112, 16
    b = 60 / bpm
    bar, paso = 4 * b, b / 4
    largo = compases * bar + 2.2
    m = Mezcla(largo)
    # el bordón y el órgano que crece en la entrada
    m.pone(tanpura(['E2', 'B2', 'E3', 'E3'], 2 * bar + 1.5, b / 2), 0, 0.55, pan=0.35, sala=0.5)
    entrada = organo(['E3', 'G3', 'B3', 'D4'], 2 * bar)
    m.pone(entrada * np.linspace(0, 1, len(entrada)) ** 2, 0, 0.4, pan=-0.3, sala=0.4)
    m.pone(so.reverso(bar), bar, 0.45)
    bateria(m, bar, 2 * bar, paso, {'t': 'x.x.x.x.x.x.x.x.'})
    # el riff, de dos compases, con la guitarra y el bajo juntos
    riff = [(0, 0.75, 'E3', False), (0.75, 0.25, 'E3', True), (1, 0.5, 'G3', False), (1.5, 1, 'A3', False),
            (3, 0.5, 'B3', False), (3.5, 0.5, 'A3', True), (4, 0.75, 'E3', False), (4.75, 0.25, 'E3', True),
            (5, 0.5, 'G3', False), (5.5, 0.5, 'A3', False), (6, 0.5, 'D4', False), (6.5, 0.5, 'C#4', False),
            (7, 1, 'A3', False)]

    def toca_riff(t0, g=1.0, bajo=True):
        for k, (bt, d, nota, apagada) in enumerate(riff):
            m.pone(quinta(nota, d * b + (0.05 if apagada else 0.25), apagada, seed=k), t0 + bt * b, 0.5 * g, pan=-0.45,
                   sala=0.25)
            m.pone(quinta(nota, d * b + (0.05 if apagada else 0.25), apagada, seed=40 + k), t0 + bt * b + 0.012, 0.42 * g,
                   pan=0.45, sala=0.25)
            if bajo:
                m.pone(bajo_dedo(hz(nota) / 2, d * b, seed=k), t0 + bt * b, 0.75)

    for c in (2, 4):
        toca_riff(c * bar)
    # la estrofa: órgano de Em7 a A7, el bajo que camina y la pandereta
    estrofa = [('Em7', ['G3', 'B3', 'D4', 'E4'], ['E2', 'G2', 'A2', 'B2']), ('A7', ['G3', 'C#4', 'E4', 'A4'], ['A2', 'C#3', 'E3', 'G3'])]
    for c in range(6, 14):
        nombre, voces, caminata = estrofa[c % 2]
        t0 = c * bar
        m.pone(organo(voces, bar - 0.02, seed=c), t0, 0.42, pan=-0.3, sala=0.35)
        for k, nota in enumerate(caminata):
            m.pone(bajo_dedo(hz(nota), b * 0.95, seed=10 + c + k), t0 + k * b, 0.75)
    for c in (7, 9):
        # un pedazo del riff entre frases
        for k, (bt, d, nota, apagada) in enumerate(riff[:6]):
            m.pone(quinta(nota, d * b + 0.2, apagada, seed=80 + k), c * bar + 2 * b + bt * b / 2, 0.3, pan=0.5, sala=0.3)
    toca_riff(14 * bar)
    # la batería: suelta, con ride en la estrofa y platillo abierto en el riff
    riff_bat = {'k': 'x.....x.x.x.....', 's': '....X.......X...', 'o': 'x.x.x.x.x.x.x.x.'}
    estrofa_bat = {'k': 'x.......x.x.....', 's': '....x.......x..g', 'r': 'x.x.x.x.x.x.x.x.', 't': '..x...x...x...x.'}
    solo_bat = {'k': 'x.....x.x.x.....', 's': '....X.......X.gg', 'r': 'X.x.X.x.X.x.X.x.', 't': 'x.x.x.x.x.x.x.x.'}
    bateria(m, 2 * bar, 6 * bar, paso, riff_bat, swing=0.08)
    bateria(m, 6 * bar, 10 * bar, paso, estrofa_bat, swing=0.08)
    bateria(m, 10 * bar, 14 * bar, paso, solo_bat, swing=0.08)
    bateria(m, 14 * bar, 15 * bar, paso, riff_bat, swing=0.08)
    for c in (5, 9, 13):
        relleno(m, c * bar + 13 * paso, paso)
    for c in (2, 6, 10, 14):
        m.pone(so.crash(), c * bar, 0.38, -0.25, sala=0.3)
    # el solo de guitarra con fuzz y wah, sobre la estrofa
    solo = [(0, 0.5, 'B4'), (0.5, 0.5, 'D5'), (1, 1, 'E5'), (2, 0.5, 'D5'), (2.5, 0.5, 'B4'), (3, 1, 'A4'),
            (4, 1.5, 'G4'), (5.5, 0.5, 'A4'), (6, 0.5, 'B4'), (6.5, 0.5, 'A4'), (7, 1, 'G4'), (8, 0.5, 'E4'),
            (8.5, 0.5, 'G4'), (9, 0.5, 'A4'), (9.5, 0.5, 'A#4'), (10, 1, 'B4'), (11, 1, 'D5'), (12, 2, 'E5'),
            (14, 0.5, 'D5'), (14.5, 0.5, 'B4'), (15, 1, 'E5')]
    voz, _ = linea(solo, b, 16 * b + 0.5, 'sierra', glide=0.02)
    t = np.arange(len(voz)) / SR
    wah = 450 * 5 ** (0.5 + 0.5 * np.sin(2 * np.pi * t / b - np.pi / 2))
    m.pone(filtro_movil(fuzz(voz, 14, 5000), wah, 0.55) * 1.4, 10 * bar, 0.5, pan=0.1, eco=0.25, sala=0.35)
    # el final: el acorde de mi que suena largo, la guitarra que se acopla y las campanas
    m.pone(quinta('E3', 2.2 * bar), 15 * bar, 0.6, pan=-0.3, sala=0.4)
    m.pone(quinta('E3', 2.2 * bar, seed=9), 15 * bar + 0.01, 0.5, pan=0.3, sala=0.4)
    m.pone(bajo_dedo(hz('E2'), 2 * bar), 15 * bar, 0.8)
    acople = np.sin(2 * np.pi * hz('E5') * tiempo(2 * bar)) * np.linspace(0, 1, int(2 * bar * SR)) ** 2
    m.pone(fuzz(acople, 4), 15 * bar + 0.3, 0.18, pan=0.2, sala=0.5)
    m.pone(so.crash(), 15 * bar, 0.5, sala=0.4)
    m.pone(so.bombo(), 15 * bar, 0.95)
    m.pone(so.campana(), 15 * bar + b, 0.8, sala=0.9)
    return m.termina(largo, 0.75 * b, cinta=False)


# ---------- Pop psicodélico ----------

def pop():
    bpm, compases = 104, 15
    b = 60 / bpm
    bar, paso = 4 * b, b / 4
    largo = compases * bar + 2.2
    m = Mezcla(largo)
    ACORDES = {
        'D': ('D2', ['D4', 'F#4', 'A4']), 'F#7': ('F#2', ['F#3', 'A#3', 'C#4', 'E4']), 'G': ('G2', ['G3', 'B3', 'D4']),
        'Gm': ('G2', ['G3', 'A#3', 'D4']), 'Bm': ('B1', ['B3', 'D4', 'F#4']), 'E7': ('E2', ['E3', 'G#3', 'B3', 'D4']),
        'A7': ('A2', ['A3', 'C#4', 'E4', 'G4']),
    }
    estrofa, coro = ['D', 'F#7', 'G', 'Gm'], ['Bm', 'E7', 'G', 'A7']
    # un acorde por compás; en el compás 13 y 14, dos por compás hacia el final
    orden = [(c * bar, bar, n) for c, n in enumerate(['D', 'Gm'] + estrofa + coro + ['D', 'Gm'])]
    orden += [(12 * bar, bar / 2, 'Bm'), (12 * bar + bar / 2, bar / 2, 'E7'), (13 * bar, bar / 2, 'G'),
              (13 * bar + bar / 2, bar / 2, 'A7'), (14 * bar, bar, 'D')]
    for i, (t0, d, nombre) in enumerate(orden):
        raiz, voces = ACORDES[nombre]
        c = int(t0 / bar + 1e-6)
        # el clavecín en corcheas, subiendo y bajando por el acorde
        arpegio = voces + [voces[1]] if len(voces) == 3 else voces
        for k in range(int(round(d / (b / 2)))):
            nota = arpegio[k % len(arpegio)] if (k // len(arpegio)) % 2 == 0 else arpegio[::-1][k % len(arpegio)]
            m.pone(clavecin(hz(nota), 0.8, seed=i * 8 + k), t0 + k * b / 2, 0.26, pan=0.4, sala=0.25)
        # el coro en el estribillo y al final
        if 6 <= c < 10 or c >= 12:
            m.pone(coro_aah([v.replace('3', '4') if c >= 12 else v for v in voces], d + 0.1), t0, 0.38, pan=-0.2, sala=0.5)
        # el bajo de dedo, melódico
        if c >= 2:
            f = hz(raiz)
            sig = hz(ACORDES[orden[min(i + 1, len(orden) - 1)][2]][0])
            if d < bar or c == 14:
                m.pone(bajo_dedo(f, d - 0.02, seed=i), t0, 0.75)
            else:
                for bt, fr, dd in ((0, f, 1.5), (1.5, 1.5 * f, 0.5), (2, 2 * f, 1), (3, 1.5 * f, 0.5), (3.5, sig * 2 ** (-1 / 12), 0.5)):
                    m.pone(bajo_dedo(fr, dd * b - 0.02, seed=i * 5 + int(bt * 2)), t0 + bt * b, 0.72)
    # la batería: seca, con palmas y pandereta en el estribillo
    estrofa_bat = {'k': 'x.......x.x.....', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.'}
    coro_bat = {'k': 'x.......x.x.....', 's': '....X.......X...', 'h': 'x.x.x.x.x.x.x.x.', 'c': '....x.......x...',
                't': 'xgxgxgxgxgxgxgxg'}
    puente_bat = {'k': 'x.........x.....', 't': '..x...x...x...x.'}
    bateria(m, 2 * bar, 6 * bar, paso, estrofa_bat, swing=0.06, sala=0.6)
    bateria(m, 6 * bar, 10 * bar, paso, coro_bat, swing=0.06, sala=0.6)
    bateria(m, 10 * bar, 12 * bar, paso, puente_bat, swing=0.06, sala=0.6)
    bateria(m, 12 * bar, 14 * bar, paso, coro_bat, swing=0.06, sala=0.6)
    relleno(m, 5 * bar + 13 * paso, paso, (247, 196, 165))
    for c in (2, 6, 12):
        m.pone(so.crash(), c * bar, 0.3, 0.25, sala=0.3)
    for c in (5, 11):
        m.pone(so.reverso(bar), c * bar, 0.45)
    # la flauta del melotrón: la melodía de la estrofa y la del estribillo
    melodia = [(0, 1, 'A4'), (1, 1, 'F#4'), (2, 1.5, 'A4'), (3.5, 0.5, 'B4'), (4, 1, 'A#4'), (5, 1, 'C#5'), (6, 2, 'E5'),
               (8, 1, 'D5'), (9, 1, 'B4'), (10, 1.5, 'G4'), (11.5, 0.5, 'A4'), (12, 1, 'A#4'), (13, 1, 'G4'), (14, 2, 'D4')]
    estribillo = [(0, 2, 'F#5'), (2, 1, 'D5'), (3, 1, 'B4'), (4, 2, 'G#4'), (6, 1, 'B4'), (7, 1, 'D5'), (8, 2, 'B4'),
                  (10, 1, 'D5'), (11, 1, 'G5'), (12, 2, 'E5'), (14, 1, 'C#5'), (15, 1, 'A4')]
    for t0, frase in ((0.0, melodia[8:]), (2 * bar, melodia), (6 * bar, estribillo), (12 * bar, estribillo[:8])):
        base = t0 - (8 * b if t0 == 0.0 else 0)
        for k, (bt, d, nota) in enumerate(frase):
            if base + bt * b >= 0:
                m.pone(flauta(hz(nota), d * b + 0.05, seed=k), base + bt * b, 0.3, pan=-0.35, eco=0.3, sala=0.45)
    # la frase de sitar en el puente
    sitar = [(0, 0.5, 'D4'), (0.5, 0.5, 'E4'), (1, 0.5, 'F#4'), (1.5, 0.5, 'A4'), (2, 1, 'G4'), (3, 0.5, 'F#4'),
             (3.5, 0.5, 'E4'), (4, 2, 'D4'), (6, 0.5, 'A4'), (6.5, 0.5, 'G4'), (7, 1, 'A#4')]
    for k, (bt, d, nota) in enumerate(sitar):
        m.pone(zumbido(cuerda(hz(nota), d * b + 0.6, 2.5, 1.0, seed=90 + k)), 10 * bar + bt * b, 0.32, pan=0.3, sala=0.4)
    # el final en re: el golpe y las campanas
    m.pone(so.crash(), 14 * bar, 0.4, sala=0.4)
    m.pone(so.bombo(), 14 * bar, 0.85)
    m.pone(so.campana(), 14 * bar + b / 2, 0.85, sala=0.9)
    return m.termina(largo, 0.75 * b)


PISTAS = {'neo-psicodelia': (neo, 98, 15), 'rock-psicodelico': (rock, 112, 16), 'pop-psicodelico': (pop, 104, 15)}


def main():
    SALIDA.mkdir(exist_ok=True)
    for nombre in sys.argv[1:] or list(PISTAS):
        print(f'{nombre}: armando')
        L, R = PISTAS[nombre][0]()
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / f'{nombre}.wav'
            escribe(L, R, wav)
            salida = SALIDA / f'{nombre}.mp3'
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '192k',
                            str(salida)], check=True)
        print(f'{salida.relative_to(AQUI.parent.parent)}: {len(L) / SR:.1f} s')


if __name__ == '__main__':
    main()
