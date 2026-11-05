#!/usr/bin/env python3
"""Dónde está cada cara en las salidas del desfile, para que posts.py la tape con una barra.

Busca las caras con BlazeFace, el detector de caras de MediaPipe, corriéndolo con OpenCV: pasa ventanas cuadradas de
varios tamaños por cada toma, con el modelo de lejos y el de cerca, y junta lo que encuentran. Después se queda solo con
las caras de las modelos:
  - en una salida sola, la cara más clara de la parte de arriba de la foto, así no se tapan las caras de los estampados
    (como las del Buzo Multitud Térmica);
  - en la salida en grupo, todas las caras claras de la mitad de arriba;
  - las espaldas, la cabeza que se gira de espaldas, el detalle que corta la cara en la nariz y los detalles de la ropa
    no llevan barra.
Las cajas se revisaron a ojo. Deja fuentes/caras.json: la caja de cada cara y sus puntos (los dos ojos, la nariz, la boca
y las dos orejas), en píxeles de la toma tal como la marca tomas.json.

Los modelos vienen en el paquete face-detection-tflite de PyPI y no se guardan en el repo:
  pip download face-detection-tflite==0.6.0 --no-deps -d /tmp/fd
  unzip -j /tmp/fd/face_detection_tflite-0.6.0-py3-none-any.whl 'fdlite/data/face_detection_*_range.tflite' -d /tmp/fd
Requiere OpenCV 4.8 o más nuevo, que lee modelos TFLite.
Uso, desde la raíz del repo: python3 bocetos/desfile/caras.py /tmp/fd
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
FUENTES = AQUI / 'fuentes'
TOMAS = json.loads((FUENTES / 'tomas.json').read_text())
# las tomas que usan los posts
USADAS = ['c5-0', 'c5-2', 'c5-3', 'c6-0', 'c1-1', 'c1-3', 'c1-6', 'c7-4', 'c3-0', 'c3-1', 'c3-2', 'c7-5', 'c6-2', 'c6-6',
          'c4-4', 'c4-5', 'c4-6', 'c4-7', 'c5-1', 'c8-d1', 'c8-d2', 'c3-5', 'c7-0', 'c7-1', 'c7-2', 'c1-5', 'c4-0', 'c4-3',
          'c6-5', 'c3-3', 'c7-7', 'c7-6', 'c1-0', 'c1-2', 'c1-4']
# espaldas, la cabeza girada de espaldas, el detalle que corta la cara en la nariz y los detalles de la ropa
SIN_CARA = {'c5-3', 'c7-2', 'c6-5', 'c4-7', 'c7-7', 'c7-5', 'c8-d1', 'c8-d2', 'c7-6'}
GRUPOS = {'c3-3'}


def anclas(s, pasos, por_celda):
    """Los centros de las anclas de BlazeFace, en el orden en que salen del modelo."""
    out = []
    for paso, n in zip(pasos, por_celda):
        g = s // paso
        for y in range(g):
            for x in range(g):
                out += [((x + 0.5) / g, (y + 0.5) / g)] * n
    return np.array(out, np.float32)


def leer(ruta):
    try:
        return cv2.dnn.readNetFromTFLite(str(ruta), engine=cv2.dnn.ENGINE_CLASSIC)  # OpenCV 5
    except (AttributeError, TypeError):
        return cv2.dnn.readNetFromTFLite(str(ruta))


def modelos(carpeta):
    return {
        'lejos': (leer(carpeta / 'face_detection_full_range.tflite'), 192,
                  ['reshaped_regressor_face_4', 'reshaped_classifier_face_4'], anclas(192, [4], [1])),
        'cerca': (leer(carpeta / 'face_detection_short_range.tflite'), 128,
                  ['regressors', 'classificators'], anclas(128, [8, 16], [2, 6])),
    }


def detectar(img, modelo, umbral=0.45):
    """img: RGB uint8 cuadrada. Devuelve [x, y, w, h, puntaje, puntos] en píxeles de img."""
    net, s, salidas, a = modelo
    lado = img.shape[0]
    x = cv2.resize(img, (s, s), interpolation=cv2.INTER_AREA if lado > s else cv2.INTER_LINEAR).astype(np.float32)
    net.setInput((x / 127.5 - 1).transpose(2, 0, 1)[None])
    reg, cls = net.forward(salidas)
    reg, cls = reg[0], cls[0, :, 0]
    p = 0.5 * (1 + np.tanh(0.5 * np.clip(cls, -100, 100)))  # la sigmoide, sin desbordarse
    out = []
    for i in np.where(p > umbral)[0]:
        cx, cy = reg[i, 0] / s + a[i, 0], reg[i, 1] / s + a[i, 1]
        w, h = reg[i, 2] / s, reg[i, 3] / s
        puntos = [((reg[i, 4 + 2 * k] / s + a[i, 0]) * lado, (reg[i, 5 + 2 * k] / s + a[i, 1]) * lado) for k in range(6)]
        out.append([(cx - w / 2) * lado, (cy - h / 2) * lado, w * lado, h * lado, float(p[i]), puntos])
    return out


def iou(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    i = max(0, x1 - x0) * max(0, y1 - y0)
    return i / (a[2] * a[3] + b[2] * b[3] - i + 1e-9)


def juntar(dets, corte=0.3):
    """Las cajas que se pisan se promedian por su puntaje. Devuelve [x, y, w, h, puntaje, puntos, votos], de la más
    clara a la menos clara."""
    dets = sorted(dets, key=lambda d: -d[4])
    out = []
    while dets:
        d = dets[0]
        grupo = [e for e in dets if iou(d, e) > corte]
        dets = [e for e in dets if iou(d, e) <= corte]
        pesos = np.array([e[4] for e in grupo])
        caja = (np.array([e[:4] for e in grupo]) * pesos[:, None]).sum(0) / pesos.sum()
        puntos = (np.array([e[5] for e in grupo]) * pesos[:, None, None]).sum(0) / pesos.sum()
        out.append([*map(float, caja), float(pesos.max()), puntos.tolist(), len(grupo)])
    return out


def caras_de(img, mods):
    """Todas las caras posibles de una toma, con ventanas cuadradas que bajan por la foto a varios tamaños."""
    h, w = img.shape[:2]
    dets = []
    for lado in sorted({w, int(w * 0.6), int(w * 0.4)}):
        if lado < 60:
            continue
        paso = max(1, lado // 3)
        for y0 in list(range(0, max(1, h - lado + 1), paso)) + [max(0, h - lado)]:
            for x0 in sorted({0, max(0, (w - lado) // 2), max(0, w - lado)} | set(range(0, max(1, w - lado + 1), paso))):
                v = np.ascontiguousarray(img[y0:y0 + lado, x0:x0 + lado])
                if v.shape[:2] != (lado, lado):
                    continue
                for modelo in mods.values():
                    for d in detectar(v, modelo):
                        d[0] += x0
                        d[1] += y0
                        d[5] = [(px + x0, py + y0) for px, py in d[5]]
                        dets.append(d)
    return [d for d in juntar(dets) if d[6] >= 2 or d[4] > 0.7]


def main():
    mods = modelos(Path(sys.argv[1]))
    hojas = {}
    resultado = {}
    for nombre in USADAS:
        if nombre in SIN_CARA:
            continue
        t = TOMAS[nombre]
        if t['collage'] not in hojas:
            hojas[t['collage']] = np.asarray(Image.open(FUENTES / f"pasarela-{t['collage']}.jpg").convert('RGB'))
        img = hojas[t['collage']][t['y']:t['y'] + t['h'], t['x']:t['x'] + t['w']]
        caras = caras_de(img, mods)
        if nombre in GRUPOS:
            elegidas = [d for d in caras if d[4] >= 0.7 and d[1] + d[3] / 2 < 0.5 * t['h']]
        else:
            elegidas = [d for d in caras if d[4] >= 0.8 and d[1] + d[3] / 2 < 0.35 * t['h']][:1]
        resultado[nombre] = [{'x': round(d[0], 1), 'y': round(d[1], 1), 'w': round(d[2], 1), 'h': round(d[3], 1),
                              'puntaje': round(d[4], 3), 'puntos': [[round(a, 1), round(b, 1)] for a, b in d[5]]}
                             for d in elegidas]
        print(nombre, len(elegidas), 'cara' if len(elegidas) == 1 else 'caras')
    ruta = FUENTES / 'caras.json'
    ruta.write_text(json.dumps(resultado, indent=1) + '\n')
    print(ruta.relative_to(AQUI.parent.parent), sum(len(v) for v in resultado.values()), 'caras en', len(resultado), 'tomas')


if __name__ == '__main__':
    main()
