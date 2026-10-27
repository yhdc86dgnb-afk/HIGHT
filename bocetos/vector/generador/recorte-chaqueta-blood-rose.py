# Recorte de la Chaqueta Blood Rose con GrabCut. La chaqueta está en plano sobre una mesa blanca: la mesa (clara y sin
# color) es fondo, también entre las tiras sueltas de abajo; la cremallera, que también es clara y sin color, es prenda.
# Uso, desde la carpeta de trabajo (requiere OpenCV: pip install opencv-python-headless):
#   python3 recorte-chaqueta-blood-rose.py productos/chaqueta-blood-rose/foto.jpg productos/chaqueta-blood-rose/foto-mascara.png
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

foto = np.array(Image.open(sys.argv[1]).convert('RGB'))
h, w = foto.shape[:2]
hsv = cv2.cvtColor(foto, cv2.COLOR_RGB2HSV).astype(int)
S, V = hsv[..., 1], hsv[..., 2]


def zona(puntos):
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon(puntos, fill=1)
    return np.array(im) > 0


# la mesa: beige (tono cálido y poco color, también a la sombra de las tiras o manchado de pintura) o gris claro, como
# la línea de la mesa; la chaqueta es lavanda (tono violeta) y rojo o negro (mucho color o poca luz)
H = hsv[..., 0]
mesa = ((S < 30) & (V > 140)) | (((H <= 35) | (H >= 178)) & (S < 80) & (V > 120))


def banda(puntos, ancho):
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).line(puntos, fill=1, width=ancho, joint='curve')
    return np.array(im) > 0


# las cremalleras son metal claro y sin color, como la mesa, pero son prenda: la que rodea la abertura de la capucha
# y la del frente, que baja hasta el tirador de balanza
capucha = banda([(232, 95), (250, 97), (300, 110), (350, 118), (400, 113), (440, 100), (463, 94), (472, 104),
                 (460, 125), (430, 130), (400, 130), (373, 140), (357, 160)], 12)
capucha |= banda([(232, 95), (232, 110), (242, 124), (260, 137), (300, 140), (340, 150), (357, 160)], 12)
frente = banda([(355, 160), (358, 200), (362, 250), (366, 300), (372, 350), (380, 385), (395, 455), (410, 500),
                (422, 530), (430, 565), (442, 600), (455, 640), (465, 670), (470, 692)], 22)
tirador = zona([(452, 640), (482, 640), (482, 692), (452, 692)])
cremallera = capucha | frente | tirador
# entre la manga izquierda y el cuerpo la mesa queda a la sombra de la chaqueta, más oscura y con algo más de color:
# ahí también es fondo
hueco = zona([(210, 636), (234, 636), (248, 690), (254, 786), (236, 800), (214, 760), (206, 690)])
sombra = hueco & ((H <= 22) | (H >= 176)) & (S >= 35) & (S <= 80) & (V >= 75) & (V <= 150)
m = np.where(mesa, cv2.GC_PR_BGD, cv2.GC_PR_FGD).astype(np.uint8)
# lo que está lejos de la mesa es prenda segura; la mesa lejos de la prenda, fondo seguro
prenda_segura = cv2.erode((~mesa).astype(np.uint8), np.ones((21, 21), np.uint8)) > 0
mesa_segura = cv2.erode(mesa.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
m[prenda_segura] = cv2.GC_FGD
m[mesa_segura & ~cremallera] = cv2.GC_BGD
m[cremallera] = cv2.GC_FGD
m[sombra] = cv2.GC_BGD

bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(foto[..., ::-1].copy(), m, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
alfa = np.where((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

# solo la pieza grande (las manchas de pintura de la mesa quedan afuera) y sin huecos de un par de píxeles; los huecos
# grandes son la mesa que se ve entre las tiras y se quedan
n, etiquetas, stats, _ = cv2.connectedComponentsWithStats(alfa, 8)
grande = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
alfa = np.where(etiquetas == grande, 255, 0).astype(np.uint8)
n, etiquetas, stats, _ = cv2.connectedComponentsWithStats(255 - alfa, 4)
for k in range(1, n):
    x, y, ww, hh, area = stats[k]
    toca_borde = x == 0 or y == 0 or x + ww == w or y + hh == h
    if not toca_borde and area < 60:
        alfa[etiquetas == k] = 255
# la mesa que se ve por rendijas chicas entre las tiras también es fondo: se quitan sus manchas de al menos 3 px de
# grueso, con la orilla; el borde de las tiras, que mezcla tira y mesa, se queda para no cortarlas
k3 = np.ones((3, 3), np.uint8)
adentro = (mesa & ~cremallera & (alfa > 0)).astype(np.uint8)
manchas = cv2.morphologyEx(adentro, cv2.MORPH_OPEN, k3)
alfa[(cv2.dilate(manchas, k3) > 0) & (adentro > 0)] = 0
alfa = cv2.morphologyEx(alfa, cv2.MORPH_OPEN, k3)
Image.fromarray(alfa).save(sys.argv[2])
print('listo', (alfa > 128).mean().round(3))
