# Lleva los archivos 360 de cada prenda a assets/ del tema: 360-<prenda>.json, -alto.png, -lado.png, -frente.webp
# y -espalda.webp.
import sys, os, json, shutil
from PIL import Image
ROOT = os.path.join(os.environ.get('HIGHT_360', os.getcwd()), 'productos')
DEST = sys.argv[1]
total = 0
for h in sys.argv[2:]:
    d = os.path.join(ROOT, h)
    meta = json.load(open(os.path.join(d, 'datos.json')))
    out = os.path.join(DEST, f'360-{h}')
    with open(out + '.json', 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    shutil.copyfile(os.path.join(d, 'alto.png'), out + '-alto.png')
    shutil.copyfile(os.path.join(d, 'lado.png'), out + '-lado.png')
    for face in ('frente', 'espalda'):
        Image.open(os.path.join(d, f'3d-{face}.png')).convert('RGB').save(out + f'-{face}.webp', 'WEBP', quality=86, method=6)
    size = sum(os.path.getsize(out + s) for s in ('.json', '-alto.png', '-lado.png', '-frente.webp', '-espalda.webp'))
    total += size
    print(h, round(size / 1024), 'KB')
print('total', round(total / 1024 / 1024, 2), 'MB')
