// Property layout generator. OWNED BY THE MOW BUILDER. Pure (no three.js, no DOM), deterministic from
// (seed, lot). Used by the sim (lawn and hardscape area for pricing) and by the 3D scene and the
// neighborhood diorama (to place the house, driveway, beds, trees and props).
//
// Coordinate frame: meters. x across the lot (0..lot.w), z from the street edge (0) to the back (lot.d).
// The street is at z < 0. The house front door faces the street (-z direction).
//
// Contract: generateProperty must be fast (< 0.5 ms for residential lots) because the sim calls it for
// every house when building a neighborhood; compute areas analytically, not by fine rasterization.
//
// Every generated shape is placed so it does not overlap another shape of a different class
// (house, hardscape, beds, bunkers, ponds), which is what makes the analytic lawn area exact:
//   lawnM2 = lot area - house - hardscape - beds - bunkers - ponds - footprints of solid obstacles on lawn.
import type { LotSpec, HouseStyle } from '../core/types';

export interface Rect { x: number; z: number; w: number; d: number; rot?: number }           // x,z = center
export interface Circle { x: number; z: number; r: number }
export type BedShape = { kind: 'rect'; rect: Rect } | { kind: 'ellipse'; x: number; z: number; rx: number; rz: number; rot: number };
export type ObstacleKind =
  | 'tree_oak' | 'tree_maple' | 'tree_pine' | 'tree_birch' | 'tree_palm' | 'shrub_round' | 'rock_big'
  | 'gnome' | 'sprinkler' | 'ball' | 'trampoline' | 'kiddie_pool' | 'swingset' | 'birdbath' | 'doghouse'
  | 'bench' | 'bbq' | 'patio_set' | 'lamppost' | 'mailbox' | 'trashcan' | 'soccer_goal' | 'flagpole' | 'hose_reel';

export interface Obstacle extends Circle {
  kind: ObstacleKind;
  rot: number;
  solid: boolean;          // blocks the mower (trees, swingset) vs can be run over and damaged (gnome, ball, sprinkler)
  damagePoints: number;    // quality points lost if run over (0 for solid)
  damageCost: number;      // $ charged if run over
  /** Visual scale hint (1 = typical size for the kind). Trees vary between 0.8 and 1.3. */
  scale?: number;
  /** True when the obstacle stands inside a flower bed or on hardscape (its footprint is not lawn). */
  offLawn?: boolean;
}

export interface FenceSeg { x1: number; z1: number; x2: number; z2: number; kind: 'picket' | 'iron' | 'hedge' }

export interface PropertyLayout {
  seed: number;
  lot: LotSpec;
  house: Rect & { style: HouseStyle };
  driveway: Rect[];
  walkways: Rect[];
  patios: Rect[];
  beds: BedShape[];
  obstacles: Obstacle[];
  fences: FenceSeg[];
  lawnM2: number;          // mowable lawn area
  hardscapeM2: number;     // driveway + walkways + patios
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  // ---- added by the mow builder (optional so older consumers keep compiling)
  /** Sand bunkers (golf). Not lawn, not solid, no damage. */
  bunkers?: BedShape[];
  /** Water (golf ponds). Not lawn, blocks the mower. */
  ponds?: BedShape[];
  /** Front door position on the house front wall. */
  door?: { x: number; z: number };
  /** Which end of the house holds the garage: +1 = high x, -1 = low x. */
  garageSide?: 1 | -1;
}

export interface GenerateOptions {
  /** Small and simple practice lawn (no fences, one bed, one tree). */
  practice?: boolean;
}

// ---------------------------------------------------------------- obstacle catalog
interface ObDef { r: number; solid: boolean; pts: number; cost: number }
export const OBSTACLE_DEFS: Record<ObstacleKind, ObDef> = {
  tree_oak: { r: 0.45, solid: true, pts: 0, cost: 0 },
  tree_maple: { r: 0.4, solid: true, pts: 0, cost: 0 },
  tree_pine: { r: 0.42, solid: true, pts: 0, cost: 0 },
  tree_birch: { r: 0.3, solid: true, pts: 0, cost: 0 },
  tree_palm: { r: 0.35, solid: true, pts: 0, cost: 0 },
  shrub_round: { r: 0.55, solid: true, pts: 0, cost: 0 },
  rock_big: { r: 0.7, solid: true, pts: 0, cost: 0 },
  gnome: { r: 0.2, solid: false, pts: 4, cost: 25 },
  sprinkler: { r: 0.1, solid: false, pts: 5, cost: 35 },
  ball: { r: 0.16, solid: false, pts: 2, cost: 10 },
  trampoline: { r: 1.8, solid: true, pts: 0, cost: 0 },
  kiddie_pool: { r: 1.0, solid: true, pts: 0, cost: 0 },
  swingset: { r: 1.5, solid: true, pts: 0, cost: 0 },
  birdbath: { r: 0.35, solid: true, pts: 0, cost: 0 },
  doghouse: { r: 0.7, solid: true, pts: 0, cost: 0 },
  bench: { r: 0.8, solid: true, pts: 0, cost: 0 },
  bbq: { r: 0.45, solid: true, pts: 0, cost: 0 },
  patio_set: { r: 1.1, solid: true, pts: 0, cost: 0 },
  lamppost: { r: 0.18, solid: true, pts: 0, cost: 0 },
  mailbox: { r: 0.22, solid: true, pts: 0, cost: 0 },
  trashcan: { r: 0.35, solid: true, pts: 0, cost: 0 },
  soccer_goal: { r: 1.3, solid: true, pts: 0, cost: 0 },
  flagpole: { r: 0.14, solid: true, pts: 0, cost: 0 },
  hose_reel: { r: 0.35, solid: true, pts: 0, cost: 0 },
};

