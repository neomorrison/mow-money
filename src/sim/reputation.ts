// Reputation: Bayesian average of recent star ratings (docs/DESIGN.md section 10).
import type { GameState } from '../core/types';
import { clamp } from '../core/rng';

export const REP_PRIOR = 3.0;
export const REP_PRIOR_WEIGHT = 5;
export const REP_DECAY = 0.99;
export const REP_WINDOW = 150;       // about a week of work for a busy company, so one rainy day does not swing it
export const STAR_Q0 = 40;          // stars = 1 + 4 * (Q - 40) / 50, so Q 90 is five stars

export function starsFor(q: number): number {
  return clamp(1 + (4 * (q - STAR_Q0)) / 50, 1, 5);
}

export function reputationOf(ratings: readonly number[]): number {
  const n = Math.min(ratings.length, REP_WINDOW);
  let sw = 0;
  let s = 0;
  for (let j = 0; j < n; j++) {
    const star = ratings[ratings.length - 1 - j];      // age j = 0 is the newest
    const w = Math.pow(REP_DECAY, j);
    sw += w;
    s += w * star;
  }
  return (REP_PRIOR_WEIGHT * REP_PRIOR + s) / (REP_PRIOR_WEIGHT + sw);
}

export function reputation(state: GameState): number {
  return Math.round(reputationOf(state.ratings) * 1000) / 1000;
}

export function addRating(state: GameState, q: number): number {
  const st = Math.round(starsFor(q) * 100) / 100;
  state.ratings.push(st);
  if (state.ratings.length > REP_WINDOW) state.ratings.splice(0, state.ratings.length - REP_WINDOW);
  return st;
}
