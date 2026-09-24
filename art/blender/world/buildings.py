"""Big buildings: office, church, school, golf clubhouse, park pavilion and the player's HQ garage.
Front door faces Blender -Y (three.js +Z, the street).

Run: blender --background --factory-startup --python art/blender/world/buildings.py -- [key prefix ...]
"""
import os
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402


def lancet(b, u, zc, w, h, frame, glass, stained=None, sill=True):
    """Pointed-arch window in a wall frame (see Builder.wall)."""
    top = zc + h / 2
    ft = 0.1
    b.block(u - w / 2 - ft, u + w / 2 + ft, -0.1, 0.06, zc - h / 2 - ft, top, frame)
    b.prism([(u - w / 2 - ft, top), (u + w / 2 + ft, top), (u, top + w * 0.72 + ft)], -0.1, 0.06, frame, axis="y")
    b.block(u - w / 2, u + w / 2, -0.125, -0.08, zc - h / 2, top, glass)
    b.prism([(u - w / 2, top), (u + w / 2, top), (u, top + w * 0.62)], -0.125, -0.08, stained or glass, axis="y")
    b.block(u - 0.03, u + 0.03, -0.15, -0.1, zc - h / 2, top + w * 0.3, frame)
    b.block(u - w / 2, u + w / 2, -0.15, -0.1, zc - 0.03 + h * 0.12, zc + 0.03 + h * 0.12, frame)
    if sill:
        b.block(u - w / 2 - ft - 0.05, u + w / 2 + ft + 0.05, -0.2, 0.06, zc - h / 2 - ft - 0.08, zc - h / 2 - ft, frame)


def clock(b, u, zc, r, face, dark):
    """Round clock face in a wall frame."""
    b.tube(r + 0.12, r - 0.02, 0.12, (u, 0.02, zc), dark, seg=12, rot=(90, 0, 0))
    b.cyl(r, 0.1, (u, 0.03, zc), face, seg=12, rot=(90, 0, 0))
    b.block(u - 0.04, u + 0.04, -0.14, -0.06, zc, zc + r * 0.75, dark)
    b.box((r * 0.55, 0.08, 0.08), (u + r * 0.22, -0.1, zc + r * 0.12), dark, rot=(0, -25, 0))


# ---------------------------------------------------------------- office 30 x 18
def bld_office(b):
    b.recenter = True
    b.mat("Concrete", "#e7e4dd", rough=0.85)
    b.mat("Glass", "#9dcde0", rough=0.08, metal=0.2)
    b.mat("Mullion", "#4b525b", rough=0.5, metal=0.3)
    b.mat("Door", "#3f464f", rough=0.5)
    b.mat("Accent", "#2f6fb0", rough=0.6)
    b.mat("Roof", "#8f949a", rough=0.9)
    b.mat("Metal", "#b9bec4", rough=0.4, metal=0.6)
    b.mat("Foundation", "#a7a39b", rough=0.95)
    b.mat("Dark", "#34383e", rough=0.6)
    b.mat("Leaf", "#5c8f3c", rough=0.9)

    x0, x1, y0, y1 = -14.0, 14.0, -7.6, 7.6
    top = 11.2
    b.block(x0 - 0.3, x1 + 0.3, y0 - 0.3, y1 + 0.3, 0, 0.4, "Foundation")
    b.block(x0, x1, y0, y1, 0.4, top, "Glass")
    for z in (4.0, 7.6):
        b.block(x0 - 0.25, x1 + 0.25, y0 - 0.25, y1 + 0.25, z - 0.25, z + 0.3, "Concrete")
    b.flat_roof(x0, x1, y0, y1, top, "Roof", cap_mat="Concrete", parapet=0.55, lip=0.25, thick=0.35)
    # mullions
    def fins(n, a0, a1, side, plane):
        with b.wall(side, plane):
            for i in range(1, n):
                u = a0 + (a1 - a0) * i / n
                b.block(u - 0.07, u + 0.07, -0.16, 0.0, 0.4, top, "Mullion")
    fins(14, x0, x1, "front", y0)
    fins(14, -x1, -x0, "back", y1)
    fins(8, y0, y1, "right", x1)
    fins(8, -y1, -y0, "left", x0)
    # corner piers
    for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        b.block(x - 0.45, x + 0.45, y - 0.45, y + 0.45, 0.4, top + 0.3, "Concrete")
    # stair tower in the accent color
    b.block(9.0, 12.2, y0 - 0.9, y0 + 0.6, 0.4, top + 1.6, "Accent")
    b.block(8.9, 12.3, y0 - 1.0, y0 + 0.6, top + 1.6, top + 1.8, "Concrete")
    with b.wall("front", y0 - 0.9):
        b.block(10.45, 10.75, -0.05, 0.02, 1.2, top + 1.0, "Glass")
    # entrance canopy and doors
    b.block(-4.6, 4.6, y0 - 2.4, y0, 0, 0.4, "Foundation")
    b.block(-3.8, 3.8, y0 - 2.75, y0 - 2.4, 0, 0.2, "Foundation")
    b.block(-4.6, 4.6, y0 - 2.5, y0 - 0.25, 3.35, 3.7, "Concrete")
    b.block(-4.6, 4.6, y0 - 2.55, y0 - 2.49, 3.38, 3.67, "Accent")
    for x in (-4.1, 4.1):
        b.cyl(0.14, 2.95, (x, y0 - 2.1, 0.4), "Metal", seg=8)
    with b.wall("front", y0):
        b.door(0, 2.4, 2.7, "Door", "Door", glass="Glass", z0=0.4, style="glass", double=True)
        b.door(-2.4, 1.2, 2.7, "Door", "Door", glass="Glass", z0=0.4, style="glass")
        b.door(2.4, 1.2, 2.7, "Door", "Door", glass="Glass", z0=0.4, style="glass")
    # planters
    for sx in (-1, 1):
        a, c = (-12.5, -5.5) if sx < 0 else (5.5, 8.4)
        b.block(a, c, y0 - 1.3, y0 - 0.45, 0, 0.55, "Concrete")
        n = int((c - a) / 0.8)
        for i in range(n):
            b.blob(0.42, (a + 0.4 + i * (c - a - 0.8) / max(1, n - 1), y0 - 0.88, 0.62), "Leaf", subdiv=1,
                   noise=0.15, scale=(1.1, 0.9, 0.8))
    # rooftop plant
    b.block(-9.0, -4.5, -3.5, 1.0, top + 0.35, top + 2.8, "Concrete")
    for (x, y) in ((1.0, -2.0), (5.0, 2.5), (-1.5, 3.5)):
        b.block(x - 1.1, x + 1.1, y - 0.8, y + 0.8, top + 0.35, top + 1.6, "Metal")
        b.cyl(0.5, 0.2, (x, y, top + 1.6), "Dark", seg=10)
    b.block(-12.0, -10.0, 3.0, 5.5, top + 0.35, top + 0.9, "Metal")


