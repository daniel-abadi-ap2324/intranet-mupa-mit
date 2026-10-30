"""
Miniaturas WebP de las imágenes que se ven en rejilla (Clínica, Identidad visual) y portadas
de los videos de la Mesa de Servicios. NO toca los originales ni los logos: escribe en
public/sitio/miniaturas-web/ y public/marca/miniaturas/, y el clic o la descarga siguen
llevando al archivo original.

Uso (desde mupa-intranet-app, con Pillow y, para las portadas, ffmpeg en el PATH):
  python scripts/generar-miniaturas-web.py

Vuelve a correrlo al agregar una imagen o un video a las listas de abajo.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent / 'public'
SITIO = RAIZ / 'sitio'
MARCA = RAIZ / 'marca'
SALIDA_SITIO = SITIO / 'miniaturas-web'
SALIDA_MARCA = MARCA / 'miniaturas'

# (original, carpeta de salida, ancho máximo, calidad)
IMAGENES = (
    [(SITIO / '2023/02/logoClinicaM.png', SALIDA_SITIO / '2023/02', 480, 85)]
    + [(MARCA / f'plantillas/wallpapers/wallpaper-{n:02d}.png', SALIDA_MARCA / 'wallpapers', 640, 80) for n in range(1, 13)]
    + [(MARCA / 'plantillas/videollamada/fondo-videollamada-1.png', SALIDA_MARCA / 'videollamada', 800, 80)]
    + [(MARCA / f'texturas/vista-previa-{n}.png', SALIDA_MARCA / 'texturas', 640, 80) for n in (1, 2, 3)]
)

# Portadas de los videos de la Mesa de Servicios: un fotograma a los 10 s (el inicio es una cortinilla con el logo).
VIDEOS = [(SITIO / '2024/08' / f'parte{n}.mp4', SALIDA_SITIO / '2024/08' / f'parte{n}.webp') for n in (1, 2, 3)]


def miniatura(origen: Path, carpeta: Path, ancho: int, calidad: int) -> None:
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / (origen.stem + '.webp')
    with Image.open(origen) as im:
        im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        if im.width > ancho:
            im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
        im.save(destino, 'WEBP', quality=calidad, method=6)
    print(f'{destino.relative_to(RAIZ)}  {destino.stat().st_size / 1024:.0f} KB  (original {origen.stat().st_size / 1024:.0f} KB)')


def portada(video: Path, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-ss', '10', '-i', str(video), '-frames:v', '1',
         '-vf', 'scale=480:-2', '-c:v', 'libwebp', '-quality', '75', str(destino)],
        check=True,
    )
    print(f'{destino.relative_to(RAIZ)}  {destino.stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    for args in IMAGENES:
        miniatura(*args)
    if '--sin-videos' not in sys.argv:
        for video, destino in VIDEOS:
            portada(video, destino)
