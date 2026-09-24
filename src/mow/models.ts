// Procedural low-poly models used while GLBs load or when they are missing, plus helpers to fit a GLB
// to a target size. Every procedural model faces +Z with its origin on the ground at the footprint
// center, matching the GLB conventions in src/data/assets.ts.
import * as THREE from 'three';
import type { EquipmentSpec, HouseStyle, Season } from '../core/types';
import type { ObstacleKind } from '../world/property';

// ---------------------------------------------------------------- materials (cached per job, disposed with it)
export class MatCache {
  private m = new Map<string, THREE.MeshLambertMaterial>();
  get(color: number | string, opts: { flat?: boolean; opacity?: number; emissive?: number; side?: THREE.Side } = {}): THREE.MeshLambertMaterial {
    const c = new THREE.Color(color as any).getHex();
    const key = `${c}|${opts.flat ? 1 : 0}|${opts.opacity ?? 1}|${opts.emissive ?? 0}|${opts.side ?? 0}`;
    let mat = this.m.get(key);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color: c, flatShading: opts.flat ?? true, side: opts.side ?? THREE.FrontSide });
      if (opts.opacity !== undefined && opts.opacity < 1) { mat.transparent = true; mat.opacity = opts.opacity; mat.depthWrite = false; }
      if (opts.emissive) mat.emissive = new THREE.Color(opts.emissive);
      this.m.set(key, mat);
    }
    return mat;
  }
  dispose() { for (const m of this.m.values()) m.dispose(); this.m.clear(); }
}

type P = THREE.Object3D;
function add<T extends THREE.Object3D>(parent: P, o: T, x = 0, y = 0, z = 0): T { o.position.set(x, y, z); parent.add(o); return o; }
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

