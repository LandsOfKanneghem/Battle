"""Prepare runtime assets from the original painted atlases, without redrawing them.

Requires Pillow. Run: python tools/build-homm2-assets.py
Sources are kept in assets/homm2/sources; only cropping, sizing and PNG encoding
are performed here. The browser loads the small runtime files, not the atlases.
"""
from pathlib import Path
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / 'assets' / 'homm2'
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


def atlas_spans(image, axis, panels):
    """Find actual panel interiors; generated rows are not necessarily equal.

    Only a nearly-black line crossing the entire atlas counts as a divider.
    Refuse ambiguous layouts instead of silently cutting through a neighboring icon.
    """
    rgb = image.convert('RGB')
    bands = []
    for position in range(rgb.height if axis == 'y' else rgb.width):
        line = rgb.crop((0, position, rgb.width, position+1) if axis == 'y'
                        else (position, 0, position+1, rgb.height))
        if max(channel[1] for channel in line.getextrema()) <= 12:
            if bands and position == bands[-1][1]+1:
                bands[-1][1] = position
            else:
                bands.append([position, position])
    if len(bands) != panels+1:
        raise ValueError(f'Expected {panels+1} {axis} divider bands, found {bands}; refusing guessed crops')
    spans = [(bands[i][1]+1, bands[i+1][0]) for i in range(panels)]
    if any(end <= start for start, end in spans):
        raise ValueError(f'Empty {axis} panel: {spans}')
    return spans


