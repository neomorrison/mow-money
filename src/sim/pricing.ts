// Market prices (docs/DESIGN.md section 6).
import type { AddOn, Frequency, HoodKind } from '../core/types';
import { ADDON_MULT, BIWEEKLY_MULT, KIND_MULT, PRICE_SCALE, SQFT_PER_M2 } from './constants';

export function toSqft(m2: number): number {
  return m2 * SQFT_PER_M2;
}

/** Base weekly fair price for a lawn of `sqft` square feet. */
export function fairSqft(sqft: number): number {
  return PRICE_SCALE * (20 + 0.052 * Math.pow(Math.max(0, sqft), 0.725));
}

export function fairPrice(lawnM2: number, freq: Frequency = 7, kind: HoodKind = 'residential'): number {
  const base = fairSqft(toSqft(lawnM2));
  const f = freq === 14 ? BIWEEKLY_MULT : 1;
  const k = KIND_MULT[kind] ?? 1;
  return Math.round(base * f * k * 100) / 100;
}

export function addOnMult(addOns: readonly AddOn[]): number {
  let m = 1;
  for (const a of addOns) m *= ADDON_MULT[a] ?? 1;
  return m;
}

export function serviceMult(freq: Frequency, addOns: readonly AddOn[]): number {
  return (freq === 14 ? BIWEEKLY_MULT : 1) * addOnMult(addOns);
}

/** Leaf cleanup is a one-off service at 0.9 x fair (section 18). */
export function leafCleanupPrice(lawnM2: number, kind: HoodKind = 'residential'): number {
  return Math.round(fairPrice(lawnM2, 7, kind) * 0.9 * 100) / 100;
}
