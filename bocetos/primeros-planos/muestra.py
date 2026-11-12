#!/usr/bin/env python3
"""La muestra interactiva del perfil con los 12 primeros planos: la cuadrícula (cada foto recortada a 3:4, como la
muestra Instagram) y, al tocar un post, el post abierto con su descripción, sus productos etiquetados y un pedazo de la
música propia del desfile sonando de fondo. Tiene el diseño de la tienda (muestra-plantilla.html) y la lógica de la muestra del desfile.

Las descripciones siguen la voz de Hight para Instagram: el dato, una frase de sensación y la acción, sin emojis y con
tres hashtags como máximo. Sin precios.
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

# en el orden en que se publican: el 01 queda abajo a la derecha y el último arriba a la izquierda
POSTS = [
    ('jean-patchwork-cuadros', 'Jean Patchwork Cuadros', ('rock-psicodelico', 2),
     'Jean Patchwork Cuadros de cerca: parches de franela, ladrillo y denim con el borde crudo',
     ['Jean Patchwork Cuadros: franela a cuadros, ladrillo y denim lavado, cosidos con el borde crudo.',
      'Cada parche viene de otra prenda; juntos cuentan otra historia.',
      'Encuéntralo en el enlace de la bio.', 'Fotos creadas con IA a partir de las prendas reales.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('jean-wide-fleco-indigo', 'Jean Wide Fleco Índigo', ('neo-psicodelia', 0),
     'Jean Wide Fleco Índigo de cerca: franjas de índigo deshilachadas, cosidas en diagonal',
     ['Jean Wide Fleco Índigo: franjas de índigo cosidas en diagonal, con el borde deshilachado a mano.',
      'Se mueve antes que tú.', 'Guarda este post.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('jean-patchwork-estrellas-violeta-frente', 'Jean Patchwork Estrellas Violeta', ('pop-psicodelico', 2),
     'Jean Patchwork Estrellas Violeta de frente: parches violeta y negros con una diana pintada en blanco',
     ['Jean Patchwork Estrellas Violeta: parches violeta y negros, costura cruda y una diana pintada a mano.',
      'Ningún parche está donde debería. Ese es el punto.', 'Está en el enlace de la bio.'],
     '#HIGHT #Sutura'),
    ('jean-flare-destroyed-verde', 'Jean Flare Destroyed Verde', ('rock-psicodelico', 6),
     'Jean Flare Destroyed Verde de cerca: rotos grandes rellenos de tela verde clara',
     ['Jean Flare Destroyed Verde: rotos grandes rellenos de tela verde clara, cosidos en zigzag.',
      'Lo gastado también se elige.', 'Etiqueta a quien lo llevaría.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('buzo-multitud-termica', 'Buzo Multitud Térmica', ('pop-psicodelico', 6),
     'Buzo Multitud Térmica de cerca: siluetas de colores sobre denim negro deshilachado',
     ['Buzo Multitud Térmica: una multitud en colores de cámara térmica sobre denim negro lavado.',
      'Entre la multitud, nadie se parece.', '¿Cuál de las siluetas eres tú? Te leemos.'],
     '#HIGHT #Sutura'),
    ('primera-fila', 'por confirmar', ('rock-psicodelico', 10),
     'Alguien sentada en una gradería metálica con un tejido gris calado a mano y un pantalón violeta de espirales',
     ['Tejido gris calado a mano y pantalón violeta de espirales, en primera fila.',
      'Adelante se sienta quien no necesita mirar a nadie.', '¿Con botas o con tenis? Te leemos.'],
     '#HIGHT #Sutura #HechoAMano'),
    ('jean-flare-dragon-acido', 'Jean Flare Dragón Ácido', ('pop-psicodelico', 4),
     'Jean Flare Dragón Ácido de cerca: hilos oliva sobre negro y el dragón en tinta',
     ['Jean Flare Dragón Ácido: hilos oliva sueltos sobre negro y un dragón en tinta en la pierna.',
      'Lo que se deshace también tiene forma.', 'Míralo de cerca en el enlace de la bio.'],
     '#HIGHT #Sutura'),
    ('tejido-anillos-indigo', 'Tejido Anillos Índigo', ('neo-psicodelia', 6),
     'Tejido Anillos Índigo de cerca: tiras tejidas en azul noche unidas con argollas metálicas',
     ['Tejido Anillos Índigo: tiras tubulares tejidas en azul noche, unidas con argollas metálicas.',
      'Un suéter que no se parece a otro.', 'Mira las argollas en la ficha de la tienda.'],
     '#HIGHT #Sutura #HechoAMano'),
    ('camiseta-celula-carmin', 'Camiseta Célula Carmín', ('neo-psicodelia', 8),
     'Camiseta Célula Carmín de cerca: estampado de células en carmín y hueso',
     ['Camiseta Célula Carmín: estampado de pintura fluida en carmín y hueso, sobre la tela calada.',
      'De lejos, una mancha. De cerca, células.', 'Encuéntrala en el enlace de la bio.'],
     '#HIGHT #Sutura'),
    ('chaqueta-trouble-maker', 'Chaqueta Trouble Maker', ('rock-psicodelico', 4),
     'Chaqueta Trouble Maker de espalda: espirales pintadas en blanco sobre denim negro',
     ['Chaqueta Trouble Maker: denim negro de archivo, espirales pintadas a mano en blanco y parches deshilachados.',
      'La espalda también habla.', 'Etiqueta a quien la llevaría.'],
     '#HIGHT #Sutura #DenimIntervenido'),
    ('chaqueta-blood-rose', 'Chaqueta Blood Rose', ('neo-psicodelia', 3),
     'Chaqueta Blood Rose de cerca: la capa lavanda calada y la cremallera metálica',
     ['Chaqueta Blood Rose: capa lavanda calada a mano y una cremallera metálica que sube hasta el cuello.',
      'Elegante no es lo mismo que obediente.', 'Está en el enlace de la bio, mientras dure.'],
     '#HIGHT #Sutura #HechoAMano'),
    # los 9 de la segunda tanda, en la calle: van arriba de los primeros planos
    ('pantera-patrulla', 'por confirmar', ('rock-psicodelico', 0),
     'Alguien con cabeza de pantera rosada y ropa intervenida en rosado, junto a una patrulla de noche',
     ['Sutura salió de noche y la calle no estaba lista.', 'Hay prendas que se notan hasta desde la patrulla.',
      'Etiqueta a quien terminaría así.'],
     '#HIGHT #Sutura'),
    ('buzo-ceniza-afiches', 'por confirmar', ('neo-psicodelia', 9),
     'Buzo gris calado a mano y pantalón de capas negras, sentado frente a una pared con afiches y grafiti',
     ['Gris asfalto, calado a mano, capa sobre capa.', 'Lo que se deshace también abriga.', 'Guarda este post.'],
     '#HIGHT #Sutura #HechoAMano'),
    ('contenedor', 'por confirmar', ('pop-psicodelico', 8),
     'Dos personas frente a un contenedor rojo: bermuda verde con cruz rosada, chaqueta amarilla pintada y pantalón violeta',
     ['Dos salidas frente al mismo contenedor.', 'El color también viaja.',
      '¿Cuál te llevas: el amarillo o el violeta? Te leemos.'],
     '#HIGHT #Sutura'),
    ('mission-failed', 'por confirmar', ('rock-psicodelico', 8),
     'Alguien acostado en el piso junto a una patineta, con chaqueta de espirales y cargo rosado con calavera',
     ['Misión fallida, outfit cumplido.', 'Caer también es una pose.', 'Etiqueta a tu compañero de misiones.'],
     '#HIGHT #Sutura'),
    ('grafiti-hight', 'ninguno', ('neo-psicodelia', 10),
     'HIGHT pintado en azul sobre una pared llena de stickers y grafiti',
     ['HIGHT, en la pared.', 'La firma se pone donde se vive.', '¿Dónde la pintarías tú? Te leemos.'],
     '#HIGHT #Sutura #Medellín'),
    ('pelea-payasos', 'por confirmar', ('pop-psicodelico', 10),
     'Dos personas disfrazadas de payaso peleando en una fiesta, con chaqueta amarilla pintada y buzo de siluetas de colores',
     ['Dos chaquetas intervenidas y ninguna tregua.', 'La fiesta se acaba cuando alguien llega mejor vestido.',
      'Etiqueta a quien empezaría la pelea.'],
     '#HIGHT #Sutura'),
    ('calle-carmin', 'por confirmar', ('neo-psicodelia', 2),
     'Dos personas caminando por una calle llena de gente, con chaqueta y saco calados en carmín',
     ['Carmín calado de pies a cabeza, lejos de casa.', 'Cosido aquí, caminado en cualquier parte.', 'Guarda este post.'],
     '#HIGHT #Sutura #HechoAMano'),
    ('sticker-hello', 'ninguno', ('rock-psicodelico', 6),
     'Sticker de HIGHT pegado en una baranda amarilla de la calle',
     ['Hello, my name is HIGHT.', 'Si lo ves pegado en la calle, ya sabes quién pasó.',
      'Mándanos una foto si encuentras uno.'],
     '#HIGHT #Sutura #Medellín'),
    ('sutura-preventa', 'por confirmar', ('pop-psicodelico', 0),
     'Afiche de la preventa de Sutura vol. 01: alguien con chaqueta de hilos de colores frente a una persiana roja, con HIGHT en grafiti blanco',
     ['Sutura vol. 01: preventa abierta.', 'Cada pieza se hace por encargo y no se repite.', 'Separa la tuya en el enlace de la bio.'],
     '#HIGHT #Sutura'),
]


# La cuadrícula, de arriba abajo y de izquierda a derecha, tal como se ve en el perfil: en tablero, los primeros
# planos de las prendas se alternan con las fotos de calle y las piezas gráficas (grafiti, sticker y afiche), y
# dos colores parecidos no quedan juntos.
CUADRICULA = [
    'tejido-anillos-indigo', 'sutura-preventa', 'jean-flare-dragon-acido',
    'pelea-payasos', 'chaqueta-trouble-maker', 'calle-carmin',
    'jean-flare-destroyed-verde', 'grafiti-hight', 'primera-fila',
    'contenedor', 'buzo-multitud-termica', 'pantera-patrulla',
    'chaqueta-blood-rose', 'sticker-hello', 'jean-wide-fleco-indigo',
    'mission-failed', 'camiseta-celula-carmin', 'buzo-ceniza-afiches',
    'jean-patchwork-estrellas-violeta-frente', 'jean-patchwork-cuadros',
]


def main():
    por_foto = {post[0]: post for post in POSTS}
    assert sorted(por_foto) == sorted(CUADRICULA), 'cada foto va una vez en la cuadrícula'
    # se publican al revés de como se leen: el último de la cuadrícula es el post 01
    orden = [por_foto[f] for f in reversed(CUADRICULA)]
    # el aviso de las fotos hechas con IA va siempre en el primer post publicado
    aviso = 'Fotos creadas con IA a partir de las prendas reales.'
    orden = [(f, e, m, a, [l for l in lineas if l != aviso], t) for f, e, m, a, lineas, t in orden]
    orden[0][4].append(aviso)
    lista = []
    for n, (foto, etiqueta, (pista, compas), alt, lineas, tags) in enumerate(orden, 1):
        bpm, compases, nombre = PISTAS[pista]
        bar = 4 * 60 / bpm
        lista.append({'n': n, 'src': f'fotos/{foto}.jpg', 'alt': alt, 'pista': pista, 'pistaNombre': nombre,
                      'desde': round(compas * bar, 3), 'dura': round(compases * bar, 3), 'lineas': lineas,
                      'hashtags': tags, 'etiquetas': etiqueta, 'fecha': f'Sutura · {n:02d} de {len(POSTS)}'})
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
