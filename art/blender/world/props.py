"""Yard props. Origin on the ground at the footprint center; fronts face Blender -Y (three.js +Z).

Run: blender --background --factory-startup --python art/blender/world/props.py -- [key prefix ...]
"""
import math
import os
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402
from mathutils import Vector  # noqa: E402


def clamp_ground(b):
    for v in b.bm.verts:
        if v.co.z < 0:
            v.co.z = 0.0


def gnome(b):
    b.mat("Coat", "#3a6fc4", rough=0.6)
    b.mat("Hat", "#d8342c", rough=0.5)
    b.mat("Skin", "#f2c29a", rough=0.7)
    b.mat("Beard", "#f7f5ef", rough=0.8)
    b.mat("Boot", "#5a3a22", rough=0.7)
    b.mat("Belt", "#2b2d31", rough=0.6)
    b.mat("Gold", "#e3b53f", rough=0.3, metal=0.7)
    b.mat("Nose", "#e89a86", rough=0.6)
    for x in (-0.045, 0.045):
        b.block(x - 0.035, x + 0.035, -0.06, 0.03, 0.0, 0.04, "Boot")
    b.cyl(0.1, 0.17, (0, 0, 0.035), "Coat", seg=8, r2=0.068)
    b.cyl(0.094, 0.022, (0, 0, 0.085), "Belt", seg=8)
    b.block(-0.018, 0.018, -0.1, -0.085, 0.084, 0.11, "Gold")
    for s in (-1, 1):
        b.rod((s * 0.07, 0, 0.18), (s * 0.1, -0.05, 0.1), 0.026, 0.022, "Coat", seg=6)
        b.uvsphere(0.024, (s * 0.1, -0.055, 0.095), "Skin", seg=6, rings=4)
    b.uvsphere(0.062, (0, 0, 0.235), "Skin", seg=8, rings=6)
    b.uvsphere(0.02, (0, -0.062, 0.232), "Nose", seg=6, rings=4)
    b.cyl(0.058, 0.13, (0, -0.03, 0.235), "Beard", seg=7, r2=0.0, rot=(160, 0, 0))
    b.cyl(0.07, 0.03, (0, 0, 0.268), "Hat", seg=8, r2=0.066)
    b.cyl(0.066, 0.17, (0, 0.005, 0.296), "Hat", seg=8, r2=0.0, rot=(-12, 0, 0))


def mailbox(b):
    b.mat("Wood", "#8a6a4a", rough=0.85)
    b.mat("Box", "#2c3e5c", rough=0.4, metal=0.4)
    b.mat("Flag", "#d8342c", rough=0.5)
    b.mat("Trim", "#e9e6de", rough=0.6)
    b.block(-0.06, 0.06, -0.06, 0.06, 0, 1.0, "Wood")
    b.block(-0.08, 0.08, -0.25, 0.2, 0.93, 1.0, "Wood")
    b.block(-0.03, 0.03, 0.02, 0.1, 0.72, 0.97, "Wood")
    b.block(-0.11, 0.11, -0.25, 0.23, 1.0, 1.12, "Box")
    b.cyl(0.11, 0.48, (0, 0.23, 1.12), "Box", seg=10, rot=(90, 0, 0))
    # door on the street side
    b.block(-0.115, 0.115, -0.27, -0.25, 1.0, 1.12, "Trim")
    b.cyl(0.115, 0.02, (0, -0.25, 1.12), "Trim", seg=10, rot=(90, 0, 0))
    b.block(-0.02, 0.02, -0.29, -0.27, 1.12, 1.17, "Box")
    # flag
    b.block(0.11, 0.13, 0.05, 0.08, 1.02, 1.3, "Flag")
    b.block(0.11, 0.13, -0.06, 0.08, 1.2, 1.3, "Flag")
    # house number plate
    b.block(-0.065, 0.065, -0.075, -0.06, 0.6, 0.7, "Trim")