# ---------------------------------------------------------------- church 16 x 24
def bld_church(b):
    b.recenter = True
    b.mat("Wall", "#f5f2ea", rough=0.9)
    b.mat("Siding", "#e1dccf", rough=0.9)
    b.mat("Trim", "#ffffff", rough=0.7)
    b.mat("Roof", "#474b56", rough=0.85)
    b.mat("Door", "#a8322b", rough=0.55)
    b.mat("Glass", "#9fc6e4", rough=0.1, metal=0.1)
    b.mat("Stained", "#e6b95a", rough=0.2, emit="#e6b95a", emit_strength=0.15)
    b.mat("Stained2", "#c8574b", rough=0.2)
    b.mat("Foundation", "#a7a195", rough=0.95)
    b.mat("Gold", "#d9b24a", rough=0.3, metal=0.8)
    b.mat("Dark", "#33363c", rough=0.6)

    nx0, nx1, ny0, ny1 = -7.0, 7.0, -7.0, 9.4
    fz, wz = 0.6, 7.0
    b.block(nx0 - 0.08, nx1 + 0.08, ny0 - 0.08, ny1 + 0.08, 0, fz, "Foundation")
    b.block(nx0, nx1, ny0, ny1, fz, wz, "Wall")
    z = fz + 0.5
    while z < wz - 0.2:
        b.block(nx0 - 0.02, nx0 + 0.01, ny0, ny1, z - 0.03, z, "Siding")
        b.block(nx1 - 0.01, nx1 + 0.02, ny0, ny1, z - 0.03, z, "Siding")
        z += 0.5
    b.gable_roof(nx0, nx1, ny0, ny1, wz, 5.2, "Roof", over=0.5, thick=0.25, ridge="y", over_end=0.4, fascia="Trim")
    b.gable_fill(nx0, nx1, ny0, ny1, wz, 5.2, "Wall", ridge="y")
    for (x, y) in ((nx0, ny0), (nx1, ny0), (nx0, ny1), (nx1, ny1)):
        b.block(x - 0.12, x + 0.12, y - 0.12, y + 0.12, fz, wz, "Trim")
    # side windows and buttresses
    for side, plane, sgn in (("right", nx1, 1), ("left", nx0, -1)):
        with b.wall(side, plane):
            for y in (-4.4, -1.2, 2.0, 5.2, 8.0):
                lancet(b, sgn * y, 3.5, 1.1, 2.8, "Trim", "Glass", stained="Stained")
            for y in (-6.4, -2.8, 0.4, 3.6, 6.6):
                u = sgn * y
                b.block(u - 0.25, u + 0.25, -0.5, 0.0, fz, 4.2, "Wall")
                b.prism([(0.0, 4.2), (-0.5, 4.2), (0.0, 4.9)], u - 0.25, u + 0.25, "Roof", axis="x")
    # apse
    ax0, ax1, ay1 = -3.4, 3.4, 11.4
    b.block(ax0 - 0.08, ax1 + 0.08, ny1, ay1 + 0.08, 0, fz, "Foundation")
    b.block(ax0, ax1, ny1 - 0.2, ay1, fz, 5.2, "Wall")
    b.hip_roof(ax0, ax1, ny1 - 0.5, ay1, 5.2, 1.9, "Roof", over=0.35, fascia="Trim", fascia_h=0.14)
    with b.wall("back", ay1):
        for u in (-1.8, 0, 1.8):
            lancet(b, u, 2.9, 0.7, 1.9, "Trim", "Glass", stained="Stained2")
    with b.wall("back", ny1):
        b.tube(1.05, 0.85, 0.12, (0, 0.02, 9.2), "Trim", seg=12, rot=(90, 0, 0))
        b.cyl(0.9, 0.1, (0, 0.03, 9.2), "Stained", seg=12, rot=(90, 0, 0))
        b.block(-0.05, 0.05, -0.12, -0.06, 8.35, 10.05, "Trim")
        b.block(-0.85, 0.85, -0.12, -0.06, 9.15, 9.25, "Trim")
    # front gable windows beside the tower
    with b.wall("front", ny0):
        for u in (-4.8, 4.8):
            lancet(b, u, 3.5, 1.0, 2.6, "Trim", "Glass", stained="Stained")
    # tower
    tx0, tx1, ty0, ty1 = -2.3, 2.3, -11.0, -6.8
    b.block(tx0 - 0.08, tx1 + 0.08, ty0 - 0.08, ty1, 0, fz, "Foundation")
    b.block(tx0, tx1, ty0, ty1, fz, 11.0, "Wall")
    for (x, y) in ((tx0, ty0), (tx1, ty0)):
        b.block(x - 0.12, x + 0.12, y - 0.12, y + 0.12, fz, 11.0, "Trim")
    b.block(tx0 - 0.1, tx1 + 0.1, ty0 - 0.1, ty1 + 0.1, 7.0, 7.25, "Trim")
    b.block(tx0 - 0.15, tx1 + 0.15, ty0 - 0.15, ty1 + 0.15, 10.8, 11.1, "Trim")
    # belfry with louvers
    bx0, bx1, by0, by1 = -1.9, 1.9, -10.6, -7.2
    b.block(bx0, bx1, by0, by1, 11.1, 14.2, "Wall")
    bcy = (by0 + by1) / 2
    for side, plane, uc in (("front", by0, 0.0), ("back", by1, 0.0), ("left", bx0, -bcy), ("right", bx1, bcy)):
        with b.wall(side, plane):
            b.block(uc - 0.9, uc + 0.9, -0.05, 0.02, 11.7, 13.6, "Dark")
            b.prism([(uc - 0.9, 13.6), (uc + 0.9, 13.6), (uc, 14.0)], -0.05, 0.02, "Dark", axis="y")
            for k in range(5):
                zz = 11.9 + k * 0.34
                b.block(uc - 0.9, uc + 0.9, -0.16, -0.04, zz, zz + 0.1, "Trim")
            b.block(uc - 1.05, uc + 1.05, -0.12, 0.02, 11.55, 11.7, "Trim")
    b.block(bx0 - 0.25, bx1 + 0.25, by0 - 0.25, by1 + 0.25, 14.2, 14.5, "Trim")
    for (x, y) in ((bx0, by0), (bx1, by0), (bx0, by1), (bx1, by1)):
        b.cyl(0.24, 1.3, (x, y, 14.5), "Roof", seg=6, r2=0)
    b.cyl(1.75, 8.2, (0, (by0 + by1) / 2, 14.5), "Roof", seg=8, r2=0, phase=0.3927)
    b.uvsphere(0.18, (0, (by0 + by1) / 2, 22.75), "Gold", seg=6, rings=4)
    cy = (by0 + by1) / 2
    b.block(-0.07, 0.07, cy - 0.07, cy + 0.07, 22.8, 24.1, "Gold")
    b.block(-0.4, 0.4, cy - 0.07, cy + 0.07, 23.45, 23.6, "Gold")
    with b.wall("front", ty0):
        b.door(0, 1.8, 2.9, "Door", "Trim", knob="Gold", z0=fz, double=True)
        b.prism([(-1.05, fz + 3.0), (1.05, fz + 3.0), (0, fz + 3.9)], -0.14, 0.06, "Trim", axis="y")
        b.prism([(-0.8, fz + 3.08), (0.8, fz + 3.08), (0, fz + 3.72)], -0.17, -0.12, "Stained", axis="y")
        lancet(b, 0, 6.0, 0.8, 1.6, "Trim", "Glass", stained="Stained")
        clock(b, 0, 9.2, 0.75, "Trim", "Dark")
    # steps
    b.block(-2.6, 2.6, ty0 - 0.8, ty0, 0, fz, "Foundation")
    b.block(-2.2, 2.2, ty0 - 1.2, ty0 - 0.8, 0, 0.3, "Foundation")


