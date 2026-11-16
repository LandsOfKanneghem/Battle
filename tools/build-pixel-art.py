"""Build the original, deterministic 1990s fantasy artwork (requires Pillow).

Run from any directory: python tools/build-pixel-art.py. No game data is changed.
All sprites are drawn at native resolution; the browser uses nearest-neighbor scaling.
"""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'homm2'
OUT.mkdir(parents=True, exist_ok=True)
R = random.Random(2246)
INK = '#201c21'
GOLD = '#ddb365'
IVORY = '#f7dfac'


def save(image, name):
    image.save(OUT / (name + '.png'), optimize=True)


def mix(a, b, t):
    return tuple(round(x + (y-x)*t) for x, y in zip(a, b))


def gradient(size, top, bottom):
    image = Image.new('RGBA', size)
    d = ImageDraw.Draw(image)
    for y in range(size[1]):
        d.line((0, y, size[0], y), fill=mix(top, bottom, y / max(1, size[1]-1)))
    return image


def shape(d, points, color, outline=INK):
    d.polygon(points, fill=color)
    if outline:
        d.line(points + [points[0]], fill=outline, width=1)


def grain(image, palette, count, seed):
    rng = random.Random(seed)
    d = ImageDraw.Draw(image)
    for _ in range(count):
        x, y = rng.randrange(image.width), rng.randrange(image.height)
        d.point((x, y), fill=rng.choice(palette))


# Textures: low-contrast surfaces leave numbers and tactical overlays readable.
for name, top, bottom, colors in [
    ('stone', (51, 56, 53), (34, 38, 40), ['#303735', '#41443c', '#262d2c']),
    ('parchment', (210, 186, 129), (181, 151, 95), ['#bfa367', '#cfb57b', '#d5bc86']),
    ('leather', (50, 40, 31), (30, 27, 25), ['#392c21', '#2c251f', '#433327']),
    ('wood', (99, 61, 34), (54, 34, 25), ['#68472a', '#513721', '#79532d']),
]:
    image = gradient((64, 64), top, bottom)
    grain(image, colors, 1200, name)
    d = ImageDraw.Draw(image)
    if name == 'stone':
        for y in range(0, 64, 16):
            d.line((0, y, 63, y), fill='#222a29')
            d.line((0, y+1, 63, y+1), fill='#54564a')
            for x in range(-16 if y % 32 else 0, 64, 32):
                d.line((x, y+1, x, y+15), fill='#242b29')
    if name == 'wood':
        for y in [5, 17, 31, 46, 59]:
            d.line((0, y, 63, y-2), fill='#3f2c21')
            d.line((0, y+1, 63, y-1), fill='#886037')
    save(image, name)

# Four subtly different grass tiles avoid an obvious repeated symbol in every cell.
for variant in range(4):
    rng = random.Random(340+variant)
    image = Image.new('RGBA', (32, 32), '#536431')
    grain(image, ['#4a5a2d', '#5c6b36', '#63723a', '#48572b', '#566832'], 680, variant)
    d = ImageDraw.Draw(image)
    for _ in range(12):
        x, y = rng.randrange(1, 30), rng.randrange(2, 31)
        d.line((x, y, x-1, y-2), fill='#3a4d28')
        d.line((x+1, y, x+2, y-3), fill='#7b8544')
    for _ in range(3):
        x,y=rng.randrange(32),rng.randrange(32)
        d.point((x,y),fill='#a99d57')
    save(image, f'grass-{variant}')

image = Image.new('RGBA', (32,32), '#b29b60')
grain(image, ['#bba569', '#a58d54', '#c2ac70', '#ab945a'], 650, 86)
d=ImageDraw.Draw(image)
for x,y in [(4,8),(19,5),(12,23),(26,27),(28,13)]:
    d.line((x,y,x+3,y),fill='#8c784b'); d.point((x+1,y-1),fill='#dbc184')
