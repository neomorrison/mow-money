"""Shared helpers for the world art scripts (buildings, nature, props).

Everything is built into a single bmesh per model (one mesh, several materials), flat shaded,
then exported as GLB. Blender is Z-up; the glTF exporter converts to three.js Y-up and maps
Blender -Y to three.js +Z, so fronts (doors, sign faces) are modeled facing Blender -Y.

1 unit = 1 meter. Origin on the ground (z = 0) at the footprint center.
"""
import bpy
import bmesh
import math
import os
import json
import random
from contextlib import contextmanager
from mathutils import Matrix, Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MODELS_DIR = os.path.join(ROOT, "public", "models")
OUT_DIR = os.path.join(ROOT, "out")


# ---------------------------------------------------------------- colors and materials
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


def make_material(name, color, rough=0.8, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0, double=False):
    m = bpy.data.materials.new(name)
    m.use_backface_culling = not double
    try:
        m.use_nodes = True
    except Exception:
        pass
    lin = hex_rgb(color)
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(emit), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
        try:
            m.blend_method = "BLEND"
        except Exception:
            pass
    m.diffuse_color = (*lin, alpha)
    m.roughness = rough
    m.metallic = metal
    return m


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _euler(rot):
    return Euler(tuple(math.radians(a) for a in rot), "XYZ").to_matrix().to_4x4()


def T(v):
    return Matrix.Translation(Vector(v))


def S(v):
    return Matrix.Diagonal((v[0], v[1], v[2], 1.0))


