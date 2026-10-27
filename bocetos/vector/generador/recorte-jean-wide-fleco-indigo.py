# Recorte del Jean Wide Fleco Índigo con GrabCut, marcando a mano lo que es prenda (los muslos y la entrepierna, que la
# sombra deja casi negra) y lo que es fondo: el arco que dejan las piernas, el piso, los zapatos y la madera.
# Parte de la máscara de recorte.py (la vieja). Uso, desde la carpeta de trabajo (requiere OpenCV):
#   python3 recorte-jean-wide-fleco-indigo.py productos/jean-wide-fleco-indigo/foto.jpg <máscara de recorte.py> productos/jean-wide-fleco-indigo/foto-mascara.png
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

foto = np.array(Image.open(sys.argv[1]).convert('RGB'))
vieja = np.array(Image.open(sys.argv[2]).convert('L').resize((foto.shape[1], foto.shape[0])))
h, w = vieja.shape
hsv = cv2.cvtColor(foto, cv2.COLOR_RGB2HSV).astype(int)

# punto de partida: lo que la máscara vieja daba por prenda es probable, lo demás es fondo
m = np.where(vieja > 128, cv2.GC_PR_FGD, cv2.GC_BGD).astype(np.uint8)

def zona(puntos):
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon(puntos, fill=1)
    return np.array(im) > 0

def poligono(puntos, valor):
    m[zona(puntos)] = valor

# entre las piernas, de la rodilla para abajo, nada es seguro: ahí decide el color
entre = zona([(262, 540), (325, 540), (335, 700), (345, h), (235, h), (250, 700)])
dentro = cv2.erode((vieja > 200).astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
dentro &= ~entre
m[dentro] = cv2.GC_FGD

# arriba de la V siguen los muslos del mismo jean hasta el borde de la foto, y entre los dos muslos va la entrepierna:
# esa tela queda en sombra honda, casi negra, pero es prenda. El fondo solo se ve por el arco que dejan las piernas
# debajo de la entrepierna (gris liso, medido fila por fila), hasta donde se tocan los flecos
izq = [(88, 44), (150, 86), (205, 115), (255, 141), (276, 151)]
der = [(306, 144), (322, 117), (355, 97), (405, 75), (452, 47), (476, 25)]
muslo_izq = zona([(100, 0), (262, 0), (262, 100), (270, 140)] + izq[::-1])
muslo_der = zona([(322, 0), (468, 0)] + der[::-1] + [(318, 110)])
arco = zona([(274, 109), (294, 109), (297, 113), (298, 125), (298, 148), (296, 156), (295, 168), (292, 178), (289, 188),
             (286, 191), (284, 188), (282, 178), (280, 168), (280, 156), (278, 150), (271, 146), (269, 135), (269, 122),
             (271, 113)])
tiro = zona([(258, 0), (326, 0), (322, 110), (306, 144), (296, 192), (282, 192), (276, 151), (270, 140), (262, 100)]) & ~arco
cadera = muslo_izq | muslo_der | tiro
m[cadera] = cv2.GC_PR_FGD
m[cv2.erode((muslo_izq | muslo_der).astype(np.uint8), np.ones((15, 15), np.uint8)) > 0] = cv2.GC_FGD
# la entrepierna es prenda segura salvo un borde de dos píxeles junto al arco, donde decide el color
m[tiro & ~(cv2.dilate(arco.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)] = cv2.GC_FGD
m[arco] = cv2.GC_BGD
# el piso que se ve entre las piernas, de la rodilla para abajo, y los zapatos
# el centro de la franja, medido fila por fila: sombra hasta la rodilla y madera más abajo
poligono([(291, 556), (297, 556), (299, 580), (300, 650), (302, 700), (310, 730), (307, 760), (310, 790), (318, 820),
          (322, h), (262, h), (264, 820), (282, 790), (285, 760), (294, 730), (292, 700), (290, 650), (288, 580)], cv2.GC_BGD)
# abajo, la pierna cae sobre el zapato: el zapato blanco es fondo
poligono([(158, 828), (248, 828), (252, h), (154, h)], cv2.GC_PR_BGD)
# la madera del piso y la pared, y el negro del escenario, son fondo donde estén
madera = (hsv[..., 0] >= 5) & (hsv[..., 0] <= 25) & (hsv[..., 1] > 50) & (hsv[..., 2] > 80)
negro = (hsv[..., 2] < 38) & (hsv[..., 1] < 60)
# la entrepierna: bajo la V las dos piernas se juntan y la costura queda en sombra, pero es prenda hasta donde se
# separan, más o menos a la altura de la rodilla
entrepierna = zona([(272, 196), (308, 196), (314, 300), (308, 450), (300, 548), (288, 548), (276, 450), (270, 300)])
m[entrepierna] = cv2.GC_FGD
m[(madera | negro) & ~dentro & ~cadera & ~entrepierna] = cv2.GC_BGD
zapato = (hsv[..., 2] > 235) & (hsv[..., 1] < 25)
zapato[:812] = False
m[zapato] = cv2.GC_BGD
# en la franja de entre las piernas, la sombra honda también es fondo
m[entre & (hsv[..., 2] < 46)] = cv2.GC_BGD

bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(foto[..., ::-1].copy(), m, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
alfa = np.where((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

# solo la pieza grande (las dos piernas se tocan), sin huecos chicos ni motas sueltas
n, etiquetas, stats, _ = cv2.connectedComponentsWithStats(alfa, 8)
grande = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
alfa = np.where(etiquetas == grande, 255, 0).astype(np.uint8)
hueco = 255 - alfa
n, etiquetas, stats, _ = cv2.connectedComponentsWithStats(hueco, 4)
for k in range(1, n):
    x, y, ww, hh, area = stats[k]
    toca_borde = x == 0 or y == 0 or x + ww == w or y + hh == h
    if not toca_borde and area < 400:
        alfa[etiquetas == k] = 255
alfa = cv2.morphologyEx(alfa, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# borde suave de un pixel y medio
alfa = cv2.GaussianBlur(alfa, (0, 0), 1.2)
Image.fromarray(alfa).save(sys.argv[3])
print('listo', (alfa > 128).mean().round(3))
