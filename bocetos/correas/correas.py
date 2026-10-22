#!/usr/bin/env python3
"""Las 12 correas de tachas, dibujadas en vector como en Illustrator.

Cada correa sale acostada, con la hebilla a la izquierda y la punta a la derecha, sobre fondo transparente: el cuero
con su canto pintado, su pespunte y su textura (lisa, granulada o de víbora), las tachas en tres tonos de plata con
contorno negro, las piedras en su engaste, las incrustaciones de cuero beige y la hebilla de plata con su lengüeta y
su presilla. Los motivos de cada una salen de la foto de las correas, en el mismo orden, de la hebilla a la punta.

Uso: python3 correas.py <carpeta del tema>
Deja assets/correa-01.svg … correa-12.svg en el tema y una copia de cada una en esta carpeta.
"""
import math
import os
import shutil
import sys

H = 170          # alto del dibujo
W = 100          # ancho de la correa
Y0 = 35          # borde de arriba de la correa
CY = Y0 + W / 2  # eje de la correa
STRAP0 = 142     # donde arranca el cuero, debajo de la barra de la hebilla
TIP = 2350       # donde empieza la punta redonda
LENGTH = TIP + W / 2 + 12

INK = '#121212'
SILVER = {'base': '#b3b8bf', 'shadow': '#737882', 'light': '#e9edf1', 'white': '#ffffff'}
STONES = {
    'negra': ('#141416', '#62666f'),
    'rosada': ('#df4d8d', '#ffb8d6'),
    'roja': ('#b3162b', '#ff8d98'),
    'naranja': ('#e1611e', '#ffc28c'),
}
BEIGE = {'fill': '#d9c8a3', 'edge': '#9a875f', 'scale': '#a8925f'}


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


# ---------- Piezas sueltas: cada una es (tipo, x, y, radio, extra) ----------

def dome(x, y, r):
    return ('dome', x, y, r, None)


def eyelet(x, y, r):
    return ('eyelet', x, y, r, None)


def concho(x, y, r):
    return ('concho', x, y, r, None)


def stone(x, y, r, color):
    return ('stone', x, y, r, color)


def enamel(x, y, r):
    return ('enamel', x, y, r, None)


# ---------- Motivos: cada uno se dibuja centrado en x; `ext` es cuánto mide a lo largo ----------

def sun(x, center='eyelet'):
    """La flor grande de cerca de la punta (su centro es el hoyo de la hebilla): cuatro brazos y cuatro diagonales."""
    out = [eyelet(x, CY, 10.5) if center == 'eyelet' else dome(x, CY, 10)]
    for d, r in ((19, 5), (29.5, 3.9)):
        out += [dome(x - d, CY, r), dome(x + d, CY, r)]
    for d, r in ((18.5, 4.8), (28.5, 3.7)):
        out += [dome(x, CY - d, r), dome(x, CY + d, r)]
    for a in (45, 135, 225, 315):
        t = math.radians(a)
        out.append(dome(x + 15 * math.cos(t), CY + 15 * math.sin(t), 3.4))
        out.append(dome(x + 25 * math.cos(t), CY + 25 * math.sin(t), 2.6))
    return out


def flower(x, center='dome', ring=8, radius=13, rr=3.4, cr=6.4, color=None):
    """Florcita: un centro (domo, ojal o piedra) y un anillo de tachas chicas."""
    if color:
        out = [stone(x, CY, cr + 1.4, color)]
    else:
        out = [eyelet(x, CY, cr + 1.2) if center == 'eyelet' else dome(x, CY, cr)]
    for k in range(ring):
        t = 2 * math.pi * k / ring + math.pi / ring
        out.append(dome(x + radius * math.cos(t), CY + radius * math.sin(t), rr))
    return out


