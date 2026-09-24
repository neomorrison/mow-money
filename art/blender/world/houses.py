"""Residential houses. Front door faces Blender -Y (three.js +Z, the street).

Run: blender --background --factory-startup --python art/blender/world/houses.py -- [key prefix ...]

Material names are shared across houses so the game can recolor variants:
Wall, Trim, Roof, Door (front door only), Accent (shutters), Glass, Foundation.
"""
import os
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402


def common(b, wall, roof, door, accent=None, trim="#fbf8f0"):
    b.recenter = True
    b.mat("Wall", wall, rough=0.9)
    b.mat("Trim", trim, rough=0.7)
    b.mat("Roof", roof, rough=0.9)
    b.mat("Door", door, rough=0.55)
    b.mat("Glass", "#bfe3f1", rough=0.12, metal=0.1)
    b.mat("Foundation", "#a69f93", rough=0.95)
    b.mat("Metal", "#d8b04a", rough=0.35, metal=0.7)
    b.mat("DoorBack", door, rough=0.55)
    if accent:
        b.mat("Accent", accent, rough=0.8)


# ---------------------------------------------------------------- ranch 16 x 9
def house_ranch(b):
    common(b, wall="#f0d28a", roof="#5a5e6a", door="#2e7f86", accent="#4d6b57")
    b.mat("Brick", "#a9573f", rough=0.95)
    b.mat("Stone", "#b58c6b", rough=0.95)
    b.mat("GarageDoor", "#f4f1ea", rough=0.7)
    b.mat("Groove", "#d6d0c3", rough=0.8)
    b.mat("Dark", "#3b3f46", rough=0.6)

    mx0, mx1, my0, my1 = -7.5, 2.2, -3.6, 3.9
    fz, wz = 0.3, 3.0
    b.block(mx0 - 0.06, mx1, my0 - 0.06, my1 + 0.06, 0, fz, "Foundation")
    b.block(mx0, mx1, my0, my1, fz, wz, "Wall")
    gx0, gx1, gy0, gy1 = 2.2, 7.5, -4.0, 3.4
    gz = 2.9
    b.block(gx0, gx1 + 0.06, gy0 - 0.06, gy1 + 0.06, 0, 0.14, "Foundation")
    b.block(gx0, gx1, gy0, gy1, 0.14, gz, "Wall")
    # corner trim
    for (x, y) in ((mx0, my0), (mx0, my1), (gx1, gy0), (gx1, gy1)):
        b.block(x - 0.08, x + 0.08, y - 0.08, y + 0.08, 0.1, wz if x == mx0 else gz, "Trim")

    b.hip_roof(mx0, mx1, my0, my1, wz, 1.7, "Roof", over=0.45, fascia="Trim", fascia_h=0.16)
    b.gable_roof(gx0, gx1, gy0, gy1, gz, 1.45, "Roof", over=0.4, thick=0.2, ridge="y", over_end=0.3, fascia="Trim")
    b.gable_fill(gx0, gx1, gy0, gy1, gz, 1.45, "Wall", ridge="y")
    b.chimney(-5.4, 1.4, 0.9, 0.9, 3.6, 5.4, "Brick", "Foundation")

    # front of the main house
    door_x = -2.3
    with b.wall("front", my0):
        b.window(-5.3, 1.8, 2.4, 1.3, "Trim", "Glass", bars="three", shutters="Accent")
        b.door(door_x, 1.0, 2.15, "Door", "Trim", knob="Metal", glass="Glass", z0=fz)
        b.window(0.5, 1.85, 1.2, 1.2, "Trim", "Glass", bars="cross", shutters="Accent")
        # stone wainscot, split around the door
        b.block(mx0 - 0.02, door_x - 0.62, -0.07, 0.01, fz, 0.95, "Stone")
        b.block(door_x + 0.62, mx1, -0.07, 0.01, fz, 0.95, "Stone")
        b.block(mx0 - 0.02, door_x - 0.62, -0.1, 0.0, 0.93, 1.0, "Trim")
        b.block(door_x + 0.62, mx1, -0.1, 0.0, 0.93, 1.0, "Trim")
        b.block(door_x + 0.72, door_x + 0.86, -0.12, 0.0, 1.85, 2.1, "Dark")
    # stoop and entry hood
    b.block(door_x - 1.0, door_x + 1.0, my0 - 1.25, my0, 0, fz, "Foundation")
    b.block(door_x - 0.75, door_x + 0.75, my0 - 1.55, my0 - 1.25, 0, 0.15, "Foundation")
    for px in (door_x - 0.85, door_x + 0.85):
        b.block(px - 0.08, px + 0.08, my0 - 1.18, my0 - 1.02, fz, 2.62, "Trim")
    b.block(door_x - 0.95, door_x + 0.95, my0 - 1.2, my0, 2.5, 2.64, "Trim")
    b.gable_roof(door_x - 0.95, door_x + 0.95, my0 - 1.2, my0, 2.64, 0.6, "Roof", over=0.12, thick=0.14,
                 ridge="y", over_end=0.1)
    b.gable_fill(door_x - 0.95, door_x + 0.95, my0 - 1.2, my0, 2.64, 0.6, "Trim", ridge="y")

    # garage front
    gcx = (gx0 + gx1) / 2
    with b.wall("front", gy0):
        b.garage_door(gcx, 4.0, 2.25, "GarageDoor", "Trim", "Groove", glass="Glass", panels=4)
        b.block(gcx - 0.4, gcx + 0.4, -0.08, 0.0, 3.25, 3.75, "Trim")
        for k in range(3):
            b.block(gcx - 0.34, gcx + 0.34, -0.11, -0.07, 3.33 + 0.13 * k, 3.38 + 0.13 * k, "Groove")
        for lx in (gcx - 2.45, gcx + 2.45):
            b.block(lx - 0.08, lx + 0.08, -0.14, 0.0, 1.9, 2.15, "Dark")
    # sides and back
    with b.wall("left", mx0):
        b.window(1.6, 1.85, 1.1, 1.2, "Trim", "Glass", bars="cross")
        b.window(-1.8, 1.85, 1.1, 1.2, "Trim", "Glass", bars="cross")
    with b.wall("back", my1):
        b.window(6.0, 1.85, 1.3, 1.2, "Trim", "Glass", bars="cross")
        b.door(3.4, 1.7, 2.1, "Trim", "Trim", glass="Glass", z0=fz, style="glass")
        b.block(3.35, 3.45, -0.09, -0.04, fz + 0.1, fz + 2.0, "Trim")
        b.window(0.6, 1.85, 1.1, 1.2, "Trim", "Glass", bars="cross")
    with b.wall("back", gy1):
        b.window(-4.9, 1.8, 1.2, 1.0, "Trim", "Glass", bars="cross")
    with b.wall("right", gx1):
        b.door(1.2, 0.9, 2.05, "DoorBack", "Trim", knob="Metal", z0=0.14)
        b.window(-1.9, 1.75, 1.0, 1.0, "Trim", "Glass", bars="cross")


