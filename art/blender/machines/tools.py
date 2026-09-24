# Mow Money hand tools. Front faces -Y. Each tool is posed as it is held while working, with the
# origin at the main grip (the right hand). With the grip at char_worker hand height (HandR empty,
# about 0.83 m above the ground) the working end reaches the ground in front of the character.
# Object: one mesh named Tool (plus a HandL empty on two-handed tools marking the second hand).
import math
from mathutils import Vector
from lib import Part, M, body, material, empty

GROUND = -0.83  # ground height relative to the grip


def shaft_points(E, H):
    E, H = Vector(E), Vector(H)
    return E, H, (H - E)


def at(E, d, t):
    return tuple(E + d * t)


def tool_shears():
    B = body('#D9412B')
    p = Part('Tool')
    # built flat along -Y, then pitched down 30 degrees
    for s in (-1, 1):
        p.box((0.036, 0.15, 0.032), (s * 0.032, 0.07, 0.0), B, bevel=0.012, seg=2, rot=(0, 0, s * 4))
        p.cyl(0.02, 0.03, (s * 0.034, 0.15, 0.0), B, verts=10)
    p.cyl(0.024, 0.05, (0, -0.03, 0), M('Metal'), verts=10)
    for s, z in ((-1, 0.007), (1, -0.007)):
        p.prism([(0.0, -0.01), (0.034 * s, -0.05), (0.012 * s, -0.38), (-0.006 * s, -0.33), (-0.012 * s, -0.05)],
                0.012, M('Steel'), axis='Z', center=z, rot=(0, 0, -s * 5))
        p.prism([(0.03 * s, -0.04), (0.034 * s, -0.05), (0.014 * s, -0.36), (0.01 * s, -0.35)], 0.012,
                M('Metal'), axis='Z', center=z, rot=(0, 0, -s * 5))
    p.transform(rot=(30, 0, 0))
    p.finish()


