# Contact sheet composer (system Python with PIL, not Blender).
#   python art/blender/machines/sheet.py                      -> out/machines_sheet.png from the shop thumbs
#   python art/blender/machines/sheet.py --preview a,b,c      -> out/preview_sheet.png from out/preview/*_<tag>.png
#   python art/blender/machines/sheet.py --only mower_ --out out/x.png
import os
import sys
import json
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'out')


def arg(name, default=None):
    if '--' + name in sys.argv:
        return sys.argv[sys.argv.index('--' + name) + 1]
    return default


def font(size):
    for f in ('C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def main():
    report = {}
    rp = os.path.join(OUT, 'machines_build.json')
    if os.path.exists(rp):
        with open(rp) as f:
            report = {r['key']: r for r in json.load(f)}
    only = arg('only', '')
    tags = arg('preview')
    if tags:
        tags = tags.split(',')
        keys = sorted({f.rsplit('_', 1)[0] for f in os.listdir(os.path.join(OUT, 'preview'))})
        keys = [k for k in keys if k.startswith(only)] if only else keys
        cell = int(arg('cell', '360'))
        cols = len(tags)
        rows = len(keys)
        img = Image.new('RGB', (cols * cell, rows * (cell + 26)), (236, 238, 232))
        d = ImageDraw.Draw(img)
        for r, k in enumerate(keys):
            for c, t in enumerate(tags):
                p = os.path.join(OUT, 'preview', '%s_%s.png' % (k, t))
                if os.path.exists(p):
                    im = Image.open(p).convert('RGBA').resize((cell, cell), Image.LANCZOS)
                    img.paste(im, (c * cell, r * (cell + 26) + 26), im)
            info = report.get(k, {})
            label = '%s   %s tris   %s KB   %s m' % (k, info.get('tris', '?'), info.get('size_kb', '?'),
                                                    ' x '.join(str(v) for v in info.get('dims', [])))
            d.text((8, r * (cell + 26) + 4), label, fill=(30, 30, 30), font=font(16))
        out = arg('out', os.path.join(OUT, 'preview_sheet.png'))
    else:
        tdir = os.path.join(ROOT, 'public', 'img', 'thumbs')
        keys = sorted(f[:-4] for f in os.listdir(tdir) if f.endswith('.png'))
        keys = [k for k in keys if k.startswith(only)] if only else keys
        order = ['mower_', 'tool_', 'addon_', 'veh_']
        keys.sort(key=lambda k: (next((i for i, o in enumerate(order) if k.startswith(o)), 9), k))
        cell = 256
        cols = 6
        rows = (len(keys) + cols - 1) // cols
        img = Image.new('RGB', (cols * cell, rows * (cell + 44)), (236, 238, 232))
        d = ImageDraw.Draw(img)
        for i, k in enumerate(keys):
            x, y = (i % cols) * cell, (i // cols) * (cell + 44)
            d.rectangle([x + 4, y + 4, x + cell - 4, y + cell - 4], fill=(222, 226, 218))
            im = Image.open(os.path.join(tdir, k + '.png')).convert('RGBA')
            img.paste(im, (x, y), im)
            info = report.get(k, {})
            d.text((x + 8, y + cell + 2), k, fill=(20, 20, 20), font=font(17))
            d.text((x + 8, y + cell + 22), '%s tris  %s KB  %s' % (
                info.get('tris', '?'), info.get('size_kb', '?'), ' x '.join('%.2f' % v for v in info.get('dims', []))),
                fill=(70, 70, 70), font=font(13))
        out = arg('out', os.path.join(OUT, 'machines_sheet.png'))
    img.save(out)
    print('wrote', out, img.size)


main()
