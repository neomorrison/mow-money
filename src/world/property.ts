// Property layout generator. OWNED BY THE MOW BUILDER. Pure (no three.js, no DOM), deterministic from
// (seed, lot). Used by the sim (lawn and hardscape area for pricing) and by the 3D scene and the
// neighborhood diorama (to place the house, driveway, beds, trees and props).
//
// Coordinate frame: meters. x across the lot (0..lot.w), z from the street edge (0) to the back (lot.d).
// The street is at z < 0. The house front door faces the street (-z direction).
//
// Contract: generateProperty must be fast (< 0.5 ms for residential lots) because the sim calls it for
// every house when building a neighborhood; compute areas analytically, not by fine rasterization.
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
}

// Placeholder until the mow builder lands the real generator: a house, a driveway, no features.
export function generateProperty(seed: number, lot: LotSpec): PropertyLayout {
  const hw = Math.min(lot.w * 0.45, 16);
  const hd = Math.min(lot.d * 0.3, 14);
  const house = { x: lot.w / 2, z: lot.d * 0.45, w: hw, d: hd, style: lot.style };
  const driveway = [{ x: lot.w * 0.85, z: lot.d * 0.2, w: 3.5, d: lot.d * 0.4 }];
  const hard = driveway.reduce((s, r) => s + r.w * r.d, 0);
  return {
    seed, lot, house, driveway, walkways: [], patios: [], beds: [], obstacles: [], fences: [],
    lawnM2: Math.max(50, lot.w * lot.d - hw * hd - hard),
    hardscapeM2: hard,
    bounds: { minX: 0, maxX: lot.w, minZ: 0, maxZ: lot.d },
  };
}

/** Lot dimensions for a target lawn area (used by the sim when generating houses). */
export function lotForLawn(targetLawnM2: number, style: HouseStyle, kind: LotSpec['kind'], aspect: number): LotSpec {
  const frac = kind === 'residential' ? 0.62 : kind === 'estate' ? 0.72 : kind === 'commercial' ? 0.6 : 0.85;
  const area = targetLawnM2 / frac;
  const w = Math.sqrt(area / aspect);
  return { w: Math.round(w * 10) / 10, d: Math.round(w * aspect * 10) / 10, style, kind };
}