# ---------------------------------------------------------------- school 36 x 18
def bld_school(b):
    b.recenter = True
    b.mat("Brick", "#b5583e", rough=0.95)
    b.mat("Trim", "#efe6d1", rough=0.7)
    b.mat("Roof", "#6b6e73", rough=0.9)
    b.mat("Door", "#2d5f93", rough=0.55)
    b.mat("Glass", "#b7dcee", rough=0.1, metal=0.1)
    b.mat("Foundation", "#a7a195", rough=0.95)
    b.mat("Accent", "#f4ead0", rough=0.7)
    b.mat("Sign", "#2d5f93", rough=0.55)
    b.mat("Dark", "#34383e", rough=0.6)
    b.mat("Metal", "#b9bec4", rough=0.4, metal=0.6)

    # center block
    cx0, cx1, cy0, cy1 = -7.5, 7.5, -8.0, 7.4
    cz = 8.6
    b.block(cx0 - 0.08, cx1 + 0.08, cy0 - 0.08, cy1 + 0.08, 0, 0.55, "Foundation")
    b.block(cx0, cx1, cy0, cy1, 0.55, cz, "Brick")
    b.block(cx0 - 0.08, cx1 + 0.08, cy0 - 0.08, cy1 + 0.08, 4.4, 4.62, "Trim")
    b.flat_roof(cx0, cx1, cy0, cy1, cz, "Roof", cap_mat="Trim", parapet=0.55, lip=0.15, thick=0.3)
    # pediment with the clock
    b.prism([(-4.2, cz + 0.85), (4.2, cz + 0.85), (0, cz + 2.4)], cy0 - 0.15, cy0 + 0.35, "Trim", axis="y")
    b.prism([(-3.6, cz + 0.95), (3.6, cz + 0.95), (0, cz + 2.2)], cy0 - 0.2, cy0 + 0.3, "Brick", axis="y")
    with b.wall("front", cy0 - 0.2):
        clock(b, 0, cz + 1.45, 0.42, "Trim", "Dark")
    # wings
    wz = 4.9
    for s in (-1, 1):
        wx0, wx1 = (cx1, 18.0) if s > 0 else (-18.0, cx0)
        wy0, wy1 = -6.6, 6.4
        b.block(wx0, wx1, wy0 - 0.08, wy1 + 0.08, 0, 0.55, "Foundation")
        b.block(wx0, wx1, wy0, wy1, 0.55, wz, "Brick")
        b.flat_roof(wx0, wx1, wy0, wy1, wz, "Roof", cap_mat="Trim", parapet=0.45, lip=0.15, thick=0.28)
        with b.wall("front", wy0):
            for u in (9.4, 11.8, 14.2, 16.6):
                b.window(s * u, 2.55, 1.8, 2.0, "Trim", "Glass", bars="three", top="Trim")
        with b.wall("back", wy1):
            for u in (9.4, 11.8, 14.2, 16.6):
                b.window(-s * u, 2.55, 1.8, 2.0, "Trim", "Glass", bars="three", top="Trim")
        with b.wall("right" if s > 0 else "left", wx1 if s > 0 else wx0):
            for u in (-3.2, 0.0, 3.2):
                b.window(u, 2.55, 1.6, 2.0, "Trim", "Glass", bars="three", top="Trim")
        # rooftop units
        b.block(s * 12.0 - 1.0, s * 12.0 + 1.0, -1.0, 1.0, wz + 0.28, wz + 1.3, "Metal")
        b.cyl(0.45, 0.15, (s * 12.0, 0, wz + 1.3), "Dark", seg=10)
    # center windows
    with b.wall("front", cy0):
        for u in (-5.6, 5.6):
            b.window(u, 2.45, 1.4, 2.1, "Trim", "Glass", bars="cross", top="Trim")
            b.window(u, 6.4, 1.4, 2.0, "Trim", "Glass", bars="cross", top="Trim")
        for u in (-2.6, 0.0, 2.6):
            b.window(u, 6.4, 1.3, 2.0, "Trim", "Glass", bars="cross", top="Trim")
        b.door(0, 2.4, 2.8, "Door", "Trim", knob="Metal", glass="Glass", z0=0.55, double=True)
    with b.wall("back", cy1):
        for u in (-5.2, -2.6, 0.0, 2.6, 5.2):
            b.window(u, 6.4, 1.3, 2.0, "Trim", "Glass", bars="cross")
        for u in (-5.2, -2.6, 2.6, 5.2):
            b.window(u, 2.45, 1.3, 2.0, "Trim", "Glass", bars="cross")
        b.door(0, 1.9, 2.6, "Trim", "Trim", glass="Glass", z0=0.55, double=True)
    # entrance canopy with the school sign
    b.block(-4.2, 4.2, cy0 - 2.1, cy0, 0, 0.55, "Foundation")
    b.block(-3.6, 3.6, cy0 - 2.45, cy0 - 2.1, 0, 0.28, "Foundation")
    for x in (-3.8, -1.6, 1.6, 3.8):
        b.block(x - 0.2, x + 0.2, cy0 - 1.95, cy0 - 1.55, 0.55, 3.6, "Trim")
    b.block(-4.3, 4.3, cy0 - 2.15, cy0, 3.6, 4.3, "Trim")
    b.block(-3.4, 3.4, cy0 - 2.22, cy0 - 2.14, 3.7, 4.2, "Sign")
    # chimney
    b.block(4.4, 5.6, 5.0, 6.2, cz, 11.6, "Brick")
    b.block(4.3, 5.7, 4.9, 6.3, 11.6, 11.8, "Trim")


