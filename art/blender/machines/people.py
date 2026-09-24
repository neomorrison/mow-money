# Mow Money characters. About 1.76 m tall, facing -Y, feet on the ground at the origin.
# Hierarchy: root empty (char_worker / char_homeowner) -> Torso, Head, ArmL, ArmR, LegL, LegR.
# Each part's origin sits on its joint so the game can swing it:
#   LegL/LegR  hip joint     (+-0.10, 0, 0.86)   rotate around X to walk (negative x swings forward in three.js)
#   ArmL/ArmR  shoulder      (+-0.25, 0, 1.40)
#   Torso      hip center    (0, 0, 0.86)
#   Head       neck base     (0, 0, 1.49)
# HandL/HandR empties (children of the arms) mark the palms, for attaching tools.
# L is the character's own left, which is +X in Blender and three.js alike.
# The worker's polo and cap use the Body material so they take the company color.
from lib import Part, M, body, material, empty

HIP = 0.86
SHOULDER = (0.25, 1.40)
NECK = 1.49


def person(kind):
    worker = kind == 'worker'
    root = empty('char_' + kind, (0, 0, 0), size=0.3)
    skin = M('Skin') if worker else material('Skin', '#C98E68', 0.7)
    shirt = body('#3E9B4F') if worker else M('Shirt')
    lower = M('Shorts') if worker else M('Pants')
    # legs
    for side, s in (('L', 1), ('R', -1)):
        x = s * 0.1
        lg = Part('Leg' + side)
        if worker:
            lg.box((0.165, 0.2, 0.36), (x, 0, HIP - 0.15), lower, bevel=0.04, seg=2)
            lg.cyl(0.056, 0.4, (x, 0.005, 0.36), skin, verts=10, r2=0.064)
            lg.cyl(0.062, 0.05, (x, 0.005, 0.18), M('Sock'), verts=10)
            lg.cyl(0.07, 0.07, (x, 0.0, 0.14), M('Boots'), verts=10)
            lg.box((0.13, 0.25, 0.12), (x, -0.045, 0.075), M('Boots'), bevel=0.04, seg=2)
            lg.bx(x - 0.068, x + 0.068, -0.175, 0.085, 0.0, 0.03, M('Sole'), bevel=0.01)
        else:
            lg.box((0.165, 0.2, 0.44), (x, 0, HIP - 0.19), lower, bevel=0.04, seg=2)
            lg.cyl(0.072, 0.4, (x, 0.0, 0.29), lower, verts=10, r2=0.078)
            lg.box((0.13, 0.26, 0.1), (x, -0.045, 0.065), M('Sneaker'), bevel=0.04, seg=2)
            lg.bx(x - 0.068, x + 0.068, -0.18, 0.09, 0.0, 0.028, M('Trim'), bevel=0.01)
        lg.finish(origin=(x, 0, HIP), parent=root)
    # torso
    t = Part('Torso')
    t.box((0.37, 0.22, 0.2), (0, 0, 0.9), lower, bevel=0.05, seg=2)
    if worker:
        t.box((0.376, 0.226, 0.04), (0, 0, 0.985), M('Leather'), bevel=0.012)
        t.box((0.06, 0.02, 0.035), (0, -0.113, 0.985), M('Chrome'))
    t.box((0.4, 0.24, 0.46), (0, 0, 1.22), shirt, bevel=0.07, seg=2, taper=(1.12, 1.0))
    if worker:
        for s in (-1, 1):
            t.box((0.1, 0.1, 0.03), (s * 0.06, -0.06, 1.445), shirt, bevel=0.01, rot=(18, 0, s * 25))
        t.bx(-0.018, 0.018, -0.124, -0.116, 1.3, 1.43, material('Placket', '#F2F0E8', 0.8))
        # company chest patch
        t.bx(0.07, 0.15, -0.124, -0.118, 1.3, 1.36, material('Patch', '#F4C331', 0.6))
    else:
        t.box((0.16, 0.14, 0.02), (0, -0.02, 1.445), shirt, bevel=0.008)
    t.cyl(0.055, 0.1, (0, 0, 1.47), skin, verts=10)
    t.finish(origin=(0, 0, HIP), parent=root)
    # head
    h = Part('Head')
    h.box((0.22, 0.235, 0.25), (0, 0, 1.625), skin, bevel=0.065, seg=2)
    for s in (-1, 1):
        h.box((0.03, 0.06, 0.07), (s * 0.112, 0.012, 1.615), skin, bevel=0.012)
        h.box((0.032, 0.014, 0.046), (s * 0.05, -0.114, 1.632), M('Eye'), bevel=0.004)
        h.box((0.05, 0.012, 0.012), (s * 0.052, -0.114, 1.672), M('Hair'), rot=(0, s * -8, 0))
    h.box((0.034, 0.03, 0.05), (0, -0.124, 1.6), skin, bevel=0.01)
    h.box((0.06, 0.012, 0.012), (0, -0.116, 1.556), material('Mouth', '#7E4636', 0.6))
    if worker:
        h.box((0.24, 0.255, 0.1), (0, 0.004, 1.722), shirt, bevel=0.045, seg=2)
        h.box((0.2, 0.15, 0.018), (0, -0.175, 1.69), shirt, bevel=0.008, rot=(10, 0, 0))
        h.cyl(0.014, 0.012, (0, 0.004, 1.775), shirt, verts=8)
        h.box((0.226, 0.06, 0.08), (0, 0.095, 1.655), M('Hair'), bevel=0.02)
        h.box((0.08, 0.03, 0.03), (0.0, -0.126, 1.708), material('Patch', '#F4C331', 0.6))
    else:
        h.box((0.236, 0.25, 0.075), (0, 0.012, 1.738), M('Hair'), bevel=0.035, seg=2)
        h.box((0.232, 0.08, 0.17), (0, 0.09, 1.665), M('Hair'), bevel=0.03, seg=2)
        for s in (-1, 1):
            h.box((0.02, 0.12, 0.1), (s * 0.113, 0.03, 1.69), M('Hair'), bevel=0.008)
        h.box((0.18, 0.06, 0.04), (0.02, -0.105, 1.735), M('Hair'), bevel=0.015, rot=(0, 0, -6))
    h.finish(origin=(0, 0, NECK), parent=root)
    # arms
    for side, s in (('L', 1), ('R', -1)):
        x = s * 0.262
        a = Part('Arm' + side)
        a.cyl(0.074, 0.22, (x - s * 0.005, 0, 1.32), shirt, verts=10, r2=0.07, bevel=0.035, seg=2)
        a.cyl(0.05, 0.15, (x, 0, 1.165), skin, verts=8)
        a.cyl(0.045, 0.24, (x, 0, 1.0), skin, verts=8, r2=0.05)
        hand = M('Gloves') if worker else skin
        a.box((0.075, 0.095, 0.115), (x, -0.005, 0.83), hand, bevel=0.028, seg=2)
        a.box((0.03, 0.035, 0.05), (x - s * 0.02, -0.055, 0.85), hand, bevel=0.012)
        if worker:
            a.cyl(0.052, 0.04, (x, 0, 0.895), hand, verts=8)
        arm = a.finish(origin=(s * SHOULDER[0], 0, SHOULDER[1]), parent=root)
        empty('Hand' + side, (x, -0.005, 0.83), parent=arm, size=0.04)


def char_worker():
    person('worker')


def char_homeowner():
    person('homeowner')


PEOPLE = {
    'char_worker': char_worker,
    'char_homeowner': char_homeowner,
}
