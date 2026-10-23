# Reels de Instagram

![Un cuadro de cada reel](vista-previa.jpg)

Cuatro videos verticales para el lanzamiento, en 1080 × 1920 y a 30 cuadros por segundo. Van sin sonido: la música se
elige en Instagram al subirlos. Tienen la misma identidad que los posts (noche con halo azul y grano, plata cepillada,
Hight Espina en cromo y la mono para los datos), y los textos quedan fuera de las franjas de arriba y de abajo donde
Instagram pone sus botones.

| Video | Dura | Qué pasa | Día sugerido |
| --- | --- | --- | --- |
| `adelanto.mp4` | 10 s | La estrella se abre, DROP 01 entra letra por letra, pasan seis prendas en cianotipo y cierra con PRONTO. | −4 |
| `giro.mp4` | 13 s | Chaqueta Smiley Ácido, Jean Flare Costura Neón y Buzo Multitud Térmica dan una vuelta entera en su percha, como en el visor 360 de la tienda. | −1 |
| `hoy.mp4` | 10 s | Las 20 piezas aparecen una por una sobre plata y después sale HOY. | 0 |
| `correas.mp4` | 9 s | Las correas de tachas corren en diagonal, en filas que van en sentidos contrarios, y cierra con TACHAS. | +1 |

Los días son los mismos de `../instagram/textos.md`, donde también están los pies de foto de cada reel. Si quieres
conservar el tablero de noche y plata en la cuadrícula del perfil, quita los reels de la cuadrícula desde su menú:
siguen en la pestaña de reels.

## Cómo se arman

`reels.html?r=<reel>` dibuja cada cuadro en un lienzo, siempre igual para el mismo número de cuadro; `giro` usa el
mismo 3D del visor de la tienda (`assets/hight-ropa.js` y three.js). `cuadros.js` guarda los cuadros como PNG y
ffmpeg los junta. Requiere Node con Playwright (Chromium) y ffmpeg; desde la raíz del repo:

```bash
python3 -m http.server 8783
node bocetos/reels/cuadros.js http://127.0.0.1:8783/bocetos/reels/reels.html giro   # deja los PNG en cuadros-giro/
ffmpeg -framerate 30 -i cuadros-giro/%04d.png -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -profile:v high -level 4.2 -movflags +faststart -an bocetos/reels/giro.mp4
```

Los nombres de los reels son `adelanto`, `giro`, `correas` y `hoy`; la carpeta de cuadros se puede borrar después.
Las prendas en cianotipo y los recortes salen de `../instagram/imagenes/`; los logos, la estrella y la plata, de
`design-system/`. El grano cambia cada dos cuadros y es de 2 px, para que la compresión de Instagram no lo vuelva
bloques.
