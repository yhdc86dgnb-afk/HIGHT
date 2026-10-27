# Fondo de logos

![Un trozo de cada versión](vista-previa.jpg)

El logo de Hight en plateado sobre negro, repetido como un estampado de perchas: filas corridas, cada logo un poco
girado y con aire entre uno y otro. El patrón empalma por los cuatro lados, así que se puede repetir sin que se note la
unión.

| Archivo | Tamaño | Qué es |
| --- | --- | --- |
| `cuadro-plata.png` | 2400 × 2400 | El logo plateado tal cual, con su brillo de metal. |
| `cuadro-plata-contorno.png` | 2400 × 2400 | El logo en contorno plateado, más liviano, como las líneas de las perchas. |
| `historia-plata.png`, `historia-plata-contorno.png` | 1080 × 1920 | Las mismas dos, del tamaño de una historia o un fondo de teléfono. |

El fondo es el negro carbón de la marca. El cuadro sirve para repetir en la web, en papel de seda o en bolsas: impreso a
300 puntos por pulgada mide 20 × 20 cm. La historia ya viene armada con logos más chicos, para que se vean unos cinco
por fila en el teléfono.

## Volver a generarlo

Requiere Python 3 con Pillow. Desde la raíz del repo:

```bash
python3 bocetos/fondos/patron.py
```

El logo plateado sale de `assets/hight-logo-plata.webp`, con un poco más de brillo para que en tamaño chico siga
viéndose como metal; el contorno sale de la silueta de `assets/hight-logo-tinta.webp`, pintado con un degradé de plata.
Los tamaños, el número de filas y columnas y el grosor del trazo están arriba en `patron.py`; con otra semilla
(`semilla`) cambian los giros de cada logo.