save(image,'sand')
image = gradient((32,32),(36,83,104),(24,65,86))
grain(image,['#23566b','#285f72','#1c4d64'],300,654)
d=ImageDraw.Draw(image)
for y,shift in [(4,0),(12,9),(22,4),(29,18)]:
    for x in range(-shift,32,19):
        d.line([(x,y+1),(x+3,y),(x+9,y),(x+11,y+1)],fill='#4e8d9b')
        d.line((x+3,y+2,x+8,y+2),fill='#32758b')
save(image,'water')

# A distant valley painted at a deliberately low native resolution.
image=gradient((512,64),(21,36,46),(112,101,66));d=ImageDraw.Draw(image)
d.ellipse((382,8,402,28),fill='#c3a163')
for points,color in [([(0,41),(30,22),(52,38),(87,12),(120,34),(155,18),(205,41),(245,23),(300,42),(347,19),(382,34),(420,16),(466,37),(512,24),(512,64),(0,64)],'#3a4a4d'),
                     ([(0,49),(55,35),(95,49),(145,32),(190,48),(254,38),(315,51),(372,31),(430,45),(480,34),(512,45),(512,64),(0,64)],'#303d39')]:
    d.polygon(points,fill=color)
for x in range(0,512,7):
    y=50+R.randrange(8);d.polygon([(x,y-9),(x-4,y+3),(x+4,y+3)],fill=R.choice(['#242f29','#29392e','#344231']))
for x,h in [(45,19),(53,25),(61,17)]:
    d.rectangle((x,53-h,x+5,56),fill='#1d2927');d.polygon([(x-1,53-h),(x+2,48-h),(x+6,53-h)],fill='#26312d')
save(image,'valley')


