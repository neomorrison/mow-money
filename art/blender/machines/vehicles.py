# Mow Money vehicles. Front faces -Y, origin on the ground at the footprint center (build.py recenters).
# Objects: Body (the static vehicle, trailers included) and Wheel_* (origin at the axle, spin around X).
from lib import Part, M, body, material, wheel, arc, empty


def lower_profile(y_front, y_back, z_bot, z_top, axles, wheel_z, arch_r, nose=0.1):
    """Side silhouette (y, z) of a body section with wheel arch notches, front at y_front."""
    import math
    if nose > 0:
        pts = [(y_front, z_bot + 0.05), (y_front, z_top - nose), (y_front + nose, z_top), (y_back, z_top),
               (y_back, z_bot)]
    else:
        pts = [(y_front, z_bot), (y_front, z_top), (y_back, z_top), (y_back, z_bot)]
    for ay in sorted(axles, reverse=True):
        a = math.degrees(math.asin(max(-1.0, min(1.0, (z_bot - wheel_z) / arch_r))))
        pts += arc(ay, wheel_z, arch_r, a, 180 - a, 9)
    return pts


def truck(p, W=1.0, hood=1.5, cab=1.4, bed=2.1, zb=0.5, belt=1.15, roof=1.85, wr=0.38, crew=False, old=True):
    """A pickup built into Part p, front bumper face near y = -0.15. Returns wheel spots and the hitch y."""
    B = M('Body')
    y0 = 0.0
    cowl = y0 + hood
    cab_back = cowl + cab
    bed_front = cab_back + 0.05
    bed_back = bed_front + bed
    fy = y0 + 0.9
    ry = bed_front + bed * 0.46
    ar = wr + 0.09
    # hood and cab lower body
    p.prism(lower_profile(y0, cab_back, zb, belt, [fy], wr, ar), 2 * W, B, axis='X')
    # greenhouse
    ws = 0.62 if old else 0.72
    gh = [(cowl, belt), (cowl + ws, roof), (cab_back - 0.02, roof), (cab_back, belt)]
    p.prism(gh, 2 * W - 0.12, B, axis='X', bevel=0.03)
    glass = M('Glass')
    dz = roof - belt
    wx = W - 0.06 - 0.1
    p.slab([(-wx, cowl + ws * 0.08 - 0.012, belt + dz * 0.08), (wx, cowl + ws * 0.08 - 0.012, belt + dz * 0.08),
            (wx, cowl + ws * 0.9 - 0.012, belt + dz * 0.9), (-wx, cowl + ws * 0.9 - 0.012, belt + dz * 0.9)],
           0.012, glass)
    for s in (-1, 1):
        x = s * (W - 0.06 + 0.004)
        zt, zl = roof - 0.08, belt + 0.07
        yf_top = cowl + ws * ((zt - belt) / dz) + 0.08
        yf_bot = cowl + ws * ((zl - belt) / dz) + 0.08
        if crew:
            mid = (cowl + cab_back) / 2 + 0.1
            wins = [[(yf_bot, zl), (mid - 0.05, zl), (mid - 0.05, zt), (yf_top, zt)],
                    [(mid + 0.05, zl), (cab_back - 0.12, zl), (cab_back - 0.12, zt), (mid + 0.05, zt)]]
        else:
            wins = [[(yf_bot, zl), (cab_back - 0.12, zl), (cab_back - 0.12, zt), (yf_top, zt)]]
        for w in wins:
            p.slab([(x, y, z) for (y, z) in w], s * 0.01, glass)
        # door seams, handles, mirrors
        seams = [cowl + 0.06, cab_back - 0.05] + ([(cowl + cab_back) / 2 + 0.1] if crew else [])
        for sy in seams:
            p.bx(s * W, s * (W + 0.006), sy - 0.008, sy + 0.008, zb + 0.08, belt - 0.02, M('Plastic'))
        for hy in ([cab_back - 0.3] + ([(cowl + cab_back) / 2 - 0.2] if crew else [])):
            p.bx(s * W, s * (W + 0.02), hy - 0.07, hy + 0.07, belt - 0.14, belt - 0.1, M('Chrome'))
        p.bx(s * (W + 0.02), s * (W + 0.17), cowl + 0.12, cowl + 0.16, belt + 0.12, belt + 0.32, M('Plastic'),
             bevel=0.015)
        p.tube((s * (W - 0.05), cowl + 0.14, belt + 0.06), (s * (W + 0.05), cowl + 0.14, belt + 0.2), 0.012,
               M('Plastic'), verts=6)
        if crew:
            p.bx(s * (W + 0.01), s * (W + 0.17), cowl + 0.1, cab_back - 0.1, zb - 0.1, zb - 0.04, M('Metal'),
                 bevel=0.01)
    p.slab([(-wx, cab_back + 0.002, belt + 0.1), (wx, cab_back + 0.002, belt + 0.1),
            (wx, cab_back + 0.002, roof - 0.1), (-wx, cab_back + 0.002, roof - 0.1)], 0.01, glass)
    # front end
    p.bx(-W + 0.22, W - 0.22, y0 - 0.03, y0 + 0.01, zb + 0.17, belt - 0.12, M('Chrome'), bevel=0.01)
    p.bx(-W + 0.27, W - 0.27, y0 - 0.045, y0, zb + 0.21, belt - 0.16, M('Plastic'))
    for i in range(3):
        z = zb + 0.26 + i * (belt - zb - 0.44) / 2
        p.bx(-W + 0.27, W - 0.27, y0 - 0.055, y0 - 0.04, z - 0.012, z + 0.012, M('Chrome'))
    for s in (-1, 1):
        hx = s * (W - 0.14)
        if old:
            p.bx(hx - 0.12, hx + 0.12, y0 - 0.03, y0 + 0.01, belt - 0.4, belt - 0.14, M('Chrome'), bevel=0.01)
            p.cyl(0.09, 0.04, (hx, y0 - 0.035, belt - 0.27), M('Light'), axis='Y', verts=14)
        else:
            p.bx(hx - 0.14, hx + 0.1, y0 - 0.04, y0 + 0.01, belt - 0.32, belt - 0.12, M('Light'), bevel=0.01)
        p.bx(hx - 0.08, hx + 0.08, y0 - 0.2, y0 - 0.14, zb + 0.04, zb + 0.1, M('Marker'))
    p.bx(-W - 0.04, W + 0.04, y0 - 0.16, y0 - 0.01, zb - 0.07, zb + 0.13,
         M('Chrome') if old else M('Plastic'), bevel=0.03)
    # bed
    for s in (-1, 1):
        p.prism(lower_profile(bed_front, bed_back, zb, belt, [ry], wr, ar, nose=0.0), 0.08, B, axis='X',
                center=s * (W - 0.04))
        p.bx(s * W, s * (W - 0.1), bed_front, bed_back, belt, belt + 0.03, M('Plastic'))
        p.bx(s * (W - 0.02), s * (W - 0.16), bed_back - 0.01, bed_back + 0.025, belt - 0.42, belt - 0.1,
             M('TailLight'))
        p.bx(s * (W - 0.08), s * (W - 0.4), ry - 0.48, ry + 0.48, zb + 0.14, wr * 2 + 0.2, M('Bed'), bevel=0.04)
    p.bx(-W + 0.08, W - 0.08, bed_front, bed_back - 0.06, zb + 0.1, zb + 0.16, M('Bed'))
    p.bx(-W, W, bed_front, bed_front + 0.07, zb + 0.05, belt, B)
    p.bx(-W + 0.08, W - 0.08, bed_back - 0.07, bed_back, zb + 0.08, belt - 0.02, B)
    p.bx(-0.16, 0.16, bed_back, bed_back + 0.012, belt - 0.16, belt - 0.1, M('Chrome'))
    p.bx(-W - 0.02, W + 0.02, bed_back, bed_back + 0.14, zb - 0.06, zb + 0.1, M('Chrome') if old else M('Plastic'),
         bevel=0.03)
    # underbody and hitch
    p.bx(-W + 0.18, W - 0.18, y0 + 0.2, bed_back - 0.1, 0.3, zb + 0.02, M('Metal'))
    p.cyl(0.035, 0.3, (-W + 0.35, bed_back + 0.05, 0.36), M('Metal'), axis='Y', verts=8)
    p.bx(-0.05, 0.05, bed_back + 0.1, bed_back + 0.3, 0.38, 0.44, M('Metal'))
    p.sphere(0.035, (0, bed_back + 0.27, 0.48), M('Chrome'), seg=8, rings=5)
    wheels = [(fy, wr), (ry, wr)]
    return wheels, bed_back + 0.27, W - 0.14


