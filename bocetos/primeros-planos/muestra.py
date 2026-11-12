#!/usr/bin/env python3
"""La muestra interactiva del perfil con los 12 primeros planos: la cuadrícula (cada foto recortada a 3:4, como la
muestra Instagram) y, al tocar un post, el post abierto con su descripción, sus productos etiquetados y un pedazo de la
música propia del desfile sonando de fondo. Tiene el diseño de la tienda (muestra-plantilla.html) y la lógica de la muestra del desfile.

Las descripciones siguen la voz de Hight para Instagram: el dato, una frase de sensación y la acción, sin emojis y con
tres hashtags como máximo. Los precios son los de la tienda del 23 de octubre de 2026.
Deja muestra.html, que usa fotos/, musica/, grano.svg y logo-plata.webp de esta carpeta. Uso, desde la raíz del repo:
python3 bocetos/primeros-planos/muestra.py
"""
import json
import re
from pathlib import Path

AQUI = Path(__file__).resolve().parent
DESFILE = AQUI.parent / 'desfile'
PISTAS = {'neo-psicodelia': (98, 5, 'Neo-psicodelia'), 'rock-psicodelico': (112, 6, 'Rock psicodélico'),
          'pop-psicodelico': (104, 5, 'Pop psicodélico')}
BIO = ['Streetwear de autor para el uso diario. Hecho en Medellín.', 'Prendas intervenidas a mano y piezas de archivo.',
       'Sutura: cosido con color →']

