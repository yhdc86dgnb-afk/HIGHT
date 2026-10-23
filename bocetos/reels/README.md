# Reels de Instagram

![Un cuadro de cada reel](vista-previa.jpg)

Cuatro videos verticales para el lanzamiento, en 1080 × 1920 y a 30 cuadros por segundo, con el mismo estilo de la
página y de los posts: carbón, hueso y los seis colores con sus texturas, Anton, Space Grotesk y Space Mono, copias
impresas con cinta, el sello y las franjas de texto. Van con cortes al ritmo de los golpes, sacudidas y destellos, y
todos cierran igual: el logo cae de arriba, golpea, y debajo aparece el anuncio del lanzamiento con una pregunta para
la comunidad y los seis colores de la tienda.

Cada reel va cortado al tempo de una canción de Tame Impala, para ponérsela en Instagram, y viene en dos versiones:

- `<reel>-sin-musica.mp4`: solo los efectos (los golpes, los barridos, el latigazo y el logo). Es la que se sube para
  ponerle la canción desde la biblioteca de música de Instagram.
- `<reel>.mp4`: con música propia al mismo tempo. Es la que se sube si la canción no aparece en Instagram o si el reel
  se va a promocionar, porque un reel con una canción comercial no se puede promocionar.

| Video | Canción (golpes por minuto) | Dura | Qué pasa | Cierre | Día |
| --- | --- | --- | --- | --- | --- |
| `adelanto` | New Person, Same Old Mistakes (152) | 9,9 s | Entran las franjas de texto, pasan los seis colores con una prenda cada uno, «¿De qué color eres?» y DROP 01 letra por letra. | PRONTO · ¿De qué color eres? | −4 |
| `giro` | Feels Like We Only Go Backwards (150) | 14,1 s | «360°» gira y entra; la Chaqueta Smiley Ácido, el Jean Flare Costura Neón y el Buzo Multitud Térmica dan una vuelta entera en su percha, con paneos rápidos entre una y otra. | MAÑANA · ¿Cuál te pondrías? | −1 |
| `hoy` | Let It Happen (125) | 9,4 s | Cuenta regresiva 3, 2, 1 en tres colores, HOY de golpe y las 20 piezas cayendo sobre la mesa. | SALE HOY · Si es tu talla, es tuya | 0 |
| `correas` | Dracula (115) | 8,6 s | Las correas corren en las franjas del inicio cada vez más rápido, TACHAS, y al final una correa cruza la pantalla como un látigo: revienta, la pantalla se parte en dos y cae el logo. | YA EN LA TIENDA · ¿Cuál es la tuya? | +1 |

Cada canción va con lo que cuenta su reel: en el adelanto la pregunta es de qué color eres, como alguien que estrena
quién es; en el giro las prendas dan la vuelta y muestran la espalda; hoy es el día en que pasa, y las correas son de
noche, cuero y tachas.

Los días son los mismos de `../instagram/textos.md`, donde también están los pies de foto de cada reel. Si quieres
conservar el tablero de la cuadrícula del perfil, quita los reels de la cuadrícula desde su menú: siguen en la pestaña
de reels.

## Ponerle la canción en Instagram

Las canciones no vienen en los videos: Instagram las pone desde su biblioteca.

1. Sube `<reel>-sin-musica.mp4` como reel y toca el botón de audio (la nota musical).
2. Busca la canción de la tabla y elige la parte que suena: arrastra el inicio hasta un golpe fuerte, por ejemplo donde
   arranca el coro.
3. Mira el video con la canción. El primer corte grande tiene que caer con un golpe de la canción: Radiactivo en el
   adelanto (0,8 s), el 360° en el giro (0,4 s), el 2 en hoy (0,5 s) y TACHAS en correas (1 s). Como todos los cortes
   van a su tempo, si cae el primero caen todos; si no, corre un poco el inicio de la canción.
4. En el volumen, deja la canción arriba y el audio original (los efectos) más o menos en la mitad.

