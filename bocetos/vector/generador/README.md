# Generador de la vista 360

Arma, a partir de la foto de una prenda, su dibujo en vector (estilo Illustrator, con texturas) y los cinco archivos
que usa el visor 360 del tema. Las fotos de la tienda no se tocan: se trabaja sobre copias.

## Qué hace

1. **Recorte** (`recorte.py`): la máscara de la prenda con un modelo de segmentación (ISNet, el de rembg). En fotos de
   estudio con fondo blanco también usa el blanco que toca el borde, para no perder las partes claras de la prenda.
   Dos prendas tienen su propio recorte, con GrabCut (OpenCV) y zonas marcadas a mano:
   `recorte-jean-wide-fleco-indigo.py` parte de la máscara de `recorte.py` y le devuelve los muslos y la entrepierna,
   y `recorte-chaqueta-blood-rose.py` saca la chaqueta de la mesa, también la que se ve entre las tiras sueltas.
2. **Dibujo** (`prenda.py`): silueta suave, tintas planas por prenda (k-medias en Lab), limpieza de bordes y motas,
   texturas sacadas del detalle fino de la foto, trama de la tela según el tipo de prenda (sarga, punto, jersey o
   malla), la espalda (de foto, de boceto o de referencia), el canto y el volumen. Escribe los SVG para Illustrator
   (`frente-texturas.svg`, `espalda-texturas.svg`) y los mapas del 3D.
3. **Mapas a WebP** (`rasterizar.js`): pasa los mapas del 3D a imagen con el lado largo en 2048 px.
4. **Exportar** (`exportar.py`): deja los cinco archivos de cada prenda (`360-<prenda>.json`, `-alto.png`,
   `-lado.png`, `-frente.webp` y `-espalda.webp`) en la carpeta que se le indique, normalmente `assets/` del tema.

`boceto-caras.js` saca el frente y la espalda del boceto plano de una prenda que todavía no tiene foto (así se armó
la Chaqueta Blood Rose antes de tener foto).

`armario.py` arma la versión liviana de cada prenda para el clóset del inicio: la misma silueta con una grilla más
gruesa (paso de 8 px en vez de 4) y texturas de 768 px. Deja `360-<prenda>-armario.json`, `-armario-frente.webp` y
`-armario-espalda.webp` junto a los demás archivos de la prenda.

`poster.js` saca el primer cuadro del clóset, el que se ve mientras cargan las prendas: abre el inicio de la tienda,
cuelga las mismas prendas que la sección y las deja quietas en el cuadro inicial. Escribe en el tema
`assets/closet-poster.webp` (2592 × 1080), `assets/closet-poster-cel.webp` (el centro, para el teléfono) y
`snippets/closet-poster.liquid`, con la lista de prendas que salen en él. Hay que volver a correrlo cuando se publica
o se oculta una prenda, o cambia su nombre o su tipo.

## Carpeta de trabajo

```
productos/
  lista.tsv                 <prenda>\t<tipo>  (Jean, Pantalón, Short, Chaqueta, Buzo, Tejido, Camiseta, Top)
  titulos.json              {"<prenda>": "Nombre de la prenda"}
  <prenda>/foto.jpg         copia de la foto del frente
  <prenda>/espalda.jpg      copia de la foto de la espalda (si la hay)
  <prenda>/boceto/          frente y espalda del boceto (si no hay foto)
modelos/isnet-general-use.onnx
```

## Uso

Desde la carpeta de trabajo (o con `HIGHT_360=<carpeta>`):

```bash
pip install numpy pillow potracer onnxruntime
python3 recorte.py <prenda>
python3 prenda.py <prenda>
node rasterizar.js <prenda>          # requiere Playwright con Chromium
python3 exportar.py <tema>/assets <prenda>
python3 armario.py <tema>/assets <prenda>
node poster.js http://127.0.0.1:9292 <tema>   # con `shopify theme dev` andando en el tema
```

Después se agrega la dirección de la prenda a la lista de `snippets/vista-360.liquid`.

Los ajustes de cada prenda están arriba de `prenda.py`: `FIX` (fotos con la prenda puesta, con piso entre las
piernas o con huecos por donde se ve la mesa), `BACK` (cómo se arma la espalda de referencia) y `WEAVE_PRODUCT` (una
trama propia). La Chaqueta Trouble Maker, la única con foto de la espalda, se ajustó a mano antes de este generador y
sus archivos quedan como están.