def fit_icon(image, palette, size=(64,64)):
    """Contain the complete panel in 64×64, keeping its proportions and shared palette."""
    image = image.convert('RGB')
    image.thumbnail(size, Image.Resampling.NEAREST)
    image = image.quantize(palette=palette, dither=Image.Dither.NONE)
    colors = palette.getpalette()
    black = min(range(256), key=lambda i: sum(colors[i*3:i*3+3]))
    tile = Image.new('P', (64,64), black)
    tile.putpalette(colors)
    tile.paste(image, ((64-image.width)//2, (64-image.height)//2))
    return tile


portraits = Image.open(SOURCES / 'portraits.png')
names = ['wizard', 'monk', 'wolf', 'hill-giant', 'lake-spirit', 'nymph', 'black-wolf']
if portraits.size != (len(names) * 144, 144):
    raise ValueError('Expected seven approved 144x144 portraits in one row')
for index, name in enumerate(names):
    save(cell(portraits, index, 0, len(names), 1), 'portrait-'+name)

materials = Image.open(SOURCES / 'materials.png').convert('RGB')
save(cell(materials, 1, 1), 'leather', (512,512))

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
    'bite': (0,5), 'boulder-smash': (1,5), 'boulder-throw': (2,5)
}
STATES = ['speed', 'slowness', 'freeze', 'burning', 'wet', 'heavy',
          'light', 'chill', 'adrenaline', 'adrenaline-crash', 'weakness', 'exhaustion',
          'vigor', 'bleeding', 'water-entity', 'levitation', 'old-age', 'summon-time']
RESISTANCES = {'ac': (2,3), 'physical': (1,5), 'fire': (0,0), 'water': (0,1),
               'air': (1,2), 'earth': (2,5), 'mind': (4,4), 'poison': (3,5)}
icons = Image.open(SOURCES / 'icons.png').convert('RGB')
spell_icons = Image.open(SOURCES / 'spell-icons-base.png')
if spell_icons.size != (384,384) or spell_icons.mode != 'P':
    raise ValueError('Base sheet must be the approved 384×384 indexed PNG')
spell_icons = spell_icons.copy()
edits = Image.open(SOURCES / 'spell-icons-edits.png')
columns = atlas_spans(edits, 'x', 3)
rows = atlas_spans(edits, 'y', 3)
edit_names = ['fire-shot', 'fire-shield', 'ice-arrow', 'deep-freeze', 'wind-rose',
              'sparks', 'apply-old-age', 'boulder-smash', 'bite']
for index, name in enumerate(edit_names):
    left, right = columns[index % 3]
    top, bottom = rows[index // 3]
    tile = fit_icon(edits.crop((left,top,right,bottom)), spell_icons)
    x,y = SPELLS[name]
    spell_icons.paste(tile, (x*64,y*64))
slowness = Image.open(SOURCES / 'state-slowness-silver.png')
if slowness.size != (64,64) or slowness.mode != 'P' or slowness.getpalette() != spell_icons.getpalette():
    raise ValueError('Silver-chain icon must be 64×64 with the shared spell palette')
# Keep the approved boot illustrations for states before replacing the spell art.
x,y = SPELLS['haste']
state_icons = {'speed': spell_icons.crop((x*64,y*64,(x+1)*64,(y+1)*64)),
               'slowness': slowness.copy()}
updates = {
    'spell-state-updates.png': [('spell', name) for name in
                              ['haste', 'slow', 'fire-shield', 'rain', 'apply-old-age']]
                             + [('state', name) for name in ['burning', 'wet', 'light', 'chill']],
    'state-icons.png': [('state', name) for name in
                       ['adrenaline', 'adrenaline-crash', 'weakness', 'exhaustion', 'vigor',
                        'bleeding', 'water-entity', 'levitation', 'summon-time']]
}
for source, entries in updates.items():
    atlas = Image.open(SOURCES / source)
    columns = atlas_spans(atlas, 'x', 3)
    rows = atlas_spans(atlas, 'y', 3)
    for index, (kind, name) in enumerate(entries):
        left, right = columns[index % 3]
        top, bottom = rows[index // 3]
        # Match the fire shield's silhouette to the other elemental shields.
        size = (60,60) if (kind, name) == ('spell', 'fire-shield') else (64,64)
        tile = fit_icon(atlas.crop((left,top,right,bottom)), spell_icons, size)
        if kind == 'spell':
            x,y = SPELLS[name]
            spell_icons.paste(tile, (x*64,y*64))
        else:
            state_icons[name] = tile
for kind, name in [('state', 'adrenaline-crash'), ('state', 'chill'),
                   ('state', 'exhaustion'), ('state', 'weakness'), ('spell', 'slow'),
                   ('spell', 'sparks'), ('spell', 'haste'), ('spell', 'boulder-smash')]:
    tile = Image.open(SOURCES / 'refinements' / f'{kind}-{name}.png')
    if tile.size != (64,64) or tile.mode != 'P' or tile.getpalette() != spell_icons.getpalette():
        raise ValueError(f'{kind}-{name} must be 64×64 with the shared spell palette')
    if kind == 'spell':
        x,y = SPELLS[name]
        spell_icons.paste(tile, (x*64,y*64))
    else:
        state_icons[name] = tile.copy()
for name, spell in [('freeze', 'deep-freeze'), ('heavy', 'dead-weight'), ('old-age', 'apply-old-age')]:
    x,y = SPELLS[spell]
    state_icons[name] = spell_icons.crop((x*64,y*64,(x+1)*64,(y+1)*64))
state_icons['heavy'] = Image.open(SOURCES / 'refinements' / 'state-heavy.png')
if set(state_icons) != set(STATES):
    raise ValueError('Every state must have a pixel-art icon')
# Keep one compiled sheet for review; sources/ contains only actual build inputs.
(PROJECT / 'docs').mkdir(exist_ok=True)
spell_icons.save(PROJECT / 'docs' / 'spell-icons-64.png', optimize=True)
state_sheet = Image.new('P', (384,192))
state_sheet.putpalette(spell_icons.getpalette())
for index, name in enumerate(STATES):
    save(state_icons[name], f'state-{name}')
    state_sheet.paste(state_icons[name], ((index % 6)*64,(index // 6)*64))
state_sheet.save(PROJECT / 'docs' / 'state-icons-64.png', optimize=True)
for name, (x,y) in SPELLS.items():
    # The approved 384×384 indexed sheet already contains exact 64×64 tiles.
    # Keep its shared VGA palette and pixels intact: no RGB conversion or re-quantization.
    # This atlas is assembled above with exact cells, unlike the generated source.
    save(spell_icons.crop((x*64,y*64,(x+1)*64,(y+1)*64)), f'spell-{name}')
for name, (x,y) in RESISTANCES.items():
    save(cell(icons, x, y, 6, 6), f'res-{name}', (64,64))

print('Prepared portraits, leather and icons from source illustrations.')
