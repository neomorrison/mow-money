// Grass field: per-cell grids for the lawn and everything the mowing job measures.
// Cells are square (cellSize meters). Grid covers x in [0, lot.w] and z in [Z0, lot.d], where Z0 is
// the curb line in front of the sidewalk. Textures mirror the grids for the ground and blade shaders
// and are uploaded only for rows that changed.
import * as THREE from 'three';
import { inBed, inRect, fenceDist, type PropertyLayout, type BedShape } from '../world/property';

export const OUT = 0, LAWN = 1, HARD = 2, BED = 3, BUILDING = 4, SOLID = 5, SAND = 6, WATER = 7;
export const SIDEWALK_Z = -1.8;   // sidewalk runs from here to z = 0
export const GRID_Z0 = -2.0;      // curb top from -2.0 to -1.8
export const EDGE_DIST = 0.45;

// ---------------------------------------------------------------- noise
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
/** Fractal noise in [-1, 1]. */
export function fbm(x: number, y: number, seed: number): number {
  return (valueNoise(x, y, seed) * 0.6 + valueNoise(x * 2.1, y * 2.1, seed + 17) * 0.28 + valueNoise(x * 4.3, y * 4.3, seed + 41) * 0.12) * 2 - 1;
}

export interface FieldOptions {
  layout: PropertyLayout;
  grassIn: number;
  leaves: number;         // 0-1 leaf density
  seed: number;
}

export class GrassField {
  readonly layout: PropertyLayout;
  readonly cs: number;
  readonly nx: number;
  readonly nz: number;
  readonly x0 = 0;
  readonly z0 = GRID_Z0;
  readonly cellArea: number;
  readonly n: number;

  surf: Uint8Array;
  bedId: Int16Array;
  h: Float32Array;
  h0: Float32Array;
  heading: Float32Array;     // last mower heading over the cell (radians), NaN if never mowed
  cutBy: Uint8Array;         // 0 never, 1 mower, 2 trimmer (last tool that touched it)
  cutOnce: Uint8Array;       // 1 once its height was reduced at least once
  passFrame: Uint32Array;    // last frame the mower deck covered the cell (to detect a new pass)
  newClumpT: Float32Array;   // time a clump was laid (fresh clumps are not mulched by the same pass)
  clump: Float32Array;
  debris: Float32Array;      // clippings on non-lawn cells
  leaves: Float32Array;
  edge: Uint8Array;
  cutAt: Float32Array;       // deck height (in) the cell was last cut or mowed over at, 0 if never
  lean: Float32Array;        // visible stripe strength stored with the heading (0..1)
  asphalt: Uint8Array;       // hard cells that are parking lot asphalt rather than concrete

  lawnCells = 0;
  edgeCells = 0;
  initialDebris = 0;
  generatedDebris = 0;
  uniqueCutCells = 0;
  mowerCutCells = 0;

  // textures
  dataA: Uint8Array; dataB: Uint8Array; dataC: Uint8Array;
  texA: THREE.DataTexture; texB: THREE.DataTexture; texC: THREE.DataTexture;
  private dirtyA: Int32Array; private dirtyC: Int32Array;   // per row: [min, max] packed as 2 ints
  private dirtyRowsA: number[] = []; private dirtyRowsC: number[] = [];