def add_wheels(prefix, spots, x, w, style='car', rim=None, verts=20):
    for i, (y, r) in enumerate(spots):
        for s, n in ((1, 'L'), (-1, 'R')):
            wheel('Wheel_%s%d%s' % (prefix, i + 1, n), r, w, (s * x, y, r), style=style, rim_m=rim, verts=verts,
                  rim_frac=0.64, side=s)


def tongue(p, y_hitch, y_box, z, W):
    for s in (-1, 1):
        p.tube((0, y_hitch + 0.12, z), (s * (W - 0.25), y_box + 0.02, z), 0.045, M('Metal'), verts=6)
    p.bx(-0.07, 0.07, y_hitch - 0.06, y_hitch + 0.2, z - 0.05, z + 0.07, M('Metal'), bevel=0.02)
    p.cyl(0.04, 0.5, (0.22, y_hitch + 0.45, z - 0.05), M('Metal'), verts=8)
    p.cyl(0.05, 0.05, (0.22, y_hitch + 0.45, 0.05), M('Tire'), axis='X', verts=10)


def open_trailer(p, y_hitch, L=3.8, W=1.12, wr=0.3):
    """12 ft utility trailer with rails and a ramp gate."""
    y0 = y_hitch + 0.95
    y1 = y0 + L
    zf = 0.58
    tongue(p, y_hitch, y0, 0.46, W)
    n = 7
    pw = 2 * W / n
    for i in range(n):
        x0 = -W + i * pw
        p.bx(x0 + 0.01, x0 + pw - 0.01, y0, y1, zf - 0.05, zf, M('Wood'))
    for s in (-1, 1):
        p.bx(s * W, s * (W - 0.08), y0, y1, zf - 0.14, zf + 0.02, M('Metal'))
        p.tube((s * (W - 0.03), y0, zf + 0.44), (s * (W - 0.03), y1, zf + 0.44), 0.03, M('Metal'), verts=8)
        k = 6
        for i in range(k + 1):
            y = y0 + 0.03 + i * (L - 0.06) / k
            p.bx(s * (W - 0.06), s * W, y - 0.03, y + 0.03, zf, zf + 0.44, M('Metal'))
        ay = y0 + L * 0.55
        p.bx(s * (W + 0.02), s * (W + 0.3), ay - 0.45, ay + 0.45, wr * 2 + 0.06, wr * 2 + 0.1, M('Metal'),
             bevel=0.01)
        p.bx(s * (W + 0.0), s * (W + 0.3), ay - 0.49, ay - 0.45, zf - 0.08, wr * 2 + 0.1, M('Metal'))
        p.bx(s * (W - 0.06), s * (W - 0.2), y1 - 0.02, y1 + 0.02, zf - 0.1, zf - 0.02, M('TailLight'))
    p.bx(-W, W, y0 - 0.06, y0, zf - 0.14, zf + 0.44, M('Metal'))
    p.tube((-W, y0 - 0.03, zf + 0.44), (W, y0 - 0.03, zf + 0.44), 0.03, M('Metal'), verts=8)
    for i in range(1, 8):
        x = -W + i * 2 * W / 8
        p.bx(x - 0.012, x + 0.012, y0 - 0.05, y0 - 0.01, zf, zf + 0.42, M('Metal'))
    # ramp gate standing up at the rear, leaning back
    import math
    lean = math.radians(12)
    gh = 1.05
    top = (y1 + math.sin(lean) * gh, zf + math.cos(lean) * gh)
    p.sweep([(-W + 0.04, y1, zf), (-W + 0.04, top[0], top[1]), (W - 0.04, top[0], top[1]), (W - 0.04, y1, zf)],
            0.03, M('Steel'), verts=6)
    for i in range(1, 10):
        x = -W + 0.04 + i * (2 * W - 0.08) / 10
        p.tube((x, y1, zf), (x, top[0], top[1]), 0.013, M('Steel'), verts=5)
    p.tube((-W + 0.04, y1 + math.sin(lean) * 0.5, zf + math.cos(lean) * 0.5),
           (W - 0.04, y1 + math.sin(lean) * 0.5, zf + math.cos(lean) * 0.5), 0.02, M('Steel'), verts=6)
    p.bx(-W, W, y1 - 0.06, y1, zf - 0.14, zf + 0.02, M('Metal'))
    return [(y0 + L * 0.55, wr)], W + 0.16