# ---------------------------------------------------------------- colonial 12 x 10
def house_colonial(b):
    common(b, wall="#f3efe5", roof="#4a4f59", door="#b3392f", accent="#2f3d37")
    b.mat("Brick", "#a3533d", rough=0.95)
    b.mat("Siding", "#ddd7ca", rough=0.9)

    x0, x1, y0, y1 = -5.6, 5.6, -4.0, 4.4
    fz, z2, wz = 0.45, 3.35, 6.2
    b.block(x0 - 0.06, x1 + 0.06, y0 - 0.06, y1 + 0.06, 0, fz, "Brick")
    b.block(x0, x1, y0, y1, fz, wz, "Wall")
    b.siding(x0, x1, y0, y1, fz, wz, "Siding", step=0.42)
    b.block(x0 - 0.07, x1 + 0.07, y0 - 0.07, y1 + 0.07, z2 - 0.1, z2 + 0.1, "Trim")
    for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        b.block(x - 0.1, x + 0.1, y - 0.1, y + 0.1, fz, wz, "Trim")
    b.gable_roof(x0, x1, y0, y1, wz, 2.9, "Roof", over=0.4, thick=0.22, over_end=0.3, fascia="Trim")
    b.gable_fill(x0, x1, y0, y1, wz, 2.9, "Wall")
    b.block(x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, wz - 0.22, wz, "Trim")
    for cx in (-4.5, 4.5):
        b.chimney(cx, 0.2, 1.0, 0.8, 7.0, 9.8, "Brick", "Foundation")

    with b.wall("front", y0):
        for u in (-4.4, -2.2, 2.2, 4.4):
            b.window(u, 4.8, 1.0, 1.55, "Trim", "Glass", bars="grid", shutters="Accent")
            b.window(u, 1.95, 1.0, 1.6, "Trim", "Glass", bars="grid", shutters="Accent")
        b.window(0, 5.05, 0.9, 1.2, "Trim", "Glass", bars="grid", shutters="Accent")
        b.door(0, 1.1, 2.3, "Door", "Trim", knob="Metal", z0=fz)
        for u in (-0.93, 0.93):
            b.window(u, fz + 1.12, 0.26, 2.0, "Trim", "Glass", bars="none", sill=False, ft=0.07)
        b.window(0, fz + 2.78, 1.9, 0.36, "Trim", "Glass", bars="three", sill=False, ft=0.08)
    # portico
    b.block(-1.75, 1.75, y0 - 1.1, y0, 0, fz, "Brick")
    b.block(-1.4, 1.4, y0 - 1.45, y0 - 1.1, 0, 0.23, "Brick")
    for cx in (-1.45, 1.45):
        b.block(cx - 0.18, cx + 0.18, y0 - 1.03, y0 - 0.67, fz, fz + 0.12, "Trim")
        b.cyl(0.13, 3.28 - fz - 0.12, (cx, y0 - 0.85, fz + 0.12), "Trim", seg=10)
        b.block(cx - 0.18, cx + 0.18, y0 - 1.03, y0 - 0.67, 3.18, 3.28, "Trim")
    b.block(-1.75, 1.75, y0 - 1.1, y0, 3.28, 3.52, "Trim")
    b.gable_roof(-1.75, 1.75, y0 - 1.1, y0, 3.52, 0.6, "Roof", over=0.12, thick=0.14, ridge="y", over_end=0.12)
    b.gable_fill(-1.75, 1.75, y0 - 1.1, y0, 3.52, 0.6, "Trim", ridge="y")

    for side, plane in (("left", x0), ("right", x1)):
        with b.wall(side, plane):
            for u in (-2.0, 2.0):
                b.window(u, 4.8, 0.95, 1.45, "Trim", "Glass", bars="grid")
                b.window(u, 1.95, 0.95, 1.5, "Trim", "Glass", bars="grid")
            b.window(0, 7.2, 0.7, 0.8, "Trim", "Glass", bars="cross")
    with b.wall("back", y1):
        for u in (-4.4, -2.2, 0.0, 2.2, 4.4):
            b.window(u, 4.8, 0.95, 1.45, "Trim", "Glass", bars="grid")
        for u in (-4.4, -2.2, 2.2, 4.4):
            b.window(u, 1.95, 0.95, 1.5, "Trim", "Glass", bars="grid")
        b.door(0, 1.0, 2.2, "DoorBack", "Trim", knob="Metal", glass="Glass", z0=fz)
    b.block(-0.9, 0.9, y1, y1 + 0.9, 0, fz, "Brick")