def fence_picket(b):
    b.mat("Paint", "#f6f4ee", rough=0.7)
    b.mat("Shade", "#dcd8cd", rough=0.8)
    # post at the left end only, so segments tile every 2 m
    b.block(-1.0, -0.9, -0.05, 0.05, 0, 1.1, "Paint")
    b.cyl(0.075, 0.08, (-0.95, 0, 1.1), "Paint", seg=4, r2=0.0, phase=math.pi / 4)
    for z in (0.28, 0.72):
        b.block(-1.0, 1.0, 0.02, 0.07, z, z + 0.08, "Shade")
    n = 9
    for i in range(n):
        x = -0.8 + i * 1.8 / (n - 1) + 0.0
        b.block(x - 0.04, x + 0.04, -0.015, 0.015, 0.05, 0.9, "Paint")
        b.prism([(x - 0.04, 0.9), (x + 0.04, 0.9), (x, 0.98)], -0.015, 0.015, "Paint", axis="y")


def fence_iron(b):
    b.mat("Iron", "#26282c", rough=0.45, metal=0.6)
    b.mat("Gold", "#c9a441", rough=0.35, metal=0.7)
    b.block(-1.0, -0.9, -0.05, 0.05, 0, 1.35, "Iron")
    b.block(-1.02, -0.88, -0.07, 0.07, 1.35, 1.4, "Iron")
    b.uvsphere(0.055, (-0.95, 0, 1.45), "Gold", seg=6, rings=4)
    for z in (0.12, 1.1):
        b.block(-1.0, 1.0, -0.018, 0.018, z, z + 0.04, "Iron")
    n = 15
    for i in range(n):
        x = -0.83 + i * 1.73 / (n - 1)
        b.block(x - 0.013, x + 0.013, -0.013, 0.013, 0.02, 1.22, "Iron")
        b.cyl(0.03, 0.09, (x, 0, 1.22), "Iron", seg=4, r2=0.0, phase=math.pi / 4)
    # scroll rings between the rails
    for i in range(0, n - 1, 2):
        x = -0.83 + (i + 0.5) * 1.73 / (n - 1)
        b.torus(0.045, 0.008, (x, 0, 1.03), "Iron", seg=8, rseg=3, rot=(90, 0, 0))


def trampoline(b):
    b.mat("Frame", "#9aa1a9", rough=0.4, metal=0.7)
    b.mat("Pad", "#2f7fd0", rough=0.6)
    b.mat("Mat", "#26282c", rough=0.8)
    z = 0.85
    for i in range(6):
        a = 2 * math.pi * i / 6
        x, y = math.cos(a) * 1.7, math.sin(a) * 1.7
        b.cyl(0.035, z, (x, y, 0), "Frame", seg=6)
        a2 = a + math.pi / 6
        # W leg base bar on the ground
        b.rod((x, y, 0.03), (math.cos(a2) * 1.7, math.sin(a2) * 1.7, 0.03), 0.03, mat="Frame", seg=4)
    b.torus(1.72, 0.04, (0, 0, z), "Frame", seg=20, rseg=4)
    b.cyl(1.5, 0.03, (0, 0, z - 0.04), "Mat", seg=20)
    b.tube(1.82, 1.45, 0.07, (0, 0, z - 0.01), "Pad", seg=20)


def kiddie_pool(b):
    b.mat("Blue", "#3f9ee0", rough=0.45)
    b.mat("White", "#f4f2ec", rough=0.5)
    b.mat("Water", "#8fd8f4", rough=0.08, metal=0.1)
    b.mat("Duck", "#f6cf3a", rough=0.5)
    b.mat("Beak", "#f0892e", rough=0.5)
    b.cyl(0.84, 0.05, (0, 0, 0), "Blue", seg=16)
    b.torus(0.82, 0.11, (0, 0, 0.11), "Blue", seg=16, rseg=6)
    b.torus(0.82, 0.1, (0, 0, 0.3), "White", seg=16, rseg=6)
    b.cyl(0.78, 0.25, (0, 0, 0.0), "Water", seg=16)
    b.uvsphere(0.07, (0.25, -0.15, 0.28), "Duck", seg=8, rings=5, scale=(1.2, 0.9, 0.7))
    b.uvsphere(0.045, (0.19, -0.15, 0.35), "Duck", seg=8, rings=5)
    b.block(0.12, 0.15, -0.165, -0.135, 0.34, 0.36, "Beak")