def diamond(x, length=214, width=78, n=10, color='negra'):
    """Rombo de tachas chicas con una piedra al centro, domos en las puntas y una cruz chica en cada punta larga."""
    pts = [(x - length / 2, CY), (x, CY - width / 2), (x + length / 2, CY), (x, CY + width / 2)]
    out = [dome(px, py, 4.4) for px, py in pts]
    for a in range(4):
        (ax, ay), (bx, by) = pts[a], pts[(a + 1) % 4]
        for k in range(1, n + 1):
            t = k / (n + 1)
            out.append(dome(ax + (bx - ax) * t, ay + (by - ay) * t, 2.9))
    # adentro, un rombo más chico de tachas alrededor de la piedra
    for a in range(4):
        (ax, ay), (bx, by) = pts[a], pts[(a + 1) % 4]
        ax, ay, bx, by = x + (ax - x) * .45, CY + (ay - CY) * .45, x + (bx - x) * .45, CY + (by - CY) * .45
        for k in range(0, 4):
            t = k / 4
            out.append(dome(ax + (bx - ax) * t, ay + (by - ay) * t, 2.3))
    if color:
        out.append(stone(x, CY, 8, color))
    return out


def x_link(x):
    return [dome(x, CY, 3)] + [dome(x + dx, CY + dy, 2.6) for dx in (-7, 7) for dy in (-7, 7)]


def tri3(x):
    return [dome(x - 10, CY - 12, 6.2), dome(x - 10, CY + 12, 6.2), dome(x + 11, CY, 7)]


def cross5(x, r=7, rr=5.2, d=15):
    out = [dome(x, CY, r)] + [dome(x + dx, CY + dy, rr) for dx, dy in ((-d, 0), (d, 0), (0, -d), (0, d))]
    return out + [dome(x + dx, CY + dy, 2.6) for dx in (-d * .7, d * .7) for dy in (-d * .7, d * .7)]


def square5(x):
    return [dome(x, CY, 4.2)] + [dome(x + dx, CY + dy, 5.6) for dx in (-11, 11) for dy in (-11, 11)] + \
           [dome(x, CY + dy, 2.8) for dy in (-26, 26)]


def enamel_pair(x):
    return [enamel(x, CY - 29, 6.2), enamel(x, CY + 29, 6.2)]


def single(r=7.2):
    return lambda x: [dome(x, CY, r)]


def paisley(x, cy, flip=1, size=1.0):
    """Gota de cachemir de tachas chicas: cabeza redonda con un domo, cola que se enrosca."""
    pts = []
    for k in range(240):
        t = 2 * math.pi * k / 240
        X = math.cos(t)
        Y = math.sin(t) * math.sin(t / 2) ** 1.3 * 0.95
        # la cola se enrosca hacia arriba (o hacia abajo si flip es -1)
        a = 0.7 * max(0.0, X) ** 2
        rx, ry = X + 1, Y
        X, Y = rx * math.cos(a) - ry * math.sin(a) - 1, rx * math.sin(a) + ry * math.cos(a)
        pts.append((x - X * 34 * size, cy - Y * 22 * size * flip))
    out = []
    acc = 0.0
    last = pts[0]
    out.append(dome(*last, 2.6))
    for p in pts[1:]:
        acc += math.hypot(p[0] - last[0], p[1] - last[1])
        last = p
        if acc >= 7:
            out.append(dome(*p, 2.6))
            acc = 0.0
    out.append(dome(x + 17 * size, cy, 6))
    return out


def paisley_pair(x):
    return paisley(x - 28, CY - 12, 1) + paisley(x + 28, CY + 12, -1)


def wave(x0, x1, amp=22, period=128, color=None):
    """Cadena de tachas en ese, con domos en las crestas y piedras donde cruza el eje."""
    out = []
    u = x0
    while u <= x1:
        out.append(dome(u, CY + amp * math.sin(2 * math.pi * (u - x0) / period), 3.2))
        u += 7.5
    k = 0
    while x0 + period / 4 + k * period / 2 <= x1:
        crest = 1 if k % 2 == 0 else -1
        px = x0 + period / 4 + k * period / 2
        out += [dome(px, CY + crest * (amp - 10), 6), dome(px, CY - crest * 12, 3.4)]
        if color and x0 + (k + 1) * period / 2 <= x1:
            out.append(stone(x0 + (k + 1) * period / 2, CY, 6.2, color))
        k += 1
    return out