// ---------------------------------------------------------------- small deterministic RNG (world depends on core types only)
interface R { next(): number; range(a: number, b: number): number; int(a: number, b: number): number; chance(p: number): boolean; pick<T>(a: readonly T[]): T }
function rng(seed: number): R {
  let a = (seed ^ 0x5bd1e995) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

// ---------------------------------------------------------------- geometry helpers (exported for the 3D scene)
/** Distance from a point to an axis-aligned (or rotated) rectangle; 0 inside. */
export function rectDist(r: Rect, x: number, z: number): number {
  let dx = x - r.x, dz = z - r.z;
  if (r.rot) {
    const c = Math.cos(-r.rot), s = Math.sin(-r.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    dx = lx; dz = lz;
  }
  const ex = Math.max(0, Math.abs(dx) - r.w / 2);
  const ez = Math.max(0, Math.abs(dz) - r.d / 2);
  return Math.hypot(ex, ez);
}
export function inRect(r: Rect, x: number, z: number, pad = 0): boolean {
  let dx = x - r.x, dz = z - r.z;
  if (r.rot) {
    const c = Math.cos(-r.rot), s = Math.sin(-r.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    dx = lx; dz = lz;
  }
  return Math.abs(dx) <= r.w / 2 + pad && Math.abs(dz) <= r.d / 2 + pad;
}
export function inBed(b: BedShape, x: number, z: number, pad = 0): boolean {
  if (b.kind === 'rect') return inRect(b.rect, x, z, pad);
  let dx = x - b.x, dz = z - b.z;
  if (b.rot) {
    const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    dx = lx; dz = lz;
  }
  const rx = b.rx + pad, rz = b.rz + pad;
  return (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz) <= 1;
}
export function bedArea(b: BedShape): number {
  return b.kind === 'rect' ? b.rect.w * b.rect.d : Math.PI * b.rx * b.rz;
}
/** Bounding radius-ish extents of a bed (for keep-out checks). */
function bedBox(b: BedShape): Rect {
  if (b.kind === 'rect') return b.rect;
  const m = Math.max(b.rx, b.rz);
  return { x: b.x, z: b.z, w: b.rot ? m * 2 : b.rx * 2, d: b.rot ? m * 2 : b.rz * 2 };
}
function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad;
}
function rectFromEdges(x0: number, x1: number, z0: number, z1: number): Rect {
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0) };
}

// ---------------------------------------------------------------- builder with keep-out bookkeeping
class Builder {
  house: Rect & { style: HouseStyle } = { x: 0, z: 0, w: 1, d: 1, style: 'ranch' };
  driveway: Rect[] = [];
  walkways: Rect[] = [];
  patios: Rect[] = [];
  beds: BedShape[] = [];
  bunkers: BedShape[] = [];
  ponds: BedShape[] = [];
  obstacles: Obstacle[] = [];
  fences: FenceSeg[] = [];
  extraBlocks: Rect[] = [];   // buildings that are not "the house" (none today, kept for future)
  constructor(public r: R, public lot: LotSpec) {}

  hard(): Rect[] { return [...this.driveway, ...this.walkways, ...this.patios]; }

  /** True if a circle at (x,z) radius rad stays clear of everything with the given padding. */
  clear(x: number, z: number, rad: number, opt: { house?: number; hard?: number; beds?: number; obs?: number; edge?: number; ignoreBed?: BedShape } = {}): boolean {
    const { w, d } = this.lot;
    const edge = opt.edge ?? 0.6;
    if (x - rad < edge || x + rad > w - edge || z - rad < edge || z + rad > d - edge) return false;
    if (rectDist(this.house, x, z) < rad + (opt.house ?? 1.5)) return false;
    for (const b of this.extraBlocks) if (rectDist(b, x, z) < rad + (opt.house ?? 1.5)) return false;
    const hp = opt.hard ?? 0.8;
    for (const h of this.driveway) if (rectDist(h, x, z) < rad + hp) return false;
    for (const h of this.walkways) if (rectDist(h, x, z) < rad + hp) return false;
    for (const h of this.patios) if (rectDist(h, x, z) < rad + hp) return false;
    const bp = opt.beds ?? 0.6;
    for (const b of this.beds) {
      if (b === opt.ignoreBed) continue;
      if (rectDist(bedBox(b), x, z) < rad + bp) return false;
    }
    for (const b of this.bunkers) if (rectDist(bedBox(b), x, z) < rad + bp) return false;
    for (const b of this.ponds) if (rectDist(bedBox(b), x, z) < rad + bp) return false;
    const op = opt.obs ?? 0.8;
    for (const o of this.obstacles) if (Math.hypot(o.x - x, o.z - z) < rad + o.r + op) return false;
    for (const f of this.fences) if (segDist(f, x, z) < rad + 0.6) return false;
    return true;
  }

  add(kind: ObstacleKind, x: number, z: number, extra: Partial<Obstacle> = {}): Obstacle {
    const d = OBSTACLE_DEFS[kind];
    const o: Obstacle = {
      kind, x, z, r: d.r * (extra.scale ?? 1), rot: extra.rot ?? this.r.range(0, Math.PI * 2),
      solid: d.solid, damagePoints: d.pts, damageCost: d.cost, ...extra,
    };
    if (extra.scale && kind.startsWith('tree')) o.r = d.r * (0.8 + 0.2 * extra.scale);
    this.obstacles.push(o);
    return o;
  }

  /** Rejection-sample a spot. Returns null after `tries` failures. */
  spot(x0: number, x1: number, z0: number, z1: number, rad: number, opt: Parameters<Builder['clear']>[3] = {}, tries = 24): { x: number; z: number } | null {
    if (x1 <= x0 || z1 <= z0) return null;
    for (let i = 0; i < tries; i++) {
      const x = this.r.range(x0, x1), z = this.r.range(z0, z1);
      if (this.clear(x, z, rad, opt)) return { x, z };
    }
    return null;
  }

