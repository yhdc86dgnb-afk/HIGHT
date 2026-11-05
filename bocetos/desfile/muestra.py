#!/usr/bin/env python3
"""La muestra de cómo se ven los 20 posts del desfile en el perfil de Instagram: una página con el encabezado del perfil,
la cuadrícula (cada post recortado a 3:4, como la muestra Instagram) y, al tocar un post, el post abierto con su
descripción, sus etiquetas y su pedazo de música propia sonando de fondo.

Lee las descripciones y las fechas de textos.md, la música de cada post de videos.py y el texto alternativo de posts.py,
así que la muestra queda igual a lo que se va a publicar. Deja muestra.html, que usa posts/ y musica/ de esta carpeta.
Uso, desde la raíz del repo: python3 bocetos/desfile/muestra.py
"""
import html
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))  # primero esta carpeta: la otra campaña también tiene un posts.py
import posts  # noqa: E402
import videos  # noqa: E402

NOMBRES = {'neo-psicodelia': 'Neo-psicodelia', 'rock-psicodelico': 'Rock psicodélico', 'pop-psicodelico': 'Pop psicodélico'}
BIO = ['Streetwear de autor para el uso diario. Hecho en Medellín.', 'Prendas intervenidas a mano y piezas de archivo.']
# la estrella de la marca, el ícono flare del tema
ESTRELLA = posts.pr.ESTRELLA


def leer_textos():
    """Las descripciones, las etiquetas y las fechas de textos.md, post por post."""
    texto = (AQUI / 'textos.md').read_text()
    fechas = {}
    for m in re.finditer(r'^\| (\d\d) \| ([^|]+) \|', texto, re.M):
        fechas[int(m.group(1))] = m.group(2).strip()
    datos = {}
    for bloque in re.split(r'^### ', texto, flags=re.M)[1:]:
        n = int(bloque[:2])
        etiquetas = re.search(r'Etiquetas?: (.+)', bloque).group(1).strip()
        citas = [linea[1:].strip() for linea in bloque.splitlines() if linea.startswith('>')]
        lineas = [c for c in citas if c and not c.startswith('#')]
        hashtags = [c for c in citas if c.startswith('#')]
        datos[n] = {'lineas': lineas, 'hashtags': ' '.join(hashtags), 'etiquetas': etiquetas, 'fecha': fechas[n]}
    return datos


def main():
    textos = leer_textos()
    lista = []
    for n in sorted(posts.POSTS):
        pista, desde = videos.MUSICA[n]
        bpm, compases = videos.PISTAS[pista]
        bar = 4 * 60 / bpm
        lista.append({'n': n, 'src': f'posts/{n:02d}.jpg', 'alt': posts.POSTS[n][0], 'pista': pista,
                      'pistaNombre': NOMBRES[pista], 'desde': round(desde * bar, 3), 'dura': round(compases * bar, 3),
                      **textos[n]})
    pistas = {p: f'musica/{p}.mp3' for p in NOMBRES}
    pagina = (AQUI / 'muestra-plantilla.html').read_text()
    pagina = pagina.replace('/*DATOS*/', 'const POSTS = ' + json.dumps(lista, ensure_ascii=False) + ';\nconst PISTAS = '
                            + json.dumps(pistas) + ';')
    pagina = pagina.replace('<!--BIO-->', '<br>'.join(html.escape(b) for b in BIO))
    pagina = pagina.replace('ESTRELLA_PATH', ESTRELLA)
    (AQUI / 'muestra.html').write_text(pagina)
    print((AQUI / 'muestra.html').relative_to(AQUI.parent.parent), len(lista), 'posts')


if __name__ == '__main__':
    main()
