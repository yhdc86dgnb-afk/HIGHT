# Correas de tachas

![Las 12 correas](vista-previa.png)

Las 12 correas de la foto, dibujadas en vector como en Illustrator: el cuero con su canto pintado, su pespunte y su
textura (lisa, granulada o de víbora), las tachas en tres tonos de plata con contorno negro, las piedras en su engaste
(negras, rosadas, rojas y naranjas), las incrustaciones de cuero beige, las mariposas de plata y la hebilla con su
lengüeta y su presilla. Están acostadas, con la hebilla a la izquierda, y en el mismo orden que en la foto.

| Correa | Cuero | Dibujo, de la hebilla a la mitad | Cerca de la punta |
| --- | --- | --- | --- |
| 01 | Verde oliva, liso | Rombos de tachas con piedra negra, unidos por equis | Flores grandes con hoyo y domos |
| 02 | Vino, granulado | Cachemires, pares de puntos blancos y florcitas | Flores grandes con hoyo |
| 03 | Negro, granulado | Cadenas en ese con piedras rosadas y flores con piedra | Flores grandes |
| 04 | Negro, granulado | Rombos de cuero beige con piedras rojas y cruces de domos | Flores grandes con hoyo |
| 05 | Blanco, granulado | Zigzag de tachas con domos en las puntas | Flores grandes con hoyo |
| 06 | Negro, víbora | Rombos de cuero beige de víbora con piedras negras | Flores grandes con hoyo |
| 07 | Negro, víbora | Equis de tachas con piedras naranjas | Flores grandes |
| 08 | Vino, víbora | Equis de tachas y florcitas | Cruces de domos y florcitas con hoyo |
| 09 | Blanco, granulado | Medias lunas con domo grande y piedras negras | Flores grandes con hoyo |
| 10 | Negro, víbora | Cruces de domos y florcitas | Flores grandes |
| 11 | Negro, granulado | Mariposas de plata y cuadros de domos | Flores grandes con hoyo |
| 12 | Negro, liso | Cruces de domos, florcitas y tachas por las orillas | Flores grandes |

Cada `correa-XX.svg` se abre y se edita en Illustrator. Las tachas son símbolos: si cambias uno (por ejemplo, el
domo), cambian todos.

En la tienda van en la sección *Correas* del inicio, que reemplazó a la cinta de texto: dos filas que corren en
sentidos contrarios. Cada una lleva a su opción en la ficha y las que ya se vendieron se ven apagadas.

## A la venta

Las doce se venden en una sola ficha, *Correa de tachas* (`/products/correa-de-tachas`), con una opción por correa
(*Correa*: 01 a 12, el mismo número de esta tabla):

- $220.000 cada una, entre la camiseta ($169.000) y el short ($260.000).
- Una unidad de cada una: ninguna se repite, y cuando se vende ya no se puede comprar.
- Tipo de producto *Correa*: entran en la colección *Correas* (en el menú, debajo de *Tienda*) y no en *Lo nuevo* ni
  en Desliza.
- La descripción lista las doce con su cuero y su dibujo, y avisa que las fotos son dibujos hechos a partir de la foto
  y que a quien quiera ver la suya se le manda una foto.

## Las fotos de la ficha

En `fotos/`, con la receta de las fotos de las prendas (`../fondos/prendas.py`): 1.600 × 2.000, sobre el fondo de
logos plateados y con una sombra suave.

- `correas.jpg`: las doce de pie, con la hebilla arriba y en el orden de la foto. Es la foto principal de la ficha y
  la imagen de la colección.
- `correa-01.jpg` a `correa-12.jpg`: cada una sola, en diagonal. Cada opción de la ficha muestra la suya.

```bash
python3 bocetos/correas/fotos.py
```

`fotos.py` pasa cada `correa-XX.svg` a PNG con `dibujos.js` (Node con Playwright y Chromium) y las pone sobre
`../fondos/prenda-plata.png`. Cuando haya fotos reales de cada correa sola, sobre fondo liso, reemplazan a estas.

## Cómo se arman

```bash
python3 correas.py <carpeta del tema>
```

Deja `assets/correa-01.svg` a `correa-12.svg` en el tema y una copia de cada una en esta carpeta. Los colores, las
texturas, la hebilla y la lista de motivos de cada correa están en `BELTS`, dentro de `correas.py`.
