# Posts de Instagram

![Los 20 posts](vista-previa.jpg)

Los 20 posts del lanzamiento del Drop 01, en 1080 × 1350 (el vertical del feed). No repiten la página: la tienda
muestra las prendas como catálogo, y acá van la noche con halo azul y grano, la plata cepillada, el cianotipo, el
blanco y negro de revista y los dibujos y el 3D del visor 360, con las tipografías y los logos del design system.

| Archivo | Para qué |
| --- | --- |
| `posts/01.jpg` a `20.jpg` | Los posts listos para subir, en el orden de publicación. |
| `textos.md` | El pie de foto de cada post, el día en que sale y la bio sugerida. |
| `posts.html` | Los 20 posts armados en una página; de acá salen los JPG. |
| `imagenes/` | Cada prenda recortada, en cianotipo, en blanco y negro y en dibujo, los detalles de cerca y cinco prendas en 3D. Sirven para armar más posts. |
| `fuentes/` | Hight Espina, Archivo, IBM Plex Mono e Instrument Serif, para que la página se vea igual en cualquier computador. |
| `preparar.py` | Arma `imagenes/` a partir de copias de las fotos de la tienda. |
| `render.js` | Saca los JPG de `posts.html`. |

## Orden

El feed alterna noche y plata, así que en la cuadrícula del perfil (tres columnas) queda un tablero, y nunca van dos
posts de texto seguidos. Seis posts salen antes del lanzamiento, dos el mismo día y doce después, uno por día.

| Post | Día | Fondo | Qué muestra |
| --- | --- | --- | --- |
| 01 | −6 | noche | DROP 01 en cromo con la estrella |
| 02 | −5 | plata | Seis detalles de cerca, cada uno de una prenda |
| 03 | −4 | noche | *La prenda se siente antes de verse.* |
| 04 | −3 | plata | Nueve prendas dibujadas, como en el visor 360 |
| 05 | −2 | noche | Chaqueta Trouble Maker en cianotipo |
| 06 | −1 | plata | Prendas en 3D colgadas en su percha |
| 07 | 0 | noche | HOY |
| 08 | 0 | plata | Las 20 piezas con su precio |
| 09 | +1 | noche | Las correas de tachas |
| 10 | +2 | plata | Jean Flare Patchwork Leopardo |
| 11 | +3 | noche | Buzo Destroyed Ceniza en cianotipo |
| 12 | +4 | plata | Camiseta Célula Carmín |
| 13 | +5 | noche | *Si la ves y es tu talla, es tuya.* |
| 14 | +6 | plata | Chaqueta Smiley Ácido, con lupa sobre la pintura |
| 15 | +7 | noche | Hoja de contacto en blanco y negro |
| 16 | +8 | plata | Jean Wide Patchwork Índigo |
| 17 | +9 | noche | Tejido Anillos Índigo en cianotipo |
| 18 | +10 | plata | Correas de cerca, cruzadas |
| 19 | +11 | noche | Jean Flare Destroyed Verde y Jean Flare Costura Neón |
| 20 | +12 | plata | Ficha técnica del Buzo Multitud Térmica, con sus detalles numerados |

Los precios y las unidades de los posts y de `textos.md` son los de la tienda del 23 de octubre de 2026 (máximo 4
por talla; la camiseta, 3 por talla). Si cambian, se cambian en `posts.html` y en `textos.md`, y se vuelven a sacar
los JPG.

## Volver a generar

Requiere Python 3 con Pillow y NumPy, y Node con Playwright (Chromium).

1. Las imágenes salen de la carpeta de trabajo que arma el generador 360 de `bocetos/vector/generador/` (la que tiene
   `productos/<prenda>/foto.jpg` y `foto-mascara.png`). Las fotos de la tienda no se tocan: se trabaja sobre copias.

   ```bash
   python3 bocetos/instagram/preparar.py <carpeta de trabajo del 360> .
   ```

2. Los JPG salen de `posts.html`, servido desde la raíz del repo (usa `design-system/` y las correas de `assets/`):

   ```bash
   python3 -m http.server 8783
   node bocetos/instagram/render.js http://127.0.0.1:8783/bocetos/instagram/posts.html
   ```

Las prendas que la foto original corta por un lado (el Jean Wide Patchwork Índigo, el Tejido Anillos Índigo, el
Jean Wide Fleco Índigo y el Jean Flare Dragón Ácido) van con ese lado contra el borde del post o del marco, para que
el corte se vea a propósito.
