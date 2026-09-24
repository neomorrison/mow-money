# Mow Money shop add-ons (display models). Front faces -Y, origin on the ground at the footprint center.
from lib import Part, M, body, material


def addon_stripekit():
    B = body('#2F6FD0')
    p = Part('Addon')
    p.cyl(0.134, 1.0, (0, 0.2, 0.134), M('Steel'), axis='X', verts=20, bevel=0.015)
    for x in (-0.3, 0.0, 0.3):
        p.cyl(0.138, 0.03, (x, 0.2, 0.138), M('Metal'), axis='X', verts=20)
    for s in (-1, 1):
        p.cyl(0.06, 0.05, (s * 0.52, 0.2, 0.134), M('Hub'), axis='X', verts=10)
        p.sweep([(s * 0.55, 0.2, 0.134), (s * 0.55, -0.05, 0.28), (s * 0.5, -0.36, 0.32)], 0.03, B, verts=6,
                rscale=(0.7, 1.0))
        p.box((0.1, 0.16, 0.12), (s * 0.55, 0.02, 0.26), B, bevel=0.03, seg=2, rot=(-30, 0, 0))
        p.bx(s * 0.46, s * 0.54, -0.44, -0.3, 0.26, 0.38, M('Metal'), bevel=0.01)
    p.tube((-0.56, -0.37, 0.32), (0.56, -0.37, 0.32), 0.028, M('Metal'), verts=10)
    p.bx(-0.3, 0.3, 0.02, 0.1, 0.28, 0.33, B, bevel=0.015)
    p.finish()


def addon_sharpener():
    B = body('#D9412B')
    p = Part('Addon')
    p.bx(-0.58, 0.58, -0.3, 0.3, 0.84, 0.9, M('Wood'), bevel=0.012)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.bx(sx * 0.53 - 0.03, sx * 0.53 + 0.03, sy * 0.25 - 0.03, sy * 0.25 + 0.03, 0.0, 0.84, M('Metal'))
    p.bx(-0.53, 0.53, -0.25, 0.25, 0.2, 0.24, M('Metal'), bevel=0.008)
    p.bx(-0.5, 0.5, 0.2, 0.24, 0.5, 0.56, M('Metal'))
    # bench grinder
    gx = -0.2
    p.bx(gx - 0.14, gx + 0.14, -0.1, 0.1, 0.9, 0.96, B, bevel=0.015)
    p.cyl(0.1, 0.26, (gx, 0, 1.06), B, axis='X', verts=16, bevel=0.02)
    p.cyl(0.04, 0.46, (gx, 0, 1.06), M('Metal'), axis='X', verts=8)
    for s in (-1, 1):
        wx = gx + s * 0.2
        p.cyl(0.12, 0.045, (wx, 0, 1.06), M('Stone'), axis='X', verts=18)
        p.box((0.08, 0.2, 0.15), (wx, 0.03, 1.13), M('Metal'), bevel=0.03, seg=2)
        p.bx(wx - 0.035, wx + 0.035, -0.18, -0.1, 0.96, 0.99, M('Metal'))
        p.box((0.1, 0.01, 0.08), (wx, -0.14, 1.2), M('Glass'), rot=(-20, 0, 0))
    p.box((0.05, 0.04, 0.03), (gx, -0.1, 0.93), M('Accent'), bevel=0.008)
    # vise with a clamped mower blade
    vx = 0.3
    p.bx(vx - 0.1, vx + 0.1, -0.08, 0.1, 0.9, 0.96, M('Metal'), bevel=0.01)
    p.bx(vx - 0.09, vx + 0.09, -0.06, -0.01, 0.96, 1.08, B, bevel=0.01)
    p.bx(vx - 0.09, vx + 0.09, 0.03, 0.08, 0.96, 1.08, B, bevel=0.01)
    p.tube((vx, -0.06, 1.0), (vx, -0.2, 1.0), 0.012, M('Chrome'), verts=6)
    p.tube((vx - 0.06, -0.2, 1.0), (vx + 0.06, -0.2, 1.0), 0.01, M('Chrome'), verts=6)
    p.bx(vx - 0.25, vx + 0.25, -0.01, 0.03, 1.06, 1.068, M('Blade'))
    p.bx(vx - 0.27, vx - 0.23, -0.01, 0.03, 1.068, 1.08, M('Blade'))
    p.box((0.5, 0.05, 0.008), (0.24, -0.2, 0.905), M('Blade'), rot=(0, 0, 8))
    p.cyl(0.035, 0.08, (-0.46, -0.16, 0.94), M('Metal'), verts=10, r2=0.005)
    p.finish()


def addon_bagger():
    p = Part('Addon')
    bag = M('Grass Bag')
    seam = material('Seam', '#4C5939', 0.95)
    p.box((0.5, 0.6, 0.4), (0, 0.07, 0.2), bag, bevel=0.08, seg=2, taper=(1.12, 1.1))
    for x in (-0.13, 0.13):
        p.bx(x - 0.008, x + 0.008, -0.25, 0.4, 0.006, 0.41, seam)
    p.bx(-0.3, 0.3, -0.2, 0.36, 0.405, 0.415, seam)
    p.sweep([(-0.29, -0.25, 0.43), (-0.29, 0.41, 0.43), (0.29, 0.41, 0.43), (0.29, -0.25, 0.43)], 0.016, M('Metal'),
            closed=True)
    p.sweep([(-0.2, 0.2, 0.43), (-0.17, 0.2, 0.58), (0.17, 0.2, 0.58), (0.2, 0.2, 0.43)], 0.015, M('Metal'))
    p.cyl(0.025, 0.28, (0, 0.2, 0.58), M('Grip'), axis='X', verts=10)
    # rigid mouth at the front that clips onto the mower
    p.sweep([(-0.2, -0.27, 0.2), (-0.2, -0.27, 0.42), (0.2, -0.27, 0.42), (0.2, -0.27, 0.2)], 0.03, M('Plastic'),
            closed=True, verts=6)
    p.bx(-0.18, 0.18, -0.28, -0.26, 0.22, 0.4, M('Bed'))
    for s in (-1, 1):
        p.box((0.05, 0.08, 0.05), (s * 0.24, -0.26, 0.44), M('Plastic'), bevel=0.012)
    p.finish()


ADDONS = {
    'addon_stripekit': addon_stripekit,
    'addon_sharpener': addon_sharpener,
    'addon_bagger': addon_bagger,
}