def enclosed_trailer(p, y_hitch, L=4.9, W=1.22, H=2.25, wr=0.32):
    """16 ft enclosed trailer with a V-nose, a body-colored stripe and a rear ramp door."""
    yb0 = y_hitch + 1.0
    yb1 = yb0 + L
    zf = 0.52
    nose = 0.45
    tongue(p, y_hitch, yb0 + 0.1, 0.46, W)
    outline = [(-W, yb0 + nose), (0.0, yb0), (W, yb0 + nose), (W, yb1), (-W, yb1)]

    def grow(pts, g):
        return [(x + (g if x > 0 else -g if x < 0 else 0), y + (-g if y < yb0 + nose else g if y >= yb1 else 0))
                for (x, y) in pts]
    p.prism(outline, H, M('Box'), axis='Z', center=zf + H / 2, bevel=0.02)
    p.prism(grow(outline, 0.012), 0.26, M('Body'), axis='Z', center=zf + H * 0.42)
    p.prism(grow(outline, 0.012), 0.06, M('Body'), axis='Z', center=zf + H * 0.42 + 0.2)
    p.prism(grow(outline, 0.018), 0.14, M('Trim'), axis='Z', center=zf + 0.05)
    p.prism(grow(outline, 0.012), 0.06, M('Trim'), axis='Z', center=zf + H - 0.02)
    p.bx(-W + 0.1, W - 0.1, yb0 + 0.3, yb1 - 0.1, 0.3, zf, M('Metal'))
    # rear ramp door and hinges
    p.sweep([(-W + 0.08, yb1 + 0.01, zf + 0.08), (-W + 0.08, yb1 + 0.01, zf + H - 0.1),
             (W - 0.08, yb1 + 0.01, zf + H - 0.1), (W - 0.08, yb1 + 0.01, zf + 0.08)], 0.022, M('Trim'), verts=6,
            closed=True)
    for s in (-1, 1):
        p.tube((s * 0.5, yb1 + 0.03, zf + 0.15), (s * 0.5, yb1 + 0.03, zf + H - 0.2), 0.016, M('Chrome'), verts=6)
        p.bx(s * (W - 0.04), s * (W - 0.14), yb1, yb1 + 0.03, zf + 0.08, zf + 0.22, M('TailLight'))
        p.bx(s * (W - 0.03), s * (W + 0.005), yb1 - 0.15, yb1 + 0.005, zf, zf + H, M('Trim'))
        p.bx(s * (W - 0.02), s * (W + 0.01), yb1 - 0.12, yb1 - 0.06, zf + H - 0.12, zf + H - 0.06, M('Marker'))
        p.bx(s * (W - 0.02), s * (W + 0.01), yb0 + nose + 0.05, yb0 + nose + 0.11, zf + H - 0.12, zf + H - 0.06,
             M('Marker'))
    # side door on the curb side (-X)
    dy0, dy1 = yb0 + nose + 0.35, yb0 + nose + 1.2
    p.sweep([(-W - 0.012, dy0, zf + 0.1), (-W - 0.012, dy0, zf + 1.95), (-W - 0.012, dy1, zf + 1.95),
             (-W - 0.012, dy1, zf + 0.1)], 0.018, M('Trim'), verts=6, closed=True)
    p.bx(-W - 0.03, -W, dy1 - 0.16, dy1 - 0.08, zf + 0.95, zf + 1.02, M('Chrome'))
    p.bx(-0.3, 0.3, yb1 - 1.4, yb1 - 0.8, zf + H, zf + H + 0.08, M('Trim'), bevel=0.02)
    ay = yb0 + L * 0.56
    spots = [(ay - 0.42, wr), (ay + 0.42, wr)]
    for s in (-1, 1):
        p.bx(s * W, s * (W + 0.22), ay - 0.82, ay + 0.82, wr * 2 + 0.06, wr * 2 + 0.1, M('Chrome'), bevel=0.02)
        p.bx(s * W, s * (W + 0.22), ay - 0.86, ay - 0.82, zf - 0.02, wr * 2 + 0.1, M('Chrome'))
        p.bx(s * W, s * (W + 0.22), ay + 0.82, ay + 0.86, zf - 0.02, wr * 2 + 0.1, M('Chrome'))
    return spots, W + 0.08


