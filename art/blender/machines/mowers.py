# Mow Money mowers. Front faces -Y, origin at the center of the cutting deck on the ground.
# Objects per mower: Deck (the cutting deck, its x extent equals the gameplay deck width), Chassis
# (everything else that is static), Wheel_* (origin at the axle, spin around local X), Reel* for reel
# mowers (origin on the reel axis), and a Driver empty where the operator's feet (walk-behind,
# stand-on) or character root (ride-on, hips on the seat) go.
import math
from lib import Part, M, body, material, wheel, caster_fork, empty

HIP = 0.86  # char_worker hip joint height above its root


def steering_ring(y, z, r=0.21, tilt=36.0, n=12):
    """Steering wheel rim points; the rim plane rises toward the front, facing the driver behind it."""
    c, s = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
    return [(math.cos(2 * math.pi * i / n) * r, y - math.sin(2 * math.pi * i / n) * r * c,
             z + math.sin(2 * math.pi * i / n) * r * s) for i in range(n)]


def seated_driver(y, seat_top):
    empty('Driver', (0, y, seat_top + 0.04 - HIP))


# ------------------------------------------------------------------ push-style decks

def push_deck(dk, w, d, B, z0=0.07, h=0.2):
    hw, hd = w / 2, d / 2
    dk.bx(-hw, hw, -hd, hd, z0, z0 + h, B, bevel=0.085, seg=3)
    dk.box((w * 0.76, d * 0.72, 0.12), (0, 0.03, z0 + h + 0.01), B, bevel=0.05, seg=2)
    dk.bx(-hw - 0.006, hw + 0.006, -hd - 0.006, hd + 0.006, z0 - 0.01, z0 + 0.045, M('Deck'), bevel=0.03)
    # front bumper lip
    dk.bx(-hw * 0.7, hw * 0.7, -hd - 0.03, -hd + 0.05, z0 + 0.03, z0 + 0.1, M('Plastic'), bevel=0.02)


def side_chute(dk, hw, y, depth, z0, out=0.28):
    """Side discharge chute on the operator's right (-X)."""
    dk.prism([(-hw + 0.03, z0 + 0.02), (-hw - out, z0 + 0.01), (-hw - out, z0 + 0.09), (-hw + 0.03, z0 + 0.22)],
             depth, M('Plastic'), axis='Y', center=y, bevel=0.015)


def push_handle(ch, x_low, y_low, z_low, x_top, y_top, z_top, grip_w, m, r=0.021):
    pts = [(-x_low, y_low, z_low), (-x_top, y_top - 0.06, z_top - 0.06), (-x_top + 0.05, y_top, z_top),
           (x_top - 0.05, y_top, z_top), (x_top, y_top - 0.06, z_top - 0.06), (x_low, y_low, z_low)]
    ch.sweep(pts, r, m, verts=8)
    ch.cyl(0.031, grip_w, (0, y_top, z_top), M('Grip'), axis='X', verts=10)
    for s in (-1, 1):
        ch.bx(s * x_low - 0.03, s * x_low + 0.03, y_low - 0.05, y_low + 0.05, z_low - 0.06, z_low + 0.03, M('Metal'))


def small_engine(ch, y, z, B=None, r=0.19):
    ch.cyl(r, 0.14, (0, y, z + 0.07), M('Engine'), verts=16)
    top = B if B is not None else M('Plastic')
    ch.cyl(r * 1.12, 0.13, (0, y, z + 0.2), top, verts=18, bevel=0.045, seg=2)
    ch.cyl(0.035, 0.05, (r * 0.45, y + r * 0.35, z + 0.28), M('Accent'), verts=10)
    ch.box((r * 1.05, 0.12, 0.13), (-0.02, y - r - 0.03, z + 0.12), M('Plastic'), bevel=0.03, seg=2)
    ch.box((0.1, 0.16, 0.08), (-r - 0.02, y - 0.1, z + 0.06), M('Metal'), bevel=0.02)
    ch.cyl(0.06, 0.03, (0, y, z + 0.28), M('Engine'), verts=12)


# ------------------------------------------------------------------ 1.0 m reel

