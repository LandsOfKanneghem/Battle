"""Prepare runtime assets from the original painted atlases, without redrawing them.

Requires Pillow. Run: python tools/build-homm2-assets.py
Sources are kept in assets/homm2/sources; only cropping, sizing and PNG encoding
are performed here. The browser loads the small runtime files, not the atlases.
"""
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'homm2'
SOURCES = OUT / 'sources'
FILTER = Image.Resampling.LANCZOS


def cell(image, column, row, columns=3, rows=2):
    return image.crop((round(column*image.width/columns), round(row*image.height/rows),
                       round((column+1)*image.width/columns), round((row+1)*image.height/rows)))


def save(image, name, size=None, resample=FILTER):
    if size:
        image = image.resize(size, resample)
    if image.mode == 'RGB':
        image = image.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    image.save(OUT / f'{name}.png', optimize=True)


units = Image.open(SOURCES / 'units.png').convert('RGBA')
portraits = Image.open(SOURCES / 'portraits.png').convert('RGB')
names = ['wizard', 'monk', 'wolf', 'hill-giant', 'lake-spirit', 'crate']
for index, name in enumerate(names):
    image = cell(units, index % 3, index // 3)
    # Ignore almost-transparent atlas padding when aligning feet to a common baseline.
    bounds = image.getchannel('A').point(lambda value: 255 if value > 32 else 0).getbbox()
    if not bounds:
        raise ValueError(f'Empty sprite: {name}')
    image = image.crop(bounds)
    scale = min(90/image.width, 90/image.height)
    image = image.resize((round(image.width*scale), round(image.height*scale)), FILTER)
    canvas = Image.new('RGBA', (96,96))
    canvas.alpha_composite(image, ((96-image.width)//2, 93-image.height))
    save(canvas, name)
    if name != 'crate':
        save(cell(portraits, index % 3, index // 3), 'portrait-'+name, (144,144))
save(cell(portraits, 2, 1), 'crest', (128,128))

materials = Image.open(SOURCES / 'materials.png').convert('RGB')
grass = Image.open(SOURCES / 'meadow.png').convert('RGB')
save(grass, 'grass-0', (512,512))
save(cell(materials, 1, 0), 'sand', (512,512))
save(cell(materials, 2, 0), 'water', (512,512))
save(cell(materials, 0, 1), 'stone', (512,512))
save(cell(materials, 1, 1), 'leather', (512,512))
save(cell(materials, 2, 1), 'parchment', (512,512))

# Atlas coordinates describe pictures only, never spell values or state behavior.
SPELLS = {
    'fire-shot': (0,0), 'burning-hands': (1,0), 'reckless': (2,0),
    'fire-cube': (3,0), 'armageddon': (4,0), 'fire-shield': (5,0),
    'water-shot': (0,1), 'liquid-membrane': (1,1), 'rain': (2,1),
    'ice-arrow': (3,1), 'deep-freeze': (4,1), 'lake-spirit': (5,1),
    'haste': (0,2), 'wind-rose': (1,2), 'sparks': (2,2),
    'sky-shot': (3,2), 'teleport': (4,2), 'water-walk': (5,2),
    'slow': (0,3), 'dead-weight': (1,3), 'stone-skin': (2,3),
    'earth-shield': (3,3), 'air-shield': (4,3), 'water-shield': (5,3),
    'heal-harm': (0,4), 'weakness-vigor': (1,4), 'sprint': (2,4),
    'light-flash': (3,4), 'power-hour': (4,4), 'apply-old-age': (5,4),
    'bite': (0,5), 'club-smash': (1,5), 'boulder-throw': (2,5)
}
STATES = {
    'speed': (0,2), 'slowness': (0,3), 'freeze': (4,1), 'burning': (0,0),
    'wet': (0,1), 'heavy': (1,3), 'light': (0,2), 'chill': (3,1),
    'adrenaline': (2,0), 'adrenaline-crash': (4,5), 'weakness': (4,5),
    'exhaustion': (4,5), 'vigor': (1,4), 'bleeding': (3,5),
    'water-entity': (5,1), 'levitation': (5,2), 'old-age': (5,4), 'summon-time': (5,5)
}
RESISTANCES = {'ac': (2,3), 'physical': (1,5), 'fire': (0,0), 'water': (0,1),
               'air': (1,2), 'earth': (2,5), 'mind': (4,4), 'poison': (3,5)}
icons = Image.open(SOURCES / 'icons.png').convert('RGB')
spell_icons = Image.open(SOURCES / 'spell-icons-retro.png').convert('RGB')
for name, (x,y) in SPELLS.items():
    # Native 64×64 pixel icons: preserve crisp clusters and empty gradient corners.
    save(cell(spell_icons, x, y, 6, 6), f'spell-{name}', (64,64), Image.Resampling.NEAREST)
for prefix, coordinates in [('state', STATES), ('res', RESISTANCES)]:
    for name, (x,y) in coordinates.items():
        save(cell(icons, x, y, 6, 6), f'{prefix}-{name}', (64,64))

print('Prepared painted sprites, portraits, materials and icons from source illustrations.')
