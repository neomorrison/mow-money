// Owner progression: XP, levels, skill points, perks (docs/DESIGN.md section 17).
import type { ActionResult, GameState, OwnerLevelInfo, PerkSpec } from '../core/types';
import { DAY_END } from './constants';

export const PERKS: PerkSpec[] = [
  { id: 'silver_tongue', tree: 'sales', name: 'Silver Tongue', blurb: '+0.08 trust in every pitch.' },
  { id: 'read_the_room', tree: 'sales', name: 'Read the Room', blurb: 'See how an offer will land before you make it.', requires: 'silver_tongue' },
  { id: 'closer', tree: 'sales', name: 'Closer', blurb: '+1 patience in every negotiation.', requires: 'read_the_room' },
  { id: 'door_pro', tree: 'sales', name: 'Door Pro', blurb: 'Knocks take 2 minutes. Answer rate +10%.' },
  { id: 'straight_lines', tree: 'craft', name: 'Straight Lines', blurb: '+0.10 stripe score.' },
  { id: 'edge_master', tree: 'craft', name: 'Edge Master', blurb: 'Trimmer radius +30%.' },
  { id: 'autopilot_pro', tree: 'craft', name: 'Autopilot Pro', blurb: '+5 quality on autopilot jobs.', requires: 'straight_lines' },
  { id: 'quick_feet', tree: 'craft', name: 'Quick Feet', blurb: '+10% mowing speed.' },
  { id: 'motivator', tree: 'management', name: 'Motivator', blurb: '+10 staff morale target.' },
  { id: 'trainer', tree: 'management', name: 'Trainer', blurb: 'Staff skill grows twice as fast.', requires: 'motivator' },
  { id: 'dispatcher', tree: 'management', name: 'Dispatcher', blurb: 'Travel time -20%.' },
  { id: 'bulk_buyer', tree: 'management', name: 'Bulk Buyer', blurb: 'Equipment costs 10% less.' },
  { id: 'negotiator', tree: 'management', name: 'Negotiator', blurb: 'Loan APR -2 points.', requires: 'bulk_buyer' },
];

/** Total XP needed to reach level L + 1 from level L (cumulative). */
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(Math.max(1, level), 1.5));
}
/** Total XP at which `level` begins (level 1 at 0). */
export function xpAtLevel(level: number): number {
  return level <= 1 ? 0 : xpForLevel(level - 1);
}

export function ownerLevel(state: GameState): OwnerLevelInfo {
  const o = state.owner;
  const start = xpAtLevel(o.level);
  const next = xpForLevel(o.level);
  const into = Math.max(0, o.xp - start);
  const span = Math.max(1, next - start);
  return { level: o.level, xp: Math.floor(o.xp), xpForNext: next, xpIntoLevel: Math.floor(into), progress: Math.min(1, into / span), skillPoints: o.skillPoints };
}

/** Add XP, handle level ups. Returns the number of levels gained. */
export function addXp(state: GameState, xp: number): number {
  const o = state.owner;
  if (!Number.isFinite(xp) || xp <= 0) return 0;
  o.xp = Math.round((o.xp + xp) * 10) / 10;
  let gained = 0;
  while (o.xp >= xpForLevel(o.level) && gained < 50) {
    o.level += 1;
    o.skillPoints += 1;
    gained++;
  }
  return gained;
}

export function unlockPerk(state: GameState, perkId: string): ActionResult {
  const perk = PERKS.find((p) => p.id === perkId);
  if (!perk) return { ok: false, message: 'Unknown perk.' };
  const o = state.owner;
  if (o.perks.includes(perkId)) return { ok: false, message: 'Already learned.' };
  if (perk.requires && !o.perks.includes(perk.requires)) {
    const req = PERKS.find((p) => p.id === perk.requires);
    return { ok: false, message: `Learn ${req?.name ?? perk.requires} first.` };
  }
  if (o.skillPoints < 1) return { ok: false, message: 'No skill points.' };
  o.skillPoints -= 1;
  o.perks.push(perkId);
  return { ok: true, message: `${perk.name} learned.` };
}

export function ownerMinutesLeft(state: GameState): number {
  return Math.max(0, DAY_END - state.owner.minute);
}
