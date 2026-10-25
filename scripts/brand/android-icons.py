"""Iconos y pantallas de arranque de Android a partir del disco partido de public/icon.svg.

Uso: python3 scripts/brand/android-icons.py  (desde la raíz del repo; necesita Pillow)
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

PAPER = (0xFB, 0xF7, 0xF0, 255)
TOMATO = (0xFF, 0x5A, 0x3C, 255)
MINT = (0x17, 0xB8, 0x97, 255)
RES = Path('android/app/src/main/res')
SS = 4  # supermuestreo para bordes suaves


def disc(size: int, color_top=TOMATO, color_bottom=MINT) -> Image.Image:
    """Disco de diámetro `size` partido en diagonal (como icon.svg: radio 168 en 512, rendija de 14, girado -8°)."""
    n = size * SS
    scale = n / 336
    pad = int(14 * scale)
    w = n + 2 * pad
    out = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    for color, sign in ((color_top, -1), (color_bottom, 1)):
        half = Image.new('L', (w, w), 0)
        d = ImageDraw.Draw(half)
        off = sign * 7 * scale
        d.ellipse([pad + off, pad + off, pad + n + off, pad + n + off], fill=255)
        cut = Image.new('L', (w, w), 0)
        c = ImageDraw.Draw(cut)
        # Semiplano por encima (o por debajo) de la diagonal x + y = w, desplazado igual que su mitad: así queda la rendija.
        tri = [(0, 0), (w, 0), (0, w)] if sign < 0 else [(w, 0), (w, w), (0, w)]
        tri = [(x + off, y + off) for x, y in tri]
        c.polygon(tri, fill=255)
        mask = ImageChops.darker(half, cut)  # intersección: el disco recortado por el semiplano
        out.paste(Image.new('RGBA', (w, w), color), (0, 0), mask)
    out = out.rotate(8, resample=Image.BICUBIC)
    return out.resize((w // SS, w // SS), Image.LANCZOS)


def place(canvas: Image.Image, logo: Image.Image) -> Image.Image:
    x = (canvas.width - logo.width) // 2
    y = (canvas.height - logo.height) // 2
    canvas.alpha_composite(logo, (x, y))
    return canvas


def rounded(size: int, radius_ratio: float) -> Image.Image:
    big = Image.new('RGBA', (size * SS, size * SS), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle([0, 0, size * SS - 1, size * SS - 1], radius=int(size * SS * radius_ratio), fill=PAPER)
    return big.resize((size, size), Image.LANCZOS)


DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in DENSITIES.items():
    d = RES / f'mipmap-{name}'
    legacy = int(48 * k)
    # Icono clásico (cuadrado redondeado) y redondo: papel con el disco en el centro.
    place(rounded(legacy, 112 / 512), disc(int(legacy * 0.62))).save(d / 'ic_launcher.png')
    place(rounded(legacy, 0.5), disc(int(legacy * 0.6))).save(d / 'ic_launcher_round.png')
    # Capa delantera del icono adaptativo (108 dp; zona segura de 66 dp).
    fg = int(108 * k)
    place(Image.new('RGBA', (fg, fg), (0, 0, 0, 0)), disc(int(fg * 0.5))).save(d / 'ic_launcher_foreground.png')
    # Capa monocroma (iconos temáticos de Android 13): solo la silueta.
    ink = (0, 0, 0, 255)
    place(Image.new('RGBA', (fg, fg), (0, 0, 0, 0)), disc(int(fg * 0.5), ink, ink)).save(d / 'ic_launcher_monochrome.png')

# Pantallas de arranque (Android < 12): papel con el disco.
for folder in sorted(p for p in RES.iterdir() if p.name.startswith('drawable')):
    f = folder / 'splash.png'
    if not f.exists():
        continue
    w, h = Image.open(f).size
    place(Image.new('RGBA', (w, h), PAPER), disc(int(min(w, h) * 0.28))).convert('RGB').save(f, optimize=True)
print('iconos y pantallas de arranque generados')