// small seeded helper for variations
function prand(seed: number) {
  let s = (seed >>> 0) || 7;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export class ModelKit {
  mats = new MatCache();
  constructor(public season: Season) {}

  box(p: P, w: number, h: number, d: number, color: number, x: number, y: number, z: number, cast = true) {
    return add(p, mesh(new THREE.BoxGeometry(w, h, d), this.mats.get(color), cast), x, y, z);
  }
  cyl(p: P, rt: number, rb: number, h: number, color: number, x: number, y: number, z: number, seg = 8) {
    return add(p, mesh(new THREE.CylinderGeometry(rt, rb, h, seg), this.mats.get(color)), x, y, z);
  }
  ball(p: P, r: number, color: number, x: number, y: number, z: number, detail = 1) {
    return add(p, mesh(new THREE.IcosahedronGeometry(r, detail), this.mats.get(color)), x, y, z);
  }

  // ---------------------------------------------------------------- houses and buildings
  /** Gable roof as a triangular prism, ridge along x. */
  private gable(p: P, w: number, d: number, rise: number, color: number, y: number) {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, rise); shape.lineTo(-d / 2, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    geo.rotateY(Math.PI / 2);
    const m = add(p, mesh(geo, this.mats.get(color)), 0, y, 0);
    return m;
  }
  private hip(p: P, w: number, d: number, rise: number, color: number, y: number) {
    const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    geo.rotateY(Math.PI / 4);
    const m = add(p, mesh(geo, this.mats.get(color)), 0, y + rise / 2, 0);
    m.scale.set(w, rise, d);
    return m;
  }
  private windowsRow(p: P, w: number, y: number, z: number, n: number, ww = 1.1, wh = 1.3, skip?: (x: number) => boolean) {
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n);
      if (skip && skip(x)) continue;
      this.box(p, ww + 0.16, wh + 0.16, 0.06, 0xf6f2e8, x, y, z, false);
      this.box(p, ww, wh, 0.09, 0x7fa3b8, x, y, z + 0.01, false);
      this.box(p, 0.06, wh, 0.1, 0xf6f2e8, x, y, z + 0.02, false);
    }
  }

  house(style: HouseStyle, w: number, d: number, seed: number, opts: { doorX?: number; garageSide?: number } = {}): THREE.Group {
    const g = new THREE.Group();
    const r = prand(seed);
    const siding = [0xf1e6cf, 0xdfe7ea, 0xcfd9c4, 0xe9e1d3, 0xf3efe6, 0xefe1b8, 0xc98a6b, 0xd6c9b4][Math.floor(r() * 8)];
    const roof = [0x4a4f57, 0x5b4636, 0x3f4a55, 0x6a5a4c, 0x363a40][Math.floor(r() * 5)];
    const accent = [0x2f5d7c, 0x8c2f2f, 0x2f6b3c, 0x3b3b3b, 0xb5782a][Math.floor(r() * 5)];
    const trim = 0xf8f5ee;
    const front = d / 2;
    const doorX = opts.doorX ?? 0;
    const gs = opts.garageSide ?? 1;
    if (style === 'office' || style === 'school' || style === 'clubhouse' || style === 'church' || style === 'pavilion') return this.building(style, w, d, seed);
    let wallH = 3.0, rise = 1.8, stories = 1, roofKind: 'gable' | 'hip' | 'flat' = 'gable';
    if (style === 'ranch') { wallH = 3.0; rise = Math.min(2.2, d * 0.28); roofKind = 'hip'; }
    if (style === 'colonial') { wallH = 5.8; rise = Math.min(2.8, d * 0.32); stories = 2; }
    if (style === 'cottage') { wallH = 3.0; rise = Math.min(3.6, d * 0.45); }
    if (style === 'modern') { wallH = 6.0; roofKind = 'flat'; stories = 2; }
    if (style === 'mansion') { wallH = 7.2; rise = Math.min(4, d * 0.3); stories = 2; roofKind = 'hip'; }
    // foundation
    this.box(g, w + 0.1, 0.35, d + 0.1, 0x9a948a, 0, 0.17, 0);
    const body = this.box(g, w, wallH, d, siding, 0, 0.35 + wallH / 2, 0);
    body.name = 'Body';
    const top = 0.35 + wallH;
    if (roofKind === 'gable') this.gable(g, w + 0.8, d + 0.9, rise, roof, top);
    else if (roofKind === 'hip') this.hip(g, w + 0.9, d + 0.9, rise, roof, top);
    else {
      this.box(g, w + 0.3, 0.3, d + 0.3, 0x44484e, 0, top + 0.15, 0);
      // stepped second volume
      this.box(g, w * 0.45, 1.2, d * 0.6, siding, -gs * w * 0.2, top + 0.9, -d * 0.1);
      this.box(g, w * 0.5, 0.2, d * 0.65, 0x44484e, -gs * w * 0.2, top + 1.55, -d * 0.1);
      // wood accent panel
      this.box(g, w * 0.3, wallH * 0.9, 0.08, 0xa0714a, -gs * w * 0.3, 0.35 + wallH * 0.47, front + 0.04);
    }
    if (style === 'colonial' || style === 'cottage' || style === 'mansion') {
      this.box(g, 0.9, rise + 1.6, 0.9, 0x9b5a45, -gs * w * 0.32, top + rise * 0.5 + 0.4, -d * 0.15);
    }
    // garage door at the garage end
    const garW = Math.min(w * 0.36, style === 'cottage' ? 2.8 : 5.2);
    const garX = gs * (w / 2 - garW / 2 - 0.35);
    this.box(g, garW, 2.3, 0.08, 0xf2efe8, garX, 0.35 + 1.15, front + 0.04, false);
    for (let i = 1; i < 4; i++) this.box(g, garW, 0.04, 0.1, 0xd6d1c6, garX, 0.35 + i * 0.58, front + 0.06, false);
    // door with a small stoop
    this.box(g, 1.3, 0.18, 1.0, 0xa9a399, doorX, 0.09, front + 0.5);
    this.box(g, 1.0, 2.15, 0.08, accent, doorX, 0.35 + 1.07, front + 0.04, false);
    this.box(g, 0.08, 0.08, 0.1, 0xd9b44a, doorX + 0.32, 0.35 + 1.05, front + 0.09, false);
    // windows
    const avoid = (x: number) => Math.abs(x - doorX) < 1.2 || Math.abs(x - garX) < garW / 2 + 0.7;
    const nWin = Math.max(2, Math.floor(w / 3));
    this.windowsRow(g, w, 0.35 + 1.55, front + 0.03, nWin, 1.1, 1.3, avoid);
    if (stories > 1) this.windowsRow(g, w, 0.35 + wallH * 0.74, front + 0.03, nWin, 1.1, 1.3);
    // back windows and side windows
    const back = new THREE.Group(); back.rotation.y = Math.PI; g.add(back);
    this.windowsRow(back, w, 0.35 + 1.55, d / 2 + 0.03, nWin, 1.1, 1.3);
    this.box(g, 0.12, wallH, 0.12, trim, -w / 2, 0.35 + wallH / 2, front, false);
    this.box(g, 0.12, wallH, 0.12, trim, w / 2, 0.35 + wallH / 2, front, false);
    return g;
  }

  building(style: HouseStyle, w: number, d: number, seed: number): THREE.Group {
    const g = new THREE.Group();
    const r = prand(seed + 3);
    if (style === 'pavilion') {
      const posts = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]];
      for (const [px, pz] of posts) this.box(g, 0.3, 3, 0.3, 0x8a6a4a, px * (w / 2 - 0.4), 1.5, pz * (d / 2 - 0.4));
      this.box(g, w, 0.12, d, 0xb9b2a4, 0, 0.06, 0);
      this.hip(g, w + 1.2, d + 1.2, 2.2, 0x6b3b2b, 3.0);
      for (let i = -1; i <= 1; i++) {
        this.box(g, 2.2, 0.08, 0.8, 0x9b7a55, i * w * 0.28, 0.78, 0);
        this.box(g, 2.2, 0.06, 0.3, 0x9b7a55, i * w * 0.28, 0.45, 0.65);
        this.box(g, 2.2, 0.06, 0.3, 0x9b7a55, i * w * 0.28, 0.45, -0.65);
      }
      return g;
    }
    if (style === 'church') {
      const naveW = w, naveD = d * 0.8;
      this.box(g, naveW, 7, naveD, 0xeee6d8, 0, 3.5, -d * 0.1);
      { const gr = this.gable(g, naveD + 0.6, naveW + 0.6, 4.5, 0x5a3e36, 7); gr.rotation.y = Math.PI / 2; gr.position.z = -d * 0.1; }
      const tw = Math.min(5, w * 0.35);
      this.box(g, tw, 13, tw, 0xeee6d8, 0, 6.5, d / 2 - tw / 2);
      const sp = add(g, mesh(new THREE.ConeGeometry(tw * 0.62, 8, 4), this.mats.get(0x5a3e36)), 0, 17, d / 2 - tw / 2);
      sp.rotation.y = Math.PI / 4;
      this.box(g, 1.8, 3, 0.1, 0x6b3b2b, 0, 1.5, d / 2 + 0.05, false);
      for (let i = -1; i <= 1; i += 2) for (let k = 0; k < 3; k++) this.box(g, 0.1, 2.6, 1.0, 0x9ab7d6, i * (naveW / 2 + 0.03), 3.4, -d * 0.35 + k * 3.2, false);
      return g;
    }
    const brick = style === 'school' ? 0xb4654a : style === 'clubhouse' ? 0xf2ede2 : [0xc9ccd0, 0xd9d2c3, 0xb8c2c8][Math.floor(r() * 3)];
    const floors = style === 'office' ? 3 : style === 'school' ? 2 : 1;
    const fh = 3.6;
    const H = floors * fh + 0.6;
    this.box(g, w, H, d, brick, 0, H / 2, 0).name = 'Body';
    if (style === 'clubhouse') {
      this.gable(g, w + 1, d + 1, 3.6, 0x3d4a3f, H);
      this.box(g, w * 0.4, 0.3, 3, 0xe8e2d4, 0, 3.2, d / 2 + 1.5);
      for (const px of [-1, 1]) this.box(g, 0.3, 3.2, 0.3, 0xf6f2ea, px * w * 0.19, 1.6, d / 2 + 2.8);
    } else {
      this.box(g, w + 0.3, 0.5, d + 0.3, 0x5b6068, 0, H + 0.25, 0);
    }
    for (let f = 0; f < floors; f++) {
      const y = 0.6 + f * fh + fh * 0.5;
      this.box(g, w * 0.92, fh * 0.45, 0.08, style === 'office' ? 0x3e5b6f : 0x88a8bf, 0, y, d / 2 + 0.04, false);
      this.box(g, w * 0.92, fh * 0.45, 0.08, style === 'office' ? 0x3e5b6f : 0x88a8bf, 0, y, -d / 2 - 0.04, false);
    }
    // entrance canopy
    this.box(g, 5, 0.3, 2.6, 0x4d535b, 0, 3.4, d / 2 + 1.3);
    this.box(g, 2.4, 2.6, 0.1, 0x2c3a44, 0, 1.3, d / 2 + 0.06, false);
    return g;
  }

  // ---------------------------------------------------------------- trees and plants
  tree(kind: ObstacleKind, scale: number, seed: number): { group: THREE.Group; canopy: THREE.Object3D[]; height: number; canopyR: number } {
    const g = new THREE.Group();
    const r = prand(seed);
    const fall = this.season === 'fall';
    const greens = [0x4f8a36, 0x5a9a3c, 0x467e30, 0x62a044];
    const fallCols = kind === 'tree_maple' ? [0xd9542b, 0xe8742c, 0xc8402a, 0xf09a2e] : kind === 'tree_oak' ? [0xb8862f, 0xa5702a, 0xc99a3a, 0x8f7a2e] : [0xd8b23a, 0xe0c048, 0xc7a030];
    const leafCol = () => (fall && kind !== 'tree_pine' ? fallCols : greens)[Math.floor(r() * 4)];
    const canopy: THREE.Object3D[] = [];
    let height = 7, canopyR = 2.6;
    const s = scale;
    if (kind === 'tree_pine') {
      this.cyl(g, 0.16 * s, 0.26 * s, 2 * s, 0x6b4a32, 0, s, 0);
      const pc = [0x2f6b3a, 0x357540, 0x2b6035][Math.floor(r() * 3)];
      for (let i = 0; i < 4; i++) {
        const rr = (2.3 - i * 0.48) * s, hh = 2.6 * s;
        const c = add(g, mesh(new THREE.ConeGeometry(rr, hh, 8), this.mats.get(pc)), 0, (1.6 + i * 1.55) * s + hh / 2, 0);
        canopy.push(c);
      }
      height = 9.5 * s; canopyR = 2.3 * s;
    } else if (kind === 'tree_birch') {
      this.cyl(g, 0.11 * s, 0.17 * s, 5 * s, 0xeeeae0, 0, 2.5 * s, 0);
      for (let i = 0; i < 5; i++) this.box(g, 0.2 * s, 0.05 * s, 0.05 * s, 0x2b2b2b, 0, (0.8 + i * 0.9) * s, 0.14 * s, false);
      for (let i = 0; i < 4; i++) {
        const c = this.ball(g, (1.05 + r() * 0.5) * s, leafCol(), (r() - 0.5) * 1.4 * s, (5 + r() * 1.6) * s, (r() - 0.5) * 1.4 * s);
        canopy.push(c);
      }
      height = 7.2 * s; canopyR = 1.8 * s;
    } else if (kind === 'tree_palm') {
      for (let i = 0; i < 6; i++) this.cyl(g, 0.17 * s, 0.2 * s, 1.1 * s, 0x8a7355, i * 0.08 * s, (0.55 + i * 1.05) * s, 0, 6);
      for (let i = 0; i < 7; i++) {
        const fr = add(g, mesh(new THREE.ConeGeometry(0.35 * s, 3.2 * s, 4), this.mats.get(0x4c8a3a)), 0.5 * s, 6.4 * s, 0);
        fr.rotation.set(0, (i / 7) * Math.PI * 2, 1.2);
        fr.position.set(Math.cos((i / 7) * Math.PI * 2) * 1.3 * s, 6.1 * s, Math.sin((i / 7) * Math.PI * 2) * 1.3 * s);
        fr.lookAt(fr.position.x * 3, 4.5 * s, fr.position.z * 3);
        fr.rotateX(Math.PI / 2);
        canopy.push(fr);
      }
      height = 7.5 * s; canopyR = 2.4 * s;
    } else {
      const oak = kind === 'tree_oak';
      const trunkH = (oak ? 2.6 : 2.4) * s;
      this.cyl(g, 0.22 * s, 0.34 * s, trunkH + 0.8 * s, 0x6b4a32, 0, (trunkH + 0.8 * s) / 2, 0);
      // a couple of branches
      const br = this.cyl(g, 0.08 * s, 0.12 * s, 1.6 * s, 0x6b4a32, 0.45 * s, trunkH + 0.4 * s, 0);
      br.rotation.z = -0.7;
      const n = oak ? 6 : 4;
      const cr = oak ? 2.9 : 2.5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r();
        const rr = (oak ? 1.5 + r() * 0.8 : 1.7 + r() * 0.6) * s;
        const c = this.ball(g, rr, leafCol(), Math.cos(a) * cr * 0.45 * s, trunkH + (1.5 + r() * 1.4) * s, Math.sin(a) * cr * 0.45 * s);
        c.scale.y = 0.85;
        canopy.push(c);
      }
      const top = this.ball(g, (oak ? 1.9 : 2.1) * s, leafCol(), 0, trunkH + 2.9 * s, 0);
      canopy.push(top);
      height = trunkH + 4.8 * s; canopyR = cr * s;
    }
    return { group: g, canopy, height, canopyR };
  }

  shrub(scale: number, seed: number): THREE.Group {
    const g = new THREE.Group();
    const r = prand(seed);
    const col = this.season === 'fall' && r() < 0.3 ? 0x9a6a2e : [0x3f7a33, 0x4a8a3a, 0x356b2c][Math.floor(r() * 3)];
    const b = this.ball(g, 0.62 * scale, col, 0, 0.45 * scale, 0);
    b.scale.y = 0.8;
    this.ball(g, 0.4 * scale, col, 0.3 * scale, 0.35 * scale, 0.15 * scale);
    if (r() < 0.4) for (let i = 0; i < 5; i++) this.ball(g, 0.07, [0xf2f2f2, 0xe86a8a, 0xf0c040][Math.floor(r() * 3)], (r() - 0.5) * 0.9 * scale, (0.55 + r() * 0.35) * scale, 0.4 * scale, 0);
    return g;
  }

  // ---------------------------------------------------------------- props
  prop(kind: ObstacleKind, seed: number, golf = false): THREE.Group {
    const g = new THREE.Group();
    const r = prand(seed);
    switch (kind) {
      case 'gnome': {
        this.cyl(g, 0.12, 0.15, 0.2, 0x2f5fa0, 0, 0.1, 0);
        this.ball(g, 0.1, 0xf0c8a8, 0, 0.27, 0, 1);
        add(g, mesh(new THREE.ConeGeometry(0.1, 0.14, 8), this.mats.get(0xf4f4f4)), 0, 0.2, 0.06).rotation.x = Math.PI;
        add(g, mesh(new THREE.ConeGeometry(0.11, 0.22, 8), this.mats.get(0xd33a2c)), 0, 0.42, 0);
        break;
      }
      case 'sprinkler': {
        this.cyl(g, 0.06, 0.07, 0.05, 0x2b2b2b, 0, 0.025, 0);
        this.cyl(g, 0.02, 0.02, 0.05, 0x3a3a3a, 0, 0.07, 0);
        break;
      }
      case 'ball': {
        const cols = [0xe83b3b, 0x3b7be8, 0xf2c230, 0xf4f4f4];
        this.ball(g, 0.13, cols[Math.floor(r() * 4)], 0, 0.13, 0, 1);
        break;
      }
      case 'trampoline': {
        const ring = add(g, mesh(new THREE.TorusGeometry(1.7, 0.08, 6, 28), this.mats.get(0x2f6fb0)), 0, 0.85, 0);
        ring.rotation.x = Math.PI / 2;
        const mat = add(g, mesh(new THREE.CircleGeometry(1.55, 24), this.mats.get(0x1e1e1e, { side: THREE.DoubleSide })), 0, 0.84, 0);
        mat.rotation.x = -Math.PI / 2;
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.cyl(g, 0.04, 0.04, 0.85, 0x777777, Math.cos(a) * 1.65, 0.42, Math.sin(a) * 1.65, 5); }
        break;
      }
      case 'kiddie_pool': {
        const ring = add(g, mesh(new THREE.TorusGeometry(0.9, 0.14, 6, 24), this.mats.get(0x4fb0e8)), 0, 0.14, 0);
        ring.rotation.x = Math.PI / 2;
        const w = add(g, mesh(new THREE.CircleGeometry(0.85, 20), this.mats.get(0x8fd8f0)), 0, 0.2, 0);
        w.rotation.x = -Math.PI / 2;
        break;
      }
      case 'swingset': {
        const W = 3.2, H = 2.3;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const leg = this.cyl(g, 0.05, 0.06, H + 0.3, 0x8a5a3a, sx * W / 2, H / 2, sz * 0.55, 6);
          leg.rotation.x = -sz * 0.24;
        }
        const bar = this.cyl(g, 0.06, 0.06, W + 0.3, 0x8a5a3a, 0, H, 0, 6); bar.rotation.z = Math.PI / 2;
        for (const sx of [-0.8, 0.8]) {
          this.box(g, 0.02, 1.7, 0.02, 0x555555, sx - 0.2, H - 0.85, 0);
          this.box(g, 0.02, 1.7, 0.02, 0x555555, sx + 0.2, H - 0.85, 0);
          this.box(g, 0.5, 0.05, 0.2, [0xe84a3a, 0x3a7ae8][sx > 0 ? 1 : 0], sx, 0.5, 0);
        }
        break;
      }
      case 'birdbath': {
        this.cyl(g, 0.16, 0.22, 0.12, 0xb8b2a6, 0, 0.06, 0);
        this.cyl(g, 0.08, 0.11, 0.7, 0xc9c3b6, 0, 0.45, 0);
        this.cyl(g, 0.38, 0.2, 0.14, 0xc9c3b6, 0, 0.86, 0, 12);
        this.cyl(g, 0.32, 0.32, 0.02, 0x8fc8dd, 0, 0.93, 0, 12);
        break;
      }
      case 'doghouse': {
        this.box(g, 1.0, 0.8, 1.2, 0xb06a3a, 0, 0.4, 0);
        this.gable(g, 1.4, 1.2, 0.5, 0x6b3a2a, 0.8).rotation.y = Math.PI / 2;
        this.box(g, 0.4, 0.5, 0.05, 0x201810, 0, 0.3, 0.61, false);
        break;
      }
      case 'bench': {
        for (let i = 0; i < 3; i++) this.box(g, 1.6, 0.05, 0.12, 0x9b6b3f, 0, 0.45, -0.15 + i * 0.15);
        for (let i = 0; i < 2; i++) this.box(g, 1.6, 0.12, 0.04, 0x9b6b3f, 0, 0.65 + i * 0.16, -0.26);
        for (const sx of [-0.7, 0.7]) this.box(g, 0.06, 0.45, 0.45, 0x333333, sx, 0.22, -0.05);
        break;
      }
      case 'bbq': {
        this.ball(g, 0.3, 0x222222, 0, 0.8, 0, 1).scale.y = 0.8;
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const l = this.cyl(g, 0.02, 0.02, 0.8, 0x444444, Math.cos(a) * 0.18, 0.38, Math.sin(a) * 0.18, 4); l.rotation.z = Math.cos(a) * 0.2; }
        break;
      }
      case 'patio_set': {
        this.cyl(g, 0.55, 0.55, 0.05, 0xf4f1ea, 0, 0.72, 0, 16);
        this.cyl(g, 0.04, 0.04, 2.2, 0xdddddd, 0, 1.1, 0, 6);
        add(g, mesh(new THREE.ConeGeometry(1.3, 0.5, 8), this.mats.get([0x2f7a6a, 0xd8583a, 0xe8c040][Math.floor(r() * 3)])), 0, 2.2, 0);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const c = new THREE.Group(); c.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); c.rotation.y = -a + Math.PI / 2; g.add(c);
          this.box(c, 0.45, 0.06, 0.45, 0xf4f1ea, 0, 0.45, 0);
          this.box(c, 0.45, 0.45, 0.05, 0xf4f1ea, 0, 0.7, -0.2);
          this.box(c, 0.4, 0.45, 0.4, 0xdcd8cf, 0, 0.22, 0).scale.set(0.2, 1, 0.2);
        }
        break;
      }
      case 'lamppost': {
        this.cyl(g, 0.06, 0.09, 3.2, 0x2a2a2a, 0, 1.6, 0, 8);
        this.box(g, 0.3, 0.4, 0.3, 0xfff1c0, 0, 3.35, 0).material = this.mats.get(0xfff1c0, { emissive: 0x6b5a20 });
        this.box(g, 0.4, 0.06, 0.4, 0x2a2a2a, 0, 3.58, 0);
        break;
      }
      case 'mailbox': {
        this.box(g, 0.1, 1.05, 0.1, 0x7a5a3a, 0, 0.52, 0);
        this.box(g, 0.24, 0.24, 0.5, [0x2a2a2a, 0x3a5a8a, 0xe8e4da][Math.floor(r() * 3)], 0, 1.15, 0);
        this.box(g, 0.03, 0.14, 0.03, 0xd8342c, 0.13, 1.25, -0.1, false);
        break;
      }
      case 'trashcan': {
        this.cyl(g, 0.3, 0.27, 0.9, 0x2f5f3a, 0, 0.45, 0, 10);
        this.cyl(g, 0.32, 0.32, 0.06, 0x264d30, 0, 0.93, 0, 10);
        break;
      }
      case 'soccer_goal': {
        const W = 3.6, H = 1.8, D = 1.3;
        for (const sx of [-1, 1]) this.cyl(g, 0.05, 0.05, H, 0xf8f8f8, sx * W / 2, H / 2, D / 2, 6);
        const bar = this.cyl(g, 0.05, 0.05, W, 0xf8f8f8, 0, H, D / 2, 6); bar.rotation.z = Math.PI / 2;
        for (const sx of [-1, 1]) { const s = this.cyl(g, 0.03, 0.03, Math.hypot(H, D), 0xdddddd, sx * W / 2, H / 2, 0, 5); s.rotation.x = Math.atan2(D, H); }
        const net = mesh(new THREE.PlaneGeometry(W, Math.hypot(H, D), 12, 6), this.mats.get(0xffffff, { opacity: 0.35, side: THREE.DoubleSide }), false);
        (net.material as THREE.MeshLambertMaterial).wireframe = true;
        net.position.set(0, H / 2, 0);
        net.rotation.x = Math.atan2(D, H);
        g.add(net);
        break;
      }
      case 'flagpole': {
        if (golf) {
          this.cyl(g, 0.02, 0.02, 2.2, 0xf4f4f4, 0, 1.1, 0, 5);
          const f = this.box(g, 0.5, 0.32, 0.01, 0xf2d020, 0.26, 1.98, 0, false);
          f.material = this.mats.get(0xf2d020, { side: THREE.DoubleSide });
          const cup = add(g, mesh(new THREE.CircleGeometry(0.16, 12), this.mats.get(0x1a1a1a)), 0, 0.01, 0);
          cup.rotation.x = -Math.PI / 2;
        } else {
          this.cyl(g, 0.05, 0.08, 8, 0xeeeeee, 0, 4, 0, 8);
          this.ball(g, 0.1, 0xd9b44a, 0, 8.05, 0, 1);
          const f = this.box(g, 1.6, 1.0, 0.02, 0x2c4f8f, 0.82, 7.35, 0, false);
          f.material = this.mats.get(0x2c4f8f, { side: THREE.DoubleSide });
          this.box(g, 1.6, 0.25, 0.025, 0xc8383a, 0.82, 7.0, 0, false);
        }
        break;
      }
      case 'hose_reel': {
        const reel = this.cyl(g, 0.28, 0.28, 0.3, 0x2f7a3a, 0, 0.4, 0, 12); reel.rotation.z = Math.PI / 2;
        const hose = add(g, mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), this.mats.get(0x3a9a3a)), 0, 0.4, 0);
        hose.rotation.y = Math.PI / 2;
        this.box(g, 0.5, 0.06, 0.4, 0x2a2a2a, 0, 0.03, 0);
        break;
      }
      case 'rock_big': {
        add(g, mesh(new THREE.DodecahedronGeometry(0.7, 0), this.mats.get(0x8c8a84)), 0, 0.35, 0).scale.set(1, 0.6, 0.85);
        break;
      }
      case 'shrub_round': return this.shrub(1, seed);
      default: {
        const t = this.tree(kind, 1, seed);
        return t.group;
      }
    }
    return g;
  }

  // ---------------------------------------------------------------- fences
  fence(kind: 'picket' | 'iron' | 'hedge', len: number): THREE.Group {
    const g = new THREE.Group();
    if (kind === 'hedge') {
      const b = this.box(g, len, 1.3, 0.7, 0x3d7534, 0, 0.65, 0);
      b.material = this.mats.get(0x3d7534);
      for (let x = -len / 2 + 0.6; x < len / 2; x += 1.2) this.ball(g, 0.45, 0x44803a, x, 1.25, 0, 0);
      return g;
    }
    const iron = kind === 'iron';
    const col = iron ? 0x2a2a2a : 0xf6f3ec;
    const H = iron ? 1.5 : 1.1;
    const n = Math.max(2, Math.round(len / (iron ? 0.14 : 0.16)));
    const geo = iron ? new THREE.BoxGeometry(0.03, H, 0.03) : new THREE.BoxGeometry(0.09, H, 0.025);
    const im = new THREE.InstancedMesh(geo, this.mats.get(col), n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(-len / 2 + (i + 0.5) * (len / n), H / 2, 0); im.setMatrixAt(i, m4); }
    im.castShadow = true; im.receiveShadow = true;
    g.add(im);
    for (const y of iron ? [0.2, H - 0.12] : [0.3, H - 0.3]) this.box(g, len, 0.07, 0.05, col, 0, y, -0.03);
    for (let x = -len / 2; x <= len / 2 + 0.01; x += 2.4) this.box(g, 0.1, H + 0.1, 0.1, col, x, (H + 0.1) / 2, 0);
    return g;
  }

  // ---------------------------------------------------------------- mowers
  mower(spec: EquipmentSpec, bodyColor: number): { group: THREE.Group; seat: THREE.Vector3 | null; handle: THREE.Vector3 | null } {
    const g = new THREE.Group();
    const W = spec.deckWidth ?? 1;
    const body = bodyColor;
    const dark = 0x2a2a2a;
    const wheel = (x: number, z: number, r: number, wdt: number) => {
      const w = this.cyl(g, r, r, wdt, 0x1c1c1c, x, r, z, 12);
      w.rotation.z = Math.PI / 2;
      const hub = this.cyl(g, r * 0.45, r * 0.45, wdt + 0.01, 0xb8b8b8, x, r, z, 8);
      hub.rotation.z = Math.PI / 2;
    };
    const id = spec.id;
    let seat: THREE.Vector3 | null = null;
    let handle: THREE.Vector3 | null = null;
    if (id === 'reel') {
      const reel = this.cyl(g, 0.12, 0.12, W * 0.85, 0x9aa0a6, 0, 0.13, 0.05, 10); reel.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const bl = this.box(g, W * 0.85, 0.015, 0.03, 0xcfd3d6, 0, 0.13 + Math.sin(i * 1.26) * 0.11, 0.05 + Math.cos(i * 1.26) * 0.11, false);
        bl.rotation.x = i * 1.26;
      }
      wheel(-W * 0.47, 0.05, 0.2, 0.06); wheel(W * 0.47, 0.05, 0.2, 0.06);
      this.box(g, W * 0.9, 0.05, 0.08, body, 0, 0.3, 0.05).name = 'Body';
      this.cyl(g, 0.03, 0.03, 1.2, 0x7a5a3a, 0, 0.72, -0.42, 6).rotation.x = -0.9;
      this.cyl(g, 0.03, 0.03, 0.55, 0x222222, 0, 1.08, -0.9, 6).rotation.z = Math.PI / 2;
      handle = new THREE.Vector3(0, 1.08, -0.9);
    } else if (!spec.rideOn) {
      // rotary walk-behind: round-ish deck, engine, handle
      const deck = this.cyl(g, W * 0.46, W * 0.48, 0.16, body, 0, 0.2, 0, 16);
      deck.scale.z = id === 'walkbehind' ? 0.75 : 1;
      deck.name = 'Body';
      this.cyl(g, 0.16, 0.18, 0.2, dark, 0, 0.38, 0.02, 10);
      this.cyl(g, 0.12, 0.12, 0.08, 0xd8d8d8, 0, 0.52, 0.02, 10);
      const wr = id === 'walkbehind' ? 0.2 : 0.14;
      for (const sx of [-1, 1]) { wheel(sx * W * 0.44, W * 0.34, wr, 0.07); wheel(sx * W * 0.44, -W * 0.34, id === 'walkbehind' ? 0.26 : wr, 0.08); }
      const hl = id === 'walkbehind' ? 1.0 : 1.15;
      for (const sx of [-1, 1]) { const h = this.cyl(g, 0.025, 0.025, hl, 0x333333, sx * 0.22, 0.62, -W * 0.34 - 0.35, 6); h.rotation.x = -0.95; }
      this.cyl(g, 0.03, 0.03, 0.5, 0x333333, 0, 1.0, -W * 0.34 - 0.72, 6).rotation.z = Math.PI / 2;
      handle = new THREE.Vector3(0, 1.0, -W * 0.34 - 0.72);
      if (spec.bagging || id === 'selfprop') {
        const bag = this.box(g, 0.45, 0.35, 0.4, 0x3a3a3a, 0, 0.42, -W * 0.34 - 0.2);
        bag.rotation.x = 0.2;
      } else {
        this.box(g, 0.22, 0.1, 0.3, dark, -W * 0.5, 0.2, 0.05);
      }
      if (id === 'walkbehind') this.box(g, 0.5, 0.3, 0.4, body, 0, 0.5, -W * 0.3);
    } else if (id === 'gangreel') {
      // tractor body with five reels: three in front, two behind the front wheels
      this.box(g, 1.6, 0.9, 2.6, 0x2f6f3a, 0, 1.1, -1.2).name = 'Body';
      this.box(g, 1.2, 0.8, 1.0, 0x2f6f3a, 0, 1.9, -1.8);
      this.box(g, 0.9, 0.5, 0.6, 0x222222, 0, 1.75, -1.3);
      for (const sx of [-1, 1]) { wheel(sx * 0.95, -0.3, 0.45, 0.35); wheel(sx * 0.9, -2.2, 0.55, 0.4); }
      for (let i = 0; i < 5; i++) {
        const front = i < 3;
        const x = front ? (i - 1) * W * 0.33 : (i === 3 ? -1 : 1) * W * 0.33 * 1.5;
        const z = front ? 0.9 : -0.2;
        const rl = this.cyl(g, 0.18, 0.18, W * 0.3, 0xa0a6aa, x, 0.2, z, 10); rl.rotation.z = Math.PI / 2;
        this.box(g, W * 0.3, 0.1, 0.5, 0xd8c040, x, 0.42, z);
      }
      seat = new THREE.Vector3(0, 1.55, -1.7);
      this.box(g, 0.6, 0.12, 0.55, dark, 0, 1.5, -1.7);
      this.box(g, 0.6, 0.6, 0.1, dark, 0, 1.85, -1.98);
    } else {
      // zero-turn, stand-on, wide-area: deck in front of the chassis
      const standon = id === 'standon';
      const deck = this.box(g, W, 0.22, W * 0.42, body, 0, 0.3, 0);
      deck.name = 'Body';
      if (id === 'widearea') { this.box(g, W * 0.28, 0.2, W * 0.4, body, -W * 0.36, 0.34, 0).rotation.z = 0.08; this.box(g, W * 0.28, 0.2, W * 0.4, body, W * 0.36, 0.34, 0).rotation.z = -0.08; }
      this.box(g, W * 0.9, 0.06, W * 0.4, 0xd0d0d0, 0, 0.42, 0);
      const cz = -W * 0.21 - 0.75;
      this.box(g, 1.1, 0.35, 1.5, body, 0, 0.55, cz);
      this.box(g, 0.9, 0.45, 0.6, dark, 0, 0.9, cz - 0.45);
      for (const sx of [-1, 1]) { wheel(sx * 0.62, cz - 0.4, 0.38, 0.3); wheel(sx * 0.45, W * 0.12 + 0.3 - W * 0.21, 0.15, 0.12); }
      if (standon) {
        this.box(g, 0.7, 0.06, 0.45, 0x333333, 0, 0.35, cz - 0.95);
        for (const sx of [-1, 1]) this.cyl(g, 0.025, 0.025, 1.1, 0x333333, sx * 0.3, 1.0, cz - 0.4, 6);
        this.box(g, 0.75, 0.05, 0.05, 0x333333, 0, 1.5, cz - 0.4);
        seat = new THREE.Vector3(0, 0.4, cz - 0.95);
      } else {
        this.box(g, 0.6, 0.14, 0.55, dark, 0, 1.0, cz + 0.05);
        this.box(g, 0.6, 0.38, 0.1, dark, 0, 1.24, cz - 0.27);
        // roll bar and lap bars
        for (const sx of [-1, 1]) this.cyl(g, 0.035, 0.035, 1.4, 0x333333, sx * 0.55, 1.35, cz - 0.55, 6);
        const rb = this.cyl(g, 0.035, 0.035, 1.1, 0x333333, 0, 2.05, cz - 0.55, 6); rb.rotation.z = Math.PI / 2;
        for (const sx of [-1, 1]) { this.cyl(g, 0.022, 0.022, 0.5, 0x333333, sx * 0.3, 1.15, cz + 0.3, 6).rotation.x = 0.4; }
        seat = new THREE.Vector3(0, 1.05, cz + 0.02);
      }
    }
    return { group: g, seat, handle };
  }

  // ---------------------------------------------------------------- people
  /** Character with joints named Head, Torso, ArmL, ArmR, LegL, LegR (pivots at the joints). */
  person(shirt: number, pants = 0x39424e, skin = 0xe0b08a, cap = 0xe8e4da): THREE.Group {
    const g = new THREE.Group();
    const hips = 0.92;
    const legL = new THREE.Group(); legL.name = 'LegL'; legL.position.set(0.11, hips, 0); g.add(legL);
    const legR = new THREE.Group(); legR.name = 'LegR'; legR.position.set(-0.11, hips, 0); g.add(legR);
    for (const l of [legL, legR]) {
      this.box(l, 0.15, 0.82, 0.17, pants, 0, -0.41, 0);
      this.box(l, 0.16, 0.1, 0.28, 0x3a2a20, 0, -0.87, 0.05);
    }
    const torso = new THREE.Group(); torso.name = 'Torso'; torso.position.set(0, hips, 0); g.add(torso);
    this.box(torso, 0.42, 0.58, 0.24, shirt, 0, 0.3, 0);
    this.box(torso, 0.44, 0.12, 0.26, pants, 0, 0.02, 0);
    const head = new THREE.Group(); head.name = 'Head'; head.position.set(0, 0.62, 0); torso.add(head);
    this.ball(head, 0.14, skin, 0, 0.14, 0, 1);
    this.cyl(head, 0.15, 0.15, 0.08, cap, 0, 0.24, 0, 10);
    this.box(head, 0.2, 0.03, 0.14, cap, 0, 0.21, 0.12);
    const armL = new THREE.Group(); armL.name = 'ArmL'; armL.position.set(0.27, 0.54, 0); torso.add(armL);
    const armR = new THREE.Group(); armR.name = 'ArmR'; armR.position.set(-0.27, 0.54, 0); torso.add(armR);
    for (const a of [armL, armR]) {
      this.box(a, 0.11, 0.56, 0.12, shirt, 0, -0.26, 0);
      this.ball(a, 0.06, skin, 0, -0.58, 0, 0);
    }
    return g;
  }

  // ---------------------------------------------------------------- tools
  tool(kind: 'trimmer' | 'blower' | 'backpack' | 'broom' | 'shears'): THREE.Group {
    const g = new THREE.Group();
    if (kind === 'trimmer') {
      const s = this.cyl(g, 0.018, 0.018, 1.6, 0x444444, 0, 0.55, 0.45, 6); s.rotation.x = 1.0;
      this.box(g, 0.14, 0.14, 0.24, 0xe07a24, 0, 0.95, -0.15);
      this.cyl(g, 0.1, 0.1, 0.04, 0x222222, 0, 0.06, 1.1, 10);
    } else if (kind === 'shears') {
      this.box(g, 0.05, 0.02, 0.4, 0xb8b8b8, 0.05, 0.7, 0.35).rotation.y = 0.2;
      this.box(g, 0.05, 0.02, 0.4, 0xb8b8b8, -0.05, 0.7, 0.35).rotation.y = -0.2;
    } else if (kind === 'broom') {
      const s = this.cyl(g, 0.02, 0.02, 1.5, 0x9b6b3f, 0, 0.6, 0.5, 6); s.rotation.x = 1.0;
      this.box(g, 0.6, 0.1, 0.12, 0x5a3a20, 0, 0.06, 1.15);
    } else {
      if (kind === 'backpack') this.box(g, 0.4, 0.5, 0.3, 0xe07a24, 0, 1.2, -0.3);
      else this.box(g, 0.2, 0.22, 0.4, 0xe07a24, 0.2, 0.85, 0.15);
      const tube = this.cyl(g, 0.045, 0.05, 0.9, 0x333333, 0.2, 0.62, 0.55, 8); tube.rotation.x = 1.15;
    }
    return g;
  }

  // ---------------------------------------------------------------- vehicles
  vehicle(key: string, color: number): THREE.Group {
    const g = new THREE.Group();
    const wheel = (x: number, z: number, r: number, w = 0.25) => {
      const m = this.cyl(g, r, r, w, 0x1c1c1c, x, r, z, 12); m.rotation.z = Math.PI / 2;
      const h = this.cyl(g, r * 0.5, r * 0.5, w + 0.01, 0xbfbfbf, x, r, z, 8); h.rotation.z = Math.PI / 2;
    };
    if (key === 'veh_bike') {
      for (const z of [0.5, -0.5]) { const w = add(g, mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 18), this.mats.get(0x1c1c1c)), 0, 0.35, z); w.rotation.y = Math.PI / 2; }
      this.box(g, 0.05, 0.05, 1.0, color, 0, 0.62, 0).rotation.x = 0.15;
      this.box(g, 0.05, 0.5, 0.05, color, 0, 0.55, -0.15);
      this.box(g, 0.22, 0.05, 0.3, 0x222222, 0, 0.85, -0.2);
      this.box(g, 0.5, 0.04, 0.04, 0x333333, 0, 0.95, 0.45);
      // open cart with a tarp-covered load
      this.box(g, 0.9, 0.05, 1.2, 0x5a6b7a, 0, 0.3, -1.5);
      for (const sx of [-1, 1]) this.box(g, 0.04, 0.3, 1.2, 0x5a6b7a, sx * 0.43, 0.45, -1.5);
      for (const sz of [-1, 1]) this.box(g, 0.9, 0.3, 0.04, 0x5a6b7a, 0, 0.45, -1.5 + sz * 0.58);
      this.box(g, 0.6, 0.22, 0.5, 0x3f6b3a, -0.1, 0.42, -1.75).rotation.y = 0.2;
      this.cyl(g, 0.14, 0.14, 0.5, 0xd8c26a, 0.2, 0.45, -1.2, 8).rotation.z = Math.PI / 2;
      for (const sx of [-1, 1]) { const w = add(g, mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), this.mats.get(0x1c1c1c)), sx * 0.5, 0.22, -1.5); w.rotation.y = Math.PI / 2; }
      this.box(g, 0.04, 0.04, 0.8, 0x333333, 0, 0.4, -0.7);
      return g;
    }
    const truck = (len: number, cz: number, boxy: boolean) => {
      const W = boxy ? 2.3 : 2.0;
      this.box(g, W, 0.8, len, color, 0, 0.9, cz).name = 'Body';
      this.box(g, W - 0.1, 0.85, 1.9, color, 0, 1.7, cz + len / 2 - 1.9);
      this.box(g, W - 0.05, 0.55, 0.05, 0x5b7385, 0, 1.75, cz + len / 2 - 0.93, false);
      this.box(g, W - 0.3, 0.2, 0.1, 0xdddddd, 0, 0.7, cz + len / 2 + 0.02, false);
      if (boxy) this.box(g, W + 0.1, 2.3, len - 2.3, 0xf4f1ea, 0, 2.1, cz - 1.0);
      wheel(-W / 2 + 0.1, cz + len / 2 - 0.9, 0.42); wheel(W / 2 - 0.1, cz + len / 2 - 0.9, 0.42);
      wheel(-W / 2 + 0.1, cz - len / 2 + 0.9, 0.42); wheel(W / 2 - 0.1, cz - len / 2 + 0.9, 0.42);
    };
    if (key === 'veh_pickup') truck(5.4, 0, false);
    else if (key === 'veh_pickup_trailer' || key === 'veh_crewtruck') {
      truck(key === 'veh_crewtruck' ? 6.2 : 5.4, 3.2, false);
      this.box(g, 2.0, 0.12, 4.5, 0x555a60, 0, 0.6, -2.4);
      for (const sx of [-1, 1]) { this.box(g, 0.05, 0.4, 4.5, 0x444444, sx, 0.85, -2.4); wheel(sx * 1.1, -2.2, 0.3, 0.2); }
    } else if (key === 'veh_boxtruck') truck(7.5, 0, true);
    else truck(5.4, 0, false);
    return g;
  }

  dispose() { this.mats.dispose(); }
}

