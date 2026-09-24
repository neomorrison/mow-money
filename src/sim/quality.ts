// Job quality (docs/DESIGN.md section 9).
import type { Damage, MowJobResult, MowJobSpec, QualityBreakdown } from '../core/types';
import { clamp } from '../core/rng';
import { STRESS_POINTS, STRESS_THRESHOLD, WET_PENALTY } from './constants';
import { starsFor } from './reputation';

export const DAMAGE_LABEL: Record<Damage['kind'], string> = {
  flowerbed: 'Mowed into a flower bed',
  gnome: 'Ran over the garden gnome',
  sprinkler: 'Broke a sprinkler head',
  toy: 'Ran over a toy',
  fence: 'Scraped the fence',
  other: 'Damage',
};
export const DAMAGE_POINTS: Record<Damage['kind'], number> = { flowerbed: 6, gnome: 4, sprinkler: 5, toy: 2, fence: 5, other: 3 };

const f = (x: number) => (Number.isFinite(x) ? x : 0);
const u = (x: number) => clamp(f(x), 0, 1);

export function stressPenalty(removedFraction: number): number {
  return STRESS_POINTS * Math.max(0, f(removedFraction) - STRESS_THRESHOLD);
}
export function heightPenalty(cutIn: number, targetIn: number): number {
  return 8 * Math.max(0, Math.abs(f(cutIn) - f(targetIn)) - 0.5);
}

export function computeQuality(spec: MowJobSpec, result: MowJobResult): QualityBreakdown {
  const perks = spec.perks ?? [];
  const stripeRaw = u(result.stripe) + (perks.includes('straight_lines') ? 0.1 : 0);
  const stripe = Math.min(1, stripeRaw);
  const stripeTerm = spec.wantsStripes ? stripe : Math.max(stripe, 0.7);
  const cov = u(result.coverage);
  const parts = [
    { label: 'Coverage', value: 50 * cov * cov * cov, max: 50 },
    { label: 'Evenness', value: 14 * u(result.evenness), max: 14 },
    { label: 'Edges', value: 12 * u(result.trim), max: 12 },
    { label: 'Cleanup', value: 8 * u(result.cleanup), max: 8 },
    { label: 'Stripes', value: 10 * stripeTerm, max: 10 },
    { label: 'No clumps', value: 6 * (1 - u(result.clumps)), max: 6 },
  ].map((p) => ({ ...p, value: Math.round(p.value * 10) / 10 }));
  const qraw = parts.reduce((s, p) => s + p.value, 0);
  const sharp = u(spec.sharpness);
  const scaled = qraw * (0.88 + 0.12 * sharp);
  const cap = spec.mower.qualityCap ?? 100;
  const capped = scaled > cap;
  let q = Math.min(cap, scaled);
  const penalties: { label: string; points: number }[] = [];
  const dull = qraw - scaled;
  if (dull >= 0.5) penalties.push({ label: 'Dull blade', points: Math.round(dull * 10) / 10 });
  const stress = stressPenalty(result.removedFraction);
  if (stress > 0.05) penalties.push({ label: 'Lawn stressed: cut too much at once', points: Math.round(stress * 10) / 10 });
  if (spec.wet) penalties.push({ label: 'Wet grass', points: WET_PENALTY });
  const diff = f(result.cutHeightIn) - f(spec.targetIn);
  const hp = heightPenalty(result.cutHeightIn, spec.targetIn);
  if (hp > 0.05) penalties.push({ label: `Cut ${Math.abs(diff).toFixed(1)} in too ${diff > 0 ? 'high' : 'low'}`, points: Math.round(hp * 10) / 10 });
  for (const d of result.damages ?? []) {
    const pts = Number.isFinite(d.points) && d.points > 0 ? d.points : DAMAGE_POINTS[d.kind] ?? 3;
    const label = d.kind === 'other' ? (d.label ? `Damaged: ${d.label.toLowerCase()}` : 'Damage') : DAMAGE_LABEL[d.kind];
    penalties.push({ label, points: pts });
  }
  // Dull blade is shown as a penalty for readability but is already inside `scaled`.
  const deductions = penalties.filter((p) => p.label !== 'Dull blade').reduce((s, p) => s + p.points, 0);
  q = clamp(q - deductions, 0, 100);
  q = Math.round(q * 10) / 10;
  return { q, stars: Math.round(starsFor(q) * 10) / 10, parts, penalties, capped };
}

/** Simulated quality with the stress and wet penalties (autopilot and crews). */
export function simulatedPenalties(opts: { grassIn: number; targetIn: number; wet: boolean; deckHeights?: number[]; maxGrassIn?: number }): { cut: number; points: number; removed: number } {
  // Pros raise the deck on overgrown lawns to stay under the one-third rule, trading a height mismatch.
  const want = Math.max(opts.targetIn, opts.grassIn * (1 - STRESS_THRESHOLD) + 0.05);
  const heights = opts.deckHeights && opts.deckHeights.length ? opts.deckHeights : [want];
  let cut = heights[heights.length - 1];
  for (const h of heights) { if (h >= want - 0.01) { cut = h; break; } }
  const removed = opts.grassIn > 0 ? Math.max(0, 1 - cut / opts.grassIn) : 0;
  let points = stressPenalty(removed) + heightPenalty(cut, opts.targetIn) + (opts.wet ? WET_PENALTY : 0);
  if (opts.maxGrassIn !== undefined && opts.grassIn > opts.maxGrassIn) points += 3 * (opts.grassIn - opts.maxGrassIn);
  return { cut, points, removed };
}
