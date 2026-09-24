"""Re-import every exported world GLB and check the contract.

Checks: file exists and is under 300 KB, triangle budget per category, min z ~ 0 (sits on the ground),
origin at the footprint center, footprint close to the target, and for buildings that the front door
(material "Door") is on the -Y side (three.js +Z, the street). Tintable materials must exist.

Run: blender --background --factory-startup --python art/blender/world/verify.py
Writes out/world_verify.json and exits with code 1 on any failure.
"""
import bpy
import json
import os
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

# key: (width X, depth Y) targets in meters for buildings, or None
FOOTPRINTS = {
    "house_ranch": (16, 9), "house_colonial": (12, 10), "house_cottage": (9, 8), "house_modern": (14, 10),
    "house_mansion": (26, 16), "bld_office": (30, 18), "bld_church": (16, 24), "bld_school": (36, 18),
    "bld_clubhouse": (24, 16), "bld_pavilion": (10, 8), "bld_hq_garage": (12, 10),
}
# key: (min, max) height in meters for nature and props
HEIGHTS = {
    "tree_oak": (7, 9), "tree_maple": (6, 9), "tree_pine": (6, 10), "tree_birch": (6, 9), "tree_palm": (6, 9),
    "shrub_round": (0.8, 1.3), "shrub_hedge": (0.9, 1.2), "flowers_cluster": (0.2, 0.6), "rock_small": (0.2, 0.6),
    "rock_big": (0.8, 1.6), "prop_gnome": (0.35, 0.5), "prop_mailbox": (1.1, 1.4), "prop_fence_picket": (0.9, 1.3),
    "prop_fence_iron": (1.2, 1.6), "prop_trampoline": (0.7, 1.1), "prop_kiddie_pool": (0.25, 0.5),
    "prop_swingset": (1.9, 2.6), "prop_bench": (0.8, 1.0), "prop_birdbath": (0.7, 1.0), "prop_sprinkler": (0.08, 0.25),
    "prop_doghouse": (0.9, 1.4), "prop_ball": (0.2, 0.3), "prop_bbq": (1.0, 1.3), "prop_patio_set": (2.0, 2.8),
    "prop_lamppost": (3.0, 4.0), "prop_trashcan": (0.9, 1.2), "prop_yard_sign": (0.6, 0.9),
    "prop_soccer_goal": (1.0, 1.5), "prop_flagpole": (2.2, 2.8), "prop_hose_reel": (0.7, 1.1),
    "prop_wheelbarrow": (0.5, 0.9), "prop_mulch_bag": (0.1, 0.3), "prop_leaf_pile": (0.25, 0.6),
}
# models whose collision circle is centered on the origin (trunk / post / pedestal)
CENTERED_BASE = {"tree_oak", "tree_maple", "tree_pine", "tree_birch", "tree_palm", "prop_lamppost", "prop_birdbath",
                 "prop_mailbox", "prop_flagpole"}
TINTABLE = {"prop_yard_sign": ["Body"], "bld_hq_garage": ["Body"]}
KB_LIMIT = 300


def budget(key):
    if key.startswith("house_"):
        return 5000
    if key.startswith("bld_"):
        return 8000
    if key.startswith(("tree_", "shrub_", "flowers_", "rock_")):
        return 1500
    return 800


