// Owner kit and productivity helpers (docs/DESIGN.md section 12).
import type { EquipmentSpec, GameState, OwnedItem } from '../core/types';
import { EQUIPMENT_BY_ID } from '../data/equipment';
import { TIME_SCALE, TRIM_TOOL_MULT, BLOW_TOOL_MULT, WET_SLOWDOWN } from './constants';
import { itemByUid } from './util';

const BIKE = EQUIPMENT_BY_ID['bike'];
const REEL = EQUIPMENT_BY_ID['reel'];

export interface Kit {
  mower: OwnedItem | undefined;
  trimmer: OwnedItem | undefined;
  blower: OwnedItem | undefined;
  vehicle: OwnedItem | undefined;
  mowerSpec: EquipmentSpec;
  trimmerSpec: EquipmentSpec | null;
  blowerSpec: EquipmentSpec | null;
  vehicleSpec: EquipmentSpec;
}

export function ownerKit(state: GameState): Kit {
  const o = state.owner;
  const mower = itemByUid(state, o.mowerUid);
  const trimmer = itemByUid(state, o.trimmerUid);
  const blower = itemByUid(state, o.blowerUid);
  const vehicle = itemByUid(state, o.vehicleUid);
  return {
    mower, trimmer, blower, vehicle,
    mowerSpec: (mower && EQUIPMENT_BY_ID[mower.specId]) || REEL,
    trimmerSpec: (trimmer && EQUIPMENT_BY_ID[trimmer.specId]) || null,
    blowerSpec: (blower && EQUIPMENT_BY_ID[blower.specId]) || null,
    vehicleSpec: (vehicle && EQUIPMENT_BY_ID[vehicle.specId]) || BIKE,
  };
}

export function canCarry(vehicle: EquipmentSpec, mower: EquipmentSpec): boolean {
  return (vehicle.capacity ?? 1) >= (mower.transportSize ?? 1);
}

export function carryError(vehicle: EquipmentSpec, mower: EquipmentSpec): string {
  const v = vehicle.id === 'bike' ? 'bicycle' : vehicle.name;
  return `Your ${v} cannot carry the ${mower.name}.`;
}

/** m2 per game minute. */
export function mowRate(mower: EquipmentSpec): number {
  return ((mower.deckWidth ?? 1) * (mower.speed ?? 2.5) * 0.75) / TIME_SCALE;
}

export interface JobTime { mow: number; trim: number; blow: number; total: number }

/** Minutes of work on site excluding setup and travel. */
export function workMinutes(opts: {
  lawnM2: number; hardscapeM2: number; grassIn: number;
  mower: EquipmentSpec; trimmer: EquipmentSpec | null; blower: EquipmentSpec | null;
  speedMult?: number; wet?: boolean; crewSize?: number;
}): JobTime {
  const speed = Math.max(0.3, opts.speedMult ?? 1);
  let mow = opts.lawnM2 / (mowRate(opts.mower) * speed);
  if (opts.grassIn > (opts.mower.maxGrassIn ?? 6)) mow *= 1.5;                 // second pass on tall grass
  const trimMult = opts.trimmer ? (TRIM_TOOL_MULT[opts.trimmer.id] ?? 1) : 2.5;  // no trimmer: scissors-level edges
  const blowMult = opts.blower ? (BLOW_TOOL_MULT[opts.blower.id] ?? 1) : 2;
  let trim = (3 + opts.lawnM2 / 250) * trimMult / speed;
  let blow = (2 + opts.hardscapeM2 / 120) * blowMult / speed;
  if (opts.wet) { mow *= WET_SLOWDOWN; trim *= WET_SLOWDOWN; blow *= WET_SLOWDOWN; }
  const total = (opts.crewSize ?? 1) >= 2 ? Math.max(mow, trim + blow) : mow + trim + blow;
  return { mow, trim, blow, total };
}

export function effectiveStripe(state: GameState, mower: EquipmentSpec): number {
  const kit = state.items.some((i) => i.specId === 'stripekit') ? 0.25 : 0;
  return Math.min(1, (mower.stripe ?? 0.3) + kit);
}