  tree(x0: number, x1: number, z0: number, z1: number, kinds: readonly ObstacleKind[], ringChance: number, opt: Parameters<Builder['clear']>[3] = {}): boolean {
    const scale = this.r.range(0.8, 1.3);
    const canopy = 1.6 * scale;
    const p = this.spot(x0, x1, z0, z1, canopy, { house: 1.8, hard: 0.4, beds: 0.8, obs: 1.4, edge: 0.4, ...opt });
    if (!p) return false;
    const kind = this.r.pick(kinds);
    let offLawn = false;
    if (this.r.chance(ringChance)) {
      const rr = this.r.range(1.1, 1.7);
      this.beds.push({ kind: 'ellipse', x: p.x, z: p.z, rx: rr, rz: rr, rot: 0 });
      offLawn = true;
    }
    this.add(kind, p.x, p.z, { scale, offLawn });
    return true;
  }

  layout(seed: number): PropertyLayout {
    const { w, d } = this.lot;
    const hardscapeM2 = this.hard().reduce((s, h) => s + h.w * h.d, 0);
    let nonLawn = this.house.w * this.house.d + hardscapeM2;
    for (const b of this.extraBlocks) nonLawn += b.w * b.d;
    for (const b of this.beds) nonLawn += bedArea(b);
    for (const b of this.bunkers) nonLawn += bedArea(b);
    for (const b of this.ponds) nonLawn += bedArea(b);
    for (const o of this.obstacles) {
      if (!o.solid) continue;
      if (o.offLawn === undefined) o.offLawn = this.isOffLawn(o.x, o.z);
      if (!o.offLawn) nonLawn += Math.PI * o.r * o.r;
    }
    for (const o of this.obstacles) if (o.offLawn === undefined) o.offLawn = this.isOffLawn(o.x, o.z);
    return {
      seed, lot: this.lot, house: this.house,
      driveway: this.driveway, walkways: this.walkways, patios: this.patios,
      beds: this.beds, obstacles: this.obstacles, fences: this.fences,
      lawnM2: Math.max(20, Math.round((w * d - nonLawn) * 10) / 10),
      hardscapeM2: Math.round(hardscapeM2 * 10) / 10,
      bounds: { minX: 0, maxX: w, minZ: 0, maxZ: d },
      bunkers: this.bunkers, ponds: this.ponds,
    };
  }

  isOffLawn(x: number, z: number): boolean {
    for (const h of this.hard()) if (inRect(h, x, z)) return true;
    for (const b of this.beds) if (inBed(b, x, z)) return true;
    return false;
  }
}

function segDist(f: { x1: number; z1: number; x2: number; z2: number }, x: number, z: number): number {
  const vx = f.x2 - f.x1, vz = f.z2 - f.z1;
  const l2 = vx * vx + vz * vz || 1e-9;
  const t = clamp(((x - f.x1) * vx + (z - f.z1) * vz) / l2, 0, 1);
  return Math.hypot(x - (f.x1 + vx * t), z - (f.z1 + vz * t));
}
export { segDist as fenceDist };

// ---------------------------------------------------------------- style table (footprint share of the lot, width/depth aspect)
const STYLE: Record<HouseStyle, { frac: number; aspect: number; maxW: number }> = {
  ranch: { frac: 0.215, aspect: 1.9, maxW: 22 },
  colonial: { frac: 0.18, aspect: 1.35, maxW: 17 },
  cottage: { frac: 0.15, aspect: 1.25, maxW: 12 },
  modern: { frac: 0.195, aspect: 1.55, maxW: 18 },
  mansion: { frac: 0.2, aspect: 1.8, maxW: 34 },
  office: { frac: 0.13, aspect: 1.7, maxW: 60 },
  church: { frac: 0.1, aspect: 0.7, maxW: 24 },
  school: { frac: 0.14, aspect: 2.3, maxW: 70 },
  clubhouse: { frac: 0.02, aspect: 1.6, maxW: 30 },
  pavilion: { frac: 0.012, aspect: 1.4, maxW: 16 },
};

const TREES_RES: readonly ObstacleKind[] = ['tree_oak', 'tree_maple', 'tree_maple', 'tree_birch', 'tree_pine'];
const TREES_EST: readonly ObstacleKind[] = ['tree_oak', 'tree_oak', 'tree_maple', 'tree_birch', 'tree_pine'];