def zigzag(x0, x1, amp=26, period=98):
    out = []
    u = x0
    while u <= x1:
        ph = ((u - x0) / period) % 1
        v = amp * (4 * ph - 1 if ph < 0.5 else 3 - 4 * ph)
        out.append(dome(u, CY + v, 3.5))
        u += 7.5
    k = 0
    while x0 + period / 2 * k <= x1:
        px = x0 + period / 2 * k
        v = -amp if k % 2 == 0 else amp
        out += [dome(px, CY + v, 6.2), dome(px, CY - v * 0.45, 5), dome(px + 11, CY - v * 0.45, 3), dome(px - 11, CY - v * 0.45, 3)]
        k += 1
    return out


def lattice(x0, x1, color=None, period=112, amp=31):
    """Dos zigzags cruzados: equis de tachas con una piedra en cada cruce y domos en las orillas."""
    out = []
    for phase in (0, 0.5):
        u = x0
        while u <= x1:
            ph = ((u - x0) / period + phase) % 1
            v = amp * (4 * ph - 1 if ph < 0.5 else 3 - 4 * ph)
            out.append(dome(u, CY + v, 3))
            u += 7
    k = 0
    while x0 + period / 4 + k * period / 2 <= x1:
        px = x0 + period / 4 + k * period / 2
        out.append(stone(px, CY, 6.6, color) if color else dome(px, CY, 6.4))
        k += 1
    k = 0
    while x0 + k * period / 2 <= x1:
        px = x0 + k * period / 2
        out += [dome(px, CY - amp, 5), dome(px, CY + amp, 5), dome(px, CY, 3.6)]
        k += 1
    return out


def crescent(x, up=True):
    """Media luna de tachas chicas con un domo grande adentro y dos piedras negras."""
    out = []
    s = -1 if up else 1   # arriba: la media luna abre hacia la orilla de arriba
    cy = CY + 46 * s
    for k in range(13):
        t = math.radians(-66 + k * 11)
        out.append(dome(x + 36 * math.sin(t), cy - 36 * math.cos(t) * s, 2.9))
    for k in range(7):
        t = math.radians(-54 + k * 18)
        out.append(dome(x + 24 * math.sin(t), cy - 24 * math.cos(t) * s, 2.3))
    out.append(dome(x, CY + 30 * s, 7.4))
    out += [stone(x - 24, CY + 3 * s, 4.8, 'negra'), stone(x + 24, CY + 3 * s, 4.8, 'negra')]
    return out


def inlay(x, length=172, width=76, stones=('roja', 'roja')):
    """Rombo de cuero beige con borde de tachas, un domo al centro y sus piedras."""
    out = [('inlay', x, CY, length, width)]
    pts = [(x - length / 2, CY), (x, CY - width / 2), (x + length / 2, CY), (x, CY + width / 2)]
    for a in range(4):
        (ax, ay), (bx, by) = pts[a], pts[(a + 1) % 4]
        for k in range(1, 10):
            t = k / 10
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            nx, ny = (by - ay), -(bx - ax)
            l = math.hypot(nx, ny)
            sgn = 1 if (px - x) * nx + (py - CY) * ny > 0 else -1
            out.append(dome(px + sgn * nx / l * 4.6, py + sgn * ny / l * 4.6, 2.7))
    for px, py in pts:
        out.append(dome(px + (-7 if px < x else 7 if px > x else 0), py, 4.4))
    out.append(dome(x, CY, 7.4))
    out += [dome(x + dx, CY, 3) for dx in (-20, 20)]
    for k, c in enumerate(stones):
        out.append(stone(x + (-42 if k == 0 else 42), CY, 6, c))
    return out


def butterfly(x):
    """Concho de mariposa: dos alas de plata a cada lado del eje."""
    return [('butterfly', x, CY, 1.0, None), dome(x, CY, 3.6)]


def edge_studs(x0, x1, step=12):
    out = []
    u = x0
    while u <= x1:
        out += [dome(u, CY - 35, 2.7), dome(u, CY + 35, 2.7)]
        u += step
    return out