# ---------------------------------------------------------------- cottage 9 x 8
def house_cottage(b):
    common(b, wall="#c3d6ab", roof="#9a4e3b", door="#e2b13e", accent="#7b5a3e")
    b.mat("Stone", "#a39d91", rough=0.95)
    b.mat("Wood", "#b88a5d", rough=0.85)
    b.mat("Leaf", "#5c8f3c", rough=0.9)
    b.mat("Pink", "#ec7fa6", rough=0.8)
    b.mat("Red", "#d9463f", rough=0.8)
    b.mat("Yellow", "#f4d04a", rough=0.8)

    x0, x1, y0, y1 = -4.1, 4.1, -2.2, 3.4
    fz, wz, rise = 0.35, 3.2, 3.1
    b.block(x0 - 0.06, x1 + 0.06, y0 - 0.06, y1 + 0.06, 0, fz, "Stone")
    b.block(x0, x1, y0, y1, fz, wz, "Wall")
    b.gable_roof(x0, x1, y0, y1, wz, rise, "Roof", over=0.38, thick=0.24, over_end=0.32, fascia="Trim")
    b.gable_fill(x0, x1, y0, y1, wz, rise, "Wall")
    for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        b.block(x - 0.08, x + 0.08, y - 0.08, y + 0.08, fz, wz, "Trim")

    # front cross gable bay
    bx0, bx1, by0 = -3.5, -0.9, -3.3
    b.block(bx0 - 0.06, bx1 + 0.06, by0 - 0.06, y0, 0, fz, "Stone")
    b.block(bx0, bx1, by0, y0 + 0.2, fz, wz, "Wall")
    for x in (bx0, bx1):
        b.block(x - 0.08, x + 0.08, by0 - 0.08, by0 + 0.08, fz, wz, "Trim")
    b.gable_roof(bx0, bx1, by0, 0.6, wz, 2.5, "Roof", over=0.3, thick=0.2, ridge="y", over_end=0.3, fascia="Trim",
                 fascia_to=y0 - 0.25)
    b.gable_fill(bx0, bx1, by0, 0.6, wz, 2.5, "Wall", ridge="y")
    bcx = (bx0 + bx1) / 2
    with b.wall("front", by0):
        b.window(bcx, 1.75, 1.4, 1.3, "Trim", "Glass", bars="cross")
        # flower box
        b.block(bcx - 0.85, bcx + 0.85, -0.38, 0.0, 0.72, 0.98, "Accent")
        for i, m in enumerate(("Pink", "Red", "Yellow", "Pink", "Red", "Yellow")):
            fx = bcx - 0.68 + i * 0.27
            b.blob(0.12, (fx, -0.2, 1.02), "Leaf", subdiv=1, noise=0.15)
            b.blob(0.075, (fx + 0.03, -0.26, 1.12), m, subdiv=1, noise=0.1)
        # octagonal attic window
        b.tube(0.42, 0.3, 0.1, (bcx, 0.02, 4.25), "Trim", seg=8, rot=(90, 0, 0))
        b.cyl(0.31, 0.06, (bcx, 0.03, 4.25), "Glass", seg=8, rot=(90, 0, 0))
        b.block(bcx - 0.02, bcx + 0.02, -0.09, -0.01, 3.95, 4.55, "Trim")
        b.block(bcx - 0.3, bcx + 0.3, -0.09, -0.01, 4.23, 4.27, "Trim")

    # porch with a shed roof tucked under the main eave
    px0, px1, py0 = -0.7, 3.8, -3.55
    b.block(px0, px1, py0, y0, 0, fz, "Wood")
    b.block(0.55, 1.85, py0 - 0.32, py0, 0, 0.18, "Wood")
    for x in (px0 + 0.12, px1 - 0.12):
        b.block(x - 0.08, x + 0.08, py0 + 0.04, py0 + 0.2, fz, 2.42, "Trim")
    b.block(px0, px1, py0 + 0.02, py0 + 0.22, 2.32, 2.46, "Trim")
    b.prism([(y0 + 0.02, 2.78), (y0 + 0.02, 2.93), (py0 - 0.28, 2.49), (py0 - 0.28, 2.36)],
            px0 - 0.18, px1 + 0.18, "Roof", axis="x")
    # railing on both sides of the steps
    for a, c in ((px0 + 0.2, 0.5), (1.9, px1 - 0.2)):
        b.block(a, c, py0 + 0.07, py0 + 0.15, fz + 0.78, fz + 0.86, "Trim")
        b.block(a, c, py0 + 0.07, py0 + 0.15, fz + 0.1, fz + 0.16, "Trim")
        n = int((c - a) / 0.22)
        for i in range(1, n):
            x = a + (c - a) * i / n
            b.block(x - 0.025, x + 0.025, py0 + 0.08, py0 + 0.14, fz + 0.16, fz + 0.78, "Trim")
    with b.wall("front", y0):
        b.door(1.2, 0.95, 2.0, "Door", "Trim", knob="Metal", glass="Glass", z0=fz)
        b.window(2.95, 1.6, 0.85, 1.05, "Trim", "Glass", bars="cross", shutters="Accent")
    # dormer above the porch
    dx0, dx1 = 1.0, 2.3
    b.block(dx0, dx1, -1.8, 0.2, 3.4, 5.05, "Wall")
    b.gable_roof(dx0, dx1, -1.8, 0.2, 5.05, 0.7, "Roof", over=0.13, thick=0.14, ridge="y", over_end=0.15)
    b.gable_fill(dx0, dx1, -1.8, 0.2, 5.05, 0.7, "Wall", ridge="y")
    with b.wall("front", -1.8):
        b.window((dx0 + dx1) / 2, 4.35, 0.6, 0.7, "Trim", "Glass", bars="cross", sill=False)
    # stone chimney
    b.chimney(3.0, 1.9, 0.9, 0.8, 4.0, 7.0, "Stone", "Stone")

    for side, plane in (("left", x0), ("right", x1)):
        with b.wall(side, plane):
            b.window(0.6, 1.75, 0.9, 1.1, "Trim", "Glass", bars="cross", shutters="Accent")
            b.window(0.6, 4.5, 0.6, 0.75, "Trim", "Glass", bars="cross")
    with b.wall("back", y1):
        b.window(2.4, 1.75, 1.0, 1.1, "Trim", "Glass", bars="cross")
        b.door(0.0, 0.9, 2.0, "DoorBack", "Trim", knob="Metal", glass="Glass", z0=fz)
        b.window(-2.4, 1.75, 1.0, 1.1, "Trim", "Glass", bars="cross")
    b.block(-0.7, 0.7, y1, y1 + 0.7, 0, fz, "Stone")