def mower_reel():
    B = body('#3D9A45')
    rim = material('Rim', '#F4C331', 0.45, 0.1)
    dk, ch = Part('Deck'), Part('Chassis')
    for s in (-1, 1):
        dk.cyl(0.165, 0.04, (s * 0.48, -0.02, 0.17), B, axis='X', verts=16, bevel=0.012)
        dk.cyl(0.05, 0.05, (s * 0.48, 0.0, 0.23), M('Hub'), axis='X', verts=8)
        dk.bx(s * 0.5, s * 0.465, 0.05, 0.23, 0.02, 0.09, B, bevel=0.01)
    dk.cyl(0.036, 0.93, (0, 0.215, 0.036), M('Wood'), axis='X', verts=12)
    dk.bx(-0.47, 0.47, 0.03, 0.09, 0.015, 0.042, M('Steel'))
    dk.tube((-0.47, -0.13, 0.29), (0.47, -0.13, 0.29), 0.018, B)
    dk.box((0.93, 0.018, 0.17), (0, 0.13, 0.27), B, rot=(-35, 0, 0))
    rp = Part('Reel')
    rp.reel(0.92, 0.115, (0, -0.02, 0.135), M('Blade'), M('Metal'), blades=5, twist=75, segs=8)
    rp.finish(origin=(0, -0.02, 0.135))
    # handle: fork arms, wooden shaft, wooden T grip
    for s in (-1, 1):
        ch.sweep([(s * 0.44, 0.0, 0.23), (s * 0.4, 0.13, 0.37), (s * 0.13, 0.53, 0.73)], 0.018, M('Metal'))
    ch.box((0.3, 0.07, 0.07), (0, 0.54, 0.74), M('Metal'), bevel=0.02, rot=(-42, 0, 0))
    ch.tube((0, 0.53, 0.73), (0, 0.86, 1.02), 0.024, M('Wood'), verts=10)
    ch.cyl(0.03, 0.58, (0, 0.86, 1.02), M('Wood'), axis='X', verts=10, bevel=0.01)
    for s in (-1, 1):
        ch.cyl(0.034, 0.03, (s * 0.29, 0.86, 1.02), M('Metal'), axis='X', verts=10)
    ch.cyl(0.04, 0.07, (0, 0.86, 1.02), M('Metal'), axis='X', verts=10)
    dk.finish()
    ch.finish()
    for s, n in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_' + n, 0.23, 0.075, (s * 0.545, 0.0, 0.23), rim_m=rim, verts=18)
    empty('Driver', (0, 1.25, 0))


# ------------------------------------------------------------------ 1.2 m gas push