def trimmer(pro):
    B = body('#D9412B' if pro else '#F08A24')
    p = Part('Tool')
    E = Vector((0, 0.2, 0.12))
    H = Vector((0, -1.42, GROUND + 0.05)) if pro else Vector((0, -1.28, GROUND + 0.05))
    d = H - E
    ang = math.degrees(math.atan2(-d.z, -d.y))
    dn = d.normalized()
    # shaft
    p.tube(E, H + Vector((0, 0.04, 0.03)), 0.019 if not pro else 0.022, M('Metal'), verts=8)
    # engine behind the grip
    ec = E - dn * 0.15 + Vector((0, 0, 0.03))
    size = (0.22, 0.3, 0.24) if pro else (0.19, 0.27, 0.21)
    p.box(size, tuple(ec), B, bevel=0.055, seg=2, rot=(ang, 0, 0))
    p.box((size[0] * 0.8, size[1] * 0.7, 0.1), tuple(ec + Vector((0, 0.02, -0.14))), material('Tank', '#EDE8D8', 0.4),
          bevel=0.03, seg=2, rot=(ang, 0, 0))
    p.cyl(0.08, 0.05, tuple(ec + Vector((size[0] / 2 + 0.02, 0.0, 0.0))), M('Plastic'), axis='X', verts=12,
          bevel=0.015)
    p.box((0.05, 0.04, 0.04), tuple(ec + Vector((size[0] / 2 + 0.05, 0.02, 0.02))), M('Grip'), bevel=0.01)
    p.box((size[0] * 0.7, size[1] * 0.5, 0.06), tuple(ec + Vector((0, -0.02, size[2] / 2 + 0.02))), M('Plastic'),
          bevel=0.02, rot=(ang, 0, 0))
    # rear grip at the origin with a trigger
    p.tube(at(E, d, 0.07), at(E, d, 0.2), 0.031, M('Grip'), verts=10)
    p.box((0.02, 0.06, 0.05), (0, -0.02, -0.04), M('Accent'), rot=(ang, 0, 0))
    # front handle
    c = Vector(at(E, d, 0.42 if not pro else 0.36))
    if pro:
        p.box((0.07, 0.07, 0.07), tuple(c), M('Plastic'), bevel=0.015)
        pts = [c + Vector(v) for v in ((-0.34, 0.08, 0.2), (-0.22, 0.03, 0.1), (0, 0, 0.05), (0.22, 0.03, 0.1),
                                       (0.34, 0.08, 0.2))]
        p.sweep(pts, 0.017, M('Metal'))
        for s in (-1, 1):
            p.tube(c + Vector((s * 0.26, 0.05, 0.14)), c + Vector((s * 0.36, 0.09, 0.22)), 0.028, M('Grip'))
        empty('HandL', tuple(c + Vector((0.31, 0.07, 0.18))))
    else:
        pts = [c + Vector(v) for v in ((-0.06, 0, 0.0), (-0.09, 0, 0.12), (-0.05, 0, 0.21), (0.05, 0, 0.21),
                                       (0.09, 0, 0.12), (0.06, 0, 0.0))]
        p.sweep(pts, 0.018, M('Grip'), closed=True)
        empty('HandL', tuple(c + Vector((0, 0, 0.21))))
    # cutting head at the ground
    p.cyl(0.035, 0.1, tuple(H + Vector((0, 0.03, 0.04))), M('Metal'), axis='Y', verts=8, rot=(ang, 0, 0))
    hr = 0.085 if pro else 0.07
    p.cyl(hr, 0.06, tuple(H), M('Plastic'), verts=14, bevel=0.012)
    p.cyl(0.03, 0.02, tuple(H + Vector((0, 0, -0.04))), M('Metal'), verts=10)
    p.box((0.44 if pro else 0.36, 0.008, 0.008), tuple(H + Vector((0, 0, -0.01))), M('Line'))
    p.box((0.008, 0.2 if pro else 0.16, 0.008), tuple(H + Vector((0, 0, -0.012))), M('Line'), rot=(0, 0, 20))
    gr = 0.23 if pro else 0.19
    p.prism([(math.cos(math.radians(a)) * gr, H.y + 0.02 + math.sin(math.radians(a)) * gr) for a in range(0, 181, 20)],
            0.018, B, axis='Z', center=H.z + 0.07)
    p.sweep([(math.cos(math.radians(a)) * gr, H.y + 0.02 + math.sin(math.radians(a)) * gr, H.z + 0.05)
             for a in range(0, 181, 20)], 0.018, B, verts=6)
    if pro:  # edger guide wheel
        p.box((0.03, 0.14, 0.03), tuple(H + Vector((0.16, 0.08, 0.06))), M('Metal'))
        p.cyl(0.06, 0.03, tuple(H + Vector((0.18, 0.02, 0.01))), M('Tire'), axis='X', verts=12)
    p.finish()


def tool_trimmer():
    trimmer(False)


def tool_trimmer_pro():
    trimmer(True)


def tool_broom():
    B = body('#2F6FD0')
    p = Part('Tool')
    top = Vector((0, 0.3, 0.19))
    head = Vector((0, -1.1, GROUND + 0.13))
    d = head - top
    ang = math.degrees(math.atan2(-d.z, -d.y))
    p.tube(top, head, 0.02, M('Wood'), verts=10)
    p.cyl(0.024, 0.07, tuple(top), B, verts=10, rot=(ang, 0, 0), axis='Y')
    p.box((0.63, 0.03, 0.02), tuple(head + Vector((0, -0.03, 0.035))), B)
    hc = head + Vector((0, -0.03, -0.02))
    p.box((0.62, 0.09, 0.07), tuple(hc), M('Wood'), bevel=0.015)
    p.box((0.6, 0.085, 0.1), tuple(hc + Vector((0, 0, -0.08))), M('Bristle'), bevel=0.01, taper=(1.0, 0.8))
    for s in (-1, 1):
        p.tube(head + Vector((0, 0.16, 0.1)), hc + Vector((s * 0.2, 0.02, 0.03)), 0.009, M('Metal'), verts=6)
    p.box((0.05, 0.05, 0.06), tuple(head + Vector((0, 0.0, 0.02))), M('Metal'), rot=(ang, 0, 0))
    empty('HandL', tuple(top + (head - top) * 0.35))
    p.finish()