def tip_studs():
    """La punta: domos siguiendo la curva y un concho plano al centro."""
    out = [concho(TIP + 6, CY, 12)]
    for a in range(-80, 81, 20):
        t = math.radians(a)
        out.append(dome(TIP + 35 * math.cos(t) - 8, CY + 35 * math.sin(t), 4.6))
    return out


# ---------- Las 12 correas, de izquierda a derecha en la foto ----------

def fill(x0, x1, pattern, gap=12):
    """Repite el patrón de motivos de x0 a x1 sin pasarse, y reparte lo que sobra entre los espacios."""
    placed = []
    x = x0
    k = 0
    while True:
        ext, make = pattern[k % len(pattern)]
        if x + ext > x1 and placed:
            break
        placed.append((x, ext, make))
        x += ext + gap
        k += 1
    spare = x1 - (placed[-1][0] + placed[-1][1])
    step = spare / max(1, len(placed) - 1)
    out = []
    for i, (px, ext, make) in enumerate(placed):
        out += make(px + i * step + ext / 2)
    return out


A0, SPLIT, A1 = 262, 1330, TIP - 66   # de la hebilla a la mitad: el dibujo de la correa; de ahí a la punta, las flores con hoyo

SUNS = [(64, sun), (18, single())]
SUNS_DOME = [(64, lambda x: sun(x, 'dome')), (18, single())]