Cada reel arranca en el primer tiempo de un compás. Si la parte elegida de la canción también empieza en un compás, los
golpes grandes caen en los golpes fuertes de la canción: el logo, al empezar un compás en el adelanto y en hoy; el
latigazo, al empezar un compás en correas (el logo cae un tiempo después), y en el giro cada prenda y el logo caen en
la caja.

En las cuentas de empresa Instagram muestra pocas canciones comerciales, así que puede que alguna no aparezca; en ese
caso se sube la versión con música propia. Lo mismo para promocionar un reel o para subirlo a otra red: la canción de
Instagram no sirve ahí.

## Sonido

Los efectos y la música propia se hacen aquí mismo con `sonido.py` (sin canciones de nadie, así que Instagram no los
silencia por derechos de autor). La música propia es psicodelia de sintetizadores: acordes soñadores en re mayor
(Dmaj9, F#m7, Gmaj7 y Gm6, un compás cada uno) que giran con la fase y se abren con el coro, un bajo melódico que salta
de octava, batería con cuerpo y mucha sala, platillos en semicorcheas con algo de swing, un arpegio que rebota de un
lado al otro con eco y un poco de vaivén de cinta. Va al tempo de la canción de cada reel: a la mitad en el adelanto
(76) y en el giro (75), que es como se sienten esas dos canciones, a 125 en hoy y a 115 en correas, donde los
platillos se aceleran con las franjas y la música se calla justo antes del latigazo. Cuando el logo cae, en los cuatro
suena lo mismo: el golpe grave y tres campanas en re mayor (re, fa sostenido, la), que son el sonido de la marca.

Los efectos son los mismos en las dos versiones: un golpe en cada corte, el aire de las franjas y los paneos, la
subida antes del logo, los tics de las letras y de las piezas, y el chasquido del látigo; en cada golpe la música
propia baja un poco para que el golpe se sienta. En el último medio segundo el sonido se apaga, así que cuando el reel
vuelve a empezar no se oye un corte.

## Cómo se arman

`reels.html?r=<reel>` dibuja cada cuadro en un lienzo, siempre igual para el mismo número de cuadro; `giro` usa el
mismo 3D del visor de la tienda (`assets/hight-ropa.js` y three.js). `cuadros.js` guarda los cuadros como PNG y los
efectos de sonido en `sonido.json`, `sonido.py` arma el sonido y ffmpeg junta todo. Requiere Node con Playwright
(Chromium), Python 3 con NumPy y ffmpeg; desde la raíz del repo:

```bash
python3 -m http.server 8783
node bocetos/reels/cuadros.js http://127.0.0.1:8783/bocetos/reels/reels.html correas   # deja cuadros-correas/
python3 bocetos/reels/sonido.py cuadros-correas/sonido.json sonido-correas.wav
python3 bocetos/reels/sonido.py cuadros-correas/sonido.json efectos-correas.wav --solo-efectos
ffmpeg -framerate 30 -i cuadros-correas/%04d.png -i sonido-correas.wav -c:v libx264 -preset slow -crf 22 \
  -pix_fmt yuv420p -profile:v high -level 4.2 -c:a aac -b:a 192k -shortest -movflags +faststart \
  bocetos/reels/correas.mp4
ffmpeg -i bocetos/reels/correas.mp4 -i efectos-correas.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k \
  -shortest -movflags +faststart bocetos/reels/correas-sin-musica.mp4
```

Los nombres de los reels son `adelanto`, `giro`, `hoy` y `correas`; las carpetas de cuadros y los WAV se pueden borrar
después. El tempo de cada reel está al principio de su parte en `reels.js` (`AD_T`, `GI_T`, `HO_T` y `CO_T`, lo que
dura un tiempo): si se cambia la canción, se cambia ahí y se vuelven a sacar los cuadros. Las prendas salen de
`../instagram/imagenes/`; el logo, las tipografías, el grano y las correas, de `assets/`. El grano cambia cada dos
cuadros y es de 2 px, para que la compresión de Instagram no lo vuelva bloques.