def creature(kind):
    im=Image.new('RGBA',(48,48));d=ImageDraw.Draw(im)
    d.ellipse((7,40,42,46),fill=(18,25,18,100))
    if kind=='wizard':
        # Gold-trimmed blue robe, ivory beard and a crystal-tipped wooden staff.
        shape(d,[(14,23),(28,21),(31,30),(35,43),(11,43),(14,32)],'#244f86')
        shape(d,[(18,25),(25,25),(27,41),(17,41)],'#3c70ad',None)
        shape(d,[(14,29),(11,37),(8,36),(11,26),(16,23)],'#315f9a')
        d.line((14,42,32,42),fill='#d3ac58',width=2)
        d.line((17,28,15,39),fill='#142e57',width=2)
        d.line((28,28,31,40),fill='#102c50',width=2)
        shape(d,[(16,14),(27,14),(28,21),(24,27),(17,22)],'#d2aa77')
        d.rectangle((17,15,21,19),fill='#f0d09d');d.point((24,17),fill='#241e27')
        shape(d,[(17,19),(23,22),(27,19),(26,25),(21,30),(17,24)],'#d9d4b7')
        d.line((20,23,21,27),fill='#fff2d2')
        shape(d,[(10,15),(17,10),(24,2),(26,10),(32,15)],'#2c568d')
        d.line((19,10,24,5),fill='#6b94be',width=2)
        d.line((11,15,31,15),fill='#d5b85d',width=2)
        d.rectangle((21,11,23,13),fill='#edc864')
        d.line((37,15,35,43),fill='#281f1a',width=3)
        d.line((37,15,35,42),fill='#b18b53')
        shape(d,[(33,10),(37,7),(41,10),(38,16),(35,16)],'#4d9ea7')
        d.line([(37,8),(36,11),(37,14)],fill='#c6f7ec')
        d.rectangle((30,27,36,30),fill='#d2a571')
    elif kind=='monk':
        shape(d,[(17,21),(28,21),(31,33),(35,44),(10,44),(14,31)],'#84532c')
        shape(d,[(19,23),(25,23),(28,41),(15,41)],'#b18043',None)
        d.line((18,26,14,41),fill='#d2ab64');d.line((29,28,32,41),fill='#56371f',width=2)
        d.line((14,43,32,43),fill='#d8b574')
        shape(d,[(15,24),(9,32),(14,35),(20,29)],'#9e713a')
        shape(d,[(29,24),(35,31),(29,35),(24,29)],'#9e713a')
        d.rectangle((16,30,27,33),fill='#d6b383');d.rectangle((19,30,23,32),fill='#f0cc96')
        d.ellipse((15,5,30,22),fill=INK);d.ellipse((16,6,29,21),fill='#bd9366')
        d.ellipse((18,7,27,15),fill='#ebc695');d.arc((16,6,29,20),180,330,fill='#654327',width=2)
        d.point((20,14),fill=INK);d.point((26,14),fill=INK);d.line((21,18,25,18),fill='#77472d')
        d.line((38,13,36,44),fill='#3e2b1c',width=3);d.line((38,13,36,43),fill='#c49a57')
        d.rectangle((35,10,40,14),fill='#8f6d37');d.rectangle((36,10,39,11),fill=GOLD)
    elif kind=='wolf':
        shape(d,[(12,28),(5,26),(2,17),(7,19),(12,23),(20,21),(32,23),(37,31),(30,36),(13,34)],'#737a7b')
        shape(d,[(12,26),(20,23),(30,25),(32,30),(22,30),(15,32)],'#9b9d91',None)
        shape(d,[(12,32),(11,43),(16,43),(19,33)],'#656d6d')
        shape(d,[(24,32),(25,43),(30,43),(29,32)],'#656d6d')
        d.line((12,42,16,42),fill='#c7bd9d');d.line((26,42,30,42),fill='#c7bd9d')
        shape(d,[(29,25),(27,16),(28,7),(33,14),(37,8),(39,19),(46,24),(44,29),(37,32),(31,30)],'#8d9390')
        shape(d,[(30,17),(31,12),(33,17),(37,14),(37,21),(43,23),(39,26),(32,24)],'#b4b5a6',None)
        d.polygon([(32,26),(42,26),(39,30),(34,29)],fill='#d2cbb2')
        d.rectangle((43,23,46,25),fill='#272b2a');d.point((37,21),fill='#f0d888')
        d.point((38,21),fill='#1e2022');d.line((39,28,44,27),fill='#30292b')
        for x,y in [(17,27),(21,26),(25,27),(30,21)]:d.line((x,y,x-1,y+3),fill='#c4c3ad')
    elif kind=='hill-giant':
        shape(d,[(13,30),(32,30),(34,44),(25,44),(24,36),(21,36),(20,44),(9,44)],'#5b4830')
        d.rectangle((10,42,19,44),fill='#a38d66');d.rectangle((26,42,34,44),fill='#a38d66')
        shape(d,[(12,16),(30,16),(36,26),(31,34),(13,34),(7,26)],'#a18455')
        shape(d,[(14,18),(27,18),(29,28),(25,32),(15,29)],'#c0a36e',None)
        shape(d,[(12,18),(7,19),(3,31),(8,34),(15,25)],'#ae905d')
        shape(d,[(30,18),(36,18),(41,27),(36,31),(29,24)],'#ae905d')
        d.rectangle((12,31,31,34),fill='#423426');d.rectangle((22,31,26,34),fill='#bda260')
        d.ellipse((14,3,31,20),fill=INK);d.ellipse((15,4,30,19),fill='#b49a69')
        shape(d,[(14,8),(16,3),(22,1),(28,3),(31,8)],'#4d4738')
        d.rectangle((18,10,20,11),fill='#27271f');d.rectangle((26,10,28,11),fill='#27271f')
        d.line((21,16,27,16),fill='#523d2b');d.point((23,13),fill='#ddbd85')
        d.line((38,14,42,43),fill=INK,width=5);d.line((38,14,42,42),fill='#8d6537',width=3)
        shape(d,[(33,5),(42,3),(46,17),(36,21)],'#644b2d')
        d.line((36,7,39,17),fill='#ac8850',width=2);d.line((41,6,44,15),fill='#382f24')
    elif kind=='lake-spirit':
        d.ellipse((7,38,42,45),fill='#285e76');d.arc((5,36,44,46),0,180,fill='#7fb7ae')
        shape(d,[(22,4),(30,13),(28,18),(36,22),(39,32),(32,38),(31,42),(15,41),(9,34),(12,24),(19,17)],'#408e9d')
        shape(d,[(22,8),(25,18),(20,24),(17,36),(28,39),(13,39),(12,31),(17,22)],'#80c5be',None)
        shape(d,[(29,23),(34,25),(36,32),(30,36),(23,34),(27,30)],'#296c88',None)
        d.line([(16,30),(17,25),(21,22),(24,25),(23,30),(20,32),(25,34)],fill='#c5e7cf',width=2)
        d.line((22,13,23,17),fill='#e5f5de',width=2)
        d.rectangle((20,23,21,24),fill='#e8f9cf');d.rectangle((26,23,27,24),fill='#e8f9cf')
    elif kind=='crate':
        shape(d,[(6,11),(32,7),(42,15),(41,40),(15,44),(6,35)],'#6e482a')
        shape(d,[(6,11),(32,7),(42,15),(15,20)],'#b08a4e')
        shape(d,[(15,20),(42,15),(41,40),(15,44)],'#927043')
        for y in [24,31,38]:d.line((16,y,40,y-4),fill='#513a26')
        for x in [9,12]:d.line((x,16,x,35),fill='#8e683b')
        d.line((17,21,39,39),fill='#c3a063',width=3);d.line((18,41,39,19),fill='#b28c52',width=3)
        for x,y in [(18,22),(37,20),(18,39),(38,37)]:d.point((x,y),fill='#332c25')
    return im