# en el orden en que se publican: el 01 queda abajo a la derecha y el 12 arriba a la izquierda
POSTS = [
    ('jean-patchwork-cuadros', 'Jean Patchwork Cuadros', ('rock-psicodelico', 2),
     'Jean Patchwork Cuadros de cerca: parches de franela, ladrillo y denim con el borde crudo',
     ['Jean Patchwork Cuadros: franela a cuadros, ladrillo y denim lavado, cosidos con el borde crudo.',
      'Cada parche viene de otra prenda; juntos cuentan otra historia.',
      '$540.000, en el enlace de la bio.', 'Fotos creadas con IA a partir de las prendas reales.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('jean-wide-fleco-indigo', 'Jean Wide Fleco Índigo', ('neo-psicodelia', 0),
     'Jean Wide Fleco Índigo de cerca: franjas de índigo deshilachadas, cosidas en diagonal',
     ['Jean Wide Fleco Índigo: franjas de índigo cosidas en diagonal, con el borde deshilachado a mano.',
      'Se mueve antes que tú.', '$620.000. Guarda este post.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('jean-patchwork-estrellas-violeta-frente', 'Jean Patchwork Estrellas Violeta', ('pop-psicodelico', 2),
     'Jean Patchwork Estrellas Violeta de frente: parches violeta y negros con una diana pintada en blanco',
     ['Jean Patchwork Estrellas Violeta: parches violeta y negros, costura cruda y una diana pintada a mano.',
      'Ningún parche está donde debería. Ese es el punto.', '$650.000, en el enlace de la bio.'],
     '#HIGHT #Sutura'),
    ('jean-flare-destroyed-verde', 'Jean Flare Destroyed Verde', ('rock-psicodelico', 6),
     'Jean Flare Destroyed Verde de cerca: rotos grandes rellenos de tela verde clara',
     ['Jean Flare Destroyed Verde: rotos grandes rellenos de tela verde clara, cosidos en zigzag.',
      'Lo gastado también se elige.', '$480.000. Etiqueta a quien lo llevaría.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('logo-hueso', 'ninguno', ('neo-psicodelia', 4),
     'El logo de HIGHT en tinta sobre hueso',
     ['HIGHT. Sutura.', 'Cosido con color, hecho en Medellín.', 'Activa las notificaciones del perfil.'],
     '#HIGHT #Sutura #Medellín'),
    ('buzo-multitud-termica', 'Buzo Multitud Térmica', ('pop-psicodelico', 6),
     'Buzo Multitud Térmica de cerca: siluetas de colores sobre denim negro deshilachado',
     ['Buzo Multitud Térmica: una multitud en colores de cámara térmica sobre denim negro lavado.',
      'Entre la multitud, nadie se parece.', '$390.000, en el enlace de la bio.'],
     '#HIGHT #Sutura'),
    ('jean-patchwork-estrellas-violeta-estrella', 'Jean Patchwork Estrellas Violeta', ('rock-psicodelico', 10),
     'Jean Patchwork Estrellas Violeta caminando: la estrella en espiral sobre violeta salpicado',
     ['Jean Patchwork Estrellas Violeta: la estrella en espiral, de cerca, sobre violeta salpicado de cloro.',
      'Camina y el estampado camina contigo.', '¿Violeta o negro? Te leemos.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('jean-flare-dragon-acido', 'Jean Flare Dragón Ácido', ('pop-psicodelico', 4),
     'Jean Flare Dragón Ácido de cerca: hilos oliva sobre negro y el dragón en tinta',
     ['Jean Flare Dragón Ácido: hilos oliva sueltos sobre negro y un dragón en tinta en la pierna.',
      'Lo que se deshace también tiene forma.', '$490.000, en el enlace de la bio.'],
     '#HIGHT #Sutura'),
    ('tejido-anillos-indigo', 'Tejido Anillos Índigo', ('neo-psicodelia', 6),
     'Tejido Anillos Índigo de cerca: tiras tejidas en azul noche unidas con argollas metálicas',
     ['Tejido Anillos Índigo: tiras tubulares tejidas en azul noche, unidas con argollas metálicas.',
      'Un suéter que no se parece a otro.', '$460.000. Mira las argollas en la ficha de la tienda.'],
     '#HIGHT #Sutura #HechoAMano'),
    ('camiseta-celula-carmin', 'Camiseta Célula Carmín', ('neo-psicodelia', 8),
     'Camiseta Célula Carmín de cerca: estampado de células en carmín y hueso',
     ['Camiseta Célula Carmín: estampado de pintura fluida en carmín y hueso, sobre la tela calada.',
      'De lejos, una mancha. De cerca, células.', '$169.000, en el enlace de la bio.'],
     '#HIGHT #Sutura'),
    ('chaqueta-trouble-maker', 'Chaqueta Trouble Maker', ('rock-psicodelico', 4),
     'Chaqueta Trouble Maker de espalda: espirales pintadas en blanco sobre denim negro',
     ['Chaqueta Trouble Maker: denim negro de archivo, espirales pintadas a mano en blanco y parches deshilachados.',
      'La espalda también habla.', '$580.000. Etiqueta a quien la llevaría.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('chaqueta-blood-rose', 'Chaqueta Blood Rose', ('neo-psicodelia', 3),
     'Chaqueta Blood Rose de cerca: la capa lavanda calada y la cremallera metálica',
     ['Chaqueta Blood Rose: capa lavanda calada a mano y una cremallera metálica que sube hasta el cuello.',
      'Elegante no es lo mismo que obediente.', '$500.000, en el enlace de la bio.'],
     '#HIGHT #Sutura #HechoAMano'),
]


def main():
    lista = []
    for n, (foto, etiqueta, (pista, compas), alt, lineas, tags) in enumerate(POSTS, 1):
        bpm, compases, nombre = PISTAS[pista]
        bar = 4 * 60 / bpm
        lista.append({'n': n, 'src': f'fotos/{foto}.jpg', 'alt': alt, 'pista': pista, 'pistaNombre': nombre,
                      'desde': round(compas * bar, 3), 'dura': round(compases * bar, 3), 'lineas': lineas,
                      'hashtags': tags, 'etiquetas': etiqueta, 'fecha': f'Primeros planos · {n:02d} de {len(POSTS)}'})
    # la lógica (descripciones, música, deslizar) es la de la muestra del desfile; el diseño, el de la tienda
    viejo = (DESFILE / 'muestra-plantilla.html').read_text()
    script = viejo[viejo.index('<script>'):viejo.index('</script>') + len('</script>')]
    cambios_script = {
        '/*DATOS*/': 'const POSTS = ' + json.dumps(lista, ensure_ascii=False) + ';\nconst PISTAS = '
                     + json.dumps({p: f'musica/{p}.mp3' for p in PISTAS}) + ';',
        'de 20`': f'de {len(POSTS)}`',
        "'desfile-silencio'": "'primeros-planos-silencio'",
        "b.setAttribute('aria-label',": "b.dataset.n = `(${String(p.n).padStart(2, '0')})`;\n  b.setAttribute('aria-label',",
    }
    for a, b in cambios_script.items():
        assert a in script, a
        script = script.replace(a, b)
    pagina = (AQUI / 'muestra-plantilla.html').read_text()
    # la estrella de la marca, la misma de la muestra del desfile
    estrella = re.search(r'<path d="([^"]+)" fill="#6d8bfb"', (DESFILE / 'muestra.html').read_text()).group(1)
    for a, b in {'<!--SCRIPT-->': script, '<!--BIO-->': '<br>'.join(BIO), 'ESTRELLA_PATH': estrella,
                 'NUM_POSTS': str(len(POSTS))}.items():
        assert a in pagina, a
        pagina = pagina.replace(a, b)
    (AQUI / 'muestra.html').write_text(pagina)
    print('bocetos/primeros-planos/muestra.html', len(lista), 'posts')


if __name__ == '__main__':
    main()
