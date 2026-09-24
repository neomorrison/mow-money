// Grass growth (docs/DESIGN.md section 4).
import type { Season, WeatherKind } from '../core/types';
import { hashSeed } from '../core/rng';
import { GROWTH_G, GROWTH_W, FERTILIZER_GROWTH, DROUGHT_GROWTH, GRASS_MAX } from './constants';
import { seasonOf } from './calendar';
import { avgWeatherMult } from './weather';

/** One day of growth. */
export function growOnce(h: number, season: Season, weather: WeatherKind, fertilizer = false, drought = false): number {
  const g = GROWTH_G[season] * GROWTH_W[weather] * (fertilizer ? FERTILIZER_GROWTH : 1) * (drought ? DROUGHT_GROWTH : 1);
  const next = h + g * Math.max(0, 1 - h / GRASS_MAX);
  return Math.min(GRASS_MAX, next);
}

/** Growth with average seasonal weather (used for non-client lawns and projections). */
export function growAvg(h: number, day: number): number {
  const s = seasonOf(day);
  const g = GROWTH_G[s] * avgWeatherMult(s);
  return Math.min(GRASS_MAX, h + g * Math.max(0, 1 - h / GRASS_MAX));
}

/** Grow from h on day `from` up to the start of day `to` with average weather. */
export function growAvgDays(h: number, from: number, to: number): number {
  let x = h;
  for (let d = from; d < to; d++) x = growAvg(x, d);
  return x;
}

/** The height a DIY owner (or rival crew) leaves the lawn at. */
export function diyCutHeight(propertySeed: number): number {
  return 2.5 + (hashSeed(propertySeed, 'diycut') % 8) / 10; // 2.5 to 3.2 in
}

/** Pure height of a non-client lawn on `day` given the owner's mowing cycle. */
export function diyHeight(propertySeed: number, cycle: number, phase: number, day: number): number {
  const c = Math.max(1, Math.round(cycle));
  const since = (((day - phase) % c) + c) % c;          // days since the last DIY mow
  const start = day - since;                             // may be negative before day 0 (treated as spring)
  return Math.round(growAvgDays(diyCutHeight(propertySeed), start, day) * 100) / 100;
}