for name in ['wizard','monk','wolf','hill-giant','lake-spirit','crate']:
    sprite=creature(name);save(sprite,name)
    if name!='crate':
        portrait=gradient((64,64),(43,61,65),(24,33,34));d=ImageDraw.Draw(portrait)
        for x in [7,55]:
            d.rectangle((x,5,x+3,60),fill='#625d44');d.line((x,6,x,60),fill='#93835a')
        d.arc((7,-10,59,41),180,360,fill='#a38b58',width=2)
        portrait.alpha_composite(sprite.resize((64,64),Image.Resampling.NEAREST),(0,1))
        save(portrait,'portrait-'+name)


# Small illustrated spellbook tiles, each readable at native 32×32 resolution.
PALETTES={
 'fire':((75,32,28),(34,26,29),'#e78e3d','#f6cf75'),
 'water':((27,62,84),(23,29,46),'#669fab','#b7e0d0'),
 'air':((44,65,74),(25,31,42),'#8eb8c2','#e4e0bb'),
 'earth':((76,58,35),(35,31,28),'#ab8854','#d5c18c'),
 'body':((77,57,46),(37,28,30),'#c09d75','#edcf9d'),
 'light':((84,68,30),(37,31,28),'#dbb44d','#ffedaf'),
 'dark':((51,41,63),(25,24,33),'#9c8a9b','#d1bd96'),
 'none':((63,62,56),(30,31,30),'#a7a48a','#e0d5b1')}