def tool_blower():
    B = body('#F08A24')
    p = Part('Tool')
    p.box((0.21, 0.36, 0.26), (0, 0.02, -0.2), B, bevel=0.07, seg=2)
    p.cyl(0.12, 0.06, (-0.12, 0.04, -0.21), M('Plastic'), axis='X', verts=14, bevel=0.015)
    p.box((0.04, 0.05, 0.04), (-0.16, 0.06, -0.19), M('Grip'), bevel=0.01)
    p.box((0.17, 0.22, 0.09), (0.0, 0.05, -0.36), material('Tank', '#EDE8D8', 0.4), bevel=0.03, seg=2)
    p.cyl(0.13, 0.04, (0.12, 0.02, -0.21), M('Plastic'), axis='X', verts=14)
    p.sweep([(0, 0.15, -0.09), (0, 0.12, 0.0), (0, -0.1, 0.0), (0, -0.14, -0.08)], 0.022, M('Plastic'))
    p.cyl(0.031, 0.17, (0, 0.01, 0.0), M('Grip'), axis='Y', verts=10)
    p.box((0.02, 0.05, 0.04), (0, -0.01, -0.03), M('Accent'))
    a, b = Vector((0, -0.14, -0.26)), Vector((0, -0.95, GROUND + 0.1))
    p.tube(a, b, 0.056, B, r2=0.04, verts=12)
    p.tube(b + (b - a).normalized() * -0.03, b + (b - a).normalized() * 0.03, 0.046, M('Plastic'), verts=12)
    p.tube(a - (b - a).normalized() * 0.02, a + (b - a).normalized() * 0.05, 0.068, M('Plastic'), verts=12)
    p.finish()


def tool_backpack():
    B = body('#F08A24')
    p = Part('Tool')
    pc = Vector((0.28, 0.6, 0.36))  # pack center relative to the grip
    p.box((0.44, 0.06, 0.62), tuple(pc + Vector((0, -0.2, 0.02))), M('Plastic'), bevel=0.03, seg=2)
    p.box((0.4, 0.34, 0.46), tuple(pc), B, bevel=0.09, seg=2)
    p.cyl(0.21, 0.16, tuple(pc + Vector((-0.2, 0.02, -0.08))), B, axis='X', verts=16, bevel=0.03)
    p.cyl(0.16, 0.05, tuple(pc + Vector((-0.29, 0.02, -0.08))), M('Plastic'), axis='X', verts=14)
    p.box((0.34, 0.28, 0.12), tuple(pc + Vector((0.02, 0.0, -0.29))), material('Tank', '#EDE8D8', 0.4), bevel=0.04,
          seg=2)
    p.box((0.3, 0.2, 0.1), tuple(pc + Vector((0.02, 0.06, 0.27))), M('Plastic'), bevel=0.03, seg=2)
    p.box((0.08, 0.05, 0.04), tuple(pc + Vector((0.14, 0.06, 0.34))), M('Grip'), bevel=0.01)
    for s in (-1, 1):
        x = pc.x + s * 0.11
        p.sweep([(x, 0.4, 0.62), (x, 0.3, 0.63), (x, 0.13, 0.5), (x + s * 0.02, 0.12, 0.25), (x + s * 0.06, 0.38, 0.13)],
                0.022, M('Plastic'), verts=6, rscale=(1.0, 0.35))
    p.sweep([(pc.x - 0.24, 0.58, 0.18), (0.02, 0.5, 0.02), (-0.02, 0.26, -0.01), (0.0, 0.1, 0.02)], 0.045,
            M('Plastic'), verts=10)
    a, b = Vector((0, 0.1, 0.03)), Vector((0, -1.04, GROUND + 0.075))
    p.tube(a, b, 0.052, B, r2=0.042, verts=12)
    p.tube(b - (b - a).normalized() * 0.03, b + (b - a).normalized() * 0.03, 0.048, M('Plastic'), verts=12)
    p.tube((0, 0.07, -0.03), (0, -0.08, -0.05), 0.03, M('Grip'), verts=10)
    p.box((0.02, 0.04, 0.05), (0, -0.02, -0.07), M('Accent'))
    p.finish()


TOOLS = {
    'tool_shears': tool_shears,
    'tool_trimmer': tool_trimmer,
    'tool_trimmer_pro': tool_trimmer_pro,
    'tool_broom': tool_broom,
    'tool_blower': tool_blower,
    'tool_backpack': tool_backpack,
}