def swingset(b):
    b.mat("Frame", "#3f8f4e", rough=0.45, metal=0.5)
    b.mat("Seat", "#d8342c", rough=0.6)
    b.mat("Seat2", "#f2c230", rough=0.6)
    b.mat("Chain", "#9aa1a9", rough=0.4, metal=0.7)
    h = 2.2
    for x in (-1.6, 1.6):
        for y in (-0.85, 0.85):
            b.rod((x, y, 0), (x, 0, h), 0.05, 0.045, "Frame", seg=6)
        b.block(x - 0.03, x + 0.03, -0.45, 0.45, 0.9, 0.95, "Frame")
    b.rod((-1.72, 0, h), (1.72, 0, h), 0.055, mat="Frame", seg=8)
    for x, m in ((-0.65, "Seat"), (0.65, "Seat2")):
        b.block(x - 0.24, x + 0.24, -0.1, 0.1, 0.44, 0.48, m)
        for dx in (-0.21, 0.21):
            b.block(x + dx - 0.012, x + dx + 0.012, -0.012, 0.012, 0.48, h - 0.04, "Chain")


def bench(b):
    b.mat("Wood", "#b0773f", rough=0.8)
    b.mat("Iron", "#2b2d31", rough=0.45, metal=0.6)
    for x in (-0.68, 0.68):
        b.block(x - 0.04, x + 0.04, -0.25, -0.19, 0, 0.44, "Iron")
        b.block(x - 0.04, x + 0.04, 0.16, 0.22, 0, 0.44, "Iron")
        b.block(x - 0.04, x + 0.04, -0.25, 0.24, 0.38, 0.42, "Iron")
        b.box((0.08, 0.06, 0.52), (x, 0.26, 0.66), "Iron", rot=(-12, 0, 0))
        b.block(x - 0.04, x + 0.04, -0.26, 0.2, 0.62, 0.66, "Iron")
        b.block(x - 0.04, x + 0.04, -0.26, -0.2, 0.42, 0.64, "Iron")
    for y in (-0.19, -0.04, 0.11):
        b.block(-0.82, 0.82, y - 0.065, y + 0.065, 0.42, 0.46, "Wood")
    for z in (0.58, 0.76):
        b.box((1.64, 0.035, 0.12), (0, 0.24 + (z - 0.58) * 0.21, z), "Wood", rot=(-12, 0, 0))


def birdbath(b):
    b.mat("Stone", "#b9b4aa", rough=0.9)
    b.mat("Stone2", "#a8a398", rough=0.9)
    b.mat("Water", "#8fd0ee", rough=0.08, metal=0.1)
    b.mat("Bird", "#4a88c8", rough=0.6)
    b.mat("Belly", "#e8834a", rough=0.6)
    b.cyl(0.24, 0.06, (0, 0, 0), "Stone2", seg=8)
    b.cyl(0.14, 0.06, (0, 0, 0.06), "Stone", seg=8, r2=0.09)
    b.cyl(0.075, 0.5, (0, 0, 0.12), "Stone", seg=8, r2=0.085)
    b.cyl(0.1, 0.14, (0, 0, 0.62), "Stone", seg=10, r2=0.4)
    b.tube(0.42, 0.34, 0.04, (0, 0, 0.74), "Stone2", seg=10)
    b.cyl(0.36, 0.02, (0, 0, 0.73), "Water", seg=10)
    # a little bird on the rim
    b.uvsphere(0.05, (0.37, -0.06, 0.83), "Bird", seg=6, rings=4, scale=(1.3, 0.9, 0.9))
    b.uvsphere(0.04, (0.37, -0.07, 0.81), "Belly", seg=6, rings=4, scale=(1.0, 0.8, 0.7))
    b.uvsphere(0.032, (0.31, -0.06, 0.88), "Bird", seg=6, rings=4)
    b.cyl(0.012, 0.03, (0.28, -0.06, 0.88), "Belly", seg=4, r2=0.0, rot=(0, -90, 0))
    b.box((0.08, 0.03, 0.015), (0.44, -0.06, 0.85), "Bird", rot=(0, -25, 0))