// ---------------------------------------------------------------- GLB fitting
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
/** Scale a loaded model uniformly so its height (or footprint) matches, keeping the origin on the ground. */
export function fitModel(obj: THREE.Object3D, target: { height?: number; footprint?: [number, number]; length?: number; fill?: boolean }): void {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  _box.getSize(_size);
  if (_size.x <= 0 || _size.y <= 0) return;
  if (target.footprint && target.fill) {
    // stretch to cover the footprint exactly (buildings), height follows the mean scale
    const sx = target.footprint[0] / _size.x, sz = target.footprint[1] / _size.z;
    obj.scale.set(obj.scale.x * sx, obj.scale.y * Math.sqrt(sx * sz), obj.scale.z * sz);
    return;
  }
  let s = 1;
  if (target.footprint) s = Math.min(target.footprint[0] / _size.x, target.footprint[1] / _size.z);
  else if (target.length) s = target.length / Math.max(_size.x, _size.z);
  else if (target.height) s = target.height / _size.y;
  if (!isFinite(s) || s <= 0) return;
  obj.scale.multiplyScalar(s);
}

/** Mark every mesh under obj as shared so dispose() skips GLB cache resources. */
export function markShared(obj: THREE.Object3D) {
  obj.traverse((o) => { o.userData.mmShared = true; });
}