BELTS = [
    # 1 · verde oliva, lisa: rombos con piedra negra unidos por equis; abajo, las flores grandes con hoyo.
    dict(leather='#3c4230', edge='#24281b', thread='#1a1d14', texture='liso', buckle='western',
         parts=lambda: fill(A0, SPLIT - 40, [(214, diamond), (20, x_link)], 4) + tri3(SPLIT - 12) + fill(SPLIT + 22, A1, SUNS, 14)),
    # 2 · vino granulada: cachemires de tachas, pares de puntos blancos y florcitas; abajo, flores con hoyo.
    dict(leather='#6e1523', edge='#470c15', thread='#3b0911', texture='granulado', buckle='rect',
         parts=lambda: fill(A0, SPLIT, [(32, flower), (14, enamel_pair), (124, paisley_pair), (14, enamel_pair)], 14) + fill(SPLIT + 30, A1, SUNS, 14)),
    # 3 · negra granulada: cadenas en ese con piedras rosadas y flores con piedra; abajo, flores grandes.
    dict(leather='#18191d', edge='#0a0a0c', thread='#2f3136', texture='granulado', buckle='rect',
         parts=lambda: fill(A0, SPLIT, [(256, lambda x: wave(x - 128, x + 128, color='rosada')), (36, lambda x: flower(x, color='rosada')),
                                         (36, lambda x: flower(x, color='negra'))], 12) + fill(SPLIT + 30, A1, SUNS_DOME, 14)),
    # 4 · negra granulada: incrustaciones beige con piedras rojas y cruces de domos; abajo, flores con hoyo.
    dict(leather='#17181c', edge='#0a0a0c', thread='#2d2f34', texture='granulado', buckle='square',
         parts=lambda: fill(A0, SPLIT, [(186, lambda x: inlay(x, stones=('roja', 'roja'))), (44, cross5)], 12) + fill(SPLIT + 30, A1, SUNS, 14)),
    # 5 · blanca granulada: zigzag de tachas con domos en las puntas; abajo, flores con hoyo.
    dict(leather='#ece8df', edge='#c8c1b3', thread='#c4bdb0', texture='granulado', buckle='western',
         parts=lambda: fill(A0, SPLIT, [(392, lambda x: zigzag(x - 196, x + 196)), (44, cross5)], 12) + fill(SPLIT + 30, A1, SUNS, 14)),
    # 6 · negra de víbora: incrustaciones beige de víbora con piedras negras y flores grandes entre ellas.
    dict(leather='#141517', edge='#070708', thread='#292a2e', texture='vibora', buckle='western',
         parts=lambda: fill(A0, SPLIT, [(186, lambda x: inlay(x, stones=('negra', 'negra'))), (64, lambda x: sun(x, 'dome'))], 12) + fill(SPLIT + 30, A1, SUNS, 14)),
    # 7 · negra de víbora: equis de tachas con piedras naranjas; abajo, flores grandes.
    dict(leather='#151618', edge='#070708', thread='#2a2b2f', texture='vibora', buckle='western',
         parts=lambda: fill(A0, SPLIT, [(1008, lambda x: lattice(x - 504, x + 504, 'naranja'))], 12) + fill(SPLIT + 30, A1, SUNS_DOME, 14)),
    # 8 · vino de víbora: equis de tachas con florcitas; abajo, cruces y flores con hoyo.
    dict(leather='#651421', edge='#3f0a13', thread='#36080f', texture='vibora', buckle='rect',
         parts=lambda: fill(A0, SPLIT, [(448, lambda x: lattice(x - 224, x + 224)), (34, flower), (34, flower)], 12) +
                       fill(SPLIT + 30, A1, [(46, cross5), (34, lambda x: flower(x, 'eyelet'))], 14)),
    # 9 · blanca granulada: medias lunas de tachas con domos grandes y piedras negras; abajo, flores con hoyo.
    dict(leather='#efece6', edge='#ccc5b8', thread='#c8c1b4', texture='granulado', buckle='western',
         parts=lambda: fill(A0, SPLIT, [(78, lambda x: crescent(x, True)), (78, lambda x: crescent(x, False))], 6) + fill(SPLIT + 30, A1, SUNS, 14)),
    # 10 · negra de víbora: cruces de domos y florcitas; abajo, flores grandes.
    dict(leather='#17181b', edge='#0a0a0c', thread='#2c2e33', texture='vibora', buckle='square',
         parts=lambda: fill(A0, SPLIT, [(44, cross5), (34, flower)], 12) + fill(SPLIT + 30, A1, SUNS_DOME, 14)),
    # 11 · negra granulada: conchos de mariposa entre cuadros de domos.
    dict(leather='#141518', edge='#070708', thread='#2a2c30', texture='granulado', buckle='western',
         parts=lambda: fill(A0, SPLIT, [(66, butterfly), (34, square5)], 12) + fill(SPLIT + 30, A1, SUNS, 14)),
    # 12 · negra lisa: cruces de domos, florcitas y tachas chicas por las orillas.
    dict(leather='#16171a', edge='#09090b', thread='#2b2d31', texture='liso', buckle='rect',
         parts=lambda: edge_studs(300, SPLIT) + fill(A0 + 20, SPLIT - 20, [(40, lambda x: cross5(x, 6.4, 4.6, 13)), (34, flower)], 12) +
                       fill(SPLIT + 30, A1, SUNS_DOME, 14)),
]


# ---------- SVG ----------

