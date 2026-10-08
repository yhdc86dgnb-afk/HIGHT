# Dirección editorial

La capa de revista de Hight: lookbooks, campañas, página "Info" y redes. Es donde la marca se permite lentitud y aire; la tienda sigue siendo sobria.

## Paleta editorial

- Plata y noche. El pliego (fondo de la página, del lookbook o del post) es plata: `.hi-metal`, `silver-*` o el tema Plata. La foto es la noche: blanco y negro frío o virada a cianotipo, sobre `prussian` o negro azulado.
- Un spread típico pone el pliego de plata a la izquierda, con hoja de contacto o índice, y la foto nocturna a la derecha con la cita.
- Un destello de `aura` o `cyan` por vista: el halo, un reflejo, la luz que sale de la figura. Nada de tonos cálidos.
- Grano de película visible en la foto (asset **Texturas/grano**), nunca simulado con ruido sobre la interfaz.

## Retícula visible

- La retícula puede mostrarse: líneas `line` a `border-hairline` atravesando la página, como pliego de imprenta. Los textos se alinean a sus cruces.
- Los textos pequeños (`label`, `caption-serif`) se anclan a las esquinas o a una columna de la retícula, nunca flotan centrados.
- Las imágenes pequeñas pueden esparcirse sobre la retícula con mucho vacío entre ellas (galería dispersa); el vacío es parte del diseño, no se rellena.

## Numeración y paréntesis

Todo se cuenta y se numera, como un archivo:

- Drops: `(N5)` en índices, "DROP 05 — PLATA" en display (regla completa en el manual, Voz y contenido).
- Tomas en hoja de contacto: letra de toma y número a dos dígitos, `(A) 01`, `(B) 02`.
- Folios de página a cuatro dígitos: `0060`, `0061`.
- Categorías con su cuenta: "Drops (5) · Colaboraciones (2) · Archivo (12)".

## La cita

- Una frase en `editorial-xl` sobre la foto, a la altura del pecho de la figura, justificada a todo el ancho: las palabras se separan y el aire entre ellas es intencional.
- Abajo, en las esquinas, dos marquillas en `label` y `on-photo`: nombre del drop a la izquierda, lugar a la derecha. "DROP 05 — PLATA" · "MEDELLÍN, CO."
- Solo lemas aprobados (sección Marca) o frases sobre sensación y uso, no sobre producto.

## Componentes

`EditorialSpread` (cita sobre foto), `ContactSheet` (tira de tomas numeradas) e `IndexList` (lista de drops o proyectos numerada).