def veh_bike():
    B = body('#2F6FD0')
    p = Part('Body')
    fr = M('Body')
    r = 0.34
    fy, ry = -0.55, 0.5
    bb = (0, 0.05, 0.3)
    st = (0, 0.18, 0.84)
    ht_top, ht_bot = (0, -0.4, 0.9), (0, -0.37, 0.72)
    for a, b in ((bb, st), (st, ht_top), (bb, ht_bot), (ht_bot, ht_top)):
        p.tube(a, b, 0.024, fr, verts=8)
    for s in (-1, 1):
        p.tube((s * 0.04, bb[1], bb[2]), (s * 0.05, ry, r), 0.016, fr, verts=6)
        p.tube((s * 0.03, st[1], st[2] - 0.02), (s * 0.05, ry, r), 0.015, fr, verts=6)
        p.tube((s * 0.03, ht_bot[1], ht_bot[2] + 0.02), (s * 0.045, fy, r), 0.018, fr, verts=6)
    p.tube(st, (0, 0.21, 0.96), 0.016, M('Chrome'), verts=6)
    p.box((0.13, 0.26, 0.06), (0, 0.22, 0.99), M('Seat'), bevel=0.025, seg=2, taper=(1.5, 1.0))
    p.tube(ht_top, (0, -0.44, 1.04), 0.016, M('Chrome'), verts=6)
    p.sweep([(-0.3, -0.36, 1.08), (-0.2, -0.44, 1.05), (0.2, -0.44, 1.05), (0.3, -0.36, 1.08)], 0.014, M('Chrome'))
    for s in (-1, 1):
        p.tube((s * 0.22, -0.4, 1.065), (s * 0.31, -0.35, 1.085), 0.022, M('Grip'), verts=8)
    p.cyl(0.1, 0.012, (0.04, bb[1], bb[2]), M('Chrome'), axis='X', verts=14)
    for s in (-1, 1):
        p.tube((s * 0.07, bb[1], bb[2]), (s * 0.07, bb[1] + s * 0.14, bb[2] - s * 0.08), 0.012, M('Metal'), verts=6)
        p.box((0.08, 0.1, 0.02), (s * 0.12, bb[1] + s * 0.14, bb[2] - s * 0.08), M('Plastic'))
    # front basket
    p.box((0.34, 0.26, 0.2), (0, -0.62, 0.98), material('Basket', '#C08A4A', 0.8), bevel=0.02, taper=(1.1, 1.1))
    # cart trailer
    cy0, cy1 = 1.05, 2.2
    cw = 0.6
    p.sweep([(0.07, ry, r + 0.04), (0.16, ry + 0.25, 0.42), (0.1, cy0 - 0.2, 0.4), (0.0, cy0, 0.36)], 0.022,
            M('Metal'), verts=6)
    p.bx(-cw, cw, cy0, cy1, 0.26, 0.31, M('Wood'))
    for s in (-1, 1):
        p.bx(s * cw, s * (cw - 0.05), cy0, cy1, 0.26, 0.62, fr, bevel=0.012)
    p.bx(-cw, cw, cy0, cy0 + 0.05, 0.26, 0.62, fr, bevel=0.012)
    p.bx(-cw, cw, cy1 - 0.05, cy1, 0.26, 0.62, fr, bevel=0.012)
    for s in (-1, 1):
        p.bx(s * (cw + 0.01), s * (cw + 0.03), (cy0 + cy1) / 2 - 0.3, (cy0 + cy1) / 2 + 0.3, 0.52, 0.56, M('Chrome'))
        p.bx(s * (cw - 0.1), s * (cw - 0.3), cy1, cy1 + 0.015, 0.34, 0.42, M('TailLight'))
    p.cyl(0.025, 2 * cw + 0.2, (0, (cy0 + cy1) / 2, 0.24), M('Metal'), axis='X', verts=8)
    p.finish()
    wheel('Wheel_F', r, 0.05, (0, fy, r), style='thin', rim_m=M('Chrome'), verts=20)
    wheel('Wheel_R', r, 0.05, (0, ry, r), style='thin', rim_m=M('Chrome'), verts=20)
    for s, n in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_C' + n, 0.24, 0.07, (s * (cw + 0.1), (cy0 + cy1) / 2, 0.24), verts=16, rim_frac=0.6)
    empty('Driver', (0, 0.18, 1.02 + 0.04 - 0.86))