def sprinkler(b):
    b.mat("Black", "#1f2124", rough=0.6)
    b.mat("Gray", "#8d9399", rough=0.5)
    b.mat("Cap", "#f2c230", rough=0.5)
    b.cyl(0.075, 0.03, (0, 0, 0), "Black", seg=10)
    b.cyl(0.032, 0.09, (0, 0, 0.03), "Gray", seg=8)
    b.cyl(0.048, 0.04, (0, 0, 0.12), "Black", seg=8)
    b.cyl(0.044, 0.012, (0, 0, 0.16), "Cap", seg=8)
    b.block(-0.012, 0.012, -0.065, -0.04, 0.125, 0.15, "Black")


def doghouse(b):
    b.mat("Wall", "#c2493d", rough=0.8)
    b.mat("Trim", "#f6f4ee", rough=0.7)
    b.mat("Roof", "#4a4f59", rough=0.85)
    b.mat("Dark", "#1d1e22", rough=0.9)
    b.mat("Bowl", "#3f7fd0", rough=0.5)
    b.mat("Food", "#8a5a33", rough=0.9)
    x0, x1, y0, y1 = -0.5, 0.5, -0.6, 0.6
    b.block(x0 - 0.04, x1 + 0.04, y0 - 0.04, y1 + 0.04, 0, 0.08, "Trim")
    b.block(x0, x1, y0, y1, 0.08, 0.72, "Wall")
    b.gable_roof(x0, x1, y0, y1, 0.72, 0.42, "Roof", over=0.1, thick=0.06, ridge="y", over_end=0.1)
    b.gable_fill(x0, x1, y0, y1, 0.72, 0.42, "Wall", ridge="y", thick=0.06)
    for (x, y) in ((x0, y0), (x1, y0)):
        b.block(x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0.08, 0.72, "Trim")
    with b.wall("front", y0):
        b.block(-0.2, 0.2, -0.015, 0.02, 0.08, 0.45, "Dark")
        b.cyl(0.2, 0.035, (0, 0.02, 0.45), "Dark", seg=10, rot=(90, 0, 0))
        b.tube(0.25, 0.2, 0.03, (0, 0.0, 0.45), "Trim", seg=10, rot=(90, 0, 0))
        b.block(-0.13, 0.13, -0.03, 0.0, 0.76, 0.84, "Trim")
    b.cyl(0.11, 0.06, (0.36, -0.82, 0), "Bowl", seg=10, r2=0.13)
    b.cyl(0.1, 0.01, (0.36, -0.82, 0.05), "Food", seg=10)


def ball(b):
    cols = [("Red", "#e0453e"), ("White", "#f7f5ee"), ("Blue", "#3a78d0"), ("White", "#f7f5ee"),
            ("Yellow", "#f4cf45"), ("White", "#f7f5ee"), ("Green", "#4caf50"), ("White", "#f7f5ee")]
    for n, c in cols:
        b.mat(n, c, rough=0.45)
    b.uvsphere(0.125, (0, 0, 0.125), None, seg=8, rings=6, mats=[n for n, _ in cols])