# ---------------------------------------------------------------- modern 14 x 10
def house_modern(b):
    b.recenter = True
    b.mat("Wall", "#efefea", rough=0.85)
    b.mat("Trim", "#393c42", rough=0.6)
    b.mat("Roof", "#4a4d53", rough=0.9)
    b.mat("Door", "#7b5235", rough=0.6)
    b.mat("DoorBack", "#393c42", rough=0.6)
    b.mat("Glass", "#b9dcea", rough=0.1, metal=0.15)
    b.mat("Foundation", "#b5b2ac", rough=0.95)
    b.mat("Accent", "#b7814e", rough=0.75)   # wood cladding
    b.mat("Slat", "#8e5f36", rough=0.8)
    b.mat("Leaf", "#5e8f3e", rough=0.9)
    b.mat("Solar", "#2b3f63", rough=0.25, metal=0.3)
    b.mat("Metal", "#c9ccd1", rough=0.3, metal=0.8)

    fz = 0.25
    # ground floor (white, recessed under the cantilever)
    ax0, ax1, ay0, ay1 = -7.0, 1.6, -3.0, 5.0
    b.block(ax0 - 0.05, ax1, ay0 - 0.05, ay1 + 0.05, 0, fz, "Foundation")
    b.block(ax0, ax1, ay0, ay1, fz, 3.4, "Wall")
    # wood volume
    bx0, bx1, by0, by1 = 1.6, 7.0, -3.6, 3.8
    b.block(bx0, bx1 + 0.05, by0 - 0.05, by1 + 0.05, 0, fz, "Foundation")
    b.block(bx0, bx1, by0, by1, fz, 3.4, "Accent")
    z = fz + 0.3
    while z < 3.3:
        b.block(bx0 + 0.9, bx1 + 0.02, by0 - 0.02, by0 + 0.01, z, z + 0.04, "Slat")
        b.block(bx1 - 0.01, bx1 + 0.02, by0, by1, z, z + 0.04, "Slat")
        b.block(bx0, bx1 + 0.02, by1 - 0.01, by1 + 0.02, z, z + 0.04, "Slat")
        z += 0.32
    b.block(bx0 - 0.1, bx1 + 0.15, by0 - 0.15, by1 + 0.15, 3.4, 3.62, "Trim")
    # cantilevered upper floor
    cx0, cx1, cy0, cy1 = -7.2, 3.2, -4.3, 4.6
    b.block(cx0, cx1, cy0, cy1, 3.4, 6.5, "Wall")
    b.block(cx0 - 0.12, cx1 + 0.12, cy0 - 0.12, cy1 + 0.12, 6.5, 6.8, "Trim")
    b.block(cx0 + 0.3, cx1 - 0.3, cy0 + 0.3, cy1 - 0.3, 6.8, 6.84, "Roof")
    b.block(cx0 - 0.02, cx1 + 0.02, cy0 - 0.02, cy1 + 0.02, 3.34, 3.44, "Trim")
    # solar panels
    for i in range(3):
        for j in range(2):
            sx = -5.8 + i * 1.9
            sy = -1.8 + j * 2.0
            b.box((1.7, 1.1, 0.06), (sx, sy, 7.1), "Solar", rot=(12, 0, 0))
            b.block(sx - 0.05, sx + 0.05, sy + 0.3, sy + 0.4, 6.84, 7.05, "Metal")

    def glass_wall(u0, u1, z0, z1, n, frame="Trim"):
        b.block(u0, u1, -0.04, 0.05, z0, z1, "Glass")
        t = 0.08
        b.block(u0 - t, u0, -0.1, 0.05, z0, z1, frame)
        b.block(u1, u1 + t, -0.1, 0.05, z0, z1, frame)
        b.block(u0 - t, u1 + t, -0.1, 0.05, z1, z1 + t, frame)
        b.block(u0 - t, u1 + t, -0.1, 0.05, z0 - t, z0, frame)
        for i in range(1, n):
            u = u0 + (u1 - u0) * i / n
            b.block(u - 0.03, u + 0.03, -0.08, -0.03, z0, z1, frame)

    with b.wall("front", ay0):
        glass_wall(-6.5, -1.0, fz + 0.1, 3.0, 4)
    with b.wall("front", cy0):
        glass_wall(-6.8, -0.9, 4.0, 5.9, 4)
        b.block(-0.5, 2.9, -0.06, 0.0, 3.5, 6.4, "Accent")
        for i in range(8):
            u = -0.3 + i * 0.44
            b.block(u - 0.04, u + 0.04, -0.1, -0.05, 3.5, 6.4, "Slat")
    with b.wall("front", by0):
        b.door(2.5, 1.1, 2.45, "Door", "Trim", z0=fz, style="flat")
        b.block(2.85, 2.9, -0.2, -0.05, fz + 0.7, fz + 1.9, "Metal")
        glass_wall(3.2, 3.6, fz + 0.1, fz + 2.55, 1)
        glass_wall(4.3, 6.6, 0.95, 2.95, 2)
    # entry landing and planter
    b.block(1.7, 3.9, by0 - 0.9, by0, 0, 0.18, "Foundation")
    b.block(4.1, 6.9, by0 - 0.75, by0 - 0.2, 0, 0.5, "Foundation")
    for i in range(5):
        b.blob(0.33, (4.4 + i * 0.55, by0 - 0.47, 0.55), "Leaf", subdiv=1, noise=0.15, scale=(1.1, 0.9, 0.8))
    # sides and back
    with b.wall("left", cx0):
        glass_wall(-2.5, -1.7, 3.8, 6.1, 1)
        glass_wall(1.7, 2.5, 3.8, 6.1, 1)
    with b.wall("left", ax0):
        glass_wall(-1.0, 1.0, 1.0, 2.8, 2)
    with b.wall("right", bx1):
        glass_wall(-1.5, 1.5, 1.0, 2.8, 2)
    with b.wall("back", ay1):
        glass_wall(-1.0, 6.4, fz + 0.1, 3.0, 5)
    with b.wall("back", cy1):
        glass_wall(-2.8, 6.6, 4.1, 5.8, 6)
    with b.wall("back", by1):
        glass_wall(-6.5, -3.5, 0.95, 2.95, 2)


