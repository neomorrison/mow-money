// Legacy (prestige): sell the company for points that carry into the next run (section 19).
import type { ActionResult, GameState, LegacyPerkSpec } from '../core/types';
import { YEAR_DAYS } from './constants';
import { valuation } from './finance';
import { checkAchievements } from './achievements';

export const LEGACY_PERKS: LegacyPerkSpec[] = [
  { id: 'seed_money', name: 'Seed Money', blurb: 'Start with $1,500 more cash.', cost: 1 },
  { id: 'local_legend', name: 'Local Legend', blurb: 'Start with a 3.8 reputation.', cost: 2 },
  { id: 'head_start', name: 'Head Start', blurb: 'One extra skill point at the start.', cost: 1 },
  { id: 'fleet_discount', name: 'Fleet Discount', blurb: 'Your first truck costs 25% less.', cost: 2 },
  { id: 'gas_start', name: 'Gas Start', blurb: 'Start with a gas push mower.', cost: 1 },
  { id: 'quick_knocks', name: 'Quick Knocks', blurb: 'Door knocks take one minute less.', cost: 1 },
];

export function legacyPointsFor(value: number): number {
  return Math.floor(Math.sqrt(Math.max(0, value) / 10000));
}

export function canSellCompany(state: GameState): ActionResult {
  if (state.day < YEAR_DAYS) return { ok: false, message: 'You can sell after your first year.' };
  if (state.flags.sold) return { ok: false, message: 'Already sold.' };
  const v = valuation(state).total;
  if (v <= 0) return { ok: false, message: 'Nobody will buy a company worth nothing.' };
  return { ok: true, message: `Buyers would pay about $${v.toLocaleString('en-US')}.` };
}

export function sellCompany(state: GameState): { points: number; valuation: number } {
  const v = valuation(state).total;
  const points = canSellCompany(state).ok ? legacyPointsFor(v) : 0;
  if (points > 0 || canSellCompany(state).ok) {
    state.flags.sold = 1;
    state.legacy.points += points;
    state.legacy.runs += 1;
    checkAchievements(state);
  }
  return { points, valuation: v };
}