def icon(kind,school):
    top,bottom,main,edge=PALETTES[school]
    im=gradient((32,32),top,bottom);d=ImageDraw.Draw(im)
    for x,y in [(4,5),(25,8),(7,25),(27,23),(19,4)]:d.point((x,y),fill=main)
    if kind=='fire':
        shape(d,[(16,3),(20,12),(24,8),(27,18),(25,25),(18,29),(10,27),(6,21),(7,13),(11,18),(12,9)],'#b74a29')
        shape(d,[(16,10),(18,18),(22,15),(23,22),(18,27),(11,25),(10,19),(14,21)],'#efaa42',None)
        d.polygon([(17,18),(20,24),(15,27),(13,23)],fill='#ffe297')
    elif kind in ['water','bubble','spirit']:
        if kind=='bubble':
            d.ellipse((4,4,28,28),outline=main,width=2);d.arc((7,7,25,25),180,270,fill=edge,width=2)
            shape(d,[(15,10),(22,17),(20,24),(13,26),(8,21),(10,16)],'#38758a')
        else:
            shape(d,[(16,3),(21,12),(26,18),(25,25),(20,29),(11,28),(6,23),(7,17),(12,10)],'#326e88')
            d.line([(14,9),(12,16),(10,20),(11,24),(14,25)],fill=edge,width=2)
            d.line([(20,17),(22,21),(20,25)],fill=main,width=2)
        if kind=='spirit':
            d.rectangle((12,18,13,19),fill=IVORY);d.rectangle((19,18,20,19),fill=IVORY)
    elif kind=='cube':
        shape(d,[(5,12),(17,5),(28,11),(27,24),(16,30),(5,24)],'#b96629')
        shape(d,[(5,12),(17,5),(28,11),(16,18)],'#eeb854')
        shape(d,[(16,18),(28,11),(27,24),(16,30)],'#e48b31')
        d.line((7,14,7,22),fill='#f3ce7a');d.line((18,20,18,26),fill='#f7c65b')
        d.polygon([(12,9),(13,4),(16,7),(18,1),(21,9)],fill='#ffd276')
    elif kind=='shield':
        shape(d,[(6,6),(16,2),(26,6),(25,21),(21,27),(16,30),(10,26),(7,20)],'#927640')
        shape(d,[(9,8),(16,5),(23,8),(22,20),(19,24),(16,27),(12,24),(10,19)],main)
        d.line((16,7,16,24),fill=edge);d.line((11,15,21,15),fill=edge)
        d.point((7,7),fill=IVORY);d.point((25,7),fill=IVORY)
    elif kind in ['boots','weight','wing']:
        if kind=='weight':
            d.arc((11,3,21,16),180,360,fill=edge,width=2)
            shape(d,[(7,12),(25,12),(28,28),(4,28)],main)
            d.line((10,15,8,25),fill=edge);d.rectangle((14,17,18,23),fill='#413a32')
        else:
            shape(d,[(13,7),(21,7),(20,20),(27,23),(27,28),(9,28),(7,24),(13,19)],'#9b743f')
            d.line((11,27,25,27),fill=edge);d.rectangle((14,10,19,12),fill=GOLD)
            shape(d,[(12,15),(3,7),(4,15),(1,13),(4,21),(11,23)],'#b8c5b1')
            d.line((4,13,10,20),fill='#5b8084')
    elif kind in ['arrow','ice','bolt','compass','feather']:
        if kind=='bolt':
            shape(d,[(19,2),(9,16),(15,16),(12,30),(25,12),(19,13),(23,2)],edge)
            d.line((19,5,13,14),fill='#fff1c2')
        elif kind=='compass':
            d.ellipse((4,4,28,28),outline=main);d.line((16,2,16,30),fill=edge);d.line((2,16,30,16),fill=edge)
            shape(d,[(16,5),(19,13),(26,16),(19,19),(16,27),(13,19),(5,16),(13,13)],main)
            d.point((16,16),fill=IVORY)
        elif kind=='ice':
            shape(d,[(23,3),(28,4),(28,10),(11,28),(4,28),(4,21)],'#6eabb7')
            d.line((7,24,25,6),fill='#e2ebd2',width=2);d.line((6,19,13,26),fill='#315c81')
        else:
            d.line((8,27,23,7),fill='#b99859',width=2)
            shape(d,[(18,6),(28,3),(25,14)],edge)
            d.line((5,23,8,28),fill=main,width=3)
    elif kind in ['rain','waves','snow']:
        if kind=='rain':
            d.ellipse((5,5,24,14),fill='#839393');d.ellipse((14,6,28,15),fill='#a3b0a0')
            for x,y in [(8,19),(15,24),(23,19)]:d.line((x,y,x-2,y+5),fill='#81bcc8',width=2)
        elif kind=='snow':
            for points in [[(16,3),(16,29)],[(4,9),(28,23)],[(4,23),(28,9)]]:d.line(points,fill=edge,width=2)
            for x,y in [(16,7),(8,12),(24,12),(8,20),(24,20),(16,25)]:d.rectangle((x-1,y-1,x+1,y+1),fill=main)
        else:
            for y in [10,17,24]:d.line([(3,y),(7,y-2),(12,y-2),(17,y+1),(23,y+1),(28,y-2)],fill=edge,width=2)
    elif kind in ['sun','star','cross']:
        if kind=='cross':
            shape(d,[(13,4),(19,4),(19,13),(28,13),(28,19),(19,19),(19,28),(13,28),(13,19),(4,19),(4,13),(13,13)],main)
            d.line((14,7,14,25),fill=edge,width=2);d.line((7,14,25,14),fill=edge,width=2)
        elif kind=='star':
            shape(d,[(16,2),(19,11),(27,5),(23,14),(30,16),(22,19),(26,27),(18,23),(16,31),(13,22),(5,27),(9,19),(2,16),(11,13),(6,5),(14,10)],'#d7ae52')
            shape(d,[(16,8),(18,14),(24,16),(18,18),(16,25),(14,18),(8,16),(14,14)],'#fff0ba',None)
        else:
            for angle in range(0,360,45):
                a=math.radians(angle);d.line((16+int(10*math.cos(a)),16+int(10*math.sin(a)),16+int(14*math.cos(a)),16+int(14*math.sin(a))),fill=GOLD,width=2)
            d.ellipse((8,8,24,24),fill='#c79839',outline=INK);d.ellipse((11,10,21,20),fill='#f7d67a')
            d.point((14,12),fill='#fff2c5')
    elif kind in ['hourglass','clock']:
        if kind=='hourglass':
            d.rectangle((8,3,24,6),fill='#b68d48');d.rectangle((8,26,24,29),fill='#b68d48')
            shape(d,[(10,7),(22,7),(22,11),(17,16),(22,22),(22,25),(10,25),(10,22),(15,16),(10,11)],'#79918d')
            d.polygon([(12,8),(20,8),(16,13)],fill='#ead393');d.polygon([(12,24),(16,19),(20,24)],fill='#ead393')
            d.point((16,17),fill=IVORY)
        else:
            d.ellipse((4,4,28,28),fill=GOLD,outline=INK);d.ellipse((7,7,25,25),fill='#d5c698')
            d.line([(16,9),(16,17),(21,20)],fill='#453b32',width=2)
            for p in [(16,6),(26,16),(16,26),(6,16)]:d.point(p,fill=IVORY)
    elif kind in ['club','rock','jaws']:
        if kind=='club':
            d.line((8,28,22,8),fill='#4d3427',width=5);d.line((8,27,22,7),fill='#ab8451',width=2)
            shape(d,[(14,6),(23,2),(29,8),(24,18),(17,15)],'#80603d');d.line((17,7,24,11),fill='#c5a16a')
        elif kind=='rock':
            shape(d,[(6,10),(16,4),(25,8),(28,20),(20,28),(8,26),(3,18)],'#8a8b7d')
            d.line([(6,10),(13,17),(24,12)],fill='#c6c4a2');d.line([(13,17),(10,25)],fill='#494d48')
            d.polygon([(16,6),(23,9),(19,14),(12,14)],fill='#aaa994')
        else:
            shape(d,[(5,7),(16,4),(27,8),(25,16),(21,22),(11,22),(6,17)],'#9b513b')
            shape(d,[(7,20),(14,27),(21,27),(27,20),(24,28),(15,30)],'#813e32')
            for x in [8,14,21]:d.polygon([(x,9),(x+5,9),(x+2,19)],fill='#ede0bd')
            d.polygon([(12,26),(16,20),(18,27)],fill='#ede0bd')
    elif kind in ['heart','fist','skull','drop','portal']:
        if kind=='heart':
            shape(d,[(4,12),(7,7),(12,7),(16,11),(20,7),(25,7),(28,12),(26,20),(16,28),(6,20)],'#bd5d45')
            d.line((8,10,12,10),fill='#f1c58e',width=2)
        elif kind=='fist':
            shape(d,[(8,11),(12,9),(13,5),(18,5),(20,8),(25,9),(26,19),(20,25),(19,29),(10,29),(11,21),(7,17)],'#b58d61')
            d.line((14,8,14,15),fill=IVORY);d.line((19,10,19,15),fill=IVORY)
        elif kind=='drop':
            shape(d,[(16,3),(22,14),(26,21),(23,28),(15,30),(8,26),(7,20)],'#a74238');d.line((13,14,11,22),fill='#f2ac7c',width=2)
        elif kind=='skull':
            d.ellipse((6,4,26,23),fill='#bfb48e',outline=INK);d.rectangle((10,19,23,27),fill='#bfb48e')
            d.rectangle((9,12,14,16),fill='#38322d');d.rectangle((19,12,23,16),fill='#38322d')
            for x in [12,16,20]:d.line((x,23,x,27),fill='#635548')
        else:
            d.ellipse((7,3,25,29),outline=main,width=3);d.arc((9,5,23,27),180,290,fill=edge,width=2)
            d.line((13,16,23,16),fill=IVORY,width=2);d.line([(18,11),(23,16),(18,21)],fill=IVORY,width=2)
    return im