def veh_pickup():
    body('#C8312B')
    p = Part('Body')
    spots, hitch, wx = truck(p)
    p.finish()
    add_wheels('', spots, wx, 0.28)


def veh_pickup_trailer():
    body('#C8312B')
    p = Part('Body')
    spots, hitch, wx = truck(p)
    tspots, twx = open_trailer(p, hitch)
    p.finish()
    add_wheels('', spots, wx, 0.28)
    add_wheels('T', tspots, twx, 0.2, verts=16)


def veh_crewtruck():
    body('#2F6FD0')
    p = Part('Body')
    spots, hitch, wx = truck(p, W=1.08, hood=1.65, cab=2.15, bed=1.95, zb=0.56, belt=1.3, roof=2.05, wr=0.42,
                             crew=True, old=False)
    # headache rack
    p.sweep([(-1.0, 3.88, 1.3), (-1.0, 3.88, 2.1), (1.0, 3.88, 2.1), (1.0, 3.88, 1.3)], 0.035, M('Metal'), verts=6)
    for x in (-0.5, 0.0, 0.5):
        p.tube((x, 3.88, 1.3), (x, 3.88, 2.1), 0.015, M('Metal'), verts=5)
    tspots, twx = enclosed_trailer(p, hitch)
    p.finish()
    add_wheels('', spots, wx, 0.3)
    add_wheels('T', tspots, twx, 0.2, verts=16)