# ---------------------------------------------------------------- clubhouse 24 x 16
def bld_clubhouse(b):
    b.recenter = True
    b.mat("Wall", "#efe4cb", rough=0.9)
    b.mat("Siding", "#ddd0b3", rough=0.9)
    b.mat("Trim", "#fbf8f0", rough=0.7)
    b.mat("Roof", "#3e5a47", rough=0.8)
    b.mat("Door", "#6e4428", rough=0.55)
    b.mat("Wood", "#a97d52", rough=0.85)
    b.mat("Glass", "#b8dcec", rough=0.1, metal=0.1)
    b.mat("Foundation", "#9e988c", rough=0.95)
    b.mat("Metal", "#2f3136", rough=0.4, metal=0.6)
    b.mat("Gold", "#d9b24a", rough=0.3, metal=0.8)

    x0, x1, y0, y1 = -10.5, 10.5, -4.0, 7.0
    fz, wz = 0.5, 4.6
    b.block(x0 - 0.08, x1 + 0.08, y0, y1 + 0.08, 0, fz, "Foundation")
    b.block(x0, x1, y0, y1, fz, wz, "Wall")
    b.siding(x0, x1, y0, y1, fz, wz, "Siding", step=0.45)
    b.hip_roof(x0, x1, y0, y1, wz, 3.4, "Roof", over=0.6, fascia="Trim", fascia_h=0.2)
    for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        b.block(x - 0.1, x + 0.1, y - 0.1, y + 0.1, fz, wz, "Trim")
    # veranda deck
    vy0 = -8.1
    b.block(-11.3, 11.3, vy0, y0, 0, fz, "Wood")
    b.block(-11.35, 11.35, vy0 - 0.05, vy0 + 0.1, 0, fz - 0.05, "Trim")
    b.block(-1.3, 1.3, vy0 - 0.4, vy0, 0, 0.33, "Wood")
    b.block(-1.3, 1.3, vy0 - 0.75, vy0 - 0.4, 0, 0.16, "Wood")
    # veranda shed roofs left and right, portico gable in the middle
    for s in (-1, 1):
        a, c = (4.32, 11.5) if s > 0 else (-11.5, -4.32)
        b.prism([(y0 + 0.1, 4.28), (y0 + 0.1, 4.45), (vy0 - 0.35, 3.55), (vy0 - 0.35, 3.4)], a, c, "Roof", axis="x")
        for x in ((6.2, 8.7, 11.0) if s > 0 else (-6.2, -8.7, -11.0)):
            b.block(x - 0.1, x + 0.1, vy0 + 0.12, vy0 + 0.32, fz, 3.55, "Trim")
        b.block(a, c, vy0 + 0.12, vy0 + 0.32, 3.35, 3.6, "Trim")
        # railing
        ra, rc = (4.0, 11.0) if s > 0 else (-11.0, -4.0)
        b.block(ra, rc, vy0 + 0.17, vy0 + 0.27, fz + 0.85, fz + 0.93, "Trim")
        b.block(ra, rc, vy0 + 0.17, vy0 + 0.27, fz + 0.1, fz + 0.16, "Trim")
        n = int((rc - ra) / 0.35)
        for i in range(1, n):
            x = ra + (rc - ra) * i / n
            b.block(x - 0.03, x + 0.03, vy0 + 0.19, vy0 + 0.25, fz + 0.16, fz + 0.85, "Trim")
    b.gable_roof(-3.9, 3.9, vy0 + 0.1, 1.5, wz, 2.9, "Roof", over=0.35, thick=0.22, ridge="y", over_end=0.3,
                 fascia="Trim", fascia_to=y0 - 0.7)
    b.gable_fill(-3.9, 3.9, vy0 + 0.1, 1.5, wz, 2.9, "Trim", ridge="y")
    b.block(-3.9, 3.9, vy0 + 0.1, vy0 + 0.4, wz - 0.35, wz, "Trim")
    for x in (-3.5, -1.5, 1.5, 3.5):
        b.block(x - 0.2, x + 0.2, vy0 + 0.05, vy0 + 0.45, fz, fz + 0.2, "Trim")
        b.cyl(0.15, wz - 0.35 - fz - 0.2, (x, vy0 + 0.25, fz + 0.2), "Trim", seg=10)
    with b.wall("front", vy0 + 0.1):
        b.tube(0.62, 0.48, 0.12, (0, 0.02, wz + 1.15), "Trim", seg=12, rot=(90, 0, 0))
        b.cyl(0.5, 0.1, (0, 0.03, wz + 1.15), "Roof", seg=12, rot=(90, 0, 0))
        # golf flag emblem
        b.block(-0.03, 0.03, -0.1, -0.05, wz + 0.8, wz + 1.5, "Trim")
        b.prism([(0.03, wz + 1.5), (0.03, wz + 1.25), (0.33, wz + 1.38)], -0.1, -0.05, "Gold", axis="y")
    # front wall: tall windows and the entry
    with b.wall("front", y0):
        for u in (-9.0, -7.3, -5.6, 5.6, 7.3, 9.0):
            b.window(u, 2.35, 1.1, 2.5, "Trim", "Glass", bars="grid", sill=False)
        for u in (-2.6, 2.6):
            b.window(u, 2.35, 1.2, 2.5, "Trim", "Glass", bars="grid", sill=False)
        b.door(0, 2.0, 2.8, "Door", "Trim", knob="Gold", glass="Glass", z0=fz, double=True)
        b.window(0, fz + 3.35, 2.0, 0.45, "Trim", "Glass", bars="three", sill=False)
    for side, plane, sg in (("left", x0, -1), ("right", x1, 1)):
        with b.wall(side, plane):
            for y in (-1.5, 1.5, 4.5):
                b.window(sg * y, 2.35, 1.2, 2.2, "Trim", "Glass", bars="grid")
    with b.wall("back", y1):
        for u in (-8.4, -6.0, -3.6, 3.6, 6.0, 8.4):
            b.window(u, 2.35, 1.5, 2.5, "Trim", "Glass", bars="cross", sill=False)
        b.door(0, 2.6, 2.7, "Trim", "Trim", glass="Glass", z0=fz, style="glass", double=True)
    b.block(-5.0, 5.0, y1, y1 + 1.2, 0, fz, "Foundation")
    # cupola with a weathervane on the ridge
    ry = (y0 + y1) / 2
    b.block(-0.8, 0.8, ry - 0.8, ry + 0.8, 7.2, 8.9, "Trim")
    for side, plane in (("front", ry - 0.8), ("back", ry + 0.8)):
        with b.wall(side, plane):
            for k in range(4):
                b.block(-0.5, 0.5, -0.08, 0.0, 7.6 + k * 0.28, 7.7 + k * 0.28, "Roof")
    b.hip_roof(-0.8, 0.8, ry - 0.8, ry + 0.8, 8.9, 0.9, "Roof", over=0.2)
    b.block(-0.03, 0.03, ry - 0.03, ry + 0.03, 9.6, 10.6, "Metal")
    b.block(-0.45, 0.35, ry - 0.03, ry + 0.03, 10.3, 10.36, "Metal")
    b.prism([(0.35, 10.2), (0.35, 10.46), (0.55, 10.33)], ry - 0.03, ry + 0.03, "Metal", axis="y")
    # stone chimney
    b.chimney(7.6, 4.2, 1.1, 0.9, 5.0, 9.4, "Foundation", "Foundation")


