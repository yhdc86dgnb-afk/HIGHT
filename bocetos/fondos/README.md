# Fondo de logos

![El fondo para las prendas, solo y con tres prendas](vista-previa.jpg)

El logo de Hight en plateado sobre negro, repetido como un estampado de perchas: filas corridas, cada logo un poco
girado y con aire entre uno y otro.

## Para poner detrás de las prendas

Fondo de estudio para las fotos de producto. Los logos van apagados, casi invisibles en las orillas, y en el centro cae
una luz suave, así que la prenda es lo primero que se ve. Sigue la receta de foto de producto del manual de marca
(`design-system/secciones/03-fotografia.md`): vertical 4:5, 2.000 px por el lado largo, la prenda centrada y ocupando
el 80 % del alto, sin sombras duras y el mismo fondo para toda la colección.

| Archivo | Tamaño | Qué es |
| --- | --- | --- |
| `prenda-plata.png` | 1600 × 2000 | El fondo solo, con el logo plateado tal cual. |
| `prenda-plata-contorno.png` | 1600 × 2000 | El fondo solo, con el logo en contorno plateado. |
| `prendas/<prenda>.jpg` | 1600 × 2000 | Las 19 prendas del Drop 01 que tienen foto, cada una sobre el fondo plateado, con una sombra suave. |
| `prendas.jpg` | | Las 19 juntas, para verlas de un vistazo. |

Las prendas salen de copias recortadas de las fotos de la tienda (`../instagram/imagenes/`); las fotos de la tienda no se
tocan. Las que la foto original corta por un lado (el Jean Wide Patchwork Índigo, el Tejido Anillos Índigo, el Jean
Wide Fleco Índigo y el Jean Flare Dragón Ácido) van con ese lado contra el borde, para que el corte se vea a propósito.
La Chaqueta Blood Rose no está porque todavía no tiene foto.

Para una foto nueva, fotografía la prenda sobre un fondo liso, recórtala y ponla encima de `prenda-plata.png` con el
mismo tamaño y margen que las demás.

## Para repetir

| Archivo | Tamaño | Qué es |
| --- | --- | --- |
| `cuadro-plata.png` | 2400 × 2400 | El logo plateado tal cual, con su brillo de metal. |
| `cuadro-plata-contorno.png` | 2400 × 2400 | El logo en contorno plateado, más liviano, como las líneas de las perchas. |
| `historia-plata.png`, `historia-plata-contorno.png` | 1080 × 1920 | Las mismas dos, del tamaño de una historia o un fondo de teléfono. |

El cuadro empalma por los cuatro lados, así que se puede repetir sin que se note la unión: sirve para la web, papel de
seda o bolsas, e impreso a 300 puntos por pulgada mide 20 × 20 cm. El fondo es el negro carbón de la marca.

## Volver a generarlos

Requiere Python 3 con Pillow y NumPy. Desde la raíz del repo:

```bash
python3 bocetos/fondos/patron.py    # los cuadros y las historias
python3 bocetos/fondos/prendas.py   # el fondo para las prendas y las 19 prendas encima
```

El logo plateado sale de `assets/hight-logo-plata.webp`, con un poco más de brillo para que en tamaño chico siga
viéndose como metal; el contorno sale de la silueta de `assets/hight-logo-tinta.webp`, pintado con un degradé de plata.
Los tamaños, el número de filas y columnas y el grosor del trazo están arriba en cada programa; con otra semilla
(`semilla` en `patron.py`) cambian los giros de cada logo.