def defs(colors_used):
    s = SILVER
    out = [
        # Tacha de domo: plata en tres tonos, como un dibujo, con su brillo y su contorno.
        '<clipPath id="u"><circle r="1"/></clipPath>',
        f'<symbol id="dome" viewBox="-1.1 -1.1 2.2 2.2"><circle r="1" fill="{s["base"]}"/>'
        f'<circle cx=".34" cy=".38" r=".9" fill="{s["shadow"]}" clip-path="url(#u)"/>'
        f'<circle cx="-.3" cy="-.32" r=".44" fill="{s["light"]}"/><circle cx="-.42" cy="-.44" r=".15" fill="{s["white"]}"/>'
        f'<circle r="1" fill="none" stroke="{INK}" stroke-width=".16"/></symbol>',
        f'<symbol id="eyelet" viewBox="-1.1 -1.1 2.2 2.2"><circle r="1" fill="{s["base"]}"/>'
        f'<circle cx=".3" cy=".34" r=".92" fill="{s["shadow"]}" clip-path="url(#u)"/>'
        f'<circle cx="-.36" cy="-.5" r=".2" fill="{s["light"]}"/><circle r=".5" fill="{INK}"/>'
        f'<circle r="1" fill="none" stroke="{INK}" stroke-width=".14"/></symbol>',
        f'<symbol id="concho" viewBox="-1.1 -1.1 2.2 2.2"><circle r="1" fill="{s["light"]}"/>'
        f'<circle r=".72" fill="{s["base"]}" stroke="{s["shadow"]}" stroke-width=".1"/>'
        f'<circle cx="-.24" cy="-.26" r=".22" fill="{s["white"]}"/>'
        f'<circle r="1" fill="none" stroke="{INK}" stroke-width=".12"/></symbol>',
        f'<symbol id="enamel" viewBox="-1.1 -1.1 2.2 2.2"><circle r="1" fill="#f6f4ef"/>'
        f'<circle cx=".3" cy=".34" r=".9" fill="#cfcabf" clip-path="url(#u)"/><circle cx="-.36" cy="-.4" r=".2" fill="#fff"/>'
        f'<circle r="1" fill="none" stroke="{INK}" stroke-width=".14"/></symbol>',
    ]
    for name in colors_used:
        c, hl = STONES[name]
        out.append(
            f'<symbol id="st-{name}" viewBox="-1.1 -1.1 2.2 2.2"><circle r="1" fill="{s["base"]}"/>'
            f'<circle cx=".26" cy=".3" r=".95" fill="{s["shadow"]}" clip-path="url(#u)"/>'
            f'<circle r=".7" fill="{c}" stroke="{INK}" stroke-width=".08"/>'
            f'<ellipse cx="-.24" cy="-.28" rx=".26" ry=".18" fill="{hl}" opacity=".9"/>'
            f'<circle r="1" fill="none" stroke="{INK}" stroke-width=".13"/></symbol>'
        )
    # Texturas del cuero, en negro y blanco con poca opacidad, para que sirvan sobre cualquier color.
    out.append(
        '<pattern id="granulado" width="9" height="9" patternUnits="userSpaceOnUse">'
        '<circle cx="1.5" cy="2" r=".9" fill="#000" opacity=".22"/><circle cx="6" cy="1" r=".7" fill="#000" opacity=".18"/>'
        '<circle cx="4" cy="6" r="1" fill="#000" opacity=".2"/><circle cx="8" cy="7.5" r=".6" fill="#000" opacity=".16"/>'
        '<circle cx="3" cy="4" r=".5" fill="#fff" opacity=".08"/><circle cx="7.5" cy="4.5" r=".5" fill="#fff" opacity=".07"/>'
        '</pattern>'
    )
    out.append(
        '<pattern id="vibora" width="12" height="9" patternUnits="userSpaceOnUse">'
        '<path d="M0 9a6 6 0 0 1 12 0M-6 4.5a6 6 0 0 1 12 0M6 4.5a6 6 0 0 1 12 0" fill="none" stroke="#000" stroke-width=".9" opacity=".5"/>'
        '<path d="M2 7.6a4.4 4.4 0 0 1 8 0M-4 3.1a4.4 4.4 0 0 1 8 0M8 3.1a4.4 4.4 0 0 1 8 0" fill="none" stroke="#fff" stroke-width=".6" opacity=".08"/>'
        '</pattern>'
    )
    out.append(
        f'<pattern id="escama-beige" width="9" height="7" patternUnits="userSpaceOnUse">'
        f'<path d="M0 7a4.5 4.5 0 0 1 9 0M-4.5 3.5a4.5 4.5 0 0 1 9 0M4.5 3.5a4.5 4.5 0 0 1 9 0" fill="none" stroke="{BEIGE["scale"]}" stroke-width=".8"/>'
        '</pattern>'
    )
    return out


def strap_path(inset=0.0):
    y0, y1 = Y0 + inset, Y0 + W - inset
    r = W / 2 - inset
    return f'M{f(STRAP0)} {f(y0)}H{f(TIP)}A{f(r)} {f(r)} 0 0 1 {f(TIP)} {f(y1)}H{f(STRAP0)}Z'


