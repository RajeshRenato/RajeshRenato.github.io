#!/usr/bin/env python3
"""Preview images (1200x630) for link cards. Needs Pillow and macOS system fonts.

  python3 scripts/og-card.py project <folder> "TITLE" "line one|line two|line three" "#e5484d" screenshot.png [left,top,right,bottom]
      The project's og.png: title and three short lines on the left, a crop of a real screenshot on the right.

  python3 scripts/og-card.py hub
      The hub's og.png, with the project count read from index.html.
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FONTS = '/System/Library/Fonts/Supplemental/'
W, H = 1200, 630


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def project(folder, title, lines, accent, shot, crop=None):
    acc = hex_rgb(accent)
    img = Image.new('RGB', (W, H), (20, 20, 26))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 14, H], fill=acc)
    size = 86
    while d.textlength(title, font=font('Arial Black.ttf', size)) > 560:
        size -= 2
    d.text((70, 160), title, font=font('Arial Black.ttf', size), fill=(255, 255, 255))
    y = 160 + size + 24
    d.rectangle([72, y, 192, y + 8], fill=acc)
    for i, line in enumerate(lines[:3]):
        d.text((72, y + 38 + i * 42), line, font=font('Arial.ttf', 30), fill=(200, 200, 212))
    f = font('Arial.ttf', 24)
    d.text((72, H - 70), "Rajesh's Playground", font=f, fill=acc)
    d.text((72 + d.textlength("Rajesh's Playground", font=f) + 24, H - 70), 'runs in the browser, no install', font=f, fill=(120, 120, 134))
    s = Image.open(shot).convert('RGB')
    if crop:
        s = s.crop(crop)
    s = s.resize((470, 296), Image.LANCZOS)
    d.rectangle([668, 158, 668 + 474, 158 + 300], fill=(58, 60, 72))
    img.paste(s, (670, 160))
    out = os.path.join(ROOT, folder, 'og.png')
    img.save(out, optimize=True)
    print('wrote', out)


LETTERS = [('P', '#ff4fa3'), ('L', '#28e0ff'), ('A', '#ffd166'), ('Y', '#64ffb4'), ('G', '#c77bff'),
           ('R', '#ff8a5c'), ('O', '#7f8cff'), ('U', '#39ff9c'), ('N', '#ff6fb0'), ('D', '#45d9e8')]


def hub():
    n = re.search(r'(\d+) games, tools, and toys that run straight', open(os.path.join(ROOT, 'index.html')).read()).group(1)
    img = Image.new('RGB', (W, H), (245, 245, 240))
    d = ImageDraw.Draw(img)
    big = font('Arial Black.ttf', 92)
    tile_w, gap = 96, 14
    x = (W - (len(LETTERS) * tile_w + (len(LETTERS) - 1) * gap)) // 2
    for ch, col in LETTERS:
        d.rounded_rectangle([x, 150, x + tile_w, 278], radius=12, fill=hex_rgb(col))
        tw = d.textlength(ch, font=big)
        d.text((x + (tile_w - tw) / 2, 160), ch, font=big, fill=(22, 22, 15))
        x += tile_w + gap
    for text, y, colr in [(n + ' games, tools, and toys that run straight in the browser.', 362, (26, 26, 24)),
                          ('Plain HTML, CSS, and JavaScript. No frameworks, no build step.', 408, (110, 110, 102))]:
        f = font('Arial.ttf', 30)
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=colr)
    x = 4
    i = 0
    while x < W:
        d.rounded_rectangle([x, 520, x + 18, 538], radius=4, fill=hex_rgb(LETTERS[i % len(LETTERS)][1]))
        x += 24
        i += 1
    out = os.path.join(ROOT, 'og.png')
    img.save(out, optimize=True)
    print('wrote', out, '(' + n + ' projects)')


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == 'hub':
        hub()
    elif len(sys.argv) >= 7 and sys.argv[1] == 'project':
        crop = tuple(int(v) for v in sys.argv[7].split(',')) if len(sys.argv) > 7 else None
        project(sys.argv[2], sys.argv[3], sys.argv[4].split('|'), sys.argv[5], sys.argv[6], crop)
    else:
        print(__doc__)
        sys.exit(1)