# ---------------------------------------------------------------- pavilion 10 x 8
def bld_pavilion(b):
    b.recenter = True
    b.mat("Wood", "#9a6a43", rough=0.85)
    b.mat("WoodDark", "#7b5234", rough=0.85)
    b.mat("Roof", "#4f7f55", rough=0.55, metal=0.2)
    b.mat("Concrete", "#bdb8ae", rough=0.95)
    b.mat("Table", "#bf8a55", rough=0.8)
    b.mat("Metal", "#5a5f66", rough=0.4, metal=0.6)

    b.block(-4.8, 4.8, -3.8, 3.8, 0, 0.15, "Concrete")
    xs, ys = (-4.2, 0.0, 4.2), (-3.2, 3.2)
    for x in xs:
        for y in ys:
            b.block(x - 0.22, x + 0.22, y - 0.22, y + 0.22, 0.15, 0.4, "Concrete")
            b.block(x - 0.13, x + 0.13, y - 0.13, y + 0.13, 0.4, 3.0, "Wood")
    for y in ys:
        b.block(-4.45, 4.45, y - 0.12, y + 0.12, 2.75, 3.05, "WoodDark")
    for x in xs:
        b.block(x - 0.12, x + 0.12, -3.45, 3.45, 2.75, 3.05, "WoodDark")
    # knee braces
    for x in xs:
        for y in ys:
            for dx in ((-1, 1) if x == 0 else ((1,) if x < 0 else (-1,))):
                b.box((0.9, 0.1, 0.12), (x + dx * 0.35, y, 2.45), "WoodDark", rot=(0, -dx * 45, 0))
            dy = 1 if y < 0 else -1
            b.box((0.1, 0.9, 0.12), (x, y + dy * 0.35, 2.45), "WoodDark", rot=(dy * 45, 0, 0))
    b.hip_roof(-4.45, 4.45, -3.45, 3.45, 3.05, 1.9, "Roof", over=0.55, fascia="WoodDark", fascia_h=0.2)
    # ridge vent
    b.block(-1.0, 1.0, -0.25, 0.25, 4.85, 5.05, "Roof")
    # picnic tables along y
    for tx in (-2.1, 2.1):
        b.block(tx - 0.42, tx + 0.42, -1.0, 1.0, 0.73, 0.79, "Table")
        for sx in (-1, 1):
            b.block(tx + sx * 0.72 - 0.15, tx + sx * 0.72 + 0.15, -1.0, 1.0, 0.43, 0.48, "Table")
        for y in (-0.7, 0.7):
            b.block(tx - 0.9, tx + 0.9, y - 0.05, y + 0.05, 0.36, 0.43, "WoodDark")
            for sx in (-1, 1):
                b.box((0.08, 0.1, 0.72), (tx + sx * 0.22, y, 0.52), "WoodDark", rot=(0, -sx * 20, 0))
        b.block(tx - 0.35, tx + 0.35, -0.05, 0.05, 0.66, 0.73, "WoodDark")
    # trash can
    b.cyl(0.28, 0.85, (4.0, -2.6, 0.15), "Metal", seg=10)
    b.cyl(0.31, 0.06, (4.0, -2.6, 1.0), "Metal", seg=10)