# ---------------------------------------------------------------- mansion 26 x 16
def house_mansion(b):
    common(b, wall="#e6d2a8", roof="#4f5866", door="#2b4460", trim="#fbf7ee")
    b.mat("Brick", "#a5563f", rough=0.95)
    b.mat("Stone", "#bdb3a2", rough=0.95)

    fz = 0.6
    # center block
    cx0, cx1, cy0, cy1 = -6.2, 6.2, -6.0, 6.2
    cz = 8.2
    b.block(cx0 - 0.1, cx1 + 0.1, cy0 - 0.1, cy1 + 0.1, 0, fz, "Stone")
    b.block(cx0, cx1, cy0, cy1, fz, cz, "Wall")
    b.block(cx0 - 0.08, cx1 + 0.08, cy0 - 0.08, cy1 + 0.08, 4.3, 4.5, "Trim")
    b.hip_roof(cx0, cx1, cy0, cy1, cz, 3.0, "Roof", over=0.5, fascia="Trim", fascia_h=0.32)
    # quoins on the front corners (one block wraps each corner)
    for x in (cx0, cx1):
        sx = 1 if x > 0 else -1
        z = fz + 0.05
        k = 0
        while z < cz - 0.5:
            w = 0.6 if k % 2 == 0 else 0.38
            b.block(min(x - sx * w, x + sx * 0.06), max(x - sx * w, x + sx * 0.06), cy0 - 0.06, cy0 + w,
                    z, z + 0.46, "Trim")
            z += 0.6
            k += 1
    # wings
    wz = 6.6
    for s in (-1, 1):
        wx0, wx1 = (cx1, 12.6) if s > 0 else (-12.6, cx0)
        wy0, wy1 = -4.6, 5.4
        b.block(wx0, wx1, wy0 - 0.1, wy1 + 0.1, 0, fz, "Stone")
        if s > 0:
            b.block(wx1, wx1 + 0.1, wy0 - 0.1, wy1 + 0.1, 0, fz, "Stone")
        else:
            b.block(wx0 - 0.1, wx0, wy0 - 0.1, wy1 + 0.1, 0, fz, "Stone")
        b.block(wx0, wx1, wy0, wy1, fz, wz, "Wall")
        b.block(wx0, wx1 + (0.08 if s > 0 else 0), wy0 - 0.08, wy1 + 0.08, 3.55, 3.72, "Trim")
        if s < 0:
            b.block(wx0 - 0.08, wx0, wy0 - 0.08, wy1 + 0.08, 3.55, 3.72, "Trim")
        b.hip_roof(wx0 - (0.5 if s > 0 else 0), wx1 + (0.5 if s < 0 else 0), wy0, wy1, wz, 2.3, "Roof",
                   over=0.45, fascia="Trim", fascia_h=0.26)
        # dormer
        dcx = s * 9.4
        b.block(dcx - 0.75, dcx + 0.75, -4.45, -2.4, 6.4, 8.0, "Wall")
        b.gable_roof(dcx - 0.75, dcx + 0.75, -4.45, -2.4, 8.0, 0.8, "Roof", over=0.14, thick=0.15, ridge="y", over_end=0.15)
        b.gable_fill(dcx - 0.75, dcx + 0.75, -4.45, -2.4, 8.0, 0.8, "Trim", ridge="y")
        with b.wall("front", -4.45):
            b.window(dcx, 7.35, 0.7, 0.8, "Trim", "Glass", bars="cross", sill=False)
        b.chimney(s * 11.3, 2.2, 1.0, 1.0, 6.5, 9.9, "Brick", "Stone")
        with b.wall("front", wy0):
            for u in (7.8, 9.4, 11.0):
                b.window(s * u, 2.15, 1.05, 1.75, "Trim", "Glass", bars="cross", top="Trim")
                b.window(s * u, 5.1, 1.05, 1.45, "Trim", "Glass", bars="cross")
        with b.wall("right" if s > 0 else "left", wx1 if s > 0 else wx0):
            for u in (-2.0, 2.0):
                b.window(u, 2.15, 1.0, 1.6, "Trim", "Glass", bars="cross")
                b.window(u, 5.1, 1.0, 1.4, "Trim", "Glass", bars="v")
        with b.wall("back", wy1):
            for u in (7.8, 11.0):
                b.window(-s * u, 2.15, 1.0, 1.6, "Trim", "Glass", bars="v")
                b.window(-s * u, 5.1, 1.0, 1.4, "Trim", "Glass", bars="v")
    for cxx in (-4.0, 4.0):
        b.chimney(cxx, 3.6, 1.1, 0.9, 9.0, 12.2, "Brick", "Stone")

    # portico
    py0 = -8.0
    b.block(-4.2, 4.2, py0, cy0, 0, fz, "Stone")
    b.block(-3.6, 3.6, py0 - 0.35, py0, 0, 0.4, "Stone")
    b.block(-3.3, 3.3, py0 - 0.7, py0 - 0.35, 0, 0.2, "Stone")
    for x in (-3.3, -1.1, 1.1, 3.3):
        b.block(x - 0.38, x + 0.38, -7.93, -7.17, fz, fz + 0.22, "Trim")
        b.cyl(0.27, 7.2 - fz - 0.22, (x, -7.55, fz + 0.22), "Trim", seg=12, r2=0.23)
        b.block(x - 0.38, x + 0.38, -7.93, -7.17, 7.2, 7.45, "Trim")
    b.block(-4.2, 4.2, py0, cy0, 7.45, 8.2, "Trim")
    b.gable_roof(-4.2, 4.2, py0, -2.4, 8.2, 1.6, "Roof", over=0.2, thick=0.25, ridge="y", over_end=0.18)
    b.gable_fill(-4.2, 4.2, py0, cy0, 8.2, 1.6, "Trim", ridge="y")
    with b.wall("front", cy0):
        b.door(0, 1.9, 3.0, "Door", "Trim", knob="Metal", z0=fz, double=True)
        b.window(0, fz + 3.55, 1.9, 0.5, "Trim", "Glass", bars="three", sill=False)
        b.window(0, 6.35, 1.1, 1.6, "Trim", "Glass", bars="cross")
        for u in (-2.3, 2.3):
            b.window(u, 2.45, 1.2, 2.1, "Trim", "Glass", bars="cross", top="Trim")
            b.window(u, 6.35, 1.1, 1.7, "Trim", "Glass", bars="cross")
        for u in (-5.2, 5.2):
            b.window(u, 2.45, 1.15, 2.1, "Trim", "Glass", bars="cross", top="Trim")
            b.window(u, 6.35, 1.1, 1.7, "Trim", "Glass", bars="cross", top="Trim")
    with b.wall("back", cy1):
        for u in (-4.2, -1.4, 1.4, 4.2):
            b.window(u, 6.35, 1.1, 1.7, "Trim", "Glass", bars="v")
        for u in (-4.2, 4.2):
            b.window(u, 2.45, 1.1, 2.0, "Trim", "Glass", bars="v")
        b.door(0, 2.4, 2.6, "DoorBack", "Trim", glass="Glass", z0=fz, style="glass", double=True)
    b.block(-3.0, 3.0, cy1, cy1 + 2.4, 0, fz, "Stone")


MODELS = {
    "house_ranch": house_ranch,
    "house_colonial": house_colonial,
    "house_cottage": house_cottage,
    "house_modern": house_modern,
    "house_mansion": house_mansion,
}

if __name__ == "__main__":
    lib.run(MODELS)