/** Tint materials named "Body" (cloned so the GLB cache stays untouched). */
export function tintBody(obj: THREE.Object3D, color: THREE.Color) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const out = mats.map((mat) => {
      if (mat && /body/i.test(mat.name)) {
        const c = (mat as THREE.MeshStandardMaterial).clone();
        if ((c as any).color) (c as any).color.copy(color);
        c.userData.mmOwned = true;
        return c;
      }
      return mat;
    });
    m.material = Array.isArray(m.material) ? out : out[0];
  });
}

/** Target visual heights for GLB props by obstacle kind (meters). */
export const PROP_HEIGHT: Partial<Record<ObstacleKind, number>> = {
  tree_oak: 8.5, tree_maple: 7.8, tree_pine: 10, tree_birch: 7.5, tree_palm: 8, shrub_round: 1.0, rock_big: 0.8,
  gnome: 0.5, sprinkler: 0.1, ball: 0.26, trampoline: 1.0, kiddie_pool: 0.35, swingset: 2.4, birdbath: 0.95,
  doghouse: 1.1, bench: 0.85, bbq: 1.1, patio_set: 2.4, lamppost: 3.6, mailbox: 1.3, trashcan: 0.95,
  soccer_goal: 1.9, flagpole: 8.2, hose_reel: 0.8,
};