  constructor(opt: FieldOptions) {
    const { layout } = opt;
    this.layout = layout;
    const W = layout.lot.w, D = layout.lot.d;
    const span = Math.max(W, D - GRID_Z0);
    this.cs = Math.max(0.1, span / 512);
    this.nx = Math.max(8, Math.ceil(W / this.cs));
    this.nz = Math.max(8, Math.ceil((D - GRID_Z0) / this.cs));
    this.n = this.nx * this.nz;
    this.cellArea = this.cs * this.cs;
    const n = this.n;
    this.surf = new Uint8Array(n);
    this.bedId = new Int16Array(n).fill(-1);
    this.h = new Float32Array(n);
    this.h0 = new Float32Array(n);
    this.heading = new Float32Array(n).fill(NaN);
    this.cutBy = new Uint8Array(n);
    this.cutOnce = new Uint8Array(n);
    this.passFrame = new Uint32Array(n);
    this.newClumpT = new Float32Array(n).fill(-99);
    this.clump = new Float32Array(n);
    this.debris = new Float32Array(n);
    this.leaves = new Float32Array(n);
    this.edge = new Uint8Array(n);
    this.cutAt = new Float32Array(n);
    this.lean = new Float32Array(n);
    this.asphalt = new Uint8Array(n);
    this.dataA = new Uint8Array(n * 4);
    this.dataB = new Uint8Array(n * 4);
    this.dataC = new Uint8Array(n * 4);
    this.dirtyA = new Int32Array(this.nz * 2);
    this.dirtyC = new Int32Array(this.nz * 2);
    for (let j = 0; j < this.nz; j++) { this.dirtyA[j * 2] = 1 << 30; this.dirtyC[j * 2] = 1 << 30; this.dirtyA[j * 2 + 1] = -1; this.dirtyC[j * 2 + 1] = -1; }

    this.rasterize();
    this.initGrass(opt);
    this.computeEdges();

    const mk = (data: Uint8Array) => {
      const t = new THREE.DataTexture(data, this.nx, this.nz, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.generateMipmaps = false;
      t.colorSpace = THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    for (let i = 0; i < n; i++) { this.writeA(i); this.writeC(i); this.writeB(i); }
    this.texA = mk(this.dataA);
    this.texB = mk(this.dataB);
    this.texC = mk(this.dataC);
  }

  // ---------------------------------------------------------------- coordinates
  idx(x: number, z: number): number {
    const i = Math.floor((x - this.x0) / this.cs), j = Math.floor((z - this.z0) / this.cs);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }
  cx(i: number): number { return this.x0 + (i + 0.5) * this.cs; }
  cz(j: number): number { return this.z0 + (j + 0.5) * this.cs; }
  surfAt(x: number, z: number): number { const k = this.idx(x, z); return k < 0 ? OUT : this.surf[k]; }
  heightAt(x: number, z: number): number { const k = this.idx(x, z); return k < 0 ? 0 : this.h[k]; }

  // ---------------------------------------------------------------- setup
  private paintBox(x0: number, x1: number, z0: number, z1: number, fn: (k: number, x: number, z: number) => void) {
    const i0 = Math.max(0, Math.floor((x0 - this.x0) / this.cs)), i1 = Math.min(this.nx - 1, Math.floor((x1 - this.x0) / this.cs));
    const j0 = Math.max(0, Math.floor((z0 - this.z0) / this.cs)), j1 = Math.min(this.nz - 1, Math.floor((z1 - this.z0) / this.cs));
    for (let j = j0; j <= j1; j++) {
      const z = this.cz(j);
      for (let i = i0; i <= i1; i++) fn(j * this.nx + i, this.cx(i), z);
    }
  }
  private paintRect(r: { x: number; z: number; w: number; d: number; rot?: number }, s: number) {
    const m = r.rot ? Math.hypot(r.w, r.d) / 2 : 0;
    const hw = r.rot ? m : r.w / 2, hd = r.rot ? m : r.d / 2;
    this.paintBox(r.x - hw, r.x + hw, r.z - hd, r.z + hd, (k, x, z) => { if (inRect(r, x, z)) this.surf[k] = s; });
  }
  private paintBed(b: BedShape, s: number, id: number) {
    const bx = b.kind === 'rect' ? b.rect.x : b.x, bz = b.kind === 'rect' ? b.rect.z : b.z;
    const m = b.kind === 'rect' ? Math.hypot(b.rect.w, b.rect.d) / 2 : Math.max(b.rx, b.rz);
    this.paintBox(bx - m, bx + m, bz - m, bz + m, (k, x, z) => {
      if (inBed(b, x, z)) { this.surf[k] = s; if (id >= 0) this.bedId[k] = id; }
    });
  }

  private rasterize() {
    const L = this.layout;
    const D = L.lot.d;
    for (let j = 0; j < this.nz; j++) {
      const z = this.cz(j);
      const s = z < SIDEWALK_Z ? HARD : z < 0 ? HARD : z <= D ? LAWN : OUT;
      this.surf.fill(s, j * this.nx, (j + 1) * this.nx);
    }
    for (const r of [...L.driveway, ...L.walkways, ...L.patios]) this.paintRect(r, HARD);
    // parking lots on commercial, park and golf properties are asphalt
    if (L.lot.kind !== 'residential' && L.lot.kind !== 'estate') {
      for (const r of L.driveway) this.paintBox(r.x - r.w / 2, r.x + r.w / 2, r.z - r.d / 2, r.z + r.d / 2, (k, x, z) => { if (inRect(r, x, z)) this.asphalt[k] = 1; });
    }
    L.beds.forEach((b, i) => this.paintBed(b, BED, i));
    for (const b of L.bunkers ?? []) this.paintBed(b, SAND, -1);
    for (const b of L.ponds ?? []) this.paintBed(b, WATER, -1);
    this.paintRect(L.house, BUILDING);
    for (const o of L.obstacles) {
      if (!o.solid) continue;
      // trunks and posts: the footprint the mower can never cut
      const r = o.kind.startsWith('tree') ? o.r : o.kind === 'soccer_goal' ? 0 : o.r * 0.85;
      if (r <= 0) continue;
      this.paintBox(o.x - r, o.x + r, o.z - r, o.z + r, (k, x, z) => {
        if ((x - o.x) ** 2 + (z - o.z) ** 2 <= r * r && this.surf[k] === LAWN) this.surf[k] = SOLID;
      });
    }
    for (const f of L.fences) {
      const t = f.kind === 'hedge' ? 0.35 : 0.07;
      this.paintBox(Math.min(f.x1, f.x2) - t, Math.max(f.x1, f.x2) + t, Math.min(f.z1, f.z2) - t, Math.max(f.z1, f.z2) + t, (k, x, z) => {
        if (fenceDist(f, x, z) <= t && this.surf[k] === LAWN) this.surf[k] = SOLID;
      });
    }
  }

  private initGrass(opt: FieldOptions) {
    const { grassIn, leaves, seed } = opt;
    const L = this.layout;
    // faster growing patches (shade, wet spots)
    const patches: { x: number; z: number; r: number; a: number }[] = [];
    const np = 2 + (seed % 4);
    for (let p = 0; p < np; p++) {
      patches.push({
        x: hash2(p, 1, seed) * L.lot.w, z: hash2(p, 2, seed) * L.lot.d,
        r: 1.8 + hash2(p, 3, seed) * Math.max(2.5, Math.min(L.lot.w, L.lot.d) * 0.12), a: 0.15 + hash2(p, 4, seed) * 0.2,
      });
    }
    const trees = L.obstacles.filter((o) => o.kind.startsWith('tree'));
    const s1 = (seed % 9973) + 3;
    for (let j = 0; j < this.nz; j++) {
      const z = this.cz(j);
      for (let i = 0; i < this.nx; i++) {
        const k = j * this.nx + i;
        const x = this.cx(i);
        const s = this.surf[k];
        if (s === LAWN || s === SOLID) {
          let m = 1 + 0.22 * fbm(x * 0.33, z * 0.33, s1);
          for (const p of patches) {
            const d2 = ((x - p.x) ** 2 + (z - p.z) ** 2) / (p.r * p.r);
            if (d2 < 4) m += p.a * Math.exp(-d2 * 1.4);
          }
          const hh = Math.max(0.6, grassIn * m);
          this.h[k] = hh;
          this.h0[k] = hh;
          if (s === LAWN) this.lawnCells++;
        }
        if (leaves > 0 && (s === LAWN || s === HARD)) {
          let near = 0;
          for (const t of trees) {
            const d2 = (x - t.x) ** 2 + (z - t.z) ** 2;
            if (d2 < 100) near += Math.exp(-d2 / 30);
          }
          const nz = valueNoise(x * 0.7, z * 0.7, s1 + 5);
          const v = Math.min(1, leaves * (0.25 + 0.9 * near) * (0.4 + nz * 1.2) * (s === HARD ? 0.6 : 1));
          this.leaves[k] = v > 0.05 ? v : 0;
          this.initialDebris += this.leaves[k];
        }
      }
    }
  }

  private computeEdges() {
    const { nx, nz } = this;
    const R = Math.max(1, Math.round(EDGE_DIST / this.cs));
    const r2 = Math.max((EDGE_DIST / this.cs) ** 2, 1.01);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const s = this.surf[k];
        if (s === LAWN || s === OUT) continue;
        // only boundary cells of obstacles matter
        let border = false;
        if (i > 0 && this.surf[k - 1] === LAWN) border = true;
        else if (i < nx - 1 && this.surf[k + 1] === LAWN) border = true;
        else if (j > 0 && this.surf[k - nx] === LAWN) border = true;
        else if (j < nz - 1 && this.surf[k + nx] === LAWN) border = true;
        if (!border) continue;
        for (let dj = -R; dj <= R; dj++) {
          const jj = j + dj;
          if (jj < 0 || jj >= nz) continue;
          for (let di = -R; di <= R; di++) {
            const ii = i + di;
            if (ii < 0 || ii >= nx || di * di + dj * dj > r2) continue;
            const kk = jj * nx + ii;
            if (this.surf[kk] === LAWN) this.edge[kk] = 1;
          }
        }
      }
    }
    let c = 0;
    for (let k = 0; k < this.n; k++) if (this.edge[k]) c++;
    this.edgeCells = c;
  }

