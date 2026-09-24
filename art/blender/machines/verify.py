# Re-imports every exported GLB and checks the conventions the game relies on, then renders
# lineup images with char_worker placed on each mower's Driver point and holding each tool.
#
#   blender --background --factory-startup --python art/blender/machines/verify.py -- [--no-render]
#
# Output: a table on stdout, out/machines_verify.json, out/machines_lineup_*.png. Exit code 1 on failure.
import os
import sys
import json
import math

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import lib  # noqa: E402
from mowers import MOWERS  # noqa: E402
from tools import TOOLS, GROUND  # noqa: E402
from addons import ADDONS  # noqa: E402
from vehicles import VEHICLES  # noqa: E402
from people import PEOPLE, HIP  # noqa: E402

MAX_KB = 300
TRI_BUDGET = {'mower': 6000, 'vehicle': 6000, 'tool': 1500, 'addon': 1500, 'char': 3000}
LIMB_NAMES = ['Head', 'Torso', 'ArmL', 'ArmR', 'LegL', 'LegR']


def kinds():
    k = {}
    for key in MOWERS:
        k[key] = 'mower'
    for key in TOOLS:
        k[key] = 'tool'
    for key in ADDONS:
        k[key] = 'addon'
    for key in VEHICLES:
        k[key] = 'vehicle'
    for key in PEOPLE:
        k[key] = 'char'
    return k


def import_glb(key):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lib.MODELS_DIR, key + '.glb'))
    bpy.context.view_layer.update()
    return [o for o in bpy.data.objects if o not in before]


def base(name):
    return name.split('.')[0]


def find(objs, name):
    for o in objs:
        if base(o.name) == name:
            return o
    return None