# ---------------------------------------------------------------- HQ garage 12 x 10
def bld_hq_garage(b):
    b.recenter = True
    b.mat("Wall", "#ece3cc", rough=0.85)
    b.mat("Rib", "#d7cbaf", rough=0.85)
    b.mat("Wainscot", "#5f6d78", rough=0.8)
    b.mat("Trim", "#fbf8f0", rough=0.7)
    b.mat("Roof", "#a8433a", rough=0.7, metal=0.1)
    b.mat("Door", "#3f6f8f", rough=0.55)
    b.mat("GarageDoor", "#e9e9e6", rough=0.6)
    b.mat("Groove", "#c9c9c3", rough=0.7)
    b.mat("Glass", "#bfe3f1", rough=0.12, metal=0.1)
    b.mat("Foundation", "#a7a195", rough=0.95)
    b.mat("Body", "#3f8f4e", rough=0.6)          # sign panel: company color or a name texture (UV mapped)
    b.mat("Accent", "#3f8f4e", rough=0.6)        # badge tuft: company color
    b.mat("Dark", "#34383e", rough=0.6)
    b.mat("Metal", "#c9ccd1", rough=0.35, metal=0.7)
    b.mat("Yellow", "#f2c230", rough=0.6)
    b.mat("Leaf", "#6aa843", rough=0.8)

    x0, x1, y0, y1 = -5.7, 5.7, -4.2, 4.6
    wz = 4.0
    b.block(x0 - 0.1, x1 + 0.1, y0 - 0.5, y1 + 0.1, 0, 0.15, "Foundation")
    b.block(x0, x1, y0, y1, 0.15, wz, "Wall")
    b.block(x0 - 0.04, x1 + 0.04, y0, y1 + 0.04, 0.15, 1.1, "Wainscot")
    b.block(x0 - 0.06, x1 + 0.06, y0, y1 + 0.06, 1.08, 1.16, "Trim")
    # ribbed metal siding on the sides and back
    for side, plane, a0, a1 in (("left", x0, -y1, -y0), ("right", x1, y0, y1), ("back", y1, x0, x1)):
        with b.wall(side, plane):
            n = int((a1 - a0) / 0.55)
            for i in range(1, n):
                u = a0 + (a1 - a0) * i / n
                b.block(u - 0.05, u + 0.05, -0.05, 0.0, 1.16, wz, "Rib")
    b.gable_roof(x0, x1, y0, y1, wz, 1.7, "Roof", over=0.45, thick=0.18, over_end=0.3, fascia="Trim")
    b.gable_fill(x0, x1, y0, y1, wz, 1.7, "Wall")
    # false-front facade carrying the sign
    fx = x1 + 0.35
    b.block(-fx, fx, y0 - 0.5, y0, 0.15, 6.0, "Wall")
    b.block(-2.6, 2.6, y0 - 0.5, y0 - 0.1, 6.0, 6.75, "Wall")
    b.block(-fx - 0.06, fx + 0.06, y0 - 0.58, y0 + 0.02, 6.0, 6.14, "Trim")
    b.block(-2.7, 2.7, y0 - 0.58, y0 - 0.06, 6.75, 6.9, "Trim")
    b.block(-fx - 0.04, fx + 0.04, y0 - 0.54, y0, 0.15, 1.1, "Wainscot")
    b.block(-fx - 0.06, fx + 0.06, y0 - 0.56, y0, 1.08, 1.16, "Trim")
    for x in (-fx, fx):
        b.block(x - 0.1, x + 0.1, y0 - 0.6, y0 - 0.4, 0.15, 6.0, "Trim")
    fy = y0 - 0.5
    b.block(-4.9, 4.9, fy - 0.08, fy, 4.25, 5.95, "Trim")
    panel = b.block(-4.7, 4.7, fy - 0.14, fy - 0.08, 4.4, 5.8, "Body")
    b.uv_panel(panel, normal=(0, -1, 0))
    # badge on the raised center: a grass tuft on a white disc
    with b.wall("front", fy):
        b.cyl(0.36, 0.08, (0, 0.0, 6.43), "Trim", seg=12, rot=(90, 0, 0))
        for (u, hgt, lean) in ((-0.14, 0.42, -12), (0.0, 0.52, 0), (0.14, 0.4, 12)):
            b.prism([(u - 0.06, 6.2), (u + 0.06, 6.2), (u + lean * 0.006, 6.2 + hgt)], -0.12, -0.07, "Accent", axis="y")
    with b.wall("front", fy):
        b.garage_door(-1.6, 4.6, 3.3, "GarageDoor", "Trim", "Groove", panels=8)
        b.block(-4.0, 0.8, -0.4, 0.0, 3.46, 3.85, "Dark")
        b.door(3.35, 0.95, 2.15, "Door", "Trim", knob="Metal", glass="Glass", z0=0.15)
        b.prism([(0.0, 2.72), (0.0, 2.86), (-0.85, 2.5), (-0.85, 2.38)], 2.6, 4.1, "Roof", axis="x")
        b.block(3.3, 3.4, -0.3, 0.0, 2.9, 3.1, "Dark")
        b.block(3.25, 3.45, -0.35, -0.25, 2.85, 2.95, "Yellow")
        b.window(5.0, 1.75, 0.8, 1.0, "Trim", "Glass", bars="cross")
    # bollards and a planter
    for x in (-4.25, 1.05):
        b.cyl(0.11, 0.95, (x, fy - 0.35, 0.0), "Yellow", seg=8)
        b.cyl(0.115, 0.08, (x, fy - 0.35, 0.6), "Dark", seg=8)
    b.block(4.4, 5.8, fy - 0.55, fy - 0.1, 0, 0.45, "Wainscot")
    for i in range(3):
        b.blob(0.3, (4.6 + i * 0.5, fy - 0.33, 0.55), "Leaf", subdiv=1, noise=0.15, scale=(1.0, 0.9, 0.85))
    # sides and back
    with b.wall("left", x0):
        for u in (-1.8, 1.8):
            b.window(u, 2.2, 1.2, 1.0, "Trim", "Glass", bars="cross")
    with b.wall("right", x1):
        b.door(1.5, 0.95, 2.1, "Trim", "Trim", knob="Metal", z0=0.15)
        b.window(-1.6, 2.2, 1.2, 1.0, "Trim", "Glass", bars="cross")
    with b.wall("back", y1):
        b.window(0.0, 2.3, 1.6, 1.0, "Trim", "Glass", bars="cross")
    # roof vents
    for x in (-2.5, 2.5):
        b.cyl(0.22, 0.6, (x, (y0 + y1) / 2 + 0.6, wz + 1.5), "Metal", seg=8)
        b.cyl(0.32, 0.12, (x, (y0 + y1) / 2 + 0.6, wz + 2.1), "Metal", seg=8)


MODELS = {
    "bld_office": bld_office,
    "bld_church": bld_church,
    "bld_school": bld_school,
    "bld_clubhouse": bld_clubhouse,
    "bld_pavilion": bld_pavilion,
    "bld_hq_garage": bld_hq_garage,
}

if __name__ == "__main__":
    lib.run(MODELS)
