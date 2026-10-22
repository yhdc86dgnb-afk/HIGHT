# Recorte de cada foto (copia) con un modelo de segmentación (ISNet, el de rembg): la máscara suave de la prenda.
# Las fotos de la tienda no se tocan: se lee la copia de productos/<prenda>/foto.jpg.
import sys, os, time
import numpy as np
from PIL import Image
import onnxruntime as ort   # pip install onnxruntime

# Modelo ISNet de rembg: https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx
MODEL = os.environ.get('ISNET_MODEL', 'modelos/isnet-general-use.onnx')
sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])

def mask_of(img):
    im = img.convert('RGB').resize((1024, 1024), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    a = a / max(1.0, a.max())
    a = (a - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([1.0, 1.0, 1.0], np.float32)
    x = a.transpose(2, 0, 1)[None].astype(np.float32)
    pred = sess.run(None, {'input_image': x})[0][0, 0]
    pred = (pred - pred.min()) / max(1e-6, pred.max() - pred.min())
    return Image.fromarray((pred * 255).astype(np.uint8)).resize(img.size, Image.LANCZOS)

names = sys.argv[1:] or sorted(os.listdir('productos'))
for h in names:
    d = f'productos/{h}'
    if not os.path.isdir(d):
        continue
    for face in ('foto', 'espalda'):
        p = f'{d}/{face}.jpg'
        if not os.path.exists(p):
            continue
        t = time.time()
        img = Image.open(p).convert('RGB')
        m = mask_of(img)
        m.save(f'{d}/{face}-mascara.png')
        # Vista de control sobre magenta.
        bg = Image.new('RGB', img.size, (255, 0, 255))
        Image.composite(img, bg, m).resize((img.width // 3, img.height // 3)).save(f'{d}/{face}-recorte.jpg', quality=80)
        print(h, face, img.size, round(time.time() - t, 1), 's')