def verts_world(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def bbox(points):
    xs = [p.x for p in points]
    ys = [p.y for p in points]
    zs = [p.z for p in points]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def material_points(objs, mat_name):
    pts = []
    for o in objs:
        if o.type != 'MESH':
            continue
        me = o.data
        idx = [i for i, m in enumerate(me.materials) if m and base(m.name) == mat_name]
        if not idx:
            continue
        for poly in me.polygons:
            if poly.material_index in idx:
                for vi in poly.vertices:
                    pts.append(o.matrix_world @ me.vertices[vi].co)
    return pts


def check(key, kind):
    lib.reset()
    objs = import_glb(key)
    meshes = [o for o in objs if o.type == 'MESH']
    pts = [p for o in meshes for p in verts_world(o)]
    mn, mx = bbox(pts)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    size_kb = os.path.getsize(os.path.join(lib.MODELS_DIR, key + '.glb')) / 1024
    mats = sorted({base(m.name) for o in meshes for m in o.data.materials if m})
    errs, notes = [], []

    def need(cond, msg):
        if not cond:
            errs.append(msg)

    need(size_kb < MAX_KB, 'file %.0f KB >= %d KB' % (size_kb, MAX_KB))
    need(tris < TRI_BUDGET[kind], 'tris %d over budget %d' % (tris, TRI_BUDGET[kind]))
    for o in objs:
        need(all(abs(a) < 1e-4 for a in o.rotation_euler) if o.rotation_mode != 'QUATERNION'
             else abs(o.rotation_quaternion.angle) < 1e-4, '%s has a rotation' % o.name)
        need(all(abs(s - 1) < 1e-4 for s in o.scale), '%s has a scale' % o.name)
    if kind != 'tool':
        need(abs(mn.z) < 0.01, 'min z %.3f is not on the ground' % mn.z)
    # wheels and reels spin around their own origin
    for o in meshes:
        if base(o.name).startswith(('Wheel', 'Reel')):
            wmn, wmx = bbox(verts_world(o))
            c = (wmn + wmx) / 2
            need((c - o.matrix_world.translation).length < 0.02, '%s origin is off its axle' % o.name)
    if kind == 'mower':
        target = MOWERS[key][1]
        deck = find(meshes, 'Deck')
        need(deck is not None, 'no Deck object')
        if deck:
            dmn, dmx = bbox(verts_world(deck))
            width = dmx.x - dmn.x
            notes.append('deck %.3f m (target %.1f)' % (width, target))
            need(abs(width - target) / target < 0.03, 'deck width %.3f vs %.1f' % (width, target))
            need(abs((dmn.x + dmx.x) / 2) < 0.02 * target, 'deck not centered in x')
            need(abs((dmn.y + dmx.y) / 2) < 0.08 * target, 'deck not centered in y (%.3f)' % ((dmn.y + dmx.y) / 2))
        drv = find(objs, 'Driver')
        need(drv is not None, 'no Driver empty')
        if drv:
            need(drv.matrix_world.translation.y > 0.3, 'Driver is not behind the deck (front must be -Y)')
            notes.append('driver y %.2f z %.2f' % tuple(drv.matrix_world.translation)[1:])
        ch = find(meshes, 'Chassis')
        if ch:
            cp = verts_world(ch)
            top = sorted(cp, key=lambda p: -p.z)[:max(8, len(cp) // 10)]
            need(sum(p.y for p in top) / len(top) > 0, 'tallest parts are in front (front must be -Y)')
        need('Body' in mats, 'no Body material')
    if kind == 'vehicle':
        need(abs((mn.x + mx.x) / 2) < 0.02 and abs((mn.y + mx.y) / 2) < 0.02, 'footprint not centered')
        need('Body' in mats, 'no Body material')
        if key != 'veh_bike':
            lp, tp = material_points(meshes, 'Light'), material_points(meshes, 'TailLight')
            need(lp and tp and sum(p.y for p in lp) / len(lp) < sum(p.y for p in tp) / len(tp),
                 'headlights are not in front of the taillights')
        else:
            fw, rw = find(meshes, 'Wheel_F'), find(meshes, 'Wheel_R')
            need(fw and rw and fw.matrix_world.translation.y < rw.matrix_world.translation.y, 'bike front wheel not at -Y')
    if kind == 'addon':
        need(abs((mn.x + mx.x) / 2) < 0.02 and abs((mn.y + mx.y) / 2) < 0.02, 'footprint not centered')
    if kind == 'tool':
        need(mn.x - 0.05 < 0 < mx.x + 0.05 and mn.y < 0 < mx.y and mn.z < 0 < mx.z + 0.05,
             'grip origin is outside the tool')
        low = sorted(pts, key=lambda p: p.z)[:10]
        need(sum(p.y for p in low) / len(low) < 0, 'working end is not in front (-Y)')
        if key != 'tool_shears':
            need(abs(mn.z - GROUND) < 0.05, 'working end at z %.2f, expected about %.2f' % (mn.z, GROUND))
        notes.append('lowest z %.2f' % mn.z)
    if kind == 'char':
        root = find(objs, key)
        need(root is not None, 'no root node named %s' % key)
        for n in LIMB_NAMES:
            o = find(objs, n)
            need(o is not None, 'missing %s' % n)
            if o is not None and root is not None:
                need(o.parent == root, '%s is not a child of the root' % n)
        ll, lr = find(objs, 'LegL'), find(objs, 'LegR')
        if ll and lr:
            need(ll.matrix_world.translation.x > 0 > lr.matrix_world.translation.x, 'LegL is not on +X')
            need(abs(ll.matrix_world.translation.z - HIP) < 0.01, 'hip pivot height')
        al = find(objs, 'ArmL')
        if al:
            need(abs(al.matrix_world.translation.z - 1.4) < 0.02, 'shoulder pivot height')
        for n in ('HandL', 'HandR'):
            need(find(objs, n) is not None, 'missing %s' % n)
        need(1.7 < mx.z < 1.82, 'height %.2f' % mx.z)
        eyes = material_points(meshes, 'Eye')
        need(eyes and sum(p.y for p in eyes) / len(eyes) < -0.05, 'face is not toward -Y')
    return {
        'key': key, 'kind': kind, 'ok': not errs, 'errors': errs, 'notes': notes, 'tris': tris,
        'size_kb': round(size_kb, 1), 'dims': [round(v, 3) for v in (mx - mn)], 'min_z': round(mn.z, 3),
        'materials': mats, 'nodes': sorted(base(o.name) for o in objs),
    }


# ------------------------------------------------------------------ lineups

def place(objs, offset, rot_z=0.0):
    for o in objs:
        if o.parent is None:
            o.location = o.location + Vector(offset)
            if rot_z:
                o.rotation_mode = 'XYZ'
                o.rotation_euler.z += rot_z


def pose(objs, legs=0.0, arms=0.0, spread=0.0):
    for o in objs:
        n = base(o.name)
        if n in ('LegL', 'LegR'):
            o.rotation_mode = 'XYZ'
            o.rotation_euler.x = math.radians(legs)
            o.rotation_euler.y = math.radians(spread if n == 'LegL' else -spread)
        if n in ('ArmL', 'ArmR'):
            o.rotation_mode = 'XYZ'
            o.rotation_euler.x = math.radians(arms)


def ground_plane(size=80):
    p = lib.Part('Ground')
    p.bx(-size, size, -size, size, -0.02, 0.0, lib.material('Lawn', '#7DBA5A', 0.95))
    return p.finish()


def lineup(keys, path, size=(2400, 900), gap=0.9, riders=True, direction=(0.55, -1.25, 0.75)):
    lib.reset()
    x = 0.0
    all_objs = []
    for key in keys:
        objs = import_glb(key)
        meshes = [o for o in objs if o.type == 'MESH']
        mn, mx = bbox([p for o in meshes for p in verts_world(o)])
        off = Vector((x - mn.x, 0, 0))
        place(objs, off)
        all_objs += objs
        bpy.context.view_layer.update()
        if riders and key.startswith('mower_'):
            drv = find(objs, 'Driver')
            if drv:
                w = import_glb('char_worker')
                seated = key in ('mower_zt48', 'mower_zt60', 'mower_widearea', 'mower_gangreel')
                standon = key == 'mower_standon'
                place(w, drv.matrix_world.translation)
                if seated:
                    pose(w, legs=-78, arms=-45, spread=6)
                elif standon:
                    pose(w, arms=-55)
                else:
                    pose(w, arms=-38)
                all_objs += w
        x += (mx.x - mn.x) + gap
    if not riders:
        for i, key in enumerate(('char_worker', 'char_homeowner')):
            w = import_glb(key)
            place(w, (x + 0.4 + i * 0.9, 0, 0))
            x += 0.6
    ground_plane()
    bpy.context.view_layer.update()
    lib.setup_studio(size[0], 48)
    sc = lib.scene()
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    lib.frame_camera(direction=direction, fill=0.94, aspect=size[0] / size[1],
                     objs=[o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Ground'])
    lib.render_to(path)


def tool_lineup(path, size=(2400, 900)):
    lib.reset()
    x = 0.0
    for key in TOOLS:
        w = import_glb('char_worker')
        place(w, (x, 0, 0))
        bpy.context.view_layer.update()
        hand = find(w, 'HandR')
        t = import_glb(key)
        place(t, hand.matrix_world.translation)
        x += 2.4 if key != 'tool_shears' else 1.2
    ground_plane()
    lib.setup_studio(size[0], 48)
    sc = lib.scene()
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    lib.frame_camera(direction=(1.25, -1.0, 0.55), fill=0.94, aspect=size[0] / size[1],
                     objs=[o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Ground'])
    lib.render_to(path)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    results = [check(k, kind) for k, kind in kinds().items()]
    print()
    print('%-20s %-8s %6s %7s  %-22s %s' % ('model', 'kind', 'tris', 'KB', 'dims x y z (m)', 'result'))
    for r in results:
        print('%-20s %-8s %6d %7.1f  %-22s %s %s' % (
            r['key'], r['kind'], r['tris'], r['size_kb'], ' x '.join('%.2f' % v for v in r['dims']),
            'OK' if r['ok'] else 'FAIL', '; '.join(r['errors'] + r['notes'])))
    os.makedirs(lib.OUT_DIR, exist_ok=True)
    with open(os.path.join(lib.OUT_DIR, 'machines_verify.json'), 'w') as f:
        json.dump(results, f, indent=1)
    bad = [r['key'] for r in results if not r['ok']]
    print('VERIFY %s (%d models, %d failing%s)' % ('PASS' if not bad else 'FAIL', len(results), len(bad),
                                                   ': ' + ', '.join(bad) if bad else ''))
    if '--no-render' not in argv:
        lineup(['mower_reel', 'mower_push', 'mower_selfprop', 'mower_walkbehind', 'mower_zt48'],
               os.path.join(lib.OUT_DIR, 'machines_lineup_small.png'))
        lineup(['mower_standon', 'mower_zt60', 'mower_widearea', 'mower_gangreel'],
               os.path.join(lib.OUT_DIR, 'machines_lineup_big.png'))
        lineup(list(VEHICLES), os.path.join(lib.OUT_DIR, 'machines_lineup_vehicles.png'), riders=False, gap=1.2,
               direction=(1.3, -1.0, 0.7))
        lineup(list(ADDONS), os.path.join(lib.OUT_DIR, 'machines_lineup_addons.png'), riders=False,
               size=(1600, 700))
        tool_lineup(os.path.join(lib.OUT_DIR, 'machines_lineup_tools.png'))
    sys.exit(1 if bad else 0)


main()
