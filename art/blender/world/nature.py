"""Trees, shrubs, flowers and rocks. Faceted low-poly foliage. Trunk (or center) at the origin.

Run: blender --background --factory-startup --python art/blender/world/nature.py -- [key prefix ...]
"""
import math
import os
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402
from mathutils import Vector  # noqa: E402


def trunk_mats(b, bark="#7a5638", bark2="#6a4a30"):
    b.mat("Bark", bark, rough=0.95)
    b.mat("Bark2", bark2, rough=0.95)


def branch(b, p0, p1, r0, r1, mat, seg=6):
    """Tapered cylinder between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    q = d.normalized().to_track_quat("Z", "Y")
    e = q.to_euler()
    b.cyl(r0, d.length, tuple(p0), mat, seg=seg, r2=r1,
          rot=(math.degrees(e.x), math.degrees(e.y), math.degrees(e.z)))


def speckle(b, faces, mat, frac, rng, cond=None):
    """Repaint a random fraction of faces (tonal variation on foliage and rocks)."""
    for f in faces:
        if not f.is_valid:
            continue
        f.normal_update()
        if rng.random() < frac and (cond is None or cond(f)):
            f.material_index = b._mi(mat)


def clamp_ground(b):
    for v in b.bm.verts:
        if v.co.z < 0:
            v.co.z = 0.0


# ---------------------------------------------------------------- trees
def tree_oak(b):
    trunk_mats(b)
    b.mat("Leaf", "#5a8f39", rough=0.9)
    b.mat("Leaf2", "#6ea446", rough=0.9)
    b.mat("Leaf3", "#4c7c31", rough=0.9)
    b.cyl(0.7, 0.45, (0, 0, 0), "Bark", seg=7, r2=0.44)
    b.cyl(0.44, 3.2, (0, 0, 0.45), "Bark", seg=7, r2=0.3)
    branch(b, (0.1, 0, 2.9), (1.6, 0.4, 4.3), 0.17, 0.08, "Bark2")
    branch(b, (-0.1, 0.05, 2.7), (-1.5, -0.5, 4.2), 0.16, 0.08, "Bark2")
    branch(b, (0, -0.1, 3.2), (0.3, -1.4, 4.4), 0.13, 0.07, "Bark2")
    blobs = [
        ((0.0, 0.0, 5.3), 2.6, (1.25, 1.2, 0.8), "Leaf"),
        ((2.4, 0.6, 4.7), 1.8, (1.0, 1.0, 0.82), "Leaf2"),
        ((-2.3, -0.5, 4.8), 1.9, (1.0, 1.0, 0.82), "Leaf"),
        ((0.5, -2.2, 4.9), 1.7, (1.0, 1.0, 0.82), "Leaf2"),
        ((-0.6, 2.3, 5.0), 1.8, (1.0, 1.0, 0.82), "Leaf"),
        ((1.6, 1.8, 5.6), 1.4, (1.0, 1.0, 0.85), "Leaf2"),
        ((0.2, 0.1, 6.6), 1.6, (1.1, 1.0, 0.85), "Leaf2"),
    ]
    faces = []
    for loc, r, sc, m in blobs:
        faces += b.blob(r, loc, m, subdiv=2, scale=sc, noise=0.13)
    speckle(b, faces, "Leaf3", 0.22, b.rng, cond=lambda f: f.normal.z < 0.2)


def tree_maple(b):
    trunk_mats(b, bark="#6f5540", bark2="#5f4735")
    b.mat("Leaf", "#80b03f", rough=0.9)
    b.mat("Leaf2", "#8fbe49", rough=0.9)
    b.mat("Leaf3", "#6e9c35", rough=0.9)
    b.cyl(0.5, 0.35, (0, 0, 0), "Bark", seg=7, r2=0.3)
    b.cyl(0.3, 2.9, (0, 0, 0.35), "Bark", seg=7, r2=0.2)
    branch(b, (0, 0, 2.5), (0.9, 0.3, 3.7), 0.13, 0.07, "Bark2")
    branch(b, (0, 0, 2.7), (-0.8, -0.2, 3.8), 0.12, 0.07, "Bark2")
    faces = b.blob(2.55, (0, 0, 5.0), "Leaf", subdiv=2, scale=(1.0, 1.0, 0.92), noise=0.1)
    for loc, r in (((1.3, -0.9, 5.6), 1.35), ((-1.2, 1.0, 5.5), 1.4), ((-0.9, -1.2, 4.4), 1.3), ((1.1, 1.2, 4.3), 1.25)):
        faces += b.blob(r, loc, "Leaf2", subdiv=2, noise=0.12)
    speckle(b, faces, "Leaf3", 0.25, b.rng, cond=lambda f: f.normal.z < 0.3)


def tree_pine(b):
    trunk_mats(b, bark="#6b4a33")
    b.mat("Needle", "#2f6b40", rough=0.9)
    b.mat("Needle2", "#3b7d4b", rough=0.9)
    b.cyl(0.26, 1.8, (0, 0, 0), "Bark", seg=7, r2=0.18)
    tiers = [(1.1, 2.3, 2.6), (2.35, 1.9, 2.4), (3.55, 1.5, 2.2), (4.7, 1.1, 2.1), (5.8, 0.7, 1.9)]
    for i, (z, r, h) in enumerate(tiers):
        faces = b.cyl(r, h, (0, 0, z), "Needle" if i % 2 == 0 else "Needle2", seg=9, r2=0,
                      phase=b.rng.uniform(0, 1))
        # jitter the rim so each tier looks ragged, droop alternate rim points
        rim = set()
        for f in faces:
            for v in f.verts:
                if abs(v.co.z - z) < 1e-4:
                    rim.add(v)
        for k, v in enumerate(sorted(rim, key=lambda v: math.atan2(v.co.y, v.co.x))):
            s = 1.0 + b.rng.uniform(-0.1, 0.12)
            v.co.x *= s
            v.co.y *= s
            v.co.z -= 0.18 if k % 2 == 0 else 0.0


def tree_birch(b):
    b.mat("Bark", "#f1eee6", rough=0.8)
    b.mat("Mark", "#2f2f33", rough=0.8)
    b.mat("Leaf", "#9cc25a", rough=0.9)
    b.mat("Leaf2", "#b0cf67", rough=0.9)
    b.mat("Leaf3", "#88b04c", rough=0.9)
    trunks = [((0, 0, 0), (0.3, 0.15, 5.4), 0.21), ((0.3, -0.18, 0), (1.15, -0.65, 4.6), 0.16),
              ((-0.25, 0.12, 0), (-0.95, 0.55, 4.8), 0.16)]
    for p0, p1, r in trunks:
        branch(b, p0, p1, r, r * 0.6, "Bark", seg=6)
        p0v, p1v = Vector(p0), Vector(p1)
        for k in range(7):
            t = 0.08 + k * 0.12 + b.rng.uniform(-0.03, 0.03)
            c = p0v.lerp(p1v, t)
            rr = r * (1 - 0.4 * t) + 0.015
            a = b.rng.uniform(0, 6.28)
            # dark lenticel marks wrapped on one side of the trunk
            b.box((rr * 1.5, rr * 0.9, 0.07 + 0.04 * (k % 2)),
                  (c.x + math.cos(a) * rr * 0.5, c.y + math.sin(a) * rr * 0.5, c.z), "Mark",
                  rot=(0, 0, math.degrees(a) + 90))
    faces = []
    for loc, r, m in (((0.35, 0.1, 5.4), 1.45, "Leaf"), ((1.4, -0.75, 4.6), 1.2, "Leaf2"), ((-1.1, 0.65, 4.8), 1.25, "Leaf"),
                      ((0.1, -0.6, 6.4), 1.05, "Leaf2"), ((-0.3, 1.0, 6.1), 1.0, "Leaf"), ((0.9, 0.6, 6.0), 0.9, "Leaf2")):
        faces += b.blob(r, loc, m, subdiv=2, scale=(1.0, 1.0, 1.1), noise=0.16)
    speckle(b, faces, "Leaf3", 0.2, b.rng)
    clamp_ground(b)


def tree_palm(b):
    b.mat("Bark", "#a27a57", rough=0.9)
    b.mat("Bark2", "#8a6446", rough=0.9)
    b.mat("Frond", "#4f933b", rough=0.8, double=True)
    b.mat("Frond2", "#3f7d31", rough=0.8, double=True)
    b.mat("Nut", "#6b4a2c", rough=0.7)
    # curved trunk from stacked frustums
    n = 9
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(Vector((1.1 * t * t, 0.15 * t, 6.6 * t)))
    for i in range(n):
        t = i / n
        r0 = 0.3 - 0.13 * t
        r1 = 0.3 - 0.13 * (i + 1) / n
        branch(b, pts[i], pts[i + 1], r0 + 0.04, r1, "Bark" if i % 2 == 0 else "Bark2", seg=7)
    top = pts[-1] + Vector((0, 0, 0.1))
    b.blob(0.32, tuple(top), "Frond2", subdiv=1, noise=0.1)
    for k in range(3):
        a = k * 2.1 + 0.4
        b.blob(0.15, (top.x + math.cos(a) * 0.25, top.y + math.sin(a) * 0.25, top.z - 0.3), "Nut", subdiv=1, noise=0.1)
    bm = b.bm
    M = b.M
    for k in range(9):
        a = k * 2 * math.pi / 9 + b.rng.uniform(-0.15, 0.15)
        L = 3.1 + b.rng.uniform(-0.3, 0.3)
        lift = 0.75 + b.rng.uniform(-0.15, 0.15)
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-d.y, d.x, 0))
        stations = 7
        rows = []
        for i in range(stations):
            s = L * i / (stations - 1)
            c = top + d * (s * 0.95) + Vector((0, 0, lift * s - 0.3 * s * s))
            w = 0.55 * math.sin(math.pi * min(1.0, (s / L) * 0.95 + 0.05)) ** 0.8
            if i == stations - 1:
                w = 0.0
            droop = Vector((0, 0, -0.35 * w))
            rows.append((bm.verts.new(M @ (c + side * w + droop)), bm.verts.new(M @ c),
                         bm.verts.new(M @ (c - side * w + droop))))
        faces = []
        for i in range(stations - 1):
            l0, c0, r0 = rows[i]
            l1, c1, r1 = rows[i + 1]
            if i == stations - 2:
                faces.append(bm.faces.new((l0, c0, c1)))
                faces.append(bm.faces.new((c0, r0, c1)))
            else:
                faces.append(bm.faces.new((l0, c0, c1, l1)))
                faces.append(bm.faces.new((c0, r0, r1, c1)))
        b._paint(faces, "Frond" if k % 2 == 0 else "Frond2")


# ---------------------------------------------------------------- shrubs and beds
def shrub_round(b):
    b.mat("Leaf", "#4f8a3a", rough=0.9)
    b.mat("Leaf2", "#5f9c45", rough=0.9)
    b.mat("Leaf3", "#437a31", rough=0.9)
    faces = b.blob(0.55, (0, 0, 0.47), "Leaf", subdiv=2, scale=(1.0, 1.0, 0.88), noise=0.12)
    faces += b.blob(0.32, (0.3, -0.22, 0.62), "Leaf2", subdiv=1, noise=0.12)
    faces += b.blob(0.3, (-0.28, 0.2, 0.66), "Leaf2", subdiv=1, noise=0.12)
    speckle(b, faces, "Leaf3", 0.25, b.rng)
    clamp_ground(b)


def shrub_hedge(b):
    b.mat("Leaf", "#447a34", rough=0.9)
    b.mat("Leaf2", "#52893d", rough=0.9)
    b.mat("Leaf3", "#3a6b2d", rough=0.9)
    rng = b.rng
    pts = []
    L, W, H = 1.0, 0.45, 1.0
    for i in range(9):
        x = -L + 2 * L * i / 8
        end = i in (0, 8)
        for (y, z) in ((-W, 0.0), (W, 0.0), (-W - 0.02, 0.45), (W + 0.02, 0.45), (-W + 0.02, 0.82), (W - 0.02, 0.82),
                       (-W * 0.55, H), (W * 0.55, H), (0.0, H + 0.04)):
            jx = 0 if end else rng.uniform(-0.06, 0.06)
            jy = 0 if z == 0 else rng.uniform(-0.05, 0.05)
            jz = 0 if z == 0 else rng.uniform(-0.05, 0.05)
            pts.append((x + jx, y + jy * (1 if y > 0 else -1), z + jz))
    faces = b.hull(pts, "Leaf")
    speckle(b, faces, "Leaf2", 0.35, rng)
    speckle(b, faces, "Leaf3", 0.2, rng)
    clamp_ground(b)


def flowers_cluster(b):
    b.mat("Leaf", "#4f8a3a", rough=0.9)
    b.mat("Leaf2", "#62a046", rough=0.9)
    cols = [("Red", "#e0453e"), ("Yellow", "#f4cf45"), ("Purple", "#9a5fd0"), ("Pink", "#f07fb0"), ("White", "#f7f5ee"),
            ("Orange", "#f29a3a")]
    for n, c in cols:
        b.mat(n, c, rough=0.75)
    b.mat("Center", "#e8b930", rough=0.7)
    b.mat("Center2", "#5a3b22", rough=0.7)
    rng = b.rng
    for (x, y, r) in ((0.0, 0.0, 0.34), (0.3, 0.2, 0.26), (-0.3, 0.18, 0.27), (0.22, -0.28, 0.25), (-0.25, -0.25, 0.26)):
        b.blob(r, (x, y, 0.12), "Leaf" if rng.random() < 0.5 else "Leaf2", subdiv=2, scale=(1.0, 1.0, 0.7), noise=0.15)
    k = 0
    for ring, count, rad in ((0, 1, 0.0), (1, 5, 0.22), (2, 8, 0.42)):
        for i in range(count):
            a = 2 * math.pi * i / count + rng.uniform(-0.2, 0.2) + ring
            x, y = math.cos(a) * rad, math.sin(a) * rad
            z = 0.3 - ring * 0.05 + rng.uniform(-0.03, 0.05)
            name = cols[k % len(cols)][0]
            k += 1
            pr = 0.085 + rng.uniform(-0.01, 0.015)
            b.cyl(pr, 0.035, (x, y, z), name, seg=5, phase=rng.uniform(0, 1), rot=(rng.uniform(-15, 15), rng.uniform(-15, 15), 0))
            b.blob(0.035, (x, y, z + 0.04), "Center" if name != "Yellow" else "Center2", subdiv=1, noise=0.05)
    clamp_ground(b)


# ---------------------------------------------------------------- rocks
def rock_small(b):
    b.mat("Rock", "#8e8b85", rough=0.95)
    b.mat("Rock2", "#a09c95", rough=0.95)
    faces = b.blob(0.32, (0, 0, 0.1), "Rock", subdiv=2, scale=(1.0, 0.78, 0.62), noise=0.2)
    speckle(b, faces, "Rock2", 0.3, b.rng)
    clamp_ground(b)


def rock_big(b):
    b.mat("Rock", "#8a867e", rough=0.95)
    b.mat("Rock2", "#9b978e", rough=0.95)
    b.mat("Moss", "#6f8f45", rough=0.95)
    faces = b.blob(0.85, (0, 0, 0.35), "Rock", subdiv=2, scale=(1.0, 0.8, 0.72), noise=0.18)
    faces += b.blob(0.55, (0.62, 0.3, 0.2), "Rock2", subdiv=2, scale=(1.0, 0.9, 0.75), noise=0.2)
    faces += b.blob(0.38, (-0.7, -0.35, 0.1), "Rock", subdiv=1, noise=0.2)
    speckle(b, faces, "Rock2", 0.25, b.rng)
    for f in faces:
        f.normal_update()
    speckle(b, faces, "Moss", 0.45, b.rng, cond=lambda f: f.normal.z > 0.75)
    clamp_ground(b)


MODELS = {
    "tree_oak": tree_oak,
    "tree_maple": tree_maple,
    "tree_pine": tree_pine,
    "tree_birch": tree_birch,
    "tree_palm": tree_palm,
    "shrub_round": shrub_round,
    "shrub_hedge": shrub_hedge,
    "flowers_cluster": flowers_cluster,
    "rock_small": rock_small,
    "rock_big": rock_big,
}

if __name__ == "__main__":
    lib.run(MODELS)