// ---------------------------------------------------------------- residential and estate
function residential(b: Builder, estate: boolean, practice: boolean, houseMult: number) {
  const { r, lot } = b;
  const W = lot.w, D = lot.d, A = W * D;
  const st = STYLE[lot.style] ?? STYLE.ranch;
  const frac = (estate ? st.frac * 0.62 : st.frac) * r.range(0.92, 1.08) * houseMult;
  let hw = Math.sqrt(A * frac * st.aspect);
  let hd = (A * frac) / hw;
  hw = Math.min(hw, W * 0.68, st.maxW * (estate ? 1.6 : 1.8));
  hd = Math.min(hd, D * 0.4);
  hw = Math.max(hw, Math.min(7, W * 0.5));
  hd = Math.max(hd, Math.min(6, D * 0.25));

  const sb = clamp(D * (estate ? 0.3 : 0.25) * r.range(0.9, 1.1), 4.5, estate ? 24 : 12);
  const gs: 1 | -1 = r.chance(0.5) ? 1 : -1;
  const dw = estate ? 4.2 : W > 19 ? 5.2 : 3.3;
  // house x: keep at least 2.2 m on the non garage side and 1.6 m on the garage side
  const minX = hw / 2 + 2.2, maxX = W - hw / 2 - 2.2;
  let hx = W / 2 + gs * r.range(-0.1, 0.35) * Math.max(0, (W - hw) / 2 - 2.2);
  hx = clamp(hx, Math.min(minX, W / 2), Math.max(maxX, W / 2));
  const hz = sb + hd / 2;
  b.house = { x: hx, z: hz, w: hw, d: hd, style: lot.style };
  const front = sb;
  const back = sb + hd;
  const houseL = hx - hw / 2, houseR = hx + hw / 2;

  // driveway to the garage end
  const garageEdge = gs > 0 ? houseR - 0.3 : houseL + 0.3;
  const dx = garageEdge - gs * dw / 2;
  let driveInner: number;   // x of the driveway edge facing the door
  if (estate && sb > 12) {
    const courtW = Math.min(dw * 2.4, hw * 0.55), courtD = Math.min(8, sb * 0.45);
    const cx = garageEdge - gs * courtW / 2;
    b.driveway.push({ x: cx, z: front - courtD / 2, w: courtW, d: courtD });
    b.driveway.push({ x: dx, z: (front - courtD) / 2, w: dw, d: front - courtD });
    driveInner = cx - gs * courtW / 2;
  } else {
    b.driveway.push({ x: dx, z: front / 2, w: dw, d: front });
    driveInner = dx - gs * dw / 2;
  }

  // front door and walkway
  const doorX = hx - gs * hw * r.range(0.05, 0.22);
  const door = { x: doorX, z: front };
  const ww = estate ? 1.8 : 1.2;
  const toDrive = !practice && r.chance(0.45);
  let walkBreak: [number, number] = [doorX - ww / 2, doorX + ww / 2];
  if (toDrive) {
    const zj = front * r.range(0.35, 0.55);
    const x0 = doorX - gs * ww / 2;   // outer side of the vertical leg
    b.walkways.push(rectFromEdges(doorX - ww / 2, doorX + ww / 2, zj - ww / 2, front));
    const hx0 = gs > 0 ? doorX + ww / 2 : driveInner;
    const hx1 = gs > 0 ? driveInner : doorX - ww / 2;
    if (hx1 - hx0 > 0.2) b.walkways.push(rectFromEdges(hx0, hx1, zj - ww / 2, zj + ww / 2));
    void x0;
  } else {
    b.walkways.push(rectFromEdges(doorX - ww / 2, doorX + ww / 2, 0, front));
  }

  // back patio
  const backDepth = D - back;
  if (!practice && backDepth > 7) {
    const pd = Math.min(r.range(3, estate ? 6 : 4.5), backDepth - 4);
    const pw = hw * r.range(0.35, 0.6);
    const px = clamp(hx + r.range(-0.2, 0.2) * hw, houseL + pw / 2, houseR - pw / 2);
    b.patios.push({ x: px, z: back + pd / 2, w: pw, d: pd });
  }

  // front bed along the house, split by the walkway, stopping before the driveway
  const bedD = r.range(1.1, estate ? 2.2 : 1.6);
  const bedL = gs > 0 ? houseL + 0.2 : Math.max(houseL, driveInner + 0.5);
  const bedR = gs > 0 ? Math.min(houseR, driveInner - 0.5) : houseR - 0.2;
  const pieces: [number, number][] = [];
  if (bedR - bedL > 1) {
    const a0 = walkBreak[0] - 0.3, a1 = walkBreak[1] + 0.3;
    if (a0 - bedL > 1.2) pieces.push([bedL, Math.min(a0, bedR)]);
    if (bedR - a1 > 1.2) pieces.push([Math.max(a1, bedL), bedR]);
  }
  // walkway to the driveway has a horizontal leg; keep front bed above it
  const walkTop = toDrive ? Math.max(...b.walkways.map((w) => w.z + w.d / 2).filter((z) => z < front - 0.01), 0) : 0;
  const bedZ0 = Math.max(front - bedD, walkTop + 0.8);
  if (front - bedZ0 > 0.7) {
    for (const [x0, x1] of pieces) {
      const bed: BedShape = { kind: 'rect', rect: rectFromEdges(x0, x1, bedZ0, front) };
      b.beds.push(bed);
      // shrubs in the bed
      if (!practice) {
        const n = Math.floor((x1 - x0) / 1.9);
        for (let i = 0; i < n; i++) {
          if (!r.chance(0.7)) continue;
          const sx = x0 + (i + 0.5) * ((x1 - x0) / n);
          b.add('shrub_round', sx, (bedZ0 + front) / 2, { scale: Math.min(1, (front - bedZ0) / 1.3), offLawn: true });
        }
      }
    }
  }

  // mailbox at the street, beside the driveway or the walkway
  {
    const mx = gs > 0 ? dx + dw / 2 + 0.6 : dx - dw / 2 - 0.6;
    if (mx > 0.4 && mx < W - 0.4) b.add('mailbox', mx, 0.45, { rot: Math.PI });
  }

  if (practice) {
    b.tree(2, W - 2, back + 2, D - 1, TREES_RES, 1, { edge: 1.5 });
    const p = b.spot(1.5, W - 1.5, 1.5, front - 1.5, 0.4, { hard: 0.8, beds: 0.4, obs: 1 });
    if (p) b.add('gnome', p.x, p.z);
    return door;
  }

  // trees: the more lot, the more trees
  const nTrees = estate ? clamp(Math.round(A / 420) + r.int(-1, 2), 4, 12) : clamp(Math.round(A / 230) + r.int(-1, 1), 1, 6);
  const trees = estate ? TREES_EST : TREES_RES;
  let placed = 0;
  // at least one in the front yard if there is room
  if (front > 6 && b.tree(1, W - 1, 1.5, front - 1, trees, 0.5)) placed++;
  for (let i = 0; placed < nTrees && i < nTrees * 3; i++) {
    const inFront = r.chance(0.35) && front > 6;
    const ok = inFront ? b.tree(1, W - 1, 1.5, front - 1, trees, 0.45) : b.tree(1, W - 1, back + 1.5, D - 0.8, trees, 0.3);
    if (ok) placed++;
  }

  // corner and feature beds
  const extraBeds = estate ? r.int(2, 4) : r.int(0, 2);
  for (let i = 0; i < extraBeds; i++) {
    const back = r.chance(0.6) && backDepth > 7;
    const rx = r.range(1.2, estate ? 3.2 : 2.2), rz = r.range(1.0, estate ? 2.4 : 1.6);
    const z0 = back ? D - rz - 0.8 : 1.5 + rz;
    const z1 = back ? D - rz - 0.8 : front - rz - 1.2;
    const cornerX = r.chance(0.5) ? rx + 0.8 : W - rx - 0.8;
    const p = b.spot(cornerX - 1, cornerX + 1, Math.min(z0, z1), Math.max(z0, z1) + 0.01, Math.max(rx, rz), { house: 1.6, hard: 0.8, beds: 1.2, obs: 0.8, edge: 0.4 });
    if (!p) continue;
    if (r.chance(0.5)) b.beds.push({ kind: 'ellipse', x: p.x, z: p.z, rx, rz, rot: r.range(-0.4, 0.4) });
    else b.beds.push({ kind: 'rect', rect: { x: p.x, z: p.z, w: rx * 1.8, d: rz * 1.6 } });
  }
  if (estate) {
    // lamp posts along the driveway and a birdbath "fountain" in its own ring bed out front
    const drive = b.driveway[b.driveway.length - 1];
    const side = drive.x + (-gs) * (drive.w / 2 + 0.7);
    for (let z = 3; z < drive.d - 1; z += 8) {
      if (b.clear(side, z, 0.2, { hard: 0.3, house: 1, obs: 0.6, beds: 0.2 })) b.add('lamppost', side, z, { rot: 0 });
    }
    const fx = (houseL + houseR) / 2 - gs * hw * 0.1, fz = front * 0.5;
    if (b.clear(fx, fz, 2.4, { hard: 1, obs: 1, beds: 0.8 })) {
      const ring: BedShape = { kind: 'ellipse', x: fx, z: fz, rx: 2.2, rz: 2.2, rot: 0 };
      b.beds.push(ring);
      b.add('birdbath', fx, fz, { scale: 1.8, offLawn: true });
    }
  }

  // yard hazards: gnomes near beds, sprinklers across the lawn, balls in back
  const nGnomes = r.int(0, estate ? 2 : 3) - (r.chance(0.35) ? 1 : 0);
  for (let i = 0; i < nGnomes; i++) {
    const bed = b.beds.length ? r.pick(b.beds) : null;
    let p: { x: number; z: number } | null = null;
    if (bed) {
      const bb = bedBox(bed);
      for (let t = 0; t < 12 && !p; t++) {
        const ang = r.range(0, Math.PI * 2);
        const x = bb.x + Math.cos(ang) * (bb.w / 2 + 0.45), z = bb.z + Math.sin(ang) * (bb.d / 2 + 0.45);
        if (b.clear(x, z, 0.2, { house: 0.5, hard: 0.4, beds: 0.05, obs: 0.4, edge: 0.4 })) p = { x, z };
      }
    }
    if (!p) p = b.spot(1, W - 1, 1, D - 1, 0.2, { house: 0.8, hard: 0.4, beds: 0.2, obs: 0.6 });
    if (p) b.add('gnome', p.x, p.z, { rot: r.range(-0.6, 0.6) + Math.PI });
  }
  const nSprink = r.int(0, estate ? 6 : 4);
  for (let i = 0; i < nSprink; i++) {
    const p = b.spot(1, W - 1, 1, D - 1, 0.1, { house: 0.7, hard: 0.5, beds: 0.4, obs: 0.8 });
    if (p) b.add('sprinkler', p.x, p.z);
  }
  const family = r.chance(0.5);
  if (family && backDepth > 6) {
    const nBalls = r.int(1, 3);
    for (let i = 0; i < nBalls; i++) {
      const p = b.spot(1, W - 1, back + 1, D - 1, 0.16, { house: 0.6, hard: 0.4, beds: 0.3, obs: 0.6 });
      if (p) b.add('ball', p.x, p.z);
    }
    const toy = r.pick(['trampoline', 'kiddie_pool', 'swingset'] as const);
    const rad = OBSTACLE_DEFS[toy].r;
    const p = b.spot(1, W - 1, back + 1, D - 1, rad, { house: 2.2, hard: 1.2, beds: 1.2, obs: 1.2, edge: 1.4 });
    if (p) b.add(toy, p.x, p.z, { rot: r.chance(0.5) ? 0 : Math.PI / 2 });
  }
  if (r.chance(0.3)) {
    const p = b.spot(1, W - 1, 1, D - 1, 0.35, { house: 1.5, hard: 1, beds: 0.8, obs: 1.2 });
    if (p) b.add('birdbath', p.x, p.z);
  }
  if (r.chance(0.25) && backDepth > 5) {
    const p = b.spot(1, W - 1, back + 0.8, D - 0.8, 0.7, { house: 1.2, hard: 0.8, beds: 0.8, obs: 1.2, edge: 0.8 });
    if (p) b.add('doghouse', p.x, p.z, { rot: r.range(-0.5, 0.5) + Math.PI });
  }
  if (r.chance(0.6)) {
    // hose reel against the house side wall
    const side = r.chance(0.5) ? -1 : 1;
    const x = side < 0 ? houseL - 0.55 : houseR + 0.55;
    const z = hz + r.range(-0.3, 0.3) * hd;
    if (b.clear(x, z, 0.35, { house: 0.05, hard: 0.1, beds: 0.1, obs: 0.4, edge: 0.3 })) b.add('hose_reel', x, z, { rot: side * Math.PI / 2 });
  }
  // patio furniture
  for (const p of b.patios) {
    b.add('patio_set', p.x - p.w * 0.15, p.z + p.d * 0.05, { offLawn: true, rot: 0, r: Math.min(1.1, p.d * 0.3) });
    if (r.chance(0.7)) b.add('bbq', p.x + p.w / 2 - 0.5, p.z, { offLawn: true, rot: -Math.PI / 2 });
  }

  // back fence with side runs and a gate gap
  if (r.chance(estate ? 0.6 : 0.45) && backDepth > 6) {
    const kind = estate ? r.pick(['iron', 'hedge', 'iron'] as const) : r.pick(['picket', 'picket', 'iron', 'hedge'] as const);
    const e = 0.25;
    const zMid = hz;
    b.fences.push({ x1: e, z1: D - e, x2: W - e, z2: D - e, kind });
    b.fences.push({ x1: e, z1: zMid, x2: e, z2: D - e, kind });
    b.fences.push({ x1: W - e, z1: zMid, x2: W - e, z2: D - e, kind });
    // connectors from the house walls to the lot sides; the wider side gets a 3.6 m gate
    const leftGap = houseL - e, rightGap = W - e - houseR;
    const gate = 3.6;
    const conn = (x0: number, x1: number) => {
      const len = x1 - x0;
      if (len < 0.4) return;
      b.fences.push({ x1: x0, z1: zMid, x2: x1, z2: zMid, kind });
    };
    const connGate = (x0: number, x1: number, atHouseEnd: boolean) => {
      const len = x1 - x0;
      if (len <= gate + 0.6) return;   // whole side passage is the gate
      if (atHouseEnd) conn(x0, x1 - gate); else conn(x0 + gate, x1);
    };
    if (leftGap >= rightGap) { connGate(e, houseL, false); conn(houseR, W - e); }
    else { conn(e, houseL); connGate(houseR, W - e, true); }
    // anything the fence now cuts through gets dropped (a tree on the fence line, a bed crossing it)
    b.obstacles = b.obstacles.filter((o) => !b.fences.some((f) => segDist(f, o.x, o.z) < o.r + 0.15));
  }
  return door;
}