def main():
    report = {}
    failures = []
    keys = list(FOOTPRINTS) + list(HEIGHTS)
    for key in keys:
        path = os.path.join(lib.MODELS_DIR, key + ".glb")
        r = {"ok": True, "notes": []}
        report[key] = r

        def fail(msg):
            r["ok"] = False
            r["notes"].append(msg)
            failures.append(key + ": " + msg)

        if not os.path.exists(path):
            fail("missing file")
            continue
        kb = os.path.getsize(path) / 1024
        r["kb"] = round(kb, 1)
        if kb > KB_LIMIT:
            fail("file %.0f KB > %d KB" % (kb, KB_LIMIT))
        lib.reset_scene()
        bpy.ops.import_scene.gltf(filepath=path)
        meshes = [o for o in bpy.data.objects if o.type == "MESH"]
        dg = bpy.context.evaluated_depsgraph_get()
        tris = 0
        xs, ys, zs = [], [], []
        door = []
        mats = set()
        for o in meshes:
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            mw = o.matrix_world
            cos = [mw @ v.co for v in me.vertices]
            xs += [c.x for c in cos]
            ys += [c.y for c in cos]
            zs += [c.z for c in cos]
            for m in me.materials:
                if m:
                    mats.add(m.name.split(".")[0])
            for p in me.polygons:
                m = me.materials[p.material_index] if me.materials else None
                if m and m.name.split(".")[0] == "Door":
                    door.append(mw @ p.center)
            o.evaluated_get(dg).to_mesh_clear()
        w, d, h = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        r.update({"tris": tris, "size": [round(w, 2), round(d, 2), round(h, 2)], "minz": round(min(zs), 3),
                  "center": [round(cx, 2), round(cy, 2)], "materials": sorted(mats)})
        if tris > budget(key):
            fail("%d tris > budget %d" % (tris, budget(key)))
        if abs(min(zs)) > 0.02:
            fail("min z %.3f is not on the ground" % min(zs))
        if key in FOOTPRINTS:
            tw, td = FOOTPRINTS[key]
            if abs(w - tw) / tw > 0.12 or abs(d - td) / td > 0.12:
                fail("footprint %.1f x %.1f far from target %d x %d" % (w, d, tw, td))
            if abs(cx) > 0.05 or abs(cy) > 0.05:
                fail("origin not at the footprint center (%.2f, %.2f)" % (cx, cy))
            if key != "bld_pavilion":
                if not door:
                    fail("no Door material")
                else:
                    dy = sum(c.y for c in door) / len(door)
                    dx = sum(c.x for c in door) / len(door)
                    # three.js space: x stays, z = -y (front door faces +Z)
                    r["door_three_xz"] = [round(dx, 2), round(-min(c.y for c in door), 2)]
                    if dy > cy - 0.15 * d:
                        fail("front door is not on the -Y side (door y %.2f)" % dy)
        if key in HEIGHTS:
            lo, hi = HEIGHTS[key]
            if not (lo <= h <= hi):
                fail("height %.2f outside %.2f..%.2f" % (h, lo, hi))
        if key in CENTERED_BASE:
            base = [(x, y) for x, y, z in zip(xs, ys, zs) if z < 0.3]
            bx = (max(p[0] for p in base) + min(p[0] for p in base)) / 2
            by = (max(p[1] for p in base) + min(p[1] for p in base)) / 2
            if abs(bx) > 0.15 or abs(by) > 0.15:
                fail("base not centered on the origin (%.2f, %.2f)" % (bx, by))
            r["base_radius"] = round(max((x * x + y * y) ** 0.5 for x, y, z in zip(xs, ys, zs) if z < 0.6), 2)
        for m in TINTABLE.get(key, []):
            if m not in mats:
                fail("missing tintable material " + m)
    os.makedirs(lib.OUT_DIR, exist_ok=True)
    with open(os.path.join(lib.OUT_DIR, "world_verify.json"), "w") as f:
        json.dump(report, f, indent=1)
    for key in keys:
        r = report[key]
        print("%-4s %-18s %5s tris %6s KB  %-22s %s" % ("OK" if r["ok"] else "FAIL", key, r.get("tris", "-"),
                                                      r.get("kb", "-"), "x".join(str(v) for v in r.get("size", [])),
                                                      "; ".join(r["notes"])))
    print("VERIFY %s: %d models, %d failures" % ("PASS" if not failures else "FAIL", len(keys), len(failures)))
    sys.stdout.flush()
    if failures:
        os._exit(1)


main()
