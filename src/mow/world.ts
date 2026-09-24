// Static scenery for a job: the property (house, props, trees, fences, flower beds) and the
// surroundings (street, sidewalks, neighbors, tree lines). Procedural models appear immediately and are
// swapped for GLBs when those load.
import * as THREE from 'three';
import type { MowJobSpec } from '../core/types';
import { instantiateModel } from '../core/assets';
import type { PropertyLayout, Obstacle, BedShape } from '../world/property';
import { inBed } from '../world/property';
import { ModelKit, fitModel, markShared, tintBody, PROP_HEIGHT, PROP_MODEL, HOUSE_MODEL, VEHICLE_LENGTH } from './models';
import { createGroundMaterial, createSurroundMaterial, type GrassUniforms } from './shaders';
import type { GrassField } from './field';
import { GRID_Z0 } from './field';

export interface Fadeable {
  obj: THREE.Object3D;
  x: number; z: number; y0: number; y1: number; r: number;
  box?: { hw: number; hd: number };   // axis-aligned footprint instead of a round canopy
  cur: number;
  mats: THREE.Material[];
}

function prand(seed: number) {
  let s = (seed >>> 0) || 11;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const FLOWER_COLORS = [0xe8456b, 0xf2c230, 0xf4f4f4, 0x9b59d0, 0xf07a2a, 0xe03a3a, 0xf59bb8, 0x5a8ae8];

export class Flowers {
  foliage: THREE.InstancedMesh;
  blooms: THREE.InstancedMesh;
  private pos: Float32Array;
  private bed: Int16Array;
  private scale: Float32Array;
  private m4 = new THREE.Matrix4();
  count: number;

  constructor(beds: BedShape[], kit: ModelKit, seed: number, fall: boolean) {
    const r = prand(seed);
    const pts: number[] = [];
    const ids: number[] = [];
    const sc: number[] = [];
    const cols: number[] = [];
    beds.forEach((b, bi) => {
      const bx = b.kind === 'rect' ? b.rect.x : b.x, bz = b.kind === 'rect' ? b.rect.z : b.z;
      const ex = b.kind === 'rect' ? Math.hypot(b.rect.w, b.rect.d) / 2 : Math.max(b.rx, b.rz);
      const area = b.kind === 'rect' ? b.rect.w * b.rect.d : Math.PI * b.rx * b.rz;
      const n = Math.min(420, Math.round(area * 5.5));
      const palette = [FLOWER_COLORS[Math.floor(r() * 8)], FLOWER_COLORS[Math.floor(r() * 8)]];
      let placed = 0;
      for (let t = 0; t < n * 3 && placed < n; t++) {
        const x = bx + (r() * 2 - 1) * ex, z = bz + (r() * 2 - 1) * ex;
        if (!inBed(b, x, z, -0.12)) continue;
        pts.push(x, z); ids.push(bi); sc.push(0.75 + r() * 0.6);
        cols.push(fall && r() < 0.5 ? 0xd98a2a : palette[r() < 0.6 ? 0 : 1]);
        placed++;
      }
    });
    this.count = ids.length;
    this.pos = new Float32Array(pts);
    this.bed = new Int16Array(ids);
    this.scale = new Float32Array(sc);
    const fg = new THREE.IcosahedronGeometry(0.13, 0);
    fg.scale(1, 0.7, 1);
    const bg = new THREE.IcosahedronGeometry(0.065, 0);
    this.foliage = new THREE.InstancedMesh(fg, kit.mats.get(0x3f7a35), Math.max(1, this.count));
    this.blooms = new THREE.InstancedMesh(bg, kit.mats.get(0xffffff), Math.max(1, this.count));
    this.foliage.count = this.count;
    this.blooms.count = this.count;
    const c = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      this.write(i);
      c.setHex(cols[i]);
      this.blooms.setColorAt(i, c);
    }
    this.foliage.castShadow = true;
    this.foliage.receiveShadow = true;
    this.blooms.receiveShadow = true;
  }

  private write(i: number) {
    const s = this.scale[i];
    const x = this.pos[i * 2], z = this.pos[i * 2 + 1];
    this.m4.makeScale(s, s, s).setPosition(x, 0.1 * s, z);
    this.foliage.setMatrixAt(i, this.m4);
    this.m4.makeScale(s, s, s).setPosition(x, 0.2 * s + 0.03, z);
    this.blooms.setMatrixAt(i, this.m4);
  }

  /** Flatten flowers of one bed within radius of (x, z). Returns how many were flattened. */
  squash(bed: number, x: number, z: number, radius: number): number {
    let n = 0;
    const r2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      if (this.bed[i] !== bed || this.scale[i] < 0.3) continue;
      const dx = this.pos[i * 2] - x, dz = this.pos[i * 2 + 1] - z;
      if (dx * dx + dz * dz > r2) continue;
      this.scale[i] = 0.25;
      this.write(i);
      n++;
    }
    if (n) { this.foliage.instanceMatrix.needsUpdate = true; this.blooms.instanceMatrix.needsUpdate = true; }
    return n;
  }

  dispose() {
    this.foliage.geometry.dispose(); this.blooms.geometry.dispose();
    this.foliage.dispose(); this.blooms.dispose();
  }
}

