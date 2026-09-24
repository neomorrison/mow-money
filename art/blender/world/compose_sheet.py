"""Compose rendered tiles into a labeled contact sheet (system Python with PIL).

Usage: python art/blender/world/compose_sheet.py <out.png> <prefix> [<prefix> ...] [--suffix _back] [--cols 4]
"""
import os
import sys
import json
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
TILES = os.path.join(ROOT, "out", "world_tiles")


def main():
    args = sys.argv[1:]
    out = args[0]
    suffix = ""
    cols = 4
    prefixes = []
    i = 1
    while i < len(args):
        if args[i] == "--suffix":
            suffix = args[i + 1]
            i += 2
            continue
        if args[i] == "--cols":
            cols = int(args[i + 1])
            i += 2
            continue
        prefixes.append(args[i])
        i += 1
    stats = {}
    sp = os.path.join(ROOT, "out", "world_stats.json")
    if os.path.exists(sp):
        stats = json.load(open(sp))
    keys = sorted(f[: -4 - len(suffix)] for f in os.listdir(TILES)
                  if f.endswith(suffix + ".png") and (suffix or not (f.endswith("_back.png") or f.endswith("_top.png"))))
    keys = [k for k in keys if not prefixes or any(k.startswith(p) for p in prefixes)]
    if not keys:
        print("no tiles")
        return
    tw = th = 420
    lh = 40
    rows = (len(keys) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + lh)), (30, 34, 40))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
        small = ImageFont.truetype("arial.ttf", 13)
    except Exception:
        font = small = ImageFont.load_default()
    for n, k in enumerate(keys):
        x, y = (n % cols) * tw, (n // cols) * (th + lh)
        im = Image.open(os.path.join(TILES, k + suffix + ".png")).convert("RGB")
        sheet.paste(im, (x, y))
        dims = ""
        tp = os.path.join(TILES, k + suffix + ".txt")
        if os.path.exists(tp):
            dims = open(tp).read().strip()
        st = stats.get(k, {})
        d.text((x + 8, y + th + 3), k, fill=(240, 240, 240), font=font)
        d.text((x + 8, y + th + 22), "%s   %s tris   %.0f KB" % (dims, st.get("tris", "?"), st.get("bytes", 0) / 1024),
               fill=(170, 180, 190), font=small)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out)
    print("sheet", out, len(keys))


main()