SPELL_ART={
 'fire-shot':('fire','fire'),'burning-hands':('fist','fire'),'reckless':('heart','fire'),
 'fire-cube':('cube','fire'),'armageddon':('rain','fire'),
 'water-shot':('water','water'),'liquid-membrane':('bubble','water'),'rain':('rain','water'),
 'ice-arrow':('ice','water'),'deep-freeze':('snow','water'),'lake-spirit':('spirit','water'),
 'haste':('boots','air'),'wind-rose':('compass','air'),'sparks':('bolt','air'),
 'sky-shot':('arrow','air'),'teleport':('portal','air'),'water-walk':('waves','air'),
 'slow':('boots','earth'),'dead-weight':('weight','earth'),'stone-skin':('shield','earth'),
 'heal-harm':('cross','body'),'weakness-vigor':('fist','body'),'sprint':('boots','body'),
 'light-flash':('star','light'),'power-hour':('sun','light'),'apply-old-age':('hourglass','dark'),
 'bite':('jaws','none'),'club-smash':('club','none'),'boulder-throw':('rock','none')}
for school in ['fire','water','earth','air']:SPELL_ART[school+'-shield']=('shield',school)
STATE_ART={
 'speed':('boots','air'),'slowness':('boots','earth'),'freeze':('snow','water'),
 'burning':('fire','fire'),'wet':('water','water'),'heavy':('weight','earth'),
 'light':('feather','air'),'chill':('ice','water'),'adrenaline':('heart','fire'),
 'adrenaline-crash':('heart','dark'),'weakness':('fist','dark'),'exhaustion':('skull','dark'),
 'vigor':('fist','light'),'bleeding':('drop','fire'),'water-entity':('water','water'),
 'levitation':('waves','air'),'old-age':('hourglass','dark'),'summon-time':('clock','earth')}
for name,args in SPELL_ART.items():save(icon(*args),'spell-'+name)
for name,args in STATE_ART.items():save(icon(*args),'state-'+name)
for key,args in {
 'ac':('shield','none'),'physical':('club','none'),'fire':('fire','fire'),'water':('water','water'),
 'air':('compass','air'),'earth':('rock','earth'),'mind':('star','dark'),'poison':('drop','earth')}.items():
    save(icon(*args),'res-'+key)

print(f'Built {len(list(OUT.glob("*.png")))} original pixel-art assets in {OUT}')
