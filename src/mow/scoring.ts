// Job measurements (MowJobResult) from the final state of the grass field, plus a local copy of the
// quality formula (docs/DESIGN.md section 9) used when the sim's computeQuality is unavailable.
import type { Damage, MowJobResult, MowJobSpec, QualityBreakdown } from '../core/types';
import { GrassField, LAWN } from './field';

export interface ScoreState {
  field: GrassField;
  deckHeights: number[];
  deckIndex: number;          // current setting (used when nothing was cut yet)
  deckWidth: number;
  stripeStrength: number;     // mower stripe + kit + perk, before clamping
  damages: Damage[];
  realSeconds: number;
  timeScale: number;
  burnsFuel: boolean;
  wearMult: number;
  mowerAreaM2: number;        // area cut by the mower (for blade wear)
}

/** Deck height (inches) used for the most cut area. */
export function mostUsedDeck(f: GrassField, heights: number[], current: number): number {
  let best = -1, bestA = 0;
  for (let i = 0; i < heights.length; i++) if (f.cutAreaByDeck[i] > bestA) { bestA = f.cutAreaByDeck[i]; best = i; }
  return best < 0 ? heights[current] : heights[best];
}

/**
 * Stripe score in 0..1 before the stripe strength of the gear. Generous on purpose: stripes are a bonus.
 *
 * Only open lawn counts: cells in the edge band around beds, trees, walls and the house are ignored, since
 * nobody can drive straight lines around a gnome.
 * 1. Parallel share P: among open lawn cells whose last cut came from the mower, the share whose heading
 *    axis (heading mod 180 degrees) lies within 20 degrees of the dominant axis.
 * 2. Alternation A: scan lines perpendicular to the dominant axis. Along each line, consecutive mowed cells
 *    with the same travel direction form a band. A band is good when it is at most 2.4 deck widths and
 *    either at least 0.3 deck widths or cut short by an obstacle or the lot line. A = good / total length.
 * raw = 0.55 P + 0.45 A, remapped so an honest effort (raw 0.85) scores full marks and a scribble scores
 * near zero, then scaled by how much of the open lawn was mowed.
 */