def veh_boxtruck():
    B = body('#2F6FD0')
    p = Part('Body')
    W = 1.1
    zb, belt, roof, wr = 0.66, 1.5, 2.6, 0.46
    y0, hood, cab = 0.0, 1.15, 1.55
    cowl, cab_back = y0 + hood, y0 + hood + cab
    fy = y0 + 0.78
    p.prism(lower_profile(y0, cab_back, zb, belt, [fy], wr, wr + 0.09, nose=0.14), 2 * W, B, axis='X')
    ws = 0.45
    p.prism([(cowl, belt), (cowl + ws, roof), (cab_back, roof), (cab_back, belt)], 2 * W - 0.1, B, axis='X',
            bevel=0.03)
    glass = M('Glass')
    wx = W - 0.15
    dz = roof - belt
    p.slab([(-wx, cowl + ws * 0.08 - 0.012, belt + dz * 0.08), (wx, cowl + ws * 0.08 - 0.012, belt + dz * 0.08),
            (wx, cowl + ws * 0.88 - 0.012, belt + dz * 0.88), (-wx, cowl + ws * 0.88 - 0.012, belt + dz * 0.88)],
           0.012, glass)
    for s in (-1, 1):
        x = s * (W - 0.05 + 0.004)
        zl, zt = belt + 0.06, roof - 0.12
        p.slab([(x, y, z) for (y, z) in [(cowl + ws * 0.06 + 0.1, zl), (cab_back - 0.55, zl), (cab_back - 0.55, zt),
                                          (cowl + ws * 0.9 + 0.1, zt)]], s * 0.01, glass)
        p.bx(s * W, s * (W + 0.006), cab_back - 0.5, cab_back - 0.49, zb + 0.1, roof - 0.1, M('Plastic'))
        p.bx(s * W, s * (W + 0.006), cowl + 0.08, cowl + 0.09, zb + 0.1, belt, M('Plastic'))
        p.bx(s * W, s * (W + 0.02), cab_back - 0.7, cab_back - 0.56, belt - 0.14, belt - 0.1, M('Chrome'))
        p.tube((s * (W - 0.05), cowl + 0.3, belt + 0.25), (s * (W + 0.25), cowl + 0.3, belt + 0.25), 0.018,
               M('Chrome'), verts=6)
        p.bx(s * (W + 0.22), s * (W + 0.28), cowl + 0.26, cowl + 0.34, belt + 0.12, belt + 0.62, M('Plastic'),
             bevel=0.01)
        p.bx(s * (W + 0.0), s * (W + 0.14), cab_back - 1.0, cab_back - 0.55, zb - 0.1, zb - 0.04, M('Metal'))
        hx = s * (W - 0.2)
        p.bx(hx - 0.16, hx + 0.12, y0 - 0.04, y0 + 0.01, belt - 0.36, belt - 0.16, M('Light'), bevel=0.01)
    p.bx(-W + 0.3, W - 0.3, y0 - 0.04, y0 + 0.01, zb + 0.18, belt - 0.14, M('Plastic'), bevel=0.01)
    for i in range(4):
        z = zb + 0.24 + i * 0.13
        p.bx(-W + 0.3, W - 0.3, y0 - 0.05, y0 - 0.04, z - 0.015, z + 0.015, M('Chrome'))
    p.bx(-W - 0.05, W + 0.05, y0 - 0.18, y0 - 0.01, zb - 0.1, zb + 0.14, M('Plastic'), bevel=0.03)
    # box
    by0, by1 = cab_back + 0.12, cab_back + 0.12 + 4.7
    bw = 1.26
    bz0, bz1 = 1.02, 3.45
    p.bx(-bw, bw, by0, by1, bz0, bz1, M('Box'), bevel=0.03)
    p.bx(-bw - 0.008, bw + 0.008, by0 + 0.05, by1 - 0.05, 1.55, 1.9, B)
    p.bx(-bw - 0.008, bw + 0.008, by0 + 0.05, by1 - 0.05, 1.96, 2.02, B)
    p.bx(-bw + 0.05, bw - 0.05, by0 - 0.008, by1 + 0.008, bz1 - 0.02, bz1 + 0.02, M('Trim'))
    for s in (-1, 1):
        p.bx(s * (bw - 0.03), s * (bw + 0.01), by1 - 0.06, by1 + 0.01, bz0, bz1, M('Trim'))
        p.bx(s * (bw - 0.03), s * (bw + 0.01), by0 - 0.01, by0 + 0.06, bz0, bz1, M('Trim'))
        p.bx(s * (bw - 0.05), s * (bw - 0.2), by1 + 0.0, by1 + 0.03, bz0 - 0.2, bz0 - 0.06, M('TailLight'))
        p.bx(s * (bw - 0.02), s * (bw + 0.01), by1 - 0.14, by1 - 0.08, bz1 - 0.12, bz1 - 0.06, M('Marker'))
    for i in range(9):
        z = bz0 + 0.14 + i * (bz1 - bz0 - 0.26) / 8
        p.bx(-bw + 0.12, bw - 0.12, by1, by1 + 0.012, z - 0.012, z + 0.012, M('Trim'))
    p.bx(-0.12, 0.12, by1, by1 + 0.03, bz0 + 0.12, bz0 + 0.18, M('Chrome'))
    # chassis, fuel tank, bumper step, mud flaps
    p.bx(-0.55, 0.55, 0.3, by1 - 0.1, 0.62, bz0, M('Metal'))
    p.cyl(0.2, 0.8, (-W - 0.02, cab_back + 0.55, 0.62), M('Chrome'), axis='Y', verts=14)
    p.bx(-bw + 0.1, bw - 0.1, by1 - 0.05, by1 + 0.22, 0.52, 0.66, M('Metal'), bevel=0.02)
    ry = by1 - 1.35
    for s in (-1, 1):
        p.bx(s * 0.72, s * 1.2, ry + wr + 0.08, ry + wr + 0.12, 0.2, 0.9, M('Plastic'))
    p.finish()
    for s, n in ((1, 'L'), (-1, 'R')):
        wheel('Wheel_1' + n, wr, 0.3, (s * 0.9, fy, wr), style='car', rim_m=M('Rim'), verts=20, rim_frac=0.64, side=s)
        wheel('Wheel_2' + n, wr, 0.5, (s * 0.94, ry, wr), style='car', rim_m=M('Rim'), verts=20, rim_frac=0.64,
              side=s)


VEHICLES = {
    'veh_bike': veh_bike,
    'veh_pickup': veh_pickup,
    'veh_pickup_trailer': veh_pickup_trailer,
    'veh_crewtruck': veh_crewtruck,
    'veh_boxtruck': veh_boxtruck,
}