export const PROP_MODEL: Partial<Record<ObstacleKind, string>> = {
  tree_oak: 'tree_oak', tree_maple: 'tree_maple', tree_pine: 'tree_pine', tree_birch: 'tree_birch', tree_palm: 'tree_palm',
  shrub_round: 'shrub_round', rock_big: 'rock_big', gnome: 'prop_gnome', sprinkler: 'prop_sprinkler', ball: 'prop_ball',
  trampoline: 'prop_trampoline', kiddie_pool: 'prop_kiddie_pool', swingset: 'prop_swingset', birdbath: 'prop_birdbath',
  doghouse: 'prop_doghouse', bench: 'prop_bench', bbq: 'prop_bbq', patio_set: 'prop_patio_set', lamppost: 'prop_lamppost',
  mailbox: 'prop_mailbox', trashcan: 'prop_trashcan', soccer_goal: 'prop_soccer_goal', flagpole: 'prop_flagpole', hose_reel: 'prop_hose_reel',
};

export const HOUSE_MODEL: Record<HouseStyle, string> = {
  ranch: 'house_ranch', colonial: 'house_colonial', cottage: 'house_cottage', modern: 'house_modern', mansion: 'house_mansion',
  office: 'bld_office', church: 'bld_church', school: 'bld_school', clubhouse: 'bld_clubhouse', pavilion: 'bld_pavilion',
};

export const VEHICLE_LENGTH: Record<string, number> = {
  veh_bike: 2.9, veh_pickup: 5.5, veh_pickup_trailer: 11, veh_crewtruck: 12.5, veh_boxtruck: 7.8,
};