def mower_push():
    B = body('#D9412B')
    dk, ch = Part('Deck'), Part('Chassis')
    push_deck(dk, 1.2, 1.0, B)
    side_chute(ch, 0.6, 0.06, 0.42, 0.08)
    dk.bx(-0.3, 0.3, 0.49, 0.53, 0.05, 0.22, M('Plastic'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            ch.box((0.04, 0.04, 0.16), (sx * 0.6, sy * 0.38, 0.3), M('Metal'), rot=(sy * -25, 0, 0))
            ch.cyl(0.025, 0.03, (sx * 0.6, sy * 0.38 + sy * 0.03, 0.38), M('Accent'), verts=8)
    small_engine(ch, 0.04, 0.33)
    push_handle(ch, 0.41, 0.42, 0.3, 0.42, 1.04, 1.0, 0.62, M('Metal'))
    ch.sweep([(-0.41, 0.95, 0.9), (-0.35, 0.99, 0.96), (0.35, 0.99, 0.96), (0.41, 0.95, 0.9)], 0.012, B)
    ch.tube((-0.42, 0.7, 0.62), (0.42, 0.7, 0.62), 0.015, M('Metal'))
    ch.box((0.08, 0.035, 0.035), (0.46, 0.72, 0.64), M('Grip'), bevel=0.01)
    dk.finish()
    ch.finish()
    for sx, nx in ((1, 'L'), (-1, 'R')):
        for sy, ny in ((-1, 'F'), (1, 'R')):
            wheel('Wheel_' + ny + nx, 0.14, 0.08, (sx * 0.645, sy * 0.38, 0.14), verts=16)
    empty('Driver', (0, 1.42, 0))


# ------------------------------------------------------------------ 1.3 m self-propelled with bag and roller

def mower_selfprop():
    B = body('#1FA39A')
    dk, ch = Part('Deck'), Part('Chassis')
    push_deck(dk, 1.3, 1.06, B)
    # rear roller between the rear wheels
    dk.cyl(0.075, 1.12, (0, 0.62, 0.075), M('Steel'), axis='X', verts=16, bevel=0.01)
    for s in (-1, 1):
        dk.bx(s * 0.58, s * 0.6, 0.45, 0.66, 0.04, 0.2, M('Metal'))
    # engine under a body-colored hood
    ch.cyl(0.18, 0.12, (0, 0.02, 0.4), M('Engine'), verts=16)
    ch.box((0.52, 0.5, 0.2), (0, 0.02, 0.53), B, bevel=0.07, seg=3, taper=(0.86, 0.86))
    ch.box((0.3, 0.22, 0.06), (0, 0.05, 0.64), M('Plastic'), bevel=0.02, seg=2)
    ch.cyl(0.035, 0.05, (0.16, 0.14, 0.64), M('Accent'), verts=10)
    ch.box((0.1, 0.16, 0.08), (-0.26, -0.08, 0.42), M('Metal'), bevel=0.02)
    # rear bag
    ch.box((0.34, 0.14, 0.16), (0, 0.55, 0.34), M('Plastic'), bevel=0.03)
    ch.box((0.64, 0.5, 0.42), (0, 0.88, 0.44), M('Grass Bag'), bevel=0.09, seg=2, rot=(-6, 0, 0), taper=(0.94, 0.9))
    ch.sweep([(-0.3, 0.64, 0.66), (-0.28, 1.1, 0.64), (0.28, 1.1, 0.64), (0.3, 0.64, 0.66)], 0.014, M('Metal'),
             closed=True)
    ch.sweep([(-0.12, 0.95, 0.65), (-0.1, 0.95, 0.74), (0.1, 0.95, 0.74), (0.12, 0.95, 0.65)], 0.013, M('Metal'))
    push_handle(ch, 0.44, 0.44, 0.32, 0.44, 1.22, 1.02, 0.66, M('Metal'))
    ch.sweep([(-0.43, 1.12, 0.93), (-0.37, 1.16, 0.99), (0.37, 1.16, 0.99), (0.43, 1.12, 0.93)], 0.013, B)
    ch.tube((-0.44, 0.78, 0.63), (0.44, 0.78, 0.63), 0.014, M('Metal'))
    dk.finish()
    ch.finish()
    for sx, nx in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_F' + nx, 0.13, 0.08, (sx * 0.695, -0.38, 0.13), verts=16)
        wheel('Wheel_R' + nx, 0.175, 0.09, (sx * 0.7, 0.34, 0.175), verts=18)
    empty('Driver', (0, 1.6, 0))


# ------------------------------------------------------------------ 1.8 m commercial walk-behind

def mower_walkbehind():
    B = body('#F08A24')
    dk, ch = Part('Deck'), Part('Chassis')
    dk.bx(-0.9, 0.9, -0.52, 0.52, 0.09, 0.28, M('Deck'), bevel=0.035)
    dk.bx(-0.86, 0.86, -0.48, 0.48, 0.27, 0.3, M('Steel'), bevel=0.012)
    dk.box((1.3, 0.46, 0.1), (0, 0.06, 0.34), B, bevel=0.04, seg=2)
    for x in (-0.55, 0.0, 0.55):
        dk.cyl(0.07, 0.05, (x, -0.3, 0.32), M('Metal'), verts=10)
    side_chute(ch, 0.9, 0.08, 0.44, 0.09, out=0.26)
    dk.tube((-0.84, -0.55, 0.2), (0.84, -0.55, 0.2), 0.028, M('Metal'))
    for s in (-1, 1):
        dk.bx(s * 0.66, s * 0.78, -0.66, -0.48, 0.28, 0.33, M('Metal'))
        caster_fork(dk, s * 0.72, -0.66, 0.1, 0.34, 0.1, M('Metal'), M('Hub'), w=0.09)
    # frame, drive and engine
    ch.bx(-0.38, 0.38, 0.46, 1.08, 0.3, 0.42, M('Metal'), bevel=0.02)
    for s in (-1, 1):
        ch.box((0.14, 0.24, 0.2), (s * 0.4, 0.86, 0.3), M('Engine'), bevel=0.03)
    ch.box((0.5, 0.42, 0.34), (0, 0.78, 0.6), M('Engine'), bevel=0.03)
    ch.box((0.56, 0.46, 0.12), (0, 0.78, 0.82), B, bevel=0.045, seg=2)
    ch.cyl(0.09, 0.14, (0.17, 0.66, 0.92), M('Plastic'), verts=12, bevel=0.02)
    ch.box((0.3, 0.1, 0.12), (0, 1.02, 0.55), M('Metal'), bevel=0.03)
    # handle, tank, hydro levers
    for s in (-1, 1):
        ch.sweep([(s * 0.3, 0.98, 0.42), (s * 0.3, 1.14, 0.64), (s * 0.3, 1.37, 0.96)], 0.026, M('Metal'))
    ch.box((0.5, 0.26, 0.2), (0, 1.14, 0.74), B, bevel=0.06, seg=2, rot=(-30, 0, 0))
    ch.cyl(0.04, 0.04, (0.12, 1.1, 0.87), M('Accent'), verts=10, rot=(-30, 0, 0))
    ch.bx(-0.36, 0.36, 1.33, 1.43, 0.9, 0.98, M('Plastic'), bevel=0.02)
    ch.cyl(0.032, 0.74, (0, 1.44, 1.0), M('Grip'), axis='X', verts=10)
    for s in (-1, 1):
        ch.sweep([(s * 0.34, 1.38, 0.96), (s * 0.34, 1.33, 1.06), (s * 0.06, 1.33, 1.06), (s * 0.06, 1.38, 0.97)],
                 0.015, M('Accent'))
    dk.finish()
    ch.finish()
    for s, n in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_R' + n, 0.28, 0.2, (s * 0.58, 0.86, 0.28), verts=20)
        wheel('Wheel_C' + n, 0.1, 0.07, (s * 0.72, -0.66, 0.1), verts=12, rim_frac=0.55)
    empty('Driver', (0, 1.78, 0))


# ------------------------------------------------------------------ ride-on decks

def rider_deck(dk, ch, w, d, B, fabricated=False):
    hw, hd = w / 2, d / 2
    if fabricated:
        dk.bx(-hw, hw, -hd, hd, 0.09, 0.3, M('Deck'), bevel=0.03)
        dk.bx(-hw + 0.04, hw - 0.04, -hd + 0.04, hd - 0.04, 0.29, 0.32, B, bevel=0.012)
        for s in (-1, 1):
            dk.box((w * 0.34, d * 0.46, 0.1), (s * w * 0.22, 0.08, 0.36), B, bevel=0.04, seg=2)
        dk.box((w * 0.14, d * 0.4, 0.1), (0, 0.1, 0.36), M('Metal'), bevel=0.03)
        dk.tube((-hw + 0.1, -hd - 0.05, 0.2), (hw - 0.1, -hd - 0.05, 0.2), 0.035, M('Metal'))
    else:
        dk.bx(-hw, hw, -hd, hd, 0.1, 0.3, B, bevel=0.075, seg=2)
        dk.bx(-hw - 0.006, hw + 0.006, -hd - 0.006, hd + 0.006, 0.07, 0.15, M('Deck'), bevel=0.03)
        dk.box((w * 0.78, d * 0.6, 0.08), (0, 0.06, 0.31), B, bevel=0.035, seg=2)
    side_chute(ch, hw, 0.12, d * 0.42, 0.1, out=0.3)
    for s in (-1, 1):
        dk.bx(s * (hw - 0.16), s * (hw - 0.06), -hd - 0.1, -hd + 0.04, 0.16, 0.22, M('Metal'))
        dk.cyl(0.055, 0.05, (s * (hw - 0.11), -hd - 0.08, 0.08), M('Tire'), axis='X', verts=10)
        dk.cyl(0.055, 0.05, (s * (hw - 0.11), hd + 0.02, 0.08), M('Tire'), axis='X', verts=10)
        dk.bx(s * (hw - 0.16), s * (hw - 0.06), hd - 0.04, hd + 0.06, 0.16, 0.22, M('Metal'))


def lap_bars(ch, x, y, z, reach, height):
    for s in (-1, 1):
        ch.sweep([(s * x, y, z), (s * x, y - 0.12, z + height * 0.8), (s * x, y - reach + 0.1, z + height),
                  (s * 0.14, y - reach, z + height)], 0.02, M('Metal'))
        ch.tube((s * (x - 0.06), y - reach + 0.03, z + height), (s * 0.16, y - reach, z + height), 0.031, M('Grip'))
        ch.bx(s * (x - 0.04), s * (x + 0.05), y - 0.1, y + 0.1, z - 0.25, z + 0.04, M('Plastic'), bevel=0.02)


def zero_turn(key, deck_w, deck_d, color, k, rear_r, rear_w, caster_r, pro=False):
    B = body(color)
    dk, ch = Part('Deck'), Part('Chassis')
    rider_deck(dk, ch, deck_w, deck_d, B, fabricated=pro)
    hd = deck_d / 2
    fw = 0.44 * k
    y_front = -hd - 0.55 * k
    y_axle = hd + rear_r + 0.06
    y_back = y_axle + 0.62 * k
    rx = fw + 0.12 + rear_w / 2
    # frame
    for s in (-1, 1):
        ch.bx(s * fw - 0.05, s * fw + 0.05, y_front - 0.02, y_back, 0.38, 0.5, M('Deck'))
    ch.bx(-fw - 0.18, fw + 0.18, y_front - 0.08, y_front + 0.08, 0.48, 0.6, M('Deck'), bevel=0.02)
    cx = fw + 0.1
    for s in (-1, 1):
        caster_fork(ch, s * cx, y_front, caster_r, 0.62, caster_r, M('Metal'), M('Hub'), w=0.12 * k)
    # footplate and toe board
    ch.bx(-fw - 0.06, fw + 0.06, y_front + 0.06, -hd + 0.25, 0.49, 0.56, B, bevel=0.025, seg=2)
    ch.bx(-fw + 0.02, fw - 0.02, y_front + 0.2, -hd + 0.2, 0.56, 0.575, M('Plastic'))
    ch.box((fw * 2 + 0.12, 0.07, 0.22), (0, y_front + 0.1, 0.64), B, bevel=0.02, rot=(20, 0, 0))
    # seat pod, fenders, tanks
    seat_y0, seat_y1 = y_axle - 0.62 * k, y_axle - 0.02
    ch.bx(-fw - 0.02, fw + 0.02, -hd + 0.2, seat_y1 + 0.12, 0.5, 0.6 + 0.08 * k, B, bevel=0.05, seg=2)
    for s in (-1, 1):
        ch.bx(s * (fw - 0.02), s * (rx + rear_w / 2 + 0.06), y_axle - rear_r - 0.12, y_axle + rear_r + 0.1,
              rear_r * 2 + 0.05, rear_r * 2 + 0.14, B, bevel=0.045, seg=2)
        ch.bx(s * (fw - 0.02), s * (fw + 0.06), y_axle - rear_r - 0.12, y_axle + rear_r + 0.1, 0.5,
              rear_r * 2 + 0.1, B, bevel=0.02)
        ch.box((0.34 * k, 0.46 * k, 0.14), (s * (rx + 0.02), y_axle + 0.02, rear_r * 2 + 0.2), M('Plastic'),
               bevel=0.05, seg=2)
        ch.cyl(0.045, 0.05, (s * (rx + 0.02), y_axle + 0.14, rear_r * 2 + 0.28), M('Accent'), verts=10)
    # seat
    if pro:
        seat_top = rear_r * 2 + 0.2
        ch.bx(-0.26, 0.26, seat_y0 + 0.1, seat_y1 - 0.08, 0.66, seat_top - 0.12, M('Plastic'), bevel=0.03)
        for s in (-1, 1):
            ch.cyl(0.05, seat_top - 0.8, (s * 0.18, seat_y0 + 0.3, (seat_top + 0.66) / 2), M('Chrome'), verts=8)
        ch.box((0.7, seat_y1 - seat_y0, 0.14), (0, (seat_y0 + seat_y1) / 2, seat_top - 0.07), M('Seat'),
               bevel=0.06, seg=2)
        ch.box((0.7, 0.14, 0.72), (0, seat_y1 + 0.03, seat_top + 0.34), M('Seat'), bevel=0.06, seg=2,
               rot=(-10, 0, 0))
        for s in (-1, 1):
            ch.box((0.08, 0.36, 0.08), (s * 0.4, (seat_y0 + seat_y1) / 2 + 0.05, seat_top + 0.2), M('Seat'),
                   bevel=0.03, seg=2)
            ch.bx(s * 0.38, s * 0.42, seat_y1 - 0.12, seat_y1 - 0.06, seat_top - 0.05, seat_top + 0.2, M('Metal'))
    else:
        seat_top = 0.6 + 0.08 * k + 0.16
        ch.box((0.64, seat_y1 - seat_y0, 0.14), (0, (seat_y0 + seat_y1) / 2, seat_top - 0.07), M('Seat'),
               bevel=0.06, seg=2)
        ch.box((0.64, 0.13, 0.52), (0, seat_y1 + 0.02, seat_top + 0.25), M('Seat'), bevel=0.06, seg=2,
               rot=(-12, 0, 0))
    lap_bars(ch, fw + 0.05, seat_y0 - 0.02, seat_top - 0.02, 0.62 * k, 0.28)
    # engine and rear
    ey0, ey1 = y_axle + 0.02, y_back - 0.04
    ch.bx(-fw + 0.06, fw - 0.06, ey0, ey1, 0.52, 0.52 + 0.42 * k, M('Engine'), bevel=0.03)
    ch.box((fw * 1.5, (ey1 - ey0) * 0.8, 0.12), (0, (ey0 + ey1) / 2, 0.56 + 0.42 * k), M('Plastic'), bevel=0.04,
           seg=2)
    ch.cyl(0.1 * k, 0.2, (0.2 * k, (ey0 + ey1) / 2 + 0.05, 0.72 + 0.42 * k), M('Plastic'), verts=12, bevel=0.02)
    ch.cyl(0.07 * k, 0.56 * k, (0, y_back + 0.02, 0.62), M('Metal'), axis='X', verts=12)
    ch.cyl(0.03, 0.12, (-0.3 * k, y_back + 0.1, 0.62), M('Chrome'), axis='Y', verts=8)
    ch.sweep([(-fw, y_back - 0.05, 0.46), (-fw, y_back + 0.14, 0.46), (fw, y_back + 0.14, 0.46),
              (fw, y_back - 0.05, 0.46)], 0.035, M('Metal'))
    if pro:  # ROPS roll bar
        rz = seat_top + 1.12
        ry = seat_y1 + 0.22
        for s in (-1, 1):
            ch.bx(s * (fw + 0.04), s * (fw + 0.16), ry - 0.08, ry + 0.08, rear_r * 2 + 0.1, rear_r * 2 + 0.3,
                  M('Metal'))
        ch.sweep([(-(fw + 0.1), ry, rear_r * 2 + 0.25), (-(fw + 0.1), ry, rz - 0.16), (-(fw - 0.04), ry, rz),
                  (fw - 0.04, ry, rz), (fw + 0.1, ry, rz - 0.16), (fw + 0.1, ry, rear_r * 2 + 0.25)],
                 0.045, M('Metal'), verts=10)
    dk.finish()
    ch.finish()
    for s, n in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_R' + n, rear_r, rear_w, (s * rx, y_axle, rear_r), verts=22, rim_frac=0.55)
        wheel('Wheel_C' + n, caster_r, 0.12 * k, (s * cx, y_front, caster_r), verts=14, rim_frac=0.55)
    seated_driver((seat_y0 + seat_y1) / 2 + 0.06, seat_top)


def mower_zt48():
    zero_turn('mower_zt48', 2.4, 1.15, '#E0572A', 1.0, 0.38, 0.3, 0.16)


def mower_zt60():
    zero_turn('mower_zt60', 3.0, 1.3, '#C8312B', 1.15, 0.44, 0.36, 0.19, pro=True)


# ------------------------------------------------------------------ 2.6 m stand-on

def mower_standon():
    B = body('#2F6FD0')
    dk, ch = Part('Deck'), Part('Chassis')
    rider_deck(dk, ch, 2.6, 1.15, B)
    fw = 0.4
    y_front, y_axle = -1.08, 0.97
    rear_r, rear_w = 0.34, 0.28
    rx = 0.74
    for s in (-1, 1):
        ch.bx(s * fw - 0.05, s * fw + 0.05, y_front - 0.02, 1.62, 0.36, 0.44, M('Deck'))
    ch.bx(-0.6, 0.6, y_front - 0.08, y_front + 0.08, 0.46, 0.58, M('Deck'), bevel=0.02)
    for s in (-1, 1):
        caster_fork(ch, s * 0.5, y_front, 0.15, 0.6, 0.15, M('Metal'), M('Hub'), w=0.11)
        ch.bx(s * 0.44, s * 0.56, y_front - 0.02, -0.5, 0.44, 0.52, B, bevel=0.015)
    # front tub over the frame, engine hood and saddle tanks
    ch.bx(-0.5, 0.5, y_front + 0.08, 0.1, 0.4, 0.52, B, bevel=0.04, seg=2)
    ch.bx(-0.4, 0.4, y_front + 0.2, -0.05, 0.52, 0.535, M('Plastic'))
    ch.bx(-0.36, 0.36, 0.0, 0.68, 0.46, 0.84, M('Engine'), bevel=0.03)
    ch.box((0.86, 0.64, 0.44), (0, 0.28, 0.74), B, bevel=0.08, seg=3, taper=(0.9, 0.86))
    ch.box((0.5, 0.3, 0.06), (0, 0.24, 0.97), M('Plastic'), bevel=0.02)
    ch.cyl(0.1, 0.18, (0.2, 0.46, 1.02), M('Plastic'), verts=12, bevel=0.02)
    for s in (-1, 1):
        ch.box((0.28, 0.54, 0.28), (s * 0.6, 0.3, 0.66), M('Plastic'), bevel=0.06, seg=2)
        ch.cyl(0.045, 0.05, (s * 0.6, 0.22, 0.82), M('Accent'), verts=10)
        ch.bx(s * 0.45, s * 0.98, y_axle - 0.44, y_axle + 0.36, 0.73, 0.8, B, bevel=0.03, seg=2)
    # operator platform and control tower
    ch.bx(-0.52, 0.52, 1.02, 1.6, 0.2, 0.27, M('Deck'), bevel=0.02)
    ch.bx(-0.52, 0.52, 1.54, 1.62, 0.2, 0.36, M('Metal'), bevel=0.01)
    for x in (-0.3, -0.1, 0.1, 0.3):
        ch.bx(x - 0.05, x + 0.05, 1.08, 1.5, 0.27, 0.28, M('Metal'))
    ch.bx(-0.38, 0.38, 0.72, 0.9, 0.44, 1.08, B, bevel=0.05, seg=2)
    ch.box((0.66, 0.12, 0.22), (0, 0.97, 0.95), M('Seat'), bevel=0.05, seg=2)
    ch.bx(-0.34, 0.34, 0.74, 0.92, 1.06, 1.18, M('Plastic'), bevel=0.03)
    for s in (-1, 1):
        ch.sweep([(s * 0.3, 0.84, 1.14), (s * 0.3, 0.9, 1.36), (s * 0.1, 0.9, 1.38)], 0.02, M('Metal'))
        ch.tube((s * 0.28, 0.9, 1.38), (s * 0.1, 0.9, 1.38), 0.031, M('Grip'))
    ch.tube((-0.4, 0.98, 1.3), (0.4, 0.98, 1.3), 0.022, M('Grip'))
    ch.cyl(0.07, 0.5, (0, 1.66, 0.4), M('Metal'), axis='X', verts=12)
    dk.finish()
    ch.finish()
    for s, n in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_R' + n, rear_r, rear_w, (s * rx, y_axle, rear_r), verts=22, rim_frac=0.55)
        wheel('Wheel_C' + n, 0.15, 0.11, (s * 0.5, y_front, 0.15), verts=14, rim_frac=0.55)
    empty('Driver', (0, 1.3, 0.27))


# ------------------------------------------------------------------ 3.8 m wide-area with wings

def mower_widearea():
    B = body('#F08A24')
    dk, ch = Part('Deck'), Part('Chassis')
    # center deck and two wings (down, mowing position)
    dk.bx(-0.85, 0.85, -0.65, 0.65, 0.1, 0.36, B, bevel=0.06, seg=2)
    dk.bx(-0.856, 0.856, -0.656, 0.656, 0.07, 0.15, M('Deck'), bevel=0.03)
    dk.box((1.2, 0.8, 0.08), (0, 0.06, 0.37), B, bevel=0.03, seg=2)
    for s in (-1, 1):
        x0, x1 = s * 0.88, s * 1.9
        dk.bx(x0, x1, -0.58, 0.58, 0.1, 0.32, B, bevel=0.05, seg=2)
        dk.bx(x0, x1 + s * 0.006, -0.586, 0.586, 0.07, 0.14, M('Deck'), bevel=0.03)
        dk.box((0.7, 0.66, 0.07), ((x0 + x1) / 2, 0.06, 0.33), B, bevel=0.03, seg=2)
        for y in (-0.4, 0.0, 0.4):
            dk.cyl(0.045, 0.2, (s * 0.865, y, 0.36), M('Metal'), axis='Y', verts=8)
        # wing lift cylinder
        dk.tube((s * 0.45, 0.25, 0.46), (s * 1.3, 0.25, 0.4), 0.045, M('Metal'), verts=8)
        dk.tube((s * 0.9, 0.25, 0.43), (s * 1.35, 0.25, 0.4), 0.022, M('Chrome'), verts=8)
        dk.bx(s * 1.28, s * 1.4, 0.18, 0.32, 0.32, 0.42, M('Metal'))
        dk.bx(s * 0.4, s * 0.5, 0.18, 0.32, 0.36, 0.5, M('Metal'))
        # skid and casters
        dk.bx(s * 1.84, s * 1.9, -0.5, 0.5, 0.03, 0.26, M('Metal'), bevel=0.01)
        for x in (s * 1.55,):
            dk.bx(x - 0.05, x + 0.05, -0.74, -0.56, 0.18, 0.24, M('Metal'))
            dk.cyl(0.08, 0.07, (x, -0.72, 0.08), M('Tire'), axis='X', verts=12)
            dk.bx(x - 0.05, x - 0.035, -0.76, -0.66, 0.06, 0.22, M('Metal'))
        dk.bx(s * 0.55 - 0.05, s * 0.55 + 0.05, -0.8, -0.62, 0.2, 0.26, M('Metal'))
        dk.cyl(0.09, 0.08, (s * 0.55, -0.78, 0.09), M('Tire'), axis='X', verts=12)
        dk.bx(s * 0.55 - 0.06, s * 0.55 - 0.045, -0.82, -0.7, 0.07, 0.24, M('Metal'))
    # push arms from the tractor
    for s in (-1, 1):
        ch.sweep([(s * 0.35, 0.3, 0.42), (s * 0.35, 0.75, 0.55), (s * 0.35, 1.05, 0.62)], 0.05, M('Metal'),
                 verts=6)
    ch.cyl(0.07, 0.8, (0, 0.95, 0.6), M('Metal'), axis='X', verts=10)
    # tractor frame, axles
    ch.bx(-0.5, 0.5, 0.9, 3.45, 0.42, 0.78, M('Metal'), bevel=0.03)
    ch.bx(-0.64, 0.64, 1.0, 2.05, 0.78, 0.86, M('Deck'), bevel=0.02)
    for s in (-1, 1):
        ch.bx(s * 0.5, s * 1.14, 0.84, 1.78, 1.0, 1.08, B, bevel=0.035, seg=2)
        ch.bx(s * 0.5, s * 0.58, 0.84, 1.78, 0.78, 1.04, B)
        ch.bx(s * 0.58, s * 0.9, 1.9, 2.3, 0.45, 0.5, M('Metal'))
    # steering tower and wheel
    ch.box((0.5, 0.3, 0.46), (0, 1.12, 1.06), B, bevel=0.05, seg=2, taper=(0.8, 0.8))
    ch.tube((0, 1.18, 1.25), (0, 1.36, 1.5), 0.035, M('Metal'))
    ch.sweep(steering_ring(1.36, 1.5), 0.022, M('Grip'), closed=True, verts=6)
    ch.tube((-0.2, 1.36, 1.5), (0.2, 1.36, 1.5), 0.015, M('Grip'))
    # seat
    ch.bx(-0.3, 0.3, 1.55, 2.0, 0.86, 1.08, B, bevel=0.04, seg=2)
    ch.box((0.62, 0.5, 0.14), (0, 1.78, 1.15), M('Seat'), bevel=0.06, seg=2)
    ch.box((0.62, 0.13, 0.55), (0, 2.02, 1.48), M('Seat'), bevel=0.06, seg=2, rot=(-10, 0, 0))
    # engine hood, exhaust, ROPS
    ch.box((1.1, 1.3, 0.72), (0, 2.8, 1.14), B, bevel=0.1, seg=3, taper=(0.92, 0.94))
    for i in range(4):
        ch.bx(-0.4, 0.4, 3.46, 3.47, 0.9 + i * 0.12, 0.96 + i * 0.12, M('Plastic'))
    ch.bx(-0.44, 0.44, 3.44, 3.46, 0.84, 1.4, M('Plastic'))
    ch.cyl(0.06, 0.5, (0.36, 2.45, 1.6), M('Metal'), verts=10)
    ch.cyl(0.045, 0.1, (0.36, 2.45, 1.9), M('Chrome'), verts=10)
    ch.sweep([(-0.66, 2.16, 0.86), (-0.66, 2.16, 2.12), (-0.52, 2.16, 2.28), (0.52, 2.16, 2.28), (0.66, 2.16, 2.12),
              (0.66, 2.16, 0.86)], 0.05, M('Metal'), verts=10)
    for s in (-1, 1):
        ch.cyl(0.06, 0.08, (s * 0.44, 3.46, 0.92), M('TailLight'), axis='Y', verts=10)
        ch.cyl(0.06, 0.06, (s * 0.3, 0.97, 1.08), M('Light'), axis='Y', verts=10)
    dk.finish()
    ch.finish()
    for s, n in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_F' + n, 0.46, 0.34, (s * 0.82, 1.32, 0.46), verts=22, rim_frac=0.55)
        wheel('Wheel_R' + n, 0.34, 0.26, (s * 0.74, 3.05, 0.34), verts=20, rim_frac=0.55)
    seated_driver(1.8, 1.22)


# ------------------------------------------------------------------ 6.0 m fairway gang reel

def reel_unit(dk, idx, x, y, B, L=1.4):
    hw = L / 2
    for s in (-1, 1):
        dk.bx(x + s * (hw - 0.045), x + s * hw, y - 0.22, y + 0.22, 0.03, 0.33, B, bevel=0.015)
    dk.box((L - 0.08, 0.34, 0.08), (x, y - 0.02, 0.32), B, bevel=0.03, seg=2)
    dk.box((L - 0.08, 0.05, 0.14), (x, y + 0.15, 0.25), B, rot=(-30, 0, 0))
    dk.cyl(0.045, L - 0.1, (x, y - 0.21, 0.045), M('Steel'), axis='X', verts=8)
    dk.cyl(0.05, L - 0.1, (x, y + 0.2, 0.05), M('Steel'), axis='X', verts=8)
    dk.cyl(0.06, 0.12, (x + hw - 0.16, y + 0.06, 0.42), M('Engine'), verts=8)
    rp = Part('Reel_%d' % idx)
    rp.reel(L - 0.1, 0.13, (x, y - 0.01, 0.15), M('Blade'), M('Metal'), blades=5, twist=70, segs=6,
            spider_verts=8, core=False)
    rp.finish(origin=(x, y - 0.01, 0.15))


def mower_gangreel():
    B = body('#2E9C6A')
    dk, ch = Part('Deck'), Part('Chassis')
    units = [(0.0, -0.6), (-1.15, 0.0), (1.15, 0.0), (-2.3, 0.6), (2.3, 0.6)]
    for i, (x, y) in enumerate(units):
        reel_unit(dk, i + 1, x, y, B)
    # lift arms from the tractor to each unit
    ch.sweep([(0, -0.6, 0.38), (0, -0.4, 0.55), (0, -0.12, 0.62)], 0.04, M('Metal'), verts=6)
    for s in (-1, 1):
        ch.sweep([(s * 1.15, 0.0, 0.38), (s * 0.9, 0.08, 0.52), (s * 0.42, 0.2, 0.62)], 0.04, M('Metal'), verts=6)
        ch.sweep([(s * 2.3, 0.6, 0.38), (s * 1.9, 0.9, 0.54), (s * 0.44, 2.0, 0.66)], 0.045, M('Metal'), verts=6)
        ch.cyl(0.07, 0.24, (s * 0.44, 2.0, 0.66), M('Engine'), axis='X', verts=10)
    # tractor
    ch.bx(-0.42, 0.42, -0.2, 3.25, 0.45, 0.82, B, bevel=0.04, seg=2)
    ch.bx(-0.62, 0.62, 0.32, 1.62, 0.82, 0.9, M('Deck'), bevel=0.02)
    ch.bx(-0.5, 0.5, -0.24, -0.1, 0.5, 0.78, M('Metal'), bevel=0.02)
    for s in (-1, 1):
        ch.bx(s * 0.45, s * 1.12, 0.42, 1.58, 1.06, 1.14, B, bevel=0.035, seg=2)
        ch.bx(s * 0.45, s * 0.52, 0.42, 1.58, 0.82, 1.1, B)
        ch.cyl(0.06, 0.05, (s * 0.3, -0.26, 0.7), M('Light'), axis='Y', verts=10)
    ch.box((0.5, 0.3, 0.5), (0, 0.5, 1.12), B, bevel=0.05, seg=2, taper=(0.8, 0.8))
    ch.tube((0, 0.56, 1.33), (0, 0.74, 1.58), 0.035, M('Metal'))
    ch.sweep(steering_ring(0.74, 1.58), 0.022, M('Grip'), closed=True, verts=6)
    ch.tube((-0.2, 0.74, 1.58), (0.2, 0.74, 1.58), 0.015, M('Grip'))
    ch.bx(-0.3, 0.3, 1.1, 1.6, 0.88, 1.1, B, bevel=0.04, seg=2)
    ch.box((0.62, 0.5, 0.14), (0, 1.34, 1.17), M('Seat'), bevel=0.06, seg=2)
    ch.box((0.62, 0.13, 0.55), (0, 1.6, 1.5), M('Seat'), bevel=0.06, seg=2, rot=(-10, 0, 0))
    ch.box((1.06, 1.45, 0.74), (0, 2.5, 1.18), B, bevel=0.1, seg=2, taper=(0.92, 0.94))
    for i in range(4):
        ch.bx(-0.38, 0.38, 3.24, 3.25, 0.95 + i * 0.12, 1.01 + i * 0.12, M('Plastic'))
    ch.bx(-0.42, 0.42, 3.22, 3.24, 0.88, 1.44, M('Plastic'))
    ch.cyl(0.06, 0.55, (0.34, 2.0, 1.72), M('Metal'), verts=10)
    ch.sweep([(-0.64, 1.78, 0.9), (-0.64, 1.78, 2.2), (-0.5, 1.78, 2.36), (0.5, 1.78, 2.36), (0.64, 1.78, 2.2),
              (0.64, 1.78, 0.9)], 0.05, M('Metal'), verts=10)
    for s in (-1, 1):
        ch.cyl(0.06, 0.08, (s * 0.42, 3.25, 0.95), M('TailLight'), axis='Y', verts=10)
    dk.finish()
    ch.finish()
    for s, n in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_F' + n, 0.5, 0.38, (s * 0.86, 1.0, 0.5), verts=18, rim_frac=0.55)
        wheel('Wheel_R' + n, 0.4, 0.3, (s * 0.76, 2.72, 0.4), verts=16, rim_frac=0.55)
    seated_driver(1.36, 1.24)


MOWERS = {
    'mower_reel': (mower_reel, 1.0),
    'mower_push': (mower_push, 1.2),
    'mower_selfprop': (mower_selfprop, 1.3),
    'mower_walkbehind': (mower_walkbehind, 1.8),
    'mower_zt48': (mower_zt48, 2.4),
    'mower_standon': (mower_standon, 2.6),
    'mower_zt60': (mower_zt60, 3.0),
    'mower_widearea': (mower_widearea, 3.8),
    'mower_gangreel': (mower_gangreel, 6.0),
}