def buckle(kind):
    """La hebilla de plata a la izquierda: marco, barra donde se dobla el cuero y lengüeta."""
    s = SILVER
    if kind == 'western':
        outer = 'M150 8H58C24 8 8 42 8 85S24 162 58 162H150Q159 162 159 153V17Q159 8 150 8Z'
        inner = 'M143 24H60C36 24 24 52 24 85S36 146 60 146H143Z'
        engrave = 'M147 16H59C30 16 16 46 16 85S30 154 59 154H147'
    elif kind == 'square':
        outer = 'M14 10H154Q159 10 159 15V155Q159 160 154 160H14Q9 160 9 155V15Q9 10 14 10Z'
        inner = 'M27 27H142V143H27Z'
        engrave = 'M18 18.5H150V151.5H18Z'
    else:
        outer = 'M26 12H146Q159 12 159 25V145Q159 158 146 158H26Q9 158 9 141V29Q9 12 26 12Z'
        inner = 'M30 28H143V142H30Q25 142 25 137V33Q25 28 30 28Z'
        engrave = 'M27 20H151V150H27Q17 150 17 140V30Q17 20 27 20Z'
    frame = outer + inner
    out = [
        # el cuero que entra en la hebilla y se dobla en la barra
        f'<clipPath id="marco"><path d="{frame}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>',
        f'<path d="{frame}" fill="{s["base"]}" fill-rule="evenodd"/>',
        f'<g clip-path="url(#marco)"><rect x="0" y="0" width="170" height="52" fill="{s["light"]}"/>'
        f'<rect x="0" y="122" width="170" height="48" fill="{s["shadow"]}"/>'
        f'<path d="{engrave}" fill="none" stroke="{s["shadow"]}" stroke-width="2.2" stroke-dasharray=".1 5.2" stroke-linecap="round"/></g>',
        f'<path d="{frame}" fill="none" stroke="{INK}" stroke-width="2.4" fill-rule="evenodd"/>',
        # la lengüeta, de la barra a la otra orilla del marco
        f'<path d="M156 {CY - 6}L22 {CY - 3}Q13 {CY} 22 {CY + 3}L156 {CY + 6}Z" fill="{s["base"]}" stroke="{INK}" stroke-width="2"/>',
        f'<path d="M150 {CY - 3}L28 {CY - 1.4}" stroke="{s["white"]}" stroke-width="1.6" stroke-linecap="round"/>',
        f'<circle cx="152" cy="{CY}" r="7" fill="{s["base"]}" stroke="{INK}" stroke-width="2"/>',
        f'<circle cx="150" cy="{CY - 2}" r="2.4" fill="{s["light"]}"/>',
    ]
    return out


def keeper():
    s = SILVER
    return [
        f'<rect x="176" y="{Y0 - 8}" width="30" height="{W + 16}" rx="4" fill="{s["base"]}" stroke="{INK}" stroke-width="2.2"/>',
        f'<rect x="179" y="{Y0 - 5}" width="24" height="14" rx="2" fill="{s["light"]}"/>',
        f'<rect x="179" y="{Y0 + W - 9}" width="24" height="12" rx="2" fill="{s["shadow"]}"/>',
        f'<path d="M183 {Y0 + 12}V{Y0 + W - 12}" stroke="{s["light"]}" stroke-width="2" stroke-linecap="round"/>',
        f'<use xlink:href="#concho" x="{228 - 7}" y="{CY - 7}" width="14" height="14"/>',
    ]


def butterfly_svg(x, y):
    s = SILVER
    wing = 'M0 0C-4-14-26-30-38-22C-46-16-36-4-20-1C-34 4-40 16-30 22C-20 28-6 14 0 0Z'
    g = []
    for sy in (1, -1):
        tr = f'translate({f(x)} {f(y)}) scale(1 {sy}) rotate(-90)'
        g.append(f'<path d="{wing}" transform="{tr}" fill="{s["base"]}" stroke="{INK}" stroke-width="1.8"/>')
        g.append(f'<path d="M-4-6C-12-16-24-22-30-20M-6 4C-16 8-24 14-26 18" transform="{tr}" fill="none" stroke="{s["light"]}" stroke-width="2" stroke-linecap="round"/>')
        g.append(f'<path d="M-2-2C-14-8-22-10-28-8" transform="{tr}" fill="none" stroke="{s["shadow"]}" stroke-width="1.4" stroke-linecap="round"/>')
    return g


