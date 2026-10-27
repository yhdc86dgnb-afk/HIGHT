# Fondo de logos

![Un trozo de cada versión](vista-previa.jpg)

El logo gótico de Hight en contorno, repetido como un estampado de perchas: filas corridas, cada logo un poco girado
y de un color distinto al de sus vecinos, con aire entre uno y otro. El patrón empalma por los cuatro lados, así que se
puede repetir sin que se note la unión.

| Archivo | Tamaño | Para qué |
| --- | --- | --- |
| `cuadro-pastel.png` | 2400 × 2400 | Los colores suaves de la imagen de referencia (azul, rosa, menta, amarillo y gris) sobre blanco. |
| `cuadro-marca.png` | 2400 × 2400 | Los colores de las seis colecciones (Radiactivo, Sangre Fría, Medianoche, Chicle, Asfalto y Fiera) sobre papel. |
| `cuadro-carbon.png` | 2400 × 2400 | Los mismos seis sobre carbón. |
| `historia-pastel.png`, `historia-marca.png`, `historia-carbon.png` | 1080 × 1920 | Las mismas tres, del tamaño de una historia o un fondo de teléfono. |

El cuadro sirve para repetir en la web, en papel de seda o en bolsas: impreso a 300 puntos por pulgada mide 20 × 20
cm. La historia ya viene armada con logos más chicos, para que se vean unos cinco por fila en el teléfono.

## Volver a generarlo

Requiere Python 3 con Pillow. Desde la raíz del repo:

```bash
python3 bocetos/fondos/patron.py
```

El logo sale de `assets/hight-logo-tinta.webp`. Los colores, los tamaños, el número de filas y columnas y el grosor del
trazo están arriba en `patron.py`; con otra semilla (`semilla`) cambian los giros y los colores de cada logo.