export function stripePattern(f: GrassField, deckWidth: number): { score: number; parallel: number; alternation: number; axis: number } {
  const bins = new Float64Array(36);
  let mowed = 0, open = 0;
  for (let k = 0; k < f.n; k++) {
    if (f.surf[k] !== LAWN || f.edge[k]) continue;
    open++;
    if (f.cutBy[k] !== 1) continue;
    const h = f.heading[k];
    if (h !== h) continue;
    let a = h % Math.PI; if (a < 0) a += Math.PI;
    bins[Math.min(35, Math.floor(a / (Math.PI / 36)))]++;
    mowed++;
  }
  if (mowed < Math.max(20, open * 0.05)) return { score: 0, parallel: 0, alternation: 0, axis: 0 };
  let peak = 0, peakV = -1;
  for (let b = 0; b < 36; b++) {
    const v = bins[b] + 0.6 * (bins[(b + 1) % 36] + bins[(b + 35) % 36]);
    if (v > peakV) { peakV = v; peak = b; }
  }
  // refine with a doubled-angle mean around the peak
  let sx = 0, sy = 0;
  const center = (peak + 0.5) * (Math.PI / 36);
  for (let k = 0; k < f.n; k++) {
    if (f.surf[k] !== LAWN || f.edge[k] || f.cutBy[k] !== 1) continue;
    const h = f.heading[k];
    if (h !== h) continue;
    let d = ((h - center) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2;
    if (Math.abs(d) > 0.2) continue;
    sx += Math.cos(2 * h); sy += Math.sin(2 * h);
  }
  const axis = sx || sy ? Math.atan2(sy, sx) / 2 : center;
  const tol = (20 * Math.PI) / 180;
  let par = 0;
  for (let k = 0; k < f.n; k++) {
    if (f.surf[k] !== LAWN || f.edge[k] || f.cutBy[k] !== 1) continue;
    const h = f.heading[k];
    if (h !== h) continue;
    const d = ((h - axis) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2;
    if (Math.abs(d) <= tol) par++;
  }
  const P = par / mowed;

  // alternation along lines perpendicular to the axis
  const ax = Math.sin(axis), az = Math.cos(axis);       // axis direction in (x, z)
  const px = az, pz = -ax;                               // perpendicular
  const W = f.layout.lot.w, D = f.layout.lot.d;
  const corners = [[0, 0], [W, 0], [0, D], [W, D]];
  let vmin = Infinity, vmax = -Infinity, umin = Infinity, umax = -Infinity;
  for (const [x, z] of corners) {
    const v = x * ax + z * az, u = x * px + z * pz;
    vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); umin = Math.min(umin, u); umax = Math.max(umax, u);
  }
  const du = f.cs;
  const maxBand = 2.4 * deckWidth, minBand = 0.3 * deckWidth;
  const alignTol = (30 * Math.PI) / 180;
  let good = 0, total = 0;
  const vStep = Math.max(1, (vmax - vmin) / 400);
  for (let v = vmin + 0.5; v < vmax; v += vStep) {
    let sign = 0, len = 0, startWall = false;
    const close = (endWall: boolean) => {
      if (sign !== 0 && len > 0) {
        total += len;
        if (len <= maxBand && (len >= minBand || startWall || endWall)) good += len;
      }
      sign = 0; len = 0;
    };
    for (let u = umin; u <= umax; u += du) {
      const x = ax * v + px * u, z = az * v + pz * u;
      const k = f.idx(x, z);
      if (k < 0 || f.surf[k] !== LAWN || f.edge[k]) { close(true); startWall = true; continue; }
      const h = f.heading[k];
      if (f.cutBy[k] !== 1 || h !== h) { close(true); startWall = true; continue; }
      const c = Math.cos(h - axis);
      if (Math.abs(c) < Math.cos(alignTol)) { close(false); startWall = false; continue; }
      const s = c > 0 ? 1 : -1;
      if (s !== sign) { const wasBand = sign !== 0; close(false); if (wasBand) startWall = false; sign = s; }
      len += du;
    }
    close(true);
  }
  const A = total > 0 ? good / total : 0;
  const raw = 0.55 * P + 0.45 * A;
  const done = Math.min(1, mowed / Math.max(1, open * 0.85));
  return { score: clamp01((raw - 0.25) / 0.6) * done, parallel: P, alternation: A, axis };
}

export function computeResult(s: ScoreState, completed: boolean, withStripe = true): MowJobResult {
  const f = s.field;
  const cutH = mostUsedDeck(f, s.deckHeights, s.deckIndex);
  const limit = cutH + 0.5;
  let lawn = 0, covered = 0, sum = 0, sum2 = 0, edges = 0, edgesCut = 0, clumps = 0, remSum = 0, remN = 0;
  for (let k = 0; k < f.n; k++) {
    if (f.surf[k] !== LAWN) continue;
    lawn++;
    const h = f.h[k];
    sum += h; sum2 += h * h;
    if (h <= limit) covered++;
    if (f.edge[k]) { edges++; if (h <= limit) edgesCut++; }
    if (f.clump[k] > 0.15) clumps++;
    if (f.cutOnce[k]) { remSum += 1 - h / f.h0[k]; remN++; }
  }
  const mean = lawn ? sum / lawn : 0;
  const sd = lawn ? Math.sqrt(Math.max(0, sum2 / lawn - mean * mean)) : 0;
  const debris = f.debrisTotal();
  const denom = f.initialDebris + f.generatedDebris;
  // Gear matters a little (a roller lays bolder stripes), technique matters more.
  const stripe = withStripe ? stripePattern(f, s.deckWidth).score * (0.75 + 0.25 * Math.min(1, Math.max(0, s.stripeStrength))) : 0;
  const gameMinutes = s.realSeconds * s.timeScale;
  const areaCut = f.uniqueCutCells * f.cellArea;
  return {
    completed,
    coverage: lawn ? covered / lawn : 0,
    evenness: clamp01(1 - sd / 1.0),
    stripe: clamp01(stripe),
    trim: edges ? edgesCut / edges : 1,
    cleanup: denom > 1e-6 ? clamp01(1 - debris / denom) : 1,
    clumps: lawn ? clumps / lawn : 0,
    removedFraction: remN ? clamp01(remSum / remN) : 0,
    damages: s.damages.slice(),
    realSeconds: round(s.realSeconds, 1),
    gameMinutes: round(gameMinutes, 2),
    areaCutM2: round(areaCut, 1),
    engineHours: s.burnsFuel ? round(gameMinutes / 60, 3) : 0,
    sharpnessLoss: round(0.12 * s.wearMult * (s.mowerAreaM2 / 1000), 4),
    cutHeightIn: cutH,
  };
}

/**
 * The live readout during a job: a projection that grows as you work instead of a snapshot of a half-cut
 * lawn. Evenness only looks at grass already cut, and evenness, cleanup and no-clumps count in proportion to
 * coverage, so an untouched lawn reads near zero and the number climbs with every pass.
 */
/** Evenness of the grass already cut (the live readouts use it). */
function cutEvenness(f: GrassField): number {
  let n = 0, sum = 0, sum2 = 0;
  for (let k = 0; k < f.n; k++) {
    if (f.surf[k] !== LAWN || !f.cutOnce[k]) continue;
    const h = f.h[k];
    n++; sum += h; sum2 += h * h;
  }
  const mean = n ? sum / n : 0;
  const sd = n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0;
  return n ? clamp01(1 - sd / 1.0) : 0;
}

/** What the job scores if the rest of the lawn is mowed as well as the part already done. */
export function projectedResult(f: GrassField, r: MowJobResult): MowJobResult {
  return { ...r, coverage: 1, evenness: cutEvenness(f) };
}

export function liveResult(f: GrassField, r: MowJobResult): MowJobResult {
  const cov = clamp01(r.coverage);
  return {
    ...r,
    evenness: cutEvenness(f) * cov,
    cleanup: clamp01(r.cleanup) * cov,
    clumps: 1 - (1 - clamp01(r.clumps)) * cov,
  };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** Local implementation of docs/DESIGN.md section 9, used only when sim.computeQuality throws. */
export function estimateQuality(spec: MowJobSpec, r: MowJobResult): QualityBreakdown {
  const parts = [
    { label: 'Coverage', value: 54 * r.coverage ** 3, max: 54 },
    { label: 'Evenness', value: 15 * r.evenness, max: 15 },
    { label: 'Edges', value: 13 * r.trim, max: 13 },
    { label: 'Cleanup', value: 10 * r.cleanup, max: 10 },
    { label: 'No clumps', value: 8 * (1 - r.clumps), max: 8 },
  ];
  const raw = parts.reduce((a, p) => a + p.value, 0);
  const cap = spec.mower.qualityCap ?? 100;
  const sharpAdj = raw * (0.88 + 0.12 * spec.sharpness);
  const capped = sharpAdj > cap;
  const bonus = (spec.wantsStripes ? 8 : 5) * (spec.striping ? 1.25 : 1) * clamp01(r.stripe);
  let q = Math.min(cap, sharpAdj) + bonus;
  const penalties: { label: string; points: number }[] = [];
  const stress = 60 * Math.max(0, r.removedFraction - 0.4);
  if (stress > 0.05) penalties.push({ label: 'Grass was scalped', points: stress });
  if (spec.wet) penalties.push({ label: 'Wet grass', points: 6 });
  const hOff = 8 * Math.max(0, Math.abs(r.cutHeightIn - spec.targetIn) - 0.5);
  if (hOff > 0.05) penalties.push({ label: r.cutHeightIn > spec.targetIn ? 'Cut too high' : 'Cut too low', points: hOff });
  for (const d of r.damages) penalties.push({ label: d.label, points: d.points });
  for (const p of penalties) q -= p.points;
  q = Math.max(0, Math.min(100, q));
  const stars = Math.max(1, Math.min(5, 1 + (4 * (q - 40)) / 50));
  return { q, stars, parts, penalties, capped };
}