// ---------------------------------------------------------------- commercial (office, church, school)
function commercial(b: Builder, houseMult: number) {
  const { r, lot } = b;
  const W = lot.w, D = lot.d, A = W * D;
  const st = STYLE[lot.style] ?? STYLE.office;
  const pSide: 1 | -1 = r.chance(0.5) ? 1 : -1;
  // parking along one side, two bays with a lawn island between them
  const pw = clamp(W * 0.34, 16, 40);
  const pd = clamp(D * 0.62, 20, 80);
  const px0 = pSide > 0 ? W - pw - 2 : 2;
  const island = 3.2;
  const bayW = (pw - island) / 2;
  b.driveway.push(rectFromEdges(px0, px0 + bayW, 0, pd));
  b.driveway.push(rectFromEdges(px0 + bayW + island, px0 + pw, 0, pd));
  // island is closed at the street end by a crossing drive lane
  b.driveway.push(rectFromEdges(px0 + bayW, px0 + bayW + island, 0, 5));
  // island trees
  for (let z = 9; z < pd - 3; z += 9) b.add('tree_maple', px0 + bayW + island / 2, z, { scale: r.range(0.8, 1.05) });

  // building on the other side
  const availW = W - pw - 10;
  let bw = Math.sqrt(A * st.frac * houseMult * st.aspect);
  let bd = (A * st.frac * houseMult) / bw;
  bw = Math.min(bw, availW, st.maxW);
  bd = Math.min(bd, D * 0.4);
  const bx = pSide > 0 ? 4 + bw / 2 + (availW - bw) * 0.5 : W - 4 - bw / 2 - (availW - bw) * 0.5;
  const sb = clamp(D * 0.26, 10, 40);
  b.house = { x: bx, z: sb + bd / 2, w: bw, d: bd, style: lot.style };
  const door = { x: bx, z: sb };

  // walkways: entrance to the street, entrance to the parking lot, a loop around the building front
  const ww = 2.2;
  b.walkways.push(rectFromEdges(bx - ww / 2, bx + ww / 2, 0, sb));
  const wz = sb * 0.55;
  const toX = pSide > 0 ? px0 : px0 + pw;
  if (pSide > 0) b.walkways.push(rectFromEdges(bx + ww / 2, toX, wz - ww / 2, wz + ww / 2));
  else b.walkways.push(rectFromEdges(toX, bx - ww / 2, wz - ww / 2, wz + ww / 2));
  // side walk along the building front
  b.walkways.push(rectFromEdges(bx - bw / 2, bx - ww / 2, sb - 1.8, sb));
  b.walkways.push(rectFromEdges(bx + ww / 2, bx + bw / 2, sb - 1.8, sb));
  // beds: along the front walk, a sign bed near the street, flagpole ring
  const bedD = 1.6;
  const fz0 = Math.max(sb - 1.8 - bedD, wz + ww / 2 + 0.6);
  if (sb - 1.8 - fz0 > 0.6) {
    b.beds.push({ kind: 'rect', rect: rectFromEdges(bx - bw / 2 + 1, bx - ww / 2 - 1.5, fz0, sb - 1.8) });
    b.beds.push({ kind: 'rect', rect: rectFromEdges(bx + ww / 2 + 1.5, bx + bw / 2 - 1, fz0, sb - 1.8) });
    for (const bed of b.beds.slice(-2)) {
      if (bed.kind !== 'rect') continue;
      const n = Math.floor(bed.rect.w / 2.4);
      for (let i = 0; i < n; i++) b.add('shrub_round', bed.rect.x - bed.rect.w / 2 + (i + 0.5) * (bed.rect.w / n), bed.rect.z, { offLawn: true, scale: 0.9 });
    }
  }
  {
    const fx = bx + (pSide > 0 ? -1 : 1) * Math.min(bw * 0.35, 9), fz = sb * 0.28;
    if (b.clear(fx, fz, 2, { hard: 0.6, obs: 0.8, beds: 0.6 })) {
      b.beds.push({ kind: 'ellipse', x: fx, z: fz, rx: 2, rz: 2, rot: 0 });
      b.add('flagpole', fx, fz, { offLawn: true, rot: 0 });
    }
  }
  // benches and trash cans along the walkway to the street
  for (const s of [-1, 1]) {
    const x = bx + s * (ww / 2 + 1.1), z = sb * 0.35 + r.range(-1, 1);
    if (b.clear(x, z, 0.8, { hard: 0.2, obs: 0.6, beds: 0.4, house: 1 })) b.add('bench', x, z, { rot: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
    if (b.clear(x, z + 1.8, 0.35, { hard: 0.2, obs: 0.3, beds: 0.4, house: 1 })) b.add('trashcan', x, z + 1.8, { rot: 0 });
  }
  // perimeter trees and some ring beds
  const nTrees = clamp(Math.round(A / 520), 6, 18);
  let placed = 0;
  for (let i = 0; placed < nTrees && i < nTrees * 4; i++) {
    const edge = r.int(0, 3);
    const ok = edge === 0 ? b.tree(2, W - 2, D - 8, D - 1.5, TREES_EST, 0.2)
      : edge === 1 ? b.tree(1.5, 7, 3, D - 2, TREES_EST, 0.3)
      : edge === 2 ? b.tree(W - 7, W - 1.5, 3, D - 2, TREES_EST, 0.3)
      : b.tree(2, W - 2, 3, sb - 3, TREES_EST, 0.5);
    if (ok) placed++;
  }
  for (let i = 0; i < 3; i++) {
    const p = b.spot(2, W - 2, 2, D - 2, 0.1, { house: 1, hard: 0.5, beds: 0.4, obs: 1 });
    if (p) b.add('sprinkler', p.x, p.z);
  }
  return door;
}

// ---------------------------------------------------------------- park
function park(b: Builder) {
  const { r, lot } = b;
  const W = lot.w, D = lot.d, A = W * D;
  // pavilion toward the front on one side
  const side: 1 | -1 = r.chance(0.5) ? 1 : -1;
  const pvW = clamp(Math.sqrt(A * 0.012 * 1.4), 10, 16), pvD = pvW / 1.4;
  const pvx = W / 2 + side * W * 0.28, pvz = clamp(D * 0.2, 12, 30) + pvD / 2;
  b.house = { x: pvx, z: pvz, w: pvW, d: pvD, style: 'pavilion' };
  const door = { x: pvx, z: pvz - pvD / 2 };
  // small parking lot at the street on the pavilion side
  const plW = clamp(W * 0.22, 14, 28), plD = 12;
  const plx = clamp(pvx, plW / 2 + 1, W - plW / 2 - 1);
  b.driveway.push({ x: plx, z: plD / 2, w: plW, d: plD });
  // path: parking lot to pavilion, then a long path to the back of the park, plus a cross path
  const pw = 2.4;
  b.walkways.push(rectFromEdges(pvx - pw / 2, pvx + pw / 2, plD, pvz - pvD / 2));
  b.walkways.push(rectFromEdges(pvx - pw / 2, pvx + pw / 2, pvz + pvD / 2, D - 3));
  const crossZ = clamp(D * 0.62, pvz + pvD / 2 + 6, D - 8);
  if (side > 0) b.walkways.push(rectFromEdges(3, pvx - pw / 2, crossZ - pw / 2, crossZ + pw / 2));
  else b.walkways.push(rectFromEdges(pvx + pw / 2, W - 3, crossZ - pw / 2, crossZ + pw / 2));
  // soccer field on the open side: two goals facing each other along z
  const fieldX = W / 2 - side * W * 0.18;
  const f0 = clamp(D * 0.14, 8, 20), f1 = crossZ - 6;
  if (f1 - f0 > 25) {
    b.add('soccer_goal', fieldX, f0, { rot: 0, offLawn: false });
    b.add('soccer_goal', fieldX, f1, { rot: Math.PI, offLawn: false });
  }
  // benches and trash cans along the paths
  for (let z = pvz + pvD / 2 + 6; z < D - 6; z += 14) {
    const x = pvx + (r.chance(0.5) ? 1 : -1) * (pw / 2 + 1);
    if (b.clear(x, z, 0.8, { hard: 0.2, obs: 0.8, beds: 0.4, house: 1 })) b.add('bench', x, z, { rot: x > pvx ? -Math.PI / 2 : Math.PI / 2 });
    if (b.clear(x, z + 2, 0.35, { hard: 0.2, obs: 0.4, beds: 0.4, house: 1 })) b.add('trashcan', x, z + 2, { rot: 0 });
  }
  for (const s of [-1, 1]) {
    const x = pvx + s * (pvW / 2 + 1.5), z = pvz;
    if (b.clear(x, z, 0.35, { hard: 0.1, obs: 0.4, beds: 0.4, house: 0.8 })) b.add('trashcan', x, z, { rot: 0 });
  }
  // beds by the pavilion and at the entrance
  for (let i = 0; i < 3; i++) {
    const rx = r.range(1.8, 3.5), rz = r.range(1.4, 2.6);
    const p = b.spot(4, W - 4, 4, D * 0.5, Math.max(rx, rz), { house: 2, hard: 1, beds: 2, obs: 2 });
    if (p) b.beds.push({ kind: 'ellipse', x: p.x, z: p.z, rx, rz, rot: r.range(-0.5, 0.5) });
  }
  // perimeter tree clusters
  const nTrees = clamp(Math.round(A / 450), 10, 36);
  let placed = 0;
  for (let i = 0; placed < nTrees && i < nTrees * 4; i++) {
    const e = r.int(0, 2);
    const ok = e === 0 ? b.tree(2, W - 2, D - 10, D - 1.5, TREES_EST, 0.1)
      : e === 1 ? b.tree(1.5, 9, 14, D - 2, TREES_EST, 0.15)
      : b.tree(W - 9, W - 1.5, 14, D - 2, TREES_EST, 0.15);
    if (ok) placed++;
  }
  b.add('flagpole', plx + (plW / 2 + 2) * -side, 3, { rot: 0 });
  for (let i = 0; i < 6; i++) {
    const p = b.spot(3, W - 3, 3, D - 3, 0.1, { house: 1, hard: 0.6, beds: 0.4, obs: 1 });
    if (p) b.add('sprinkler', p.x, p.z);
  }
  return door;
}

// ---------------------------------------------------------------- golf fairway
function golf(b: Builder) {
  const { r, lot } = b;
  const W = lot.w, D = lot.d, A = W * D;
  const side: 1 | -1 = r.chance(0.5) ? 1 : -1;
  // clubhouse near the street on one side, a small lot, a cart path running the length of the hole
  const cw = clamp(Math.sqrt(A * 0.018 * 1.6), 16, 30), cd = cw / 1.6;
  const cx = side > 0 ? W - cw / 2 - 4 : cw / 2 + 4;
  const cz = cd / 2 + 10;
  b.house = { x: cx, z: cz, w: cw, d: cd, style: 'clubhouse' };
  const door = { x: cx, z: cz - cd / 2 };
  const plW = clamp(W * 0.28, 16, 30);
  const plx = side > 0 ? cx - cw / 2 - plW / 2 - 3 : cx + cw / 2 + plW / 2 + 3;
  b.driveway.push({ x: plx, z: 5, w: plW, d: 10 });
  const pathX = side > 0 ? W - 3.5 : 3.5;
  b.walkways.push(rectFromEdges(pathX - 1.25, pathX + 1.25, cz + cd / 2 + 2, D - 4));
  b.walkways.push(rectFromEdges(Math.min(cx, pathX) - 1.25, Math.max(cx, pathX) + 1.25, cz + cd / 2, cz + cd / 2 + 2));
  // bunkers along the fairway edges and around the green at the back
  const nB = r.int(5, 8);
  for (let i = 0; i < nB; i++) {
    const rx = r.range(3, 7), rz = r.range(2.2, 4.5);
    const nearGreen = i < 2;
    const z0 = nearGreen ? D - 34 : D * 0.3, z1 = nearGreen ? D - 14 : D - 40;
    const p = b.spot(rx + 3, W - rx - 3, z0, z1, Math.max(rx, rz), { house: 4, hard: 3, beds: 5, obs: 3 });
    if (p) b.bunkers.push({ kind: 'ellipse', x: p.x, z: p.z, rx, rz, rot: r.range(-0.6, 0.6) });
  }
  if (r.chance(0.7)) {
    const rx = r.range(8, 14), rz = r.range(5, 9);
    const p = b.spot(rx + 4, W - rx - 4, D * 0.35, D * 0.7, Math.max(rx, rz), { house: 6, hard: 4, beds: 6, obs: 3 });
    if (p) b.ponds.push({ kind: 'ellipse', x: p.x, z: p.z, rx, rz, rot: r.range(-0.5, 0.5) });
  }
  // flag pins: the green at the back plus practice pins
  b.add('flagpole', W / 2 + r.range(-6, 6), D - 12, { rot: 0 });
  for (let i = 0; i < 2; i++) {
    const p = b.spot(8, W - 8, D * 0.25, D * 0.7, 0.2, { house: 4, hard: 2, beds: 3, obs: 8 });
    if (p) b.add('flagpole', p.x, p.z, { rot: 0 });
  }
  // tree lines at the edges
  const nTrees = clamp(Math.round(D / 9), 12, 36);
  let placed = 0;
  for (let i = 0; placed < nTrees && i < nTrees * 4; i++) {
    const left = r.chance(0.5);
    const ok = left ? b.tree(1, 7, cz + cd, D - 2, ['tree_pine', 'tree_oak', 'tree_pine', 'tree_birch'], 0.05)
      : b.tree(W - 7, W - 1, cz + cd, D - 2, ['tree_pine', 'tree_oak', 'tree_pine', 'tree_birch'], 0.05);
    if (ok) placed++;
  }
  // clubhouse beds and benches
  b.beds.push({ kind: 'rect', rect: rectFromEdges(cx - cw / 2 + 1, cx + cw / 2 - 1, cz - cd / 2 - 1.8, cz - cd / 2) });
  for (let i = 0; i < 2; i++) {
    const p = b.spot(4, W - 4, cz, cz + 16, 0.8, { house: 1.5, hard: 0.3, beds: 1, obs: 2 });
    if (p) b.add('bench', p.x, p.z, { rot: r.range(0, Math.PI * 2) });
  }
  return door;
}

// ---------------------------------------------------------------- entry points
/** Lawn share of the lot the generator aims for (lotForLawn uses the same numbers). */
function targetLawnFrac(kind: LotSpec['kind'], style: HouseStyle): number {
  if (kind === 'residential') return 0.62 + (style === 'cottage' ? 0.02 : style === 'ranch' ? -0.02 : 0);
  if (kind === 'estate') return 0.72;
  if (kind === 'commercial') return 0.6;
  return 0.9;
}

function build(seed: number, lot: LotSpec, opts: GenerateOptions, houseMult: number): PropertyLayout {
  const r = rng(seed ^ Math.round(lot.w * 131 + lot.d * 7919));
  const b = new Builder(r, lot);
  let door: { x: number; z: number };
  let garageSide: 1 | -1 | undefined;
  switch (lot.kind) {
    case 'commercial': door = commercial(b, houseMult); break;
    case 'park': door = park(b); break;
    case 'golf': door = golf(b); break;
    default: {
      door = residential(b, lot.kind === 'estate', !!opts.practice, houseMult);
      const d = b.driveway[0];
      garageSide = d && d.x > b.house.x ? 1 : -1;
    }
  }
  const out = b.layout(seed);
  out.door = door;
  if (garageSide) out.garageSide = garageSide;
  return out;
}

export function generateProperty(seed: number, lot: LotSpec, opts: GenerateOptions = {}): PropertyLayout {
  const first = build(seed, lot, opts, 1);
  if (opts.practice || lot.kind === 'park' || lot.kind === 'golf') return first;
  // Second pass: resize the building so the lawn share lands near the target for this kind of lot.
  // Same seed, so everything else is drawn from the same stream and stays deterministic.
  const A = lot.w * lot.d;
  const want = targetLawnFrac(lot.kind, lot.style) + (((seed >>> 3) % 5) - 2) * 0.008;
  const houseA = first.house.w * first.house.d;
  const delta = (first.lawnM2 / A - want) * A;
  const mult = clamp((houseA + delta) / houseA, 0.55, 2.4);
  if (Math.abs(mult - 1) < 0.03) return first;
  return build(seed, lot, opts, mult);
}

/** Lot dimensions for a target lawn area (used by the sim when generating houses). aspect = depth / width. */
export function lotForLawn(targetLawnM2: number, style: HouseStyle, kind: LotSpec['kind'], aspect: number): LotSpec {
  const frac = targetLawnFrac(kind, style);
  const area = targetLawnM2 / frac;
  const w = Math.sqrt(area / aspect);
  return { w: Math.round(w * 10) / 10, d: Math.round(w * aspect * 10) / 10, style, kind };
}