def inlay_svg(x, y, length, width):
    pts = f'{f(x - length / 2)},{f(y)} {f(x)},{f(y - width / 2)} {f(x + length / 2)},{f(y)} {f(x)},{f(y + width / 2)}'
    return [
        f'<polygon points="{pts}" fill="{BEIGE["fill"]}"/>',
        f'<polygon points="{pts}" fill="url(#escama-beige)"/>',
        f'<polygon points="{pts}" fill="none" stroke="{BEIGE["edge"]}" stroke-width="2.4" stroke-linejoin="round"/>',
        f'<polygon points="{pts}" fill="none" stroke="{INK}" stroke-width="1" stroke-linejoin="round" opacity=".6"/>',
    ]


def inside(p):
    """Nada se sale del cuero: las tachas quedan adentro del pespunte."""
    if p[0] in ('inlay', 'butterfly'):
        return True
    return abs(p[2] - CY) + p[3] <= W / 2 - 9


def svg(n, belt):
    parts = [p for p in belt['parts']() + tip_studs() if inside(p)]
    colors = sorted({p[4] for p in parts if p[0] == 'stone'})
    body = ['<defs>'] + defs(colors) + [f'<clipPath id="cuero"><path d="{strap_path()}"/></clipPath>', '</defs>']
    body.append('<g>')
    # El cuero: canto pintado, cara, textura, luz arriba y sombra abajo, pespunte y contorno.
    body.append(f'<path d="{strap_path()}" fill="{belt["edge"]}"/>')
    body.append(f'<path d="{strap_path(3)}" fill="{belt["leather"]}"/>')
    if belt['texture'] != 'liso':
        body.append(f'<rect x="{STRAP0}" y="{Y0}" width="{LENGTH}" height="{W}" fill="url(#{belt["texture"]})" clip-path="url(#cuero)"/>')
    body.append(f'<g clip-path="url(#cuero)"><rect x="{STRAP0}" y="{Y0 + 3}" width="{LENGTH}" height="17" fill="#fff" opacity=".07"/>'
                f'<rect x="{STRAP0}" y="{Y0 + W - 20}" width="{LENGTH}" height="17" fill="#000" opacity=".14"/></g>')
    body.append(f'<path d="{strap_path(8.5)}" fill="none" stroke="{belt["thread"]}" stroke-width="1.7" stroke-dasharray="5.5 4" stroke-linecap="round"/>')
    body.append(f'<path d="{strap_path()}" fill="none" stroke="{INK}" stroke-width="2.4"/>')
    # Incrustaciones y mariposas debajo de las tachas; después cada pieza de metal o piedra.
    for p in parts:
        if p[0] == 'inlay':
            body += inlay_svg(p[1], p[2], p[3], p[4])
    for p in parts:
        if p[0] == 'butterfly':
            body += butterfly_svg(p[1], p[2])
    for p in parts:
        kind, x, y, r, extra = p
        if kind in ('inlay', 'butterfly'):
            continue
        ref = f'st-{extra}' if kind == 'stone' else kind
        body.append(f'<use xlink:href="#{ref}" x="{f(x - r * 1.1)}" y="{f(y - r * 1.1)}" width="{f(r * 2.2)}" height="{f(r * 2.2)}"/>')
    body += keeper()
    body += buckle(belt['buckle'])
    body.append('</g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {f(LENGTH)} {H}" width="{f(LENGTH)}" height="{H}">'
            + ''.join(body) + '</svg>\n')


def main():
    theme = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..')
    here = os.path.dirname(os.path.abspath(__file__))
    for n, belt in enumerate(BELTS, 1):
        name = f'correa-{n:02d}.svg'
        path = os.path.join(theme, 'assets', name)
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(svg(n, belt))
        shutil.copyfile(path, os.path.join(here, name))
        print(name, os.path.getsize(path), 'bytes')


if __name__ == '__main__':
    main()