def bbq(b):
    b.mat("Black", "#2b2d31", rough=0.5, metal=0.3)
    b.mat("Steel", "#b9bec4", rough=0.3, metal=0.8)
    b.mat("Red", "#d8342c", rough=0.5)
    b.block(-0.45, 0.45, -0.28, 0.28, 0.15, 0.8, "Black")
    for x in (-0.22, 0.22):
        b.block(x - 0.2, x + 0.2, -0.3, -0.28, 0.22, 0.72, "Steel")
        b.block(x - 0.02 + (0.14 if x < 0 else -0.14), x + 0.02 + (0.14 if x < 0 else -0.14), -0.33, -0.3, 0.4, 0.6, "Black")
    b.block(-0.5, 0.5, -0.32, 0.32, 0.8, 0.9, "Black")
    for x in (-0.25, 0.0, 0.25):
        b.cyl(0.025, 0.03, (x, -0.32, 0.85), "Red", seg=6, rot=(90, 0, 0))
    # lid: half cylinder along x
    prof = [(math.cos(math.pi * i / 6) * 0.3, 0.9 + math.sin(math.pi * i / 6) * 0.26) for i in range(7)]
    b.prism(prof, -0.46, 0.46, "Steel", axis="x")
    b.rod((-0.25, -0.36, 1.02), (0.25, -0.36, 1.02), 0.018, mat="Black", seg=6)
    for x in (-0.25, 0.25):
        b.block(x - 0.015, x + 0.015, -0.36, -0.2, 1.0, 1.03, "Black")
    for s in (-1, 1):
        b.block(s * 0.5, s * 0.78, -0.25, 0.25, 0.84, 0.87, "Steel")
    for x in (-0.36, 0.36):
        b.cyl(0.08, 0.05, (x - 0.025, 0.2, 0.08), "Black", seg=8, rot=(0, 90, 0))
        b.block(x - 0.03, x + 0.03, -0.22, -0.16, 0, 0.15, "Black")


def patio_set(b):
    b.mat("Table", "#f3f1ec", rough=0.5)
    b.mat("Chair", "#3f8f86", rough=0.55)
    b.mat("Metal", "#6f757c", rough=0.4, metal=0.6)
    b.mat("Canopy", "#d8453a", rough=0.7, double=True)
    b.mat("Canopy2", "#f4efe3", rough=0.7, double=True)
    b.cyl(0.25, 0.04, (0, 0, 0), "Metal", seg=8)
    b.cyl(0.04, 0.7, (0, 0, 0.04), "Metal", seg=6)
    b.cyl(0.55, 0.04, (0, 0, 0.72), "Table", seg=12)
    b.cyl(0.022, 1.7, (0, 0, 0.76), "Metal", seg=6)
    # striped umbrella canopy
    bm = b.bm
    apex = bm.verts.new((0, 0, 2.35))
    ring = [bm.verts.new((math.cos(2 * math.pi * i / 8) * 1.25, math.sin(2 * math.pi * i / 8) * 1.25, 1.95))
            for i in range(8)]
    for i in range(8):
        f = bm.faces.new((ring[i], ring[(i + 1) % 8], apex))
        b._paint([f], "Canopy" if i % 2 == 0 else "Canopy2")
    b.uvsphere(0.04, (0, 0, 2.38), "Metal", seg=6, rings=4)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        cx, cy = math.cos(a) * 0.85, math.sin(a) * 0.85
        with b.at((cx, cy, 0), rz=math.degrees(a) + 90):
            # local -y faces the table
            b.block(-0.23, 0.23, -0.23, 0.2, 0.43, 0.48, "Chair")
            for (x, y) in ((-0.2, -0.2), (0.2, -0.2), (-0.2, 0.17), (0.2, 0.17)):
                b.block(x - 0.025, x + 0.025, y - 0.025, y + 0.025, 0, 0.43, "Metal")
            b.box((0.46, 0.04, 0.42), (0, 0.24, 0.7), "Chair", rot=(-10, 0, 0))


def lamppost(b):
    b.mat("Iron", "#26282c", rough=0.45, metal=0.6)
    b.mat("Light", "#ffe7a3", rough=0.3, emit="#ffd98a", emit_strength=1.2)
    b.cyl(0.16, 0.25, (0, 0, 0), "Iron", seg=8, r2=0.12)
    b.cyl(0.06, 2.55, (0, 0, 0.25), "Iron", seg=8, r2=0.045)
    b.torus(0.07, 0.02, (0, 0, 1.2), "Iron", seg=8, rseg=3)
    b.cyl(0.09, 0.06, (0, 0, 2.78), "Iron", seg=8)
    b.cyl(0.1, 0.42, (0, 0, 2.84), "Light", seg=6, r2=0.15)
    for i in range(6):
        a = 2 * math.pi * i / 6 + math.pi / 6
        b.rod((math.cos(a) * 0.1, math.sin(a) * 0.1, 2.84), (math.cos(a) * 0.15, math.sin(a) * 0.15, 3.26), 0.012,
              mat="Iron", seg=4)
    b.cyl(0.2, 0.04, (0, 0, 3.26), "Iron", seg=6)
    b.cyl(0.19, 0.2, (0, 0, 3.3), "Iron", seg=6, r2=0.0)
    b.uvsphere(0.035, (0, 0, 3.53), "Iron", seg=6, rings=4)


