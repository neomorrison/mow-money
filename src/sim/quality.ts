// Job quality (docs/DESIGN.md section 9).
import type { Damage, MowJobResult, MowJobSpec, QualityBreakdown } from '../core/types';
import { clamp } from '../core/rng';
import { PREMIUM_STRIPE_MIN, PREMIUM_STRIPE_PENALTY, STRESS_POINTS, STRESS_THRESHOLD, STRIPE_BONUS, STRIPE_BONUS_WANTED, WET_PENALTY } from './constants';
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

/** Stripe bonus points added on top of the base score (and past the mower's cap). Never a penalty. */
export function stripeBonus(stripe: number, wantsStripes: boolean, striping = false): number {
  const max = (wantsStripes ? STRIPE_BONUS_WANTED : STRIPE_BONUS) * (striping ? 1.25 : 1);
  return max * u(stripe);
}

export function computeQuality(spec: MowJobSpec, result: MowJobResult): QualityBreakdown {
  const stripe = u(result.stripe);
  const cov = u(result.coverage);
  const parts = [
    { label: 'Coverage', value: 54 * cov * cov * cov, max: 54 },
    { label: 'Evenness', value: 15 * u(result.evenness), max: 15 },
    { label: 'Edges', value: 13 * u(result.trim), max: 13 },
    { label: 'Cleanup', value: 10 * u(result.cleanup), max: 10 },
    { label: 'No clumps', value: 8 * (1 - u(result.clumps)), max: 8 },
  ].map((p) => ({ ...p, value: Math.round(p.value * 10) / 10 }));
  const qraw = parts.reduce((s, p) => s + p.value, 0);
  const sharp = u(spec.sharpness);
  const scaled = qraw * (0.88 + 0.12 * sharp);
  const cap = spec.mower.qualityCap ?? 100;
  const capped = scaled > cap;
  let q = Math.min(cap, scaled);
  // Stripes are a bonus on top: they can lift a job past the mower's quality cap.
  const bonus = Math.round(stripeBonus(stripe, spec.wantsStripes, spec.striping) * 10) / 10;
  if (bonus >= 0.1) parts.push({ label: 'Stripe bonus', value: bonus, max: Math.round((spec.wantsStripes ? STRIPE_BONUS_WANTED : STRIPE_BONUS) * (spec.striping ? 1.25 : 1) * 10) / 10 });
  q += bonus;
  const penalties: { label: string; points: number }[] = [];
  const dull = qraw - scaled;
  if (dull >= 0.5) penalties.push({ label: 'Dull blade', points: Math.round(dull * 10) / 10 });
  const stress = stressPenalty(result.removedFraction);
  if (stress > 0.05) penalties.push({ label: 'Lawn stressed: cut too much at once', points: Math.round(stress * 10) / 10 });
  if (spec.wet) penalties.push({ label: 'Wet grass', points: WET_PENALTY });
  const diff = f(result.cutHeightIn) - f(spec.targetIn);
  const hp = heightPenalty(result.cutHeightIn, spec.targetIn);
  if (hp > 0.05) penalties.push({ label: `Cut ${Math.abs(diff).toFixed(1)} in too ${diff > 0 ? 'high' : 'low'}`, points: Math.round(hp * 10) / 10 });
  if (spec.premiumStripes && stripe < PREMIUM_STRIPE_MIN) penalties.push({ label: 'Paid for stripes, got none', points: PREMIUM_STRIPE_PENALTY });
  for (const d of result.damages ?? []) {
    const pts = Number.isFinite(d.points) && d.points > 0 ? d.points : DAMAGE_POINTS[d.kind] ?? 3;
    const label = d.kind === 'other' ? (d.label ? `Damaged: ${d.label.toLowerCase()}` : 'Damage') : DAMAGE_LABEL[d.kind];
    penalties.push({ label, points: pts });
  }
  // Dull blade is shown as a penalty for readability but is already inside `scaled`.
  const deductions = penalties.filter((p) => p.label !== 'Dull blade').reduce((s, p) => s + p.points, 0);
  // the same mistake twice reads as one line with a count
  const grouped: { label: string; points: number }[] = [];
  for (const p of penalties) {
    const g = grouped.find((x) => x.label === p.label || x.label.startsWith(`${p.label} x`));
    if (g) {
      const n = (g.label.match(/ x(\d+)$/) ? Number(g.label.match(/ x(\d+)$/)![1]) : 1) + 1;
      g.label = `${p.label} x${n}`;
      g.points = Math.round((g.points + p.points) * 10) / 10;
    } else grouped.push({ ...p });
  }
  penalties.length = 0;
  penalties.push(...grouped);
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
