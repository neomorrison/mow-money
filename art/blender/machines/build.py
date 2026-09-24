# Builds, exports and thumbnails every machine and character model. Idempotent: rerun at will.
#
#   blender --background --factory-startup --python art/blender/machines/build.py -- [options]
#     --only key1,key2   build a subset
#     --no-thumbs        skip the shop thumbnails
#     --preview          also render 512 px front and rear previews to out/preview/
#
# Output: public/models/<key>.glb, public/img/thumbs/<key>.png, out/machines_build.json
import os
import sys
import json
import time

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import lib  # noqa: E402
from mowers import MOWERS  # noqa: E402
from tools import TOOLS  # noqa: E402
from addons import ADDONS  # noqa: E402
from vehicles import VEHICLES  # noqa: E402
from people import PEOPLE  # noqa: E402


# Shop thumbnail camera direction overrides (default is a 3/4 front view from the front-left).
THUMB_VIEW = {
    'tool_backpack': (-1.1, 1.0, 0.8),
    'addon_bagger': (1.2, 0.8, 0.9),
}


def registry():
    reg = {}
    for key, (fn, deck) in MOWERS.items():
        reg[key] = {'fn': fn, 'kind': 'mower', 'deck': deck}
    for key, fn in TOOLS.items():
        reg[key] = {'fn': fn, 'kind': 'tool'}
    for key, fn in ADDONS.items():
        reg[key] = {'fn': fn, 'kind': 'addon'}
    for key, fn in VEHICLES.items():
        reg[key] = {'fn': fn, 'kind': 'vehicle'}
    for key, fn in PEOPLE.items():
        reg[key] = {'fn': fn, 'kind': 'char'}
    return reg


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opts = {'only': None, 'thumbs': True, 'preview': False}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--only':
            opts['only'] = set(argv[i + 1].split(','))
            i += 1
        elif a == '--no-thumbs':
            opts['thumbs'] = False
        elif a == '--preview':
            opts['preview'] = True
        i += 1
    return opts


def main():
    opts = parse_args()
    reg = registry()
    report = []
    t0 = time.time()
    for key, meta in reg.items():
        if opts['only'] and key not in opts['only']:
            continue
        lib.reset()
        meta['fn']()
        if meta['kind'] in ('vehicle', 'addon'):
            lib.recenter_xy()
        bpy.context.view_layer.update()
        path = lib.export_glb(key)
        mn, mx = lib.world_bbox()
        row = {
            'key': key, 'kind': meta['kind'], 'tris': lib.tri_count(),
            'size_kb': round(os.path.getsize(path) / 1024, 1),
            'dims': [round(mx.x - mn.x, 3), round(mx.y - mn.y, 3), round(mx.z - mn.z, 3)],
            'min': [round(mn.x, 3), round(mn.y, 3), round(mn.z, 3)],
            'max': [round(mx.x, 3), round(mx.y, 3), round(mx.z, 3)],
            'objects': sorted(o.name for o in lib.scene().objects),
        }
        report.append(row)
        print('BUILT %-20s tris=%5d size=%6.1fKB dims=%s' % (key, row['tris'], row['size_kb'], row['dims']))
        if opts['thumbs'] and meta['kind'] != 'char':
            lib.render_thumb(key, direction=THUMB_VIEW.get(key))
        if opts['preview']:
            lib.setup_studio(512, 32)
            for tag, d in (('a', (1.0, -1.25, 0.8)), ('b', (-1.1, 1.0, 0.9)), ('c', (0.0, -1.0, 0.25))):
                lib.frame_camera(direction=d, fill=0.85)
                lib.render_to(os.path.join(lib.OUT_DIR, 'preview', '%s_%s.png' % (key, tag)))
    os.makedirs(lib.OUT_DIR, exist_ok=True)
    out = os.path.join(lib.OUT_DIR, 'machines_build.json')
    prev = []
    if opts['only'] and os.path.exists(out):
        with open(out) as f:
            prev = [r for r in json.load(f) if r['key'] not in opts['only']]
    with open(out, 'w') as f:
        json.dump(prev + report, f, indent=1)
    print('DONE %d models in %.1fs' % (len(report), time.time() - t0))


main()