  // ---------------------------------------------------------------- texture packing
  writeA(k: number) {
    const o = k * 4;
    const d = this.dataA;
    const hh = this.h[k];
    d[o] = hh >= 12.75 ? 255 : (hh * 20) | 0;
    const hd = this.heading[k];
    if (hd === hd && this.cutBy[k] === 1) {
      const v = this.lean[k] * 127;
      d[o + 1] = (127.5 + Math.sin(hd) * v) | 0;
      d[o + 2] = (127.5 + Math.cos(hd) * v) | 0;
    } else { d[o + 1] = 128; d[o + 2] = 128; }
    d[o + 3] = this.cutBy[k] ? 255 : 0;
  }
  private writeB(k: number) {
    const o = k * 4;
    const s = this.surf[k];
    const d = this.dataB;
    d[o] = s === LAWN ? 255 : 0;
    d[o + 1] = s === HARD ? 255 : 0;
    d[o + 2] = s === BED ? 255 : 0;
    d[o + 3] = s === SAND ? 170 : s === WATER ? 255 : s === HARD && this.asphalt[k] ? 85 : 0;
  }
  writeC(k: number) {
    const o = k * 4;
    const d = this.dataC;
    d[o] = Math.min(255, this.clump[k] * 255) | 0;
    d[o + 1] = Math.min(255, this.debris[k] * 255) | 0;
    d[o + 2] = Math.min(255, this.leaves[k] * 255) | 0;
    // done: cut (or mowed over) and within half an inch of that deck, so the missed-spot flash skips it
    d[o + 3] = this.cutAt[k] > 0 && this.h[k] <= this.cutAt[k] + 0.5 ? 255 : 0;
  }
  /**
   * Height a lawn cell must be at or under to count as mowed: half an inch over the deck it was cut at, or
   * over `ref` (the deck used for most of the lawn) if the mower never reached it.
   */
  limitAt(k: number, ref: number): number {
    const c = this.cutAt[k];
    return (c > 0 ? c : ref) + 0.5;
  }
  markA(k: number) {
    this.writeA(k);
    const j = (k / this.nx) | 0, i = k - j * this.nx;
    const d = this.dirtyA;
    if (d[j * 2 + 1] < 0) this.dirtyRowsA.push(j);
    if (i < d[j * 2]) d[j * 2] = i;
    if (i > d[j * 2 + 1]) d[j * 2 + 1] = i;
  }
  markC(k: number) {
    this.writeC(k);
    const j = (k / this.nx) | 0, i = k - j * this.nx;
    const d = this.dirtyC;
    if (d[j * 2 + 1] < 0) this.dirtyRowsC.push(j);
    if (i < d[j * 2]) d[j * 2] = i;
    if (i > d[j * 2 + 1]) d[j * 2 + 1] = i;
  }
  /** Push changed rows to the GPU. Call once per frame. */
  flush() {
    this.flushOne(this.texA, this.dirtyA, this.dirtyRowsA);
    this.flushOne(this.texC, this.dirtyC, this.dirtyRowsC);
  }
  private flushOne(tex: THREE.DataTexture, d: Int32Array, rows: number[]) {
    if (!rows.length) return;
    if (rows.length > 96) {
      tex.clearUpdateRanges();
    } else {
      for (const j of rows) {
        const a = d[j * 2], b = d[j * 2 + 1];
        tex.addUpdateRange((j * this.nx + a) * 4, (b - a + 1) * 4);
      }
    }
    for (const j of rows) { d[j * 2] = 1 << 30; d[j * 2 + 1] = -1; }
    rows.length = 0;
    tex.needsUpdate = true;
  }

  dispose() {
    this.texA.dispose(); this.texB.dispose(); this.texC.dispose();
  }

  // ---------------------------------------------------------------- measurements
  /** Sum of all loose debris (clippings on hard surfaces plus leaves anywhere). */
  debrisTotal(): number {
    // traces under 0.03 per cell are invisible and do not count
    let s = 0;
    for (let k = 0; k < this.n; k++) {
      const d = this.debris[k] + this.leaves[k];
      if (d > 0.03) s += d;
    }
    return s;
  }
}