def trashcan(b):
    b.mat("Bin", "#3f7d4e", rough=0.6)
    b.mat("Lid", "#2d5c3a", rough=0.6)
    b.mat("Black", "#1f2124", rough=0.7)
    pts = []
    for (w, d, z) in ((0.25, 0.27, 0.06), (0.29, 0.33, 0.98)):
        for sx in (-1, 1):
            for sy in (-1, 1):
                pts.append((sx * w, sy * d, z))
    b.hull(pts, "Bin")
    b.block(-0.31, 0.31, -0.36, 0.34, 0.98, 1.04, "Lid")
    b.block(-0.3, 0.3, -0.39, -0.35, 0.95, 1.03, "Lid")
    b.block(-0.3, 0.3, 0.33, 0.4, 0.92, 1.0, "Black")
    for x in (-0.24, 0.24):
        b.cyl(0.1, 0.06, (x + (0.03 if x > 0 else -0.03), 0.3, 0.1), "Black", seg=10, rot=(0, 90 if x > 0 else -90, 0))
    b.block(-0.26, 0.26, 0.27, 0.33, 0.07, 0.13, "Black")
    # front bands
    for z in (0.35, 0.7):
        b.block(-0.28, 0.28, -0.33, -0.3, z, z + 0.04, "Lid")


def yard_sign(b):
    b.mat("Stake", "#5a5f66", rough=0.4, metal=0.6)
    b.mat("Body", "#2f8f4e", rough=0.6)          # the game tints it (company color)
    for x in (-0.2, 0.2):
        b.block(x - 0.008, x + 0.008, -0.008, 0.008, 0.0, 0.72, "Stake")
    v = b.block(-0.3, 0.3, -0.012, 0.012, 0.32, 0.74, "Body")
    b.uv_panel(v, normal=(0, -1, 0))
    b.uv_panel(v, normal=(0, 1, 0), mirror=True)


def soccer_goal(b):
    b.mat("Frame", "#f4f2ec", rough=0.5)
    b.mat("Net", "#ffffff", rough=0.8, alpha=0.35, double=True)
    w, h, d = 0.9, 1.2, 0.9
    for x in (-w, w):
        b.rod((x, 0, 0), (x, 0, h), 0.035, mat="Frame", seg=6)
        b.rod((x, 0, 0.02), (x, d, 0.02), 0.03, mat="Frame", seg=6)
        b.rod((x, 0, h), (x, d, 0.02), 0.03, mat="Frame", seg=6)
    b.rod((-w - 0.035, 0, h), (w + 0.035, 0, h), 0.035, mat="Frame", seg=6)
    b.rod((-w, d, 0.02), (w, d, 0.02), 0.03, mat="Frame", seg=6)
    # translucent net panels: back slope and the two sides
    b.poly([(-w, 0, h), (w, 0, h), (w, d, 0.02), (-w, d, 0.02)], "Net")
    for x in (-w, w):
        b.poly([(x, 0, 0.02), (x, 0, h), (x, d, 0.02)], "Net")
    # a few net strands
    for i in range(1, 8):
        x = -w + 2 * w * i / 8
        b.rod((x, 0, h), (x, d, 0.02), 0.006, mat="Frame", seg=3)
    for i in range(1, 4):
        t = i / 4
        b.rod((-w, d * t, h * (1 - t) + 0.02 * t), (w, d * t, h * (1 - t) + 0.02 * t), 0.006, mat="Frame", seg=3)


