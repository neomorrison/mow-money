"""Render a preview tile for each exported GLB (imports the GLB, so it checks the real file).

Usage: blender --background --factory-startup --python art/blender/world/sheet.py -- <prefix> [<prefix> ...]
Tiles go to out/world_tiles/<key>.png, then compose_sheet.py (system Python + PIL) lays them out.
Optional flag: --back renders from behind (checks the back side), --top renders from above.
"""
import bpy
import math
import os
import sys
from mathutils import Vector

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

TILE = 420


def setup_scene():
    lib.reset_scene()
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = TILE
    sc.render.resolution_y = TILE
    sc.render.film_transparent = False
    try:
        sc.view_settings.view_transform = "Standard"
        sc.view_settings.look = "None"
    except Exception:
        pass
    try:
        sc.eevee.taa_render_samples = 16
    except Exception:
        pass
    world = bpy.data.worlds.new("World")
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (*lib.hex_rgb("#cfe2ee"), 1)
    bg.inputs[1].default_value = 0.9
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 3.6
    sun_data.angle = math.radians(8)
    sun_data.color = (1.0, 0.96, 0.9)
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(-18), math.radians(-35))
    sc.collection.objects.link(sun)
    gm = lib.make_material("Ground", "#a9c98a", rough=1.0)
    me = bpy.data.meshes.new("ground")
    s = 200
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    me.materials.append(gm)
    g = bpy.data.objects.new("Ground", me)
    sc.collection.objects.link(g)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("Cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def frame(cam, objs, az_deg, el_deg):
    pts = []
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (lo + hi) / 2
    az, el = math.radians(az_deg), math.radians(el_deg)
    d = Vector((-math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    dist = (hi - lo).length * 3 + 10
    cam.location = ctr + d * dist
    rot = (-d).to_track_quat("-Z", "Y")
    cam.rotation_euler = rot.to_euler()
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    cs = [inv @ c for c in corners]
    minx, maxx = min(c.x for c in cs), max(c.x for c in cs)
    miny, maxy = min(c.y for c in cs), max(c.y for c in cs)
    cam.data.ortho_scale = max(maxx - minx, maxy - miny) * 1.12
    cam.location = cam.matrix_world @ Vector(((minx + maxx) / 2, (miny + maxy) / 2, 0))
    cam.data.clip_end = dist * 3
    return hi - lo


def main():
    args = lib.parse_args()
    back = "--back" in args
    top = "--top" in args
    prefixes = [a for a in args if not a.startswith("--")]
    files = sorted(f[:-4] for f in os.listdir(lib.MODELS_DIR) if f.endswith(".glb"))
    keys = [k for k in files if not prefixes or any(k.startswith(p) for p in prefixes)]
    out = os.path.join(lib.OUT_DIR, "world_tiles")
    os.makedirs(out, exist_ok=True)
    for key in keys:
        cam = setup_scene()
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(lib.MODELS_DIR, key + ".glb"))
        objs = [o for o in bpy.data.objects if o not in before]
        az = 30 + (180 if back else 0)
        el = 70 if top else 24
        size = frame(cam, objs, az, el)
        sc = bpy.context.scene
        suffix = "_back" if back else ("_top" if top else "")
        if "--nospec" in args:
            for m in bpy.data.materials:
                n = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
                if n:
                    n.inputs["Specular IOR Level"].default_value = 0.0
            suffix += "_nospec"
        sc.render.filepath = os.path.join(out, key + suffix + ".png")
        bpy.ops.render.render(write_still=True)
        with open(os.path.join(out, key + suffix + ".txt"), "w") as f:
            f.write("%.1f x %.1f x %.1f m" % (size.x, size.y, size.z))
        print("TILE", key, tuple(round(v, 2) for v in size))


main()
