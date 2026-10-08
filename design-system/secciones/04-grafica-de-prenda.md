# Gráfica de prenda

Lo que va estampado, bordado o en relieve sobre la ropa. Aquí la tipografía puede romperse; la interfaz nunca.

## Tintas

- Sobre prenda negra o azul noche: `print-glow` (blanco luminoso, apenas azul), nunca blanco puro.
- Sobre algodón crudo: `print-cyanotype`, ideal para cianotipo real expuesto al sol sobre la tela.
- Cromado: `print-chrome-hi` → `print-chrome-mid` → `print-chrome-lo`. Se logra con puff, foil o degradado de serigrafía; en mockup se dibuja con esas tres tintas.
- Halos y destellos (estrella de cuatro puntas, rayos, figura que emite luz) en `print-glow` con degradado de serigrafía hacia el fondo.
- `aura` como estampado solo en piezas de edición limitada.

## Cinco tratamientos tipográficos

1. **Repetición y solape.** Una palabra o frase apilada tres veces, con las líneas montadas unas sobre otras, textura de serigrafía gastada (tinta que falta, rayones). Debajo, una línea pequeña en serif mayúscula como subtítulo. Puede llevar un recorte de foto pequeño al lado.
2. **Cromo.** Monograma o palabra en 3D cromado, inclinado en diagonal, con un lema corto en mono debajo siguiendo el mismo ángulo.
3. **Pincel.** Letras de trazo seco donde se ven las cerdas y la tinta acumulada en los bordes. Números grandes (año, número de drop) funcionan mejor que palabras.
4. **Líquida / nouveau.** Letras de curvas fundidas o con terminaciones de gota, tipo art nouveau de los 70 o tipografía líquida. Solo para una palabra, nunca para frases.
5. **Espina.** La tipografía de la marca, **Hight Espina**, la misma anatomía del logo. Número de drop, nombre de colección o una palabra (máximo 3), en `print-glow` sobre negro, cromo o tinta sobre prenda clara. La versión **Hueso** a partir de 8 cm de ancho, para que los poros no se tapen en serigrafía. No va en la misma prenda que el logo grande.

Reglas:

- Un tratamiento por prenda. Nunca cromo y pincel juntos. Espina sí puede ir en cromo (puff o foil).
- Las letras expresivas de los tratamientos 1 a 4 se dibujan para cada pieza (lettering); Hight Espina es la única fuente expresiva instalada y nunca se usa en la tienda fuera de campaña.
- El texto expresivo siempre tiene un texto pequeño y sobrio al lado (mono o serif) que lo ancla.
- Las palabras pesadas (dolor, muerte, depresión) se usan solo si son el título de un proyecto o una colaboración musical que lo justifique.

## Marquilla interior

Etiqueta tejida negra en el cuello, como una ficha técnica:

- Esquina superior: logo o número de colección. Esquina derecha: talla en una letra.
- Abajo: un lema corto en mono MAYÚSCULAS y el origen `MED/COL`.
- Misma lógica que `label` y `spec`: datos, no adjetivos.

## Ubicación de estampados

Medidas sobre la prenda en plano, tomadas desde la costura del cuello (asset **Prenda/ubicacion-estampados**):

| Zona | Tamaño máximo | Distancia |
| --- | --- | --- |
| Pecho centro | 28 × 35 cm | 8 cm bajo el cuello |
| Pecho izquierdo (corazón) | 9 × 9 cm | 18 cm bajo el hombro, 9 cm del centro |
| Espalda alta | 30 × 10 cm | 6 cm bajo el cuello |
| Espalda centro | 32 × 40 cm | 12 cm bajo el cuello |
| Manga | 8 × 8 cm | 4 cm sobre el dobladillo |

- Una zona principal por prenda (pecho centro o espalda centro) y, como mucho, una secundaria pequeña.
- Antes de producir, imprime el arte a tamaño real y pruébalo sobre la prenda en cada talla.

## Ficha técnica

Cada prenda tiene su ficha (asset **Prenda/ficha-tecnica**): nombre y código, drop, corte, tela y gramaje, colores con su hex, tallas, medidas, ubicación de gráfica con técnica (serigrafía, puff, bordado, DTF), avíos (marquilla, hang tag, etiqueta de cuidado) y notas de confección.