def flagpole(b):
    b.mat("Pole", "#f4f2ec", rough=0.4)
    b.mat("Band", "#d8342c", rough=0.5)
    b.mat("Flag", "#e8412f", rough=0.6, double=True)
    b.mat("Cup", "#f7f7f5", rough=0.5)
    b.tube(0.075, 0.055, 0.015, (0, 0, 0), "Cup", seg=12)
    b.cyl(0.056, 0.004, (0, 0, 0), "Band", seg=12)
    b.cyl(0.013, 2.4, (0, 0, 0.0), "Pole", seg=6)
    for z in (0.2, 0.6, 1.0, 1.4):
        b.cyl(0.0145, 0.2, (0, 0, z), "Band", seg=6)
    b.uvsphere(0.025, (0, 0, 2.42), "Pole", seg=6, rings=4)
    # waving flag
    bm = b.bm
    cols = 5
    L, H, z0 = 0.52, 0.34, 2.02
    grid = []
    for i in range(cols):
        x = L * i / (cols - 1)
        y = 0.05 * math.sin(i * 1.3) * (i / (cols - 1))
        grid.append((bm.verts.new((x + 0.012, y, z0 - 0.02 * i / (cols - 1))),
                     bm.verts.new((x + 0.012, y, z0 + H - 0.03 * i / (cols - 1)))))
    faces = []
    for i in range(cols - 1):
        faces.append(bm.faces.new((grid[i][0], grid[i + 1][0], grid[i + 1][1], grid[i][1])))
    b._paint(faces, "Flag")


def hose_reel(b):
    b.mat("Frame", "#3f8f4e", rough=0.5)
    b.mat("Hose", "#58b04a", rough=0.5)
    b.mat("Black", "#1f2124", rough=0.7)
    b.mat("Nozzle", "#f2c230", rough=0.5)
    zc = 0.42
    for x in (-0.28, 0.28):
        b.hull([(x - 0.02, -0.28, 0.05), (x - 0.02, 0.28, 0.05), (x - 0.02, 0, zc + 0.3),
                (x + 0.02, -0.28, 0.05), (x + 0.02, 0.28, 0.05), (x + 0.02, 0, zc + 0.3)], "Frame")
        b.cyl(0.12, 0.05, (x + (0.02 if x > 0 else -0.07), 0.2, 0.12), "Black", seg=10, rot=(0, 90, 0))
    b.rod((-0.3, 0, zc), (0.3, 0, zc), 0.07, mat="Frame", seg=8)
    for x in (-0.16, 0.0, 0.16):
        b.torus(0.17, 0.065, (x, 0, zc), "Hose", seg=12, rseg=5, rot=(0, 90, 0))
    b.rod((-0.28, 0, zc + 0.3), (-0.28, -0.25, zc + 0.45), 0.02, mat="Frame", seg=5)
    b.rod((0.28, 0, zc + 0.3), (0.28, -0.25, zc + 0.45), 0.02, mat="Frame", seg=5)
    b.rod((-0.3, -0.25, zc + 0.45), (0.3, -0.25, zc + 0.45), 0.025, mat="Black", seg=6)
    # hose tail with a nozzle
    b.rod((0.1, -0.18, 0.3), (0.3, -0.5, 0.04), 0.03, mat="Hose", seg=5)
    b.rod((0.3, -0.5, 0.04), (0.6, -0.55, 0.04), 0.03, mat="Hose", seg=5)
    b.rod((0.6, -0.55, 0.04), (0.78, -0.5, 0.05), 0.035, 0.03, mat="Nozzle", seg=6)
    clamp_ground(b)


def wheelbarrow(b):
    b.mat("Tray", "#d8542e", rough=0.5, metal=0.2)
    b.mat("Wood", "#a97d52", rough=0.8)
    b.mat("Black", "#1f2124", rough=0.7)
    b.mat("Hub", "#9aa1a9", rough=0.4, metal=0.7)
    b.mat("Soil", "#5a3b24", rough=0.95)
    zb, zt = 0.3, 0.62
    b.hull([(-0.2, -0.35, zb), (0.2, -0.35, zb), (-0.22, 0.3, zb), (0.22, 0.3, zb),
            (-0.36, -0.62, zt), (0.36, -0.62, zt), (-0.38, 0.48, zt), (0.38, 0.48, zt)], "Tray")
    b.blob(0.33, (0, -0.06, zt - 0.02), "Soil", subdiv=2, scale=(1.05, 1.55, 0.35), noise=0.15)
    for s in (-1, 1):
        b.rod((s * 0.2, -0.72, 0.2), (s * 0.3, 0.8, 0.56), 0.028, mat="Wood", seg=5)
        b.rod((s * 0.3, 0.8, 0.56), (s * 0.31, 0.96, 0.6), 0.034, mat="Black", seg=5)
        b.rod((s * 0.22, 0.35, 0.33), (s * 0.24, 0.42, 0.0), 0.022, mat="Wood", seg=4)
    b.cyl(0.2, 0.08, (-0.04, -0.72, 0.2), "Black", seg=12, rot=(0, 90, 0))
    b.cyl(0.07, 0.1, (-0.05, -0.72, 0.2), "Hub", seg=8, rot=(0, 90, 0))