export class World {
  group = new THREE.Group();
  fadeables: Fadeable[] = [];
  propByObstacle = new Map<Obstacle, THREE.Object3D>();
  flowers: Flowers;
  vehicle: THREE.Object3D;
  vehiclePos = new THREE.Vector3();
  vehicleRadius = 2;
  vehicleLen = 3;
  ground: THREE.Mesh;
  private disposed = false;
  private owned: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];

  constructor(private layout: PropertyLayout, private kit: ModelKit, private spec: MowJobSpec, field: GrassField, u: GrassUniforms, companyColor: THREE.Color) {
    const L = layout;
    const W = L.lot.w, D = L.lot.d;
    const seed = layout.seed;
    const golf = L.lot.kind === 'golf';

    // ---------------------------------------------------------------- ground (the lot and sidewalk)
    const gw = field.nx * field.cs, gd = field.nz * field.cs;
    const gg = new THREE.PlaneGeometry(gw, gd);
    gg.rotateX(-Math.PI / 2);
    gg.translate(gw / 2, 0, field.z0 + gd / 2);
    this.geos.push(gg);
    const gm = createGroundMaterial(u);
    this.owned.push(gm);
    this.ground = new THREE.Mesh(gg, gm);
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    this.buildSurroundings(u, W, D, seed);

    // ---------------------------------------------------------------- house
    {
      const h = L.house;
      const local = new THREE.Group();
      local.position.set(h.x, 0, h.z);
      local.rotation.y = Math.PI;
      const doorX = L.door ? -(L.door.x - h.x) : 0;
      const proc = kit.house(h.style, h.w, h.d, seed, { doorX, garageSide: -(L.garageSide ?? 1) });
      local.add(proc);
      this.group.add(local);
      const HT: Record<string, number> = { ranch: 5.8, cottage: 6.8, colonial: 9.2, modern: 8.2, mansion: 11.8, office: 12.5, church: 21, school: 8.6, clubhouse: 8.5, pavilion: 5.4 };
      const fade = this.addFade(local, h.x, h.z, 0, HT[h.style] ?? 9, Math.max(h.w, h.d) * 0.55);
      fade.box = { hw: h.w / 2 + 0.3, hd: h.d / 2 + 0.3 };
      this.swap(HOUSE_MODEL[h.style], proc, local, (m) => {
        fitModel(m, { footprint: [h.w, h.d], fill: true });
        // the ranch model has its garage on its own right (+x); mirror it when the driveway is on the other side
        if (h.style === 'ranch' && (L.garageSide ?? 1) > 0) m.scale.x *= -1;
        this.recolor(m, seed);
      }, fade);
    }

    // ---------------------------------------------------------------- obstacles
    for (const o of L.obstacles) {
      const holder = new THREE.Group();
      holder.position.set(o.x, 0, o.z);
      holder.rotation.y = o.rot;
      this.group.add(holder);
      const isTree = o.kind.startsWith('tree');
      let proc: THREE.Object3D;
      let fade: Fadeable | null = null;
      if (isTree) {
        const t = kit.tree(o.kind, o.scale ?? 1, Math.round(o.x * 97 + o.z * 13));
        proc = t.group;
        holder.add(proc);
        fade = this.addFade(holder, o.x, o.z, 2.2 * (o.scale ?? 1), t.height, t.canopyR);
      } else if (o.kind === 'shrub_round') {
        proc = kit.shrub(o.scale ?? 1, Math.round(o.x * 31 + o.z * 7));
        holder.add(proc);
      } else {
        proc = kit.prop(o.kind, Math.round(o.x * 53 + o.z * 17), golf);
        holder.add(proc);
      }
      if (!o.solid) this.propByObstacle.set(o, holder);
      const key = PROP_MODEL[o.kind];
      // GLBs are authored at real size; only the per-obstacle variation scale applies
      const sc = isTree || o.kind === 'shrub_round' || o.kind === 'birdbath' ? (o.scale ?? 1) : 1;
      void PROP_HEIGHT;
      // golf pins are short flags; keep the procedural pin there
      if (key && !(golf && o.kind === 'flagpole')) this.swap(key, proc, holder, (m) => { if (sc !== 1) m.scale.multiplyScalar(sc); }, fade);
    }

    // ---------------------------------------------------------------- fences
    for (const f of L.fences) {
      const len = Math.hypot(f.x2 - f.x1, f.z2 - f.z1);
      if (len < 0.1) continue;
      const g = kit.fence(f.kind, len);
      g.position.set((f.x1 + f.x2) / 2, 0, (f.z1 + f.z2) / 2);
      g.rotation.y = Math.atan2(-(f.z2 - f.z1), f.x2 - f.x1);
      this.group.add(g);
    }

    // ---------------------------------------------------------------- flowers
    this.flowers = new Flowers(L.beds, kit, seed, spec.season === 'fall');
    this.group.add(this.flowers.foliage, this.flowers.blooms);
    // bed borders: low stone edging
    for (const b of L.beds) this.bedEdge(b);
    // parking stall lines
    if (L.lot.kind !== 'residential' && L.lot.kind !== 'estate') {
      const lines: THREE.Matrix4[] = [];
      for (const r of L.driveway) {
        if (Math.min(r.w, r.d) < 7) continue;
        const along = r.d >= r.w;                    // stalls line the long sides
        const len = along ? r.d : r.w, depth = Math.min(5, (along ? r.w : r.d) * 0.36);
        for (let t = -len / 2 + 3; t <= len / 2 - 3; t += 2.7) {
          for (const side of [-1, 1]) {
            const m = new THREE.Matrix4();
            if (along) m.makeScale(depth, 1, 0.12).setPosition(r.x + side * (r.w / 2 - depth / 2), 0.006, r.z + t);
            else m.makeScale(0.12, 1, depth).setPosition(r.x + t, 0.006, r.z + side * (r.d / 2 - depth / 2));
            lines.push(m);
          }
        }
      }
      if (lines.length) {
        const lg = new THREE.PlaneGeometry(1, 1);
        lg.rotateX(-Math.PI / 2);
        this.geos.push(lg);
        const im = new THREE.InstancedMesh(lg, kit.mats.get(0xf2f0ea, { flat: false }), lines.length);
        lines.forEach((m, i) => im.setMatrixAt(i, m));
        im.receiveShadow = true;
        this.group.add(im);
      }
    }
    // bunkers and ponds as smooth shapes over the cell grid
    const disc = new THREE.CircleGeometry(1, 48);
    disc.rotateX(-Math.PI / 2);
    this.geos.push(disc);
    const sandMat = kit.mats.get(0xe6d6a4, { flat: false });
    const lipMat = kit.mats.get(0xcdbb86, { flat: false });
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x3f93ad, transparent: true, opacity: 0.92 });
    const shoreMat = kit.mats.get(0x6f8f4a, { flat: false });
    this.owned.push(waterMat);
    const flat = (b: BedShape, mat: THREE.Material, y: number, grow: number) => {
      if (b.kind !== 'ellipse') return;
      const m = new THREE.Mesh(disc, mat);
      m.position.set(b.x, y, b.z);
      m.rotation.y = -b.rot;
      m.scale.set(b.rx + grow, 1, b.rz + grow);
      m.receiveShadow = true;
      this.group.add(m);
    };
    for (const b of L.bunkers ?? []) { flat(b, lipMat, 0.012, 0.18); flat(b, sandMat, 0.02, 0); }
    for (const b of L.ponds ?? []) { flat(b, shoreMat, 0.012, 0.35); flat(b, waterMat, 0.025, 0); }

    // ---------------------------------------------------------------- the owner's vehicle at the curb
    const vkey = spec.vehicleModel || 'veh_bike';
    const vlen = VEHICLE_LENGTH[vkey] ?? 5;
    const drive = L.driveway[0];
    const vx = drive ? (drive.x > W / 2 ? Math.max(vlen / 2 + 1, drive.x - drive.w / 2 - vlen / 2 - 2) : Math.min(W + 6, drive.x + drive.w / 2 + vlen / 2 + 2)) : W / 2;
    const vz = vkey === 'veh_bike' ? -1.1 : -3.35;
    const vh = new THREE.Group();
    vh.position.set(vx, vkey === 'veh_bike' ? 0 : -0.14, vz);
    vh.rotation.y = Math.PI / 2;
    const vproc = kit.vehicle(vkey, companyColor.getHex());
    vh.add(vproc);
    this.group.add(vh);
    this.vehicle = vh;
    this.vehiclePos.set(vx, 0, vz);
    this.vehicleRadius = vlen / 2 + 2.2;
    this.vehicleLen = vlen;
    this.swap(vkey, vproc, vh, (m) => { tintBody(m, companyColor); }, null);
  }

  private bedEdge(b: BedShape) {
    const pts: THREE.Vector2[] = [];
    if (b.kind === 'rect') {
      const { x, z, w, d } = b.rect;
      pts.push(new THREE.Vector2(x - w / 2, z - d / 2), new THREE.Vector2(x + w / 2, z - d / 2), new THREE.Vector2(x + w / 2, z + d / 2), new THREE.Vector2(x - w / 2, z + d / 2));
    } else {
      const n = 28;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const lx = Math.cos(a) * b.rx, lz = Math.sin(a) * b.rz;
        const c = Math.cos(b.rot), s = Math.sin(b.rot);
        pts.push(new THREE.Vector2(b.x + lx * c - lz * s, b.z + lx * s + lz * c));
      }
    }
    const count = pts.length;
    const geo = new THREE.BoxGeometry(1, 0.1, 0.1);
    this.geos.push(geo);
    const im = new THREE.InstancedMesh(geo, this.kit.mats.get(0xb9ae9c), count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const a = pts[i], c = pts[(i + 1) % count];
      const len = a.distanceTo(c);
      q.setFromAxisAngle(up, Math.atan2(-(c.y - a.y), c.x - a.x));
      m4.compose(new THREE.Vector3((a.x + c.x) / 2, 0.04, (a.y + c.y) / 2), q, new THREE.Vector3(len + 0.05, 1, 1));
      im.setMatrixAt(i, m4);
    }
    im.receiveShadow = true;
    this.group.add(im);
  }

  /** Give each house its own paint: the models share material names Wall, Roof, Door. */
  private recolor(m: THREE.Object3D, seed: number) {
    const r = prand(seed * 31 + 5);
    const walls = [null, 0xdfe7ea, 0xcfd9c4, 0xf1e6cf, 0xe9e1d3, 0xf3efe6, 0xefe1b8, 0xd8c3a8, 0xc9d3dc];
    const roofs = [null, 0x4a4f57, 0x5b4636, 0x3f4a55, 0x6a5a4c];
    const doors = [null, 0x2f5d7c, 0x8c2f2f, 0x2f6b3c, 0x3b3b3b, 0xb5782a];
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const plan: Record<string, number | null> = { Wall: pick(walls), Roof: pick(roofs), Door: pick(doors) };
    const clones = new Map<THREE.Material, THREE.Material>();
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swapMat = (mat: THREE.Material) => {
        const col = plan[mat.name];
        if (col == null) return mat;
        let c = clones.get(mat);
        if (!c) {
          c = mat.clone();
          ((c as THREE.MeshStandardMaterial).color as THREE.Color | undefined)?.setHex(col);
          c.userData.mmOwned = true;
          this.owned.push(c);
          clones.set(mat, c);
        }
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swapMat) : swapMat(mesh.material);
    });
  }

  private addFade(obj: THREE.Object3D, x: number, z: number, y0: number, y1: number, r: number): Fadeable {
    const f: Fadeable = { obj, x, z, y0, y1, r, cur: 1, mats: [] };
    this.collectFadeMats(f);
    this.fadeables.push(f);
    return f;
  }
  private collectFadeMats(f: Fadeable) {
    f.mats = [];
    f.obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const arr = Array.isArray(m.material) ? m.material : [m.material];
      const cl = arr.map((mat) => { const c = mat.clone(); c.userData.mmOwned = true; this.owned.push(c); f.mats.push(c); return c; });
      m.material = Array.isArray(m.material) ? cl : cl[0];
    });
  }

  /** Replace a procedural placeholder with the GLB once it loads (if it exists). */
  private swap(key: string, proc: THREE.Object3D, holder: THREE.Object3D, fit: (m: THREE.Object3D) => void, fade: Fadeable | null) {
    instantiateModel(key).then((m) => {
      if (!m || this.disposed) return;
      markShared(m);
      fit(m);
      holder.remove(proc);
      proc.traverse((o) => { const pm = o as THREE.Mesh; if (pm.isMesh) pm.geometry?.dispose(); });
      holder.add(m);
      if (fade) this.collectFadeMats(fade);
    }).catch(() => { /* keep the placeholder */ });
  }

  // ---------------------------------------------------------------- surroundings
  private buildSurroundings(u: GrassUniforms, W: number, D: number, seed: number) {
    const r = prand(seed + 99);
    const kit = this.kit;
    const surround = createSurroundMaterial(u);
    this.owned.push(surround);
    const plane = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, y = 0) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      // world-scaled UVs so tiled textures line up across planes (1 unit = one 1.6 m slab)
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / 1.6, (z0 + (1 - uv.getY(i)) * (z1 - z0)) / 1.6);
      g.rotateX(-Math.PI / 2);
      g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
      this.geos.push(g);
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    const ext = Math.max(160, Math.max(W, D) * 1.6);
    const STREET0 = GRID_Z0, STREET1 = GRID_Z0 - 8.5;
    // lawns around the lot
    plane(-ext, 0, GRID_Z0 + 0.2, D + ext, surround);
    plane(W, W + ext, GRID_Z0 + 0.2, D + ext, surround);
    plane(0, W, D, D + ext, surround);
    plane(-ext, W + ext, STREET1 - 2.2 - ext, STREET1 - 2.2, surround);
    // sidewalks beside the lot and across the street
    const ctex = concreteTexture();
    ctex.wrapS = ctex.wrapT = THREE.RepeatWrapping;
    const conc = new THREE.MeshLambertMaterial({ color: 0xffffff, map: ctex });
    this.owned.push(conc);
    plane(-ext, 0, SIDEWALK_Z_, 0, conc, 0.002);
    plane(W, W + ext, SIDEWALK_Z_, 0, conc, 0.002);
    plane(-ext, W + ext, STREET1 - 2.2, STREET1, conc, 0.002);
    // curb strips
    const curb = kit.mats.get(0xb5b0a6, { flat: false });
    plane(-ext, 0, GRID_Z0, SIDEWALK_Z_, curb, 0.004);
    plane(W, W + ext, GRID_Z0, SIDEWALK_Z_, curb, 0.004);
    // street with a canvas asphalt texture
    const tex = asphaltTexture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set((W + 2 * ext) / 6, (STREET0 - STREET1) / 6);
    const asphalt = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex });
    this.owned.push(asphalt);
    plane(-ext, W + ext, STREET1, STREET0, asphalt, -0.14);
    // curb faces
    const faceGeo = new THREE.BoxGeometry(W + 2 * ext, 0.16, 0.12);
    this.geos.push(faceGeo);
    for (const z of [STREET0 - 0.06, STREET1 + 0.06]) {
      const f = new THREE.Mesh(faceGeo, curb);
      f.position.set(W / 2, -0.07, z);
      f.receiveShadow = true;
      this.group.add(f);
    }
    // dashed center line
    const dashGeo = new THREE.PlaneGeometry(2.2, 0.14);
    dashGeo.rotateX(-Math.PI / 2);
    this.geos.push(dashGeo);
    const nd = Math.ceil((W + 2 * ext) / 5);
    const dashes = new THREE.InstancedMesh(dashGeo, kit.mats.get(0xe8c64a, { flat: false }), nd);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < nd; i++) { m4.makeTranslation(-ext + i * 5, -0.13, (STREET0 + STREET1) / 2); dashes.setMatrixAt(i, m4); }
    this.group.add(dashes);

    const kind = this.layout.lot.kind;
    const residential = kind === 'residential' || kind === 'estate';
    const styles = kind === 'estate' ? (['colonial', 'mansion', 'modern'] as const) : (['ranch', 'colonial', 'cottage', 'modern'] as const);
    const placeHouse = (x: number, z: number, facingStreet: 'south' | 'north', w: number, d: number, sd: number) => {
      const st = styles[Math.floor(r() * styles.length)];
      const holder = new THREE.Group();
      holder.position.set(x, 0, z);
      holder.rotation.y = facingStreet === 'south' ? Math.PI : 0;
      const proc = kit.house(st, w, d, sd, { doorX: 0, garageSide: r() < 0.5 ? 1 : -1 });
      holder.add(proc);
      this.group.add(holder);
      this.swap(HOUSE_MODEL[st], proc, holder, (m) => { fitModel(m, { footprint: [w, d], fill: true }); this.recolor(m, sd); }, null);
      // driveway
      const dx = x + (r() < 0.5 ? -1 : 1) * (w / 2 - 2);
      const z0 = facingStreet === 'south' ? 0 : z + d / 2, z1 = facingStreet === 'south' ? z - d / 2 : STREET1 - 2.2;
      plane(dx - 1.7, dx + 1.7, Math.min(z0, z1), Math.max(z0, z1), conc, 0.003);
    };
    const tree = (x: number, z: number, s: number) => {
      const kinds = ['tree_oak', 'tree_maple', 'tree_pine', 'tree_birch'] as const;
      const k = kinds[Math.floor(r() * 4)];
      const t = kit.tree(k, s, Math.floor(r() * 1e6));
      t.group.position.set(x, 0, z);
      this.group.add(t.group);
      this.addFade(t.group, x, z, 2.2 * s, t.height, t.canopyR);
    };
    const hw = Math.min(W * 0.55, 18), hd = Math.min(D * 0.3, 12);
    if (residential) {
      for (const side of [-1, 1]) {
        const cx = side < 0 ? -W / 2 - 1 : W + W / 2 + 1;
        placeHouse(cx, D * 0.26 + hd / 2, 'south', hw, hd, seed + side * 7);
        tree(cx + (r() - 0.5) * W * 0.6, D * 0.12 + r() * 3, 0.9 + r() * 0.3);
        tree(cx + (r() - 0.5) * W * 0.7, D * 0.75 + r() * D * 0.2, 0.9 + r() * 0.3);
        // second neighbors further out
        const cx2 = side < 0 ? -W * 1.5 - 2 : W * 2.5 + 2;
        placeHouse(cx2, D * 0.25 + hd / 2, 'south', hw * 0.9, hd, seed + side * 13);
      }
      for (let i = -2; i <= 2; i++) {
        const cx = W / 2 + i * (W + 2);
        placeHouse(cx, STREET1 - 2.2 - 7 - hd / 2, 'north', hw * (0.85 + r() * 0.2), hd, seed + 31 * i + 5);
        if (r() < 0.7) tree(cx + (r() - 0.5) * W * 0.6, STREET1 - 5, 0.8 + r() * 0.3);
      }
    } else {
      // open land: tree clusters beside and across the street
      for (let i = 0; i < 24; i++) {
        const side = r() < 0.5 ? -1 : 1;
        tree(side < 0 ? -6 - r() * 30 : W + 6 + r() * 30, r() * D, 0.9 + r() * 0.4);
      }
      for (let i = 0; i < 14; i++) tree(-20 + r() * (W + 40), STREET1 - 6 - r() * 25, 0.9 + r() * 0.4);
    }
    // back tree line (instanced so it costs two draw calls)
    const n = Math.ceil((W + 80) / 3.6);
    const trunkG = new THREE.CylinderGeometry(0.22, 0.3, 3, 6);
    const crownG = new THREE.IcosahedronGeometry(2.6, 1);
    this.geos.push(trunkG, crownG);
    const fall = this.spec.season === 'fall';
    const trunks = new THREE.InstancedMesh(trunkG, kit.mats.get(0x6b4a32), n * 2);
    const crowns = new THREE.InstancedMesh(crownG, kit.mats.get(0xffffff), n * 2);
    const c = new THREE.Color();
    const greens = fall ? [0xc9772e, 0xb8862f, 0x5a8a3a, 0xd9a03a, 0x4f7a34] : [0x3f7532, 0x4a833a, 0x356b2c, 0x57903f, 0x2f6a3a];
    let k = 0;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < n; i++) {
        const x = -40 + i * 3.6 + r() * 2;
        const z = D + 4 + row * 6 + r() * 4;
        const s = 0.9 + r() * 0.7;
        m4.makeScale(s, s, s).setPosition(x, 1.5 * s, z);
        trunks.setMatrixAt(k, m4);
        m4.makeScale(s * (0.9 + r() * 0.3), s * (1.1 + r() * 0.4), s).setPosition(x, (3 + 2.2) * s, z);
        crowns.setMatrixAt(k, m4);
        c.setHex(greens[Math.floor(r() * greens.length)]);
        crowns.setColorAt(k, c);
        k++;
      }
    }
    trunks.castShadow = crowns.castShadow = true;
    this.group.add(trunks, crowns);
  }

  /** Fade trees and the house that stand between the camera and the player (or swallow the camera). */
  updateFades(cam: THREE.Vector3, target: THREE.Vector3, dt: number) {
    const dx = target.x - cam.x, dy = target.y - cam.y, dz = target.z - cam.z;
    for (const f of this.fadeables) {
      // quick reject: object far from both ends of the sight line
      const minX = Math.min(cam.x, target.x) - f.r - 1, maxX = Math.max(cam.x, target.x) + f.r + 1;
      const minZ = Math.min(cam.z, target.z) - f.r - 1, maxZ = Math.max(cam.z, target.z) + f.r + 1;
      let hit = false;
      if (f.x > minX && f.x < maxX && f.z > minZ && f.z < maxZ) {
        for (let i = 0; i <= 14 && !hit; i++) {
          const t = i / 16;
          const px = cam.x + dx * t, py = cam.y + dy * t, pz = cam.z + dz * t;
          if (py < f.y0 - 0.3 || py > f.y1 + 0.3) continue;
          if (f.box) hit = Math.abs(px - f.x) < f.box.hw && Math.abs(pz - f.z) < f.box.hd;
          else hit = (px - f.x) ** 2 + (pz - f.z) ** 2 < f.r * f.r * 1.1;
        }
      }
      // a canopy right beside the camera fills the screen even when it does not block the player
      if (!hit && !f.box && cam.y > f.y0 - 1 && cam.y < f.y1 + 0.5 && (cam.x - f.x) ** 2 + (cam.z - f.z) ** 2 < (f.r + 1.8) ** 2) hit = true;
      const goal = hit ? 0.3 : 1;
      if (f.cur === goal) continue;
      let next = f.cur + (goal - f.cur) * Math.min(1, dt * 7);
      if (Math.abs(next - goal) < 0.01) next = goal;
      f.cur = next;
      const transparent = next < 0.995;
      for (const m of f.mats) {
        if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
        m.opacity = next;
        m.depthWrite = !transparent;
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.flowers.dispose();
    for (const g of this.geos) g.dispose();
    for (const m of this.owned) { const mm = m as THREE.MeshLambertMaterial; mm.map?.dispose(); m.dispose(); }
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || o.userData.mmShared) return;
      m.geometry?.dispose();
    });
  }
}

const SIDEWALK_Z_ = -1.8;

function asphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a5d61';
  g.fillRect(0, 0, 128, 128);
  let s = 12345;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 2600; i++) {
    const v = 70 + Math.floor(rnd() * 50);
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** One 1.6 m concrete slab with a joint on two edges, colored to match the lot's ground shader. */
function concreteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8e4dd';
  g.fillRect(0, 0, 128, 128);
  let s = 777;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 1400; i++) {
    const v = 214 + Math.floor(rnd() * 26);
    g.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 3));
  }
  g.fillStyle = '#c4c0b8';
  g.fillRect(0, 0, 128, 2);
  g.fillRect(0, 0, 2, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