# ---------------------------------------------------------------- builder
class Builder:
    """Accumulates flat-shaded geometry into one bmesh with per-face materials.

    Coordinates passed to primitives are local to the current frame (see `at`).
    """

    def __init__(self, name, seed=1):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []            # material names in slot order
        self.mat_objs = {}
        self.stack = [Matrix()]
        self.recenter = False     # buildings: recenter XY on the bounding box
        self.uvs = False          # export texcoords (only models with a UV-mapped sign panel)
        self.rng = random.Random(seed)

    # ---------- materials
    def mat(self, name, color, **kw):
        if name not in self.mat_objs:
            self.mat_objs[name] = make_material(name, color, **kw)
        return name

    def _mi(self, name):
        if name not in self.mat_objs:
            raise KeyError("material not defined: " + name)
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def _paint(self, faces, mat):
        mi = self._mi(mat)
        for f in faces:
            f.material_index = mi
            f.smooth = False
        return faces

    @staticmethod
    def _faces_of(verts):
        # ordered and unique, so seeded per-face randomness is reproducible between runs
        fs = {}
        for v in verts:
            for f in v.link_faces:
                fs[f] = None
        return list(fs)

    def uv_panel(self, verts, normal=(0, -1, 0), mirror=False):
        """Planar 0..1 UVs on the faces of a primitive that face `normal` (world, axis aligned X/Z panel).
        UV (0,0) is the bottom-left seen from the front; glTF flips V, so use texture.flipY = false."""
        self.uvs = True
        uv = self.bm.loops.layers.uv.verify()
        n = Vector(normal)
        for f in self._faces_of(verts):
            f.normal_update()
            if f.normal.dot(n) < 0.9:
                continue
            xs = [v.co.x for v in f.verts]
            zs = [v.co.z for v in f.verts]
            x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
            for loop in f.loops:
                u = (loop.vert.co.x - x0) / max(1e-6, x1 - x0)
                if mirror:
                    u = 1.0 - u
                loop[uv].uv = (u, (loop.vert.co.z - z0) / max(1e-6, z1 - z0))

    # ---------- frames
    @property
    def M(self):
        return self.stack[-1]

    @contextmanager
    def at(self, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, scale=None):
        m = T(loc) @ _euler((rx, ry, rz))
        if scale is not None:
            m = m @ S(scale)
        self.stack.append(self.M @ m)
        try:
            yield
        finally:
            self.stack.pop()

    @contextmanager
    def wall(self, side, plane):
        """Frame on the outside face of a wall. Local: outward normal = -y, z up, wall surface y = 0.
        u (local x) maps to world coordinates: front u = x, back u = -x, right u = y, left u = -y.
        plane = the wall's world y (front/back) or x (left/right)."""
        if side == "front":
            loc, rz = (0, plane, 0), 0
        elif side == "back":
            loc, rz = (0, plane, 0), 180
        elif side == "right":
            loc, rz = (plane, 0, 0), 90
        elif side == "left":
            loc, rz = (plane, 0, 0), -90
        else:
            raise ValueError(side)
        with self.at(loc, rz=rz):
            yield

    # ---------- primitives
    def box(self, size, loc, mat, rot=(0, 0, 0), bevel=0.0):
        M = self.M @ T(loc) @ _euler(rot) @ S(size)
        verts = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)["verts"]
        faces = self._faces_of(verts)
        self._paint(faces, mat)
        if bevel > 0:
            edges = {}
            for v in verts:
                for e in v.link_edges:
                    edges[e] = None
            bmesh.ops.bevel(self.bm, geom=list(verts) + list(edges), offset=bevel, segments=1,
                            affect="EDGES", profile=0.5, material=-1, clamp_overlap=True)
        return verts

    def block(self, x0, x1, y0, y1, z0, z1, mat, bevel=0.0):
        """Axis aligned box from extents (in the current frame)."""
        return self.box((abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)),
                        ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat, bevel=bevel)

    def cyl(self, r, h, loc=(0, 0, 0), mat=None, seg=8, r2=None, rot=(0, 0, 0), cap=True,
            scale=(1, 1), phase=None):
        """Cylinder or cone frustum with its base center at loc, axis along local +Z (after rot).
        r2 = 0 makes a pointed cone."""
        if r2 is None:
            r2 = r
        M = self.M @ T(loc) @ _euler(rot)
        bm = self.bm
        if phase is None:
            phase = math.pi / seg
        def ring(rad, z):
            return [bm.verts.new(M @ Vector((rad * scale[0] * math.cos(phase + 2 * math.pi * i / seg),
                                               rad * scale[1] * math.sin(phase + 2 * math.pi * i / seg), z)))
                    for i in range(seg)]
        bot = ring(r, 0.0)
        faces = []
        if r2 <= 1e-6:
            apex = bm.verts.new(M @ Vector((0, 0, h)))
            for i in range(seg):
                faces.append(bm.faces.new((bot[i], bot[(i + 1) % seg], apex)))
        else:
            top = ring(r2, h)
            for i in range(seg):
                j = (i + 1) % seg
                faces.append(bm.faces.new((bot[i], bot[j], top[j], top[i])))
            if cap:
                faces.append(bm.faces.new(top))
        if cap:
            faces.append(bm.faces.new(list(reversed(bot))))
        self._paint(faces, mat)
        return faces

    def rod(self, p0, p1, r0, r1=None, mat=None, seg=6):
        """Tapered cylinder between two points (current frame)."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        e = d.normalized().to_track_quat("Z", "Y").to_euler()
        return self.cyl(r0, d.length, tuple(p0), mat, seg=seg, r2=r0 if r1 is None else r1,
                        rot=(math.degrees(e.x), math.degrees(e.y), math.degrees(e.z)))

    def tube(self, r_out, r_in, h, loc=(0, 0, 0), mat=None, seg=16, rot=(0, 0, 0)):
        """Hollow ring (pool walls, trampoline pads)."""
        M = self.M @ T(loc) @ _euler(rot)
        bm = self.bm
        def ring(rad, z):
            return [bm.verts.new(M @ Vector((rad * math.cos(2 * math.pi * i / seg), rad * math.sin(2 * math.pi * i / seg), z)))
                    for i in range(seg)]
        ob, ot, ib, it = ring(r_out, 0), ring(r_out, h), ring(r_in, 0), ring(r_in, h)
        faces = []
        for i in range(seg):
            j = (i + 1) % seg
            faces.append(bm.faces.new((ob[i], ob[j], ot[j], ot[i])))
            faces.append(bm.faces.new((ib[j], ib[i], it[i], it[j])))
            faces.append(bm.faces.new((ot[i], ot[j], it[j], it[i])))
            faces.append(bm.faces.new((ob[j], ob[i], ib[i], ib[j])))
        self._paint(faces, mat)
        return faces

    def torus(self, R, r, loc=(0, 0, 0), mat=None, seg=16, rseg=6, rot=(0, 0, 0)):
        M = self.M @ T(loc) @ _euler(rot)
        bm = self.bm
        grid = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            row = []
            for k in range(rseg):
                b = 2 * math.pi * k / rseg
                rr = R + r * math.cos(b)
                row.append(bm.verts.new(M @ Vector((rr * math.cos(a), rr * math.sin(a), r * math.sin(b)))))
            grid.append(row)
        faces = []
        for i in range(seg):
            for k in range(rseg):
                i2, k2 = (i + 1) % seg, (k + 1) % rseg
                faces.append(bm.faces.new((grid[i][k], grid[i2][k], grid[i2][k2], grid[i][k2])))
        self._paint(faces, mat)
        return faces

    def blob(self, r, loc, mat, subdiv=2, scale=(1, 1, 1), noise=0.12, rot=(0, 0, 0), flat_bottom=None):
        """Faceted low-poly blob (icosphere with random radial displacement)."""
        verts = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=1.0, matrix=Matrix())["verts"]
        M = self.M @ T(loc) @ _euler(rot) @ S((r * scale[0], r * scale[1], r * scale[2]))
        for v in verts:
            d = 1.0 + self.rng.uniform(-noise, noise)
            co = v.co * d
            if flat_bottom is not None and co.z < flat_bottom:
                co.z = flat_bottom
            v.co = M @ co
        faces = self._faces_of(verts)
        self._paint(faces, mat)
        return faces

    def uvsphere(self, r, loc, mat, seg=8, rings=6, scale=(1, 1, 1), rot=(0, 0, 0), mats=None):
        """Low-poly UV sphere. mats: optional list of materials cycled per segment wedge."""
        M = self.M @ T(loc) @ _euler(rot) @ S((r * scale[0], r * scale[1], r * scale[2]))
        bm = self.bm
        top = bm.verts.new(M @ Vector((0, 0, 1)))
        bot = bm.verts.new(M @ Vector((0, 0, -1)))
        rows = []
        for k in range(1, rings):
            th = math.pi * k / rings
            rows.append([bm.verts.new(M @ Vector((math.sin(th) * math.cos(2 * math.pi * i / seg),
                                                   math.sin(th) * math.sin(2 * math.pi * i / seg), math.cos(th))))
                         for i in range(seg)])
        faces_by_wedge = [[] for _ in range(seg)]
        for i in range(seg):
            j = (i + 1) % seg
            faces_by_wedge[i].append(bm.faces.new((top, rows[0][i], rows[0][j])))
            for k in range(len(rows) - 1):
                faces_by_wedge[i].append(bm.faces.new((rows[k][i], rows[k + 1][i], rows[k + 1][j], rows[k][j])))
            faces_by_wedge[i].append(bm.faces.new((rows[-1][j], rows[-1][i], bot)))
        allf = []
        for i, fl in enumerate(faces_by_wedge):
            self._paint(fl, mats[i % len(mats)] if mats else mat)
            allf += fl
        bmesh.ops.recalc_face_normals(bm, faces=allf)
        return allf

    def prism(self, profile, a0, a1, mat, axis="x"):
        """Extrude a 2D profile along an axis. axis 'x': profile points are (y, z);
        axis 'y': profile points are (x, z); axis 'z': profile points are (x, y)."""
        bm = self.bm
        M = self.M
        def P(p, a):
            if axis == "x":
                return M @ Vector((a, p[0], p[1]))
            if axis == "y":
                return M @ Vector((p[0], a, p[1]))
            return M @ Vector((p[0], p[1], a))
        v0 = [bm.verts.new(P(p, a0)) for p in profile]
        v1 = [bm.verts.new(P(p, a1)) for p in profile]
        n = len(profile)
        faces = []
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((v0[i], v0[j], v1[j], v1[i])))
        faces.append(bm.faces.new(v0))
        faces.append(bm.faces.new(list(reversed(v1))))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._paint(faces, mat)
        return faces

    def poly(self, pts, mat, double=False):
        """A single flat polygon from world points in the current frame."""
        vs = [self.bm.verts.new(self.M @ Vector(p)) for p in pts]
        faces = [self.bm.faces.new(vs)]
        if double:
            vs2 = [self.bm.verts.new(self.M @ Vector(p)) for p in reversed(pts)]
            faces.append(self.bm.faces.new(vs2))
        self._paint(faces, mat)
        return faces

    def hull(self, pts, mat):
        """Convex hull of the given points (current frame)."""
        vs = [self.bm.verts.new(self.M @ Vector(p)) for p in pts]
        res = bmesh.ops.convex_hull(self.bm, input=vs)
        faces = [g for g in res["geom"] if isinstance(g, bmesh.types.BMFace)]
        # drop interior leftovers (loose verts)
        loose = [v for v in vs if v.is_valid and not v.link_faces]
        if loose:
            bmesh.ops.delete(self.bm, geom=loose, context="VERTS")
        self._paint(faces, mat)
        return faces

    # ---------- architecture
    def gable_roof(self, x0, x1, y0, y1, z0, rise, mat, over=0.4, thick=0.2, ridge="x", over_end=None,
                   fascia=None, fascia_to=None):
        """Gable roof slab over the rectangle. Ridge along x (gables on the left/right walls) or y
        (gables face front/back). z0 = top of walls. Returns the eave height at the overhang."""
        if over_end is None:
            over_end = over
        if ridge == "x":
            half = (y1 - y0) / 2
            c = (y0 + y1) / 2
            lo, hi, a0, a1 = y0, y1, x0 - over_end, x1 + over_end
        else:
            half = (x1 - x0) / 2
            c = (x0 + x1) / 2
            lo, hi, a0, a1 = x0, x1, y0 - over_end, y1 + over_end
        s = rise / half
        ze = z0 - over * s
        tv = thick * math.sqrt(1 + s * s)
        prof = [(lo - over, ze - tv), (lo - over, ze), (c, z0 + rise), (hi + over, ze), (hi + over, ze - tv),
                (c, z0 + rise - tv)]
        self.prism(prof, a0, a1, mat, axis=ridge)
        if fascia:
            ft = 0.06
            if fascia_to is not None:
                a1 = fascia_to
            if ridge == "x":
                self.block(a0, a1, lo - over - ft, lo - over + 0.01, ze - tv - 0.06, ze + 0.02, fascia)
                self.block(a0, a1, hi + over - 0.01, hi + over + ft, ze - tv - 0.06, ze + 0.02, fascia)
            else:
                self.block(lo - over - ft, lo - over + 0.01, a0, a1, ze - tv - 0.06, ze + 0.02, fascia)
                self.block(hi + over - 0.01, hi + over + ft, a0, a1, ze - tv - 0.06, ze + 0.02, fascia)
        return ze

    def gable_fill(self, x0, x1, y0, y1, z0, rise, mat, ridge="x", thick=0.14):
        """Triangular wall infill under a gable roof (in the wall material). The slopes sit inside the
        roof slab (never coplanar with its top surface, which would z-fight)."""
        half = ((y1 - y0) if ridge == "x" else (x1 - x0)) / 2
        s = rise / half
        tv = min(thick, 0.12) * math.sqrt(1 + s * s) * 0.5
        if ridge == "x":
            c = (y0 + y1) / 2
            self.prism([(y0, z0 - tv), (y1, z0 - tv), (c, z0 + rise - tv)], x0, x1, mat, axis="x")
        else:
            c = (x0 + x1) / 2
            self.prism([(x0, z0 - tv), (x1, z0 - tv), (c, z0 + rise - tv)], y0, y1, mat, axis="y")

    def hip_roof(self, x0, x1, y0, y1, z0, rise, mat, over=0.4, fascia=None, fascia_h=0.18):
        """Hip roof (equal pitch) over the rectangle; z0 = top of walls."""
        X0, X1, Y0, Y1 = x0 - over, x1 + over, y0 - over, y1 + over
        W, D = X1 - X0, Y1 - Y0
        half = min(W, D) / 2
        s = rise / (min(x1 - x0, y1 - y0) / 2)
        ze = z0 - over * s
        top = ze + half * s
        xc, yc = (X0 + X1) / 2, (Y0 + Y1) / 2
        bm = self.bm
        M = self.M
        V = lambda x, y, z: bm.verts.new(M @ Vector((x, y, z)))
        a, b, c, d = V(X0, Y0, ze), V(X1, Y0, ze), V(X1, Y1, ze), V(X0, Y1, ze)
        faces = []
        if W >= D:
            r0, r1 = V(X0 + half, yc, top), V(X1 - half, yc, top)
            if (X1 - half) - (X0 + half) < 1e-4:
                bm.verts.remove(r1)
                r1 = r0
                faces += [bm.faces.new((a, b, r0)), bm.faces.new((b, c, r0)), bm.faces.new((c, d, r0)),
                          bm.faces.new((d, a, r0))]
            else:
                faces += [bm.faces.new((a, b, r1, r0)), bm.faces.new((b, c, r1)), bm.faces.new((c, d, r0, r1)),
                          bm.faces.new((d, a, r0))]
        else:
            r0, r1 = V(xc, Y0 + half, top), V(xc, Y1 - half, top)
            faces += [bm.faces.new((a, b, r0)), bm.faces.new((b, c, r1, r0)), bm.faces.new((c, d, r1)),
                      bm.faces.new((d, a, r0, r1))]
        faces.append(bm.faces.new((d, c, b, a)))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self._paint(faces, mat)
        if fascia:
            self.block(X0, X1, Y0, Y1, ze - fascia_h, ze, fascia)
        return ze

    def flat_roof(self, x0, x1, y0, y1, z0, mat, cap_mat=None, parapet=0.35, lip=0.15, thick=0.25):
        """Flat roof slab with an optional parapet rim."""
        self.block(x0 - lip, x1 + lip, y0 - lip, y1 + lip, z0, z0 + thick, cap_mat or mat)
        if parapet > 0:
            t = 0.22
            zt = z0 + thick + parapet
            cm = cap_mat or mat
            self.block(x0 - lip, x1 + lip, y0 - lip, y0 - lip + t, z0 + thick, zt, cm)
            self.block(x0 - lip, x1 + lip, y1 + lip - t, y1 + lip, z0 + thick, zt, cm)
            self.block(x0 - lip, x0 - lip + t, y0 - lip + t, y1 + lip - t, z0 + thick, zt, cm)
            self.block(x1 + lip - t, x1 + lip, y0 - lip + t, y1 + lip - t, z0 + thick, zt, cm)
            self.block(x0 - lip + t, x1 + lip - t, y0 - lip + t, y1 + lip - t, z0 + thick, z0 + thick + 0.02, mat)

    # Features built in a wall frame (see `wall`): u along the wall, outward = -y, wall surface y = 0.
    def window(self, u, zc, w, h, frame, glass, bars="cross", sill=True, shutters=None, ft=0.09,
               depth=0.1, top=None):
        # one frame block with the glass pane just proud of it (cheaper than four frame bars)
        self.block(u - w / 2 - ft, u + w / 2 + ft, -depth, 0.06, zc - h / 2 - ft, zc + h / 2 + ft, frame)
        g0 = -depth - 0.015
        self.block(u - w / 2, u + w / 2, g0, -depth + 0.02, zc - h / 2, zc + h / 2, glass)
        mb = 0.045
        my0 = g0 - 0.03
        if bars in ("cross", "v", "grid"):
            self.block(u - mb / 2, u + mb / 2, my0, g0 + 0.01, zc - h / 2, zc + h / 2, frame)
        if bars in ("cross", "h", "grid"):
            self.block(u - w / 2, u + w / 2, my0, g0 + 0.01, zc - mb / 2, zc + mb / 2, frame)
        if bars == "grid":
            for k in (-1, 1):
                self.block(u + k * w / 4 - mb / 2, u + k * w / 4 + mb / 2, my0, g0 + 0.01, zc - h / 2, zc + h / 2, frame)
        if bars == "three":
            for k in (-1, 1):
                self.block(u + k * w / 6 - mb / 2, u + k * w / 6 + mb / 2, my0, g0 + 0.01, zc - h / 2, zc + h / 2, frame)
        if sill:
            self.block(u - w / 2 - ft - 0.06, u + w / 2 + ft + 0.06, -depth - 0.08, 0.06,
                       zc - h / 2 - ft - 0.07, zc - h / 2 - ft + 0.005, frame)
        if top:
            self.block(u - w / 2 - ft - 0.08, u + w / 2 + ft + 0.08, -depth - 0.06, 0.06,
                       zc + h / 2 + ft, zc + h / 2 + ft + 0.1, top)
        if shutters:
            sw = w * 0.48
            for k in (-1, 1):
                x0 = u + k * (w / 2 + ft + 0.03)
                x1 = x0 + k * sw
                self.block(min(x0, x1), max(x0, x1), -0.06, 0.04, zc - h / 2 - ft, zc + h / 2 + ft, shutters)

    def door(self, u, w, h, door_mat, frame, knob=None, glass=None, ft=0.1, z0=0.0, style="panel",
             double=False):
        self.block(u - w / 2, u + w / 2, -0.04, 0.06, z0, z0 + h, door_mat)
        self.block(u - w / 2 - ft, u - w / 2, -0.11, 0.06, z0, z0 + h + ft, frame)
        self.block(u + w / 2, u + w / 2 + ft, -0.11, 0.06, z0, z0 + h + ft, frame)
        self.block(u - w / 2 - ft - 0.05, u + w / 2 + ft + 0.05, -0.14, 0.06, z0 + h, z0 + h + ft + 0.08, frame)
        if double:
            self.block(u - 0.02, u + 0.02, -0.07, -0.03, z0, z0 + h, frame)
        if style == "panel":
            # two raised panels per leaf
            leaves = [(u - w / 2, u), (u, u + w / 2)] if double else [(u - w / 2, u + w / 2)]
            for a, b in leaves:
                m = 0.12 * (b - a) / 0.5 if double else 0.12
                pw = (b - a) - 2 * m
                if glass:
                    self.block(a + m, b - m, -0.07, -0.03, z0 + h * 0.58, z0 + h * 0.88, glass)
                else:
                    self.block(a + m, b - m, -0.07, -0.03, z0 + h * 0.55, z0 + h * 0.88, door_mat)
                self.block(a + m, b - m, -0.07, -0.03, z0 + h * 0.1, z0 + h * 0.45, door_mat)
        elif style == "glass" and glass:
            self.block(u - w / 2 + 0.08, u + w / 2 - 0.08, -0.07, -0.03, z0 + 0.12, z0 + h - 0.1, glass)
        if knob:
            if double:
                for k in (-1, 1):
                    self.block(u + k * 0.1 - 0.03, u + k * 0.1 + 0.03, -0.12, -0.04, z0 + h * 0.46, z0 + h * 0.52, knob)
            else:
                kx = u + w / 2 - 0.14
                self.block(kx - 0.04, kx + 0.04, -0.12, -0.04, z0 + h * 0.46, z0 + h * 0.51, knob)

    def garage_door(self, u, w, h, door_mat, frame, groove, glass=None, panels=4, ft=0.12):
        self.block(u - w / 2, u + w / 2, -0.03, 0.06, 0, h, door_mat)
        for k in range(1, panels):
            z = h * k / panels
            self.block(u - w / 2, u + w / 2, -0.06, -0.02, z - 0.03, z + 0.03, groove)
        if glass:
            n = max(2, int(round(w / 0.9)))
            gw = w / n
            z = h * (panels - 0.5) / panels
            for i in range(n):
                cx = u - w / 2 + gw * (i + 0.5)
                self.block(cx - gw * 0.34, cx + gw * 0.34, -0.06, -0.02, z - h / panels * 0.28, z + h / panels * 0.28, glass)
        self.block(u - w / 2 - ft, u - w / 2, -0.1, 0.06, 0, h + ft, frame)
        self.block(u + w / 2, u + w / 2 + ft, -0.1, 0.06, 0, h + ft, frame)
        self.block(u - w / 2 - ft, u + w / 2 + ft, -0.1, 0.06, h, h + ft, frame)

    def siding(self, x0, x1, y0, y1, z0, z1, mat, step=0.45, t=0.018):
        """Lap siding lines on the four walls of a box (thin horizontal strips)."""
        z = z0 + step
        while z < z1 - 0.1:
            self.block(x0 - t, x1 + t, y0 - t, y0 + 0.01, z - 0.025, z, mat)
            self.block(x0 - t, x1 + t, y1 - 0.01, y1 + t, z - 0.025, z, mat)
            self.block(x0 - t, x0 + 0.01, y0, y1, z - 0.025, z, mat)
            self.block(x1 - 0.01, x1 + t, y0, y1, z - 0.025, z, mat)
            z += step

    def chimney(self, x, y, w, d, z0, z1, mat, cap_mat):
        self.block(x - w / 2, x + w / 2, y - d / 2, y + d / 2, z0, z1, mat)
        self.block(x - w / 2 - 0.08, x + w / 2 + 0.08, y - d / 2 - 0.08, y + d / 2 + 0.08, z1, z1 + 0.14, cap_mat)
        self.block(x - w / 2 + 0.12, x + w / 2 - 0.12, y - d / 2 + 0.12, y + d / 2 - 0.12, z1 + 0.14, z1 + 0.24, cap_mat)

    # ---------- finish
    def finish(self):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        for f in bm.faces:
            f.smooth = False
        if self.recenter:
            xs = [v.co.x for v in bm.verts]
            ys = [v.co.y for v in bm.verts]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            for v in bm.verts:
                v.co.x -= cx
                v.co.y -= cy
        mesh = bpy.data.meshes.new(self.name)
        bm.to_mesh(mesh)
        bm.free()
        for name in self.mats:
            mesh.materials.append(self.mat_objs[name])
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def mesh_stats(obj):
    me = obj.data
    me.calc_loop_triangles()
    tris = len(me.loop_triangles)
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    return {
        "tris": tris,
        "min": [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3)],
        "max": [round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)],
        "size": [round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2), round(max(zs) - min(zs), 2)],
        "materials": [m.name for m in me.materials],
    }


def export_glb(obj, path, uvs=False):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_texcoords=uvs,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=False,
        export_animations=False,
        export_vertex_color="NONE",
    )


def parse_args():
    import sys
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else []


def run(models, argv=None):
    """Build and export the given {key: fn(builder)} models. argv filters by key prefix."""
    if argv is None:
        argv = parse_args()
    keys = [k for k in models if not argv or any(k.startswith(a) for a in argv)]
    stats_path = os.path.join(OUT_DIR, "world_stats.json")
    os.makedirs(OUT_DIR, exist_ok=True)
    stats = {}
    if os.path.exists(stats_path):
        try:
            with open(stats_path) as f:
                stats = json.load(f)
        except Exception:
            stats = {}
    for key in keys:
        reset_scene()
        b = Builder(key, seed=sum(ord(c) for c in key))
        models[key](b)
        obj = b.finish()
        st = mesh_stats(obj)
        path = os.path.join(MODELS_DIR, key + ".glb")
        export_glb(obj, path, uvs=b.uvs)
        st["bytes"] = os.path.getsize(path)
        stats[key] = st
        print("BUILT %-20s tris=%5d size=%s kb=%.1f" % (key, st["tris"], st["size"], st["bytes"] / 1024))
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=1, sort_keys=True)