def mulch_bag(b):
    b.mat("Bag", "#6a3f2a", rough=0.5)
    b.mat("Label", "#efe3c0", rough=0.6)
    b.mat("Leaf", "#4f9a3e", rough=0.6)
    b.mat("Seam", "#553222", rough=0.6)
    pts = []
    for i in range(7):
        x = -0.45 + 0.9 * i / 6
        end = i in (0, 6)
        t = 0.45 if end else 1.0
        for (y, z) in ((-0.27, 0.0), (0.27, 0.0), (-0.3, 0.05), (0.3, 0.05), (-0.22, 0.13 * t + 0.02),
                       (0.22, 0.13 * t + 0.02), (0.0, 0.16 * t + 0.02)):
            pts.append((x, y * (0.85 if end else 1.0) + b.rng.uniform(-0.01, 0.01), z))
    b.hull(pts, "Bag")
    for x in (-0.47, 0.47):
        b.block(x - 0.025, x + 0.025, -0.26, 0.26, 0.0, 0.06, "Seam")
    b.box((0.4, 0.3, 0.012), (0.02, -0.01, 0.175), "Label")
    for (dx, a) in ((-0.03, 35), (0.03, -35)):
        b.box((0.09, 0.04, 0.012), (0.02 + dx, -0.02, 0.186), "Leaf", rot=(0, 0, a))


def leaf_pile(b):
    cols = [("Orange", "#e0782f"), ("Red", "#c8452f"), ("Yellow", "#e8b43a"), ("Brown", "#9a5f32")]
    for n, c in cols:
        b.mat(n, c, rough=0.9)
    rng = b.rng
    faces = b.blob(0.62, (0, 0, 0.0), "Orange", subdiv=2, scale=(1.0, 0.9, 0.55), noise=0.2)
    faces += b.blob(0.35, (0.35, 0.2, 0.08), "Yellow", subdiv=1, scale=(1.0, 1.0, 0.6), noise=0.2)
    for f in faces:
        f.material_index = b._mi(cols[rng.randrange(4)][0])
    for i in range(10):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.62, 0.95)
        b.box((0.11, 0.07, 0.012), (math.cos(a) * r, math.sin(a) * r, 0.006), cols[i % 4][0],
              rot=(0, 0, rng.uniform(0, 180)))
    clamp_ground(b)


MODELS = {
    "prop_gnome": gnome,
    "prop_mailbox": mailbox,
    "prop_fence_picket": fence_picket,
    "prop_fence_iron": fence_iron,
    "prop_trampoline": trampoline,
    "prop_kiddie_pool": kiddie_pool,
    "prop_swingset": swingset,
    "prop_bench": bench,
    "prop_birdbath": birdbath,
    "prop_sprinkler": sprinkler,
    "prop_doghouse": doghouse,
    "prop_ball": ball,
    "prop_bbq": bbq,
    "prop_patio_set": patio_set,
    "prop_lamppost": lamppost,
    "prop_trashcan": trashcan,
    "prop_yard_sign": yard_sign,
    "prop_soccer_goal": soccer_goal,
    "prop_flagpole": flagpole,
    "prop_hose_reel": hose_reel,
    "prop_wheelbarrow": wheelbarrow,
    "prop_mulch_bag": mulch_bag,
    "prop_leaf_pile": leaf_pile,
}

if __name__ == "__main__":
    lib.run(MODELS)
