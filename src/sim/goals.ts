// Daily goals: three small targets every morning that pay a cash and XP bonus, plus a bonus for clearing
// all three. Short, arcade-sized objectives that point the player at the next satisfying thing to do.
import type { DailyGoal, GameState, GoalKind } from '../core/types';
import { hashSeed, makeRng } from '../core/rng';
import { calendar } from './calendar';
import { addLedger, r2 } from './util';
import { addXp } from './owner';
import { fairPrice } from './pricing';
import { readDayLog } from './util';

const QUALITY_BAR = 77.5;     // four stars

function num(state: GameState, key: string): number {
  const v = Number(state.flags[key]);
  return Number.isFinite(v) ? v : 0;
}

/** The running total each goal kind counts against (progress = total now - total at dawn). */
function metric(state: GameState, kind: GoalKind): number {
  switch (kind) {
    case 'knocks': return state.stats.knocks;
    case 'deals': return state.stats.deals;
    case 'jobs': return state.owner.jobsToday;
    case 'quality': return readDayLog(state).jobs.filter((j) => j.by.startsWith('You') && j.q >= QUALITY_BAR).length;
    case 'tips': return Math.round(state.ledger.filter((e) => e.day === state.day && e.cat === 'tip').reduce((a, e) => a + e.amount, 0));
    case 'stripes': return num(state, 'stripeJobs');
    case 'charm': return num(state, 'likedTalks');
    case 'earn': return Math.round(state.ledger.filter((e) => e.day === state.day && (e.cat === 'job' || e.cat === 'tip')).reduce((a, e) => a + e.amount, 0));
  }
}

/** Counters that reset every morning start from zero, running totals from their value at dawn. */
function baseFor(state: GameState, kind: GoalKind): number {
  return kind === 'jobs' || kind === 'quality' || kind === 'tips' || kind === 'earn' ? 0 : metric(state, kind);
}

function label(kind: GoalKind, n: number): string {
  switch (kind) {
    case 'knocks': return `Knock on ${n} doors`;
    case 'deals': return n === 1 ? 'Sign a new client' : `Sign ${n} new clients`;
    case 'jobs': return `Finish ${n} jobs yourself`;
    case 'quality': return n === 1 ? 'Mow a lawn at 4 stars or better' : `Mow ${n} lawns at 4 stars or better`;
    case 'tips': return `Earn $${n} in tips`;
    case 'stripes': return n === 1 ? 'Lay great stripes on a lawn' : `Lay great stripes on ${n} lawns`;
    case 'charm': return n === 1 ? 'Win a client over with small talk' : `Win ${n} clients over with small talk`;
    case 'earn': return `Earn $${n} from lawns`;
  }
}

function avgPrice(state: GameState): number {
  const paying = state.clients.filter((c) => !c.commercial && !c.trial);
  if (!paying.length) return fairPrice(330);
  return paying.reduce((a, c) => a + c.price, 0) / paying.length;
}

function rollGoals(state: GameState): DailyGoal[] {
  const cal = calendar(state.day);
  if (cal.season === 'winter') return [];
  const rng = makeRng(hashSeed(state.seed, 'goals', state.day));
  const due = state.clients.filter((c) => c.status === 'active' && c.nextDueDay <= state.day + 1 && (c.assignee === 'owner')).length;
  const price = avgPrice(state);
  const reward = Math.round(Math.min(160, 0.5 * price + 5));
  const make = (kind: GoalKind, target: number, xp = 20): DailyGoal => ({
    kind, label: label(kind, target), target, base: baseFor(state, kind), progress: 0, reward, xp, done: false,
  });
  // Day one teaches the loop: sign Rose and a neighbor, knock around, lay stripes on the first lawn.
  if (state.day === 0) return [make('deals', 2), make('knocks', 5), make('stripes', 1)];
  const pool: DailyGoal[] = [];
  pool.push(make('knocks', 5 + rng.int(0, 5)));
  pool.push(make('deals', state.clients.length < 6 ? 1 : 1 + rng.int(0, 1), 25));
  if (cal.isWorkday && due >= 2) pool.push(make('jobs', Math.min(due, 2 + rng.int(0, 3))));
  if (cal.isWorkday && due >= 1) {
    pool.push(make('quality', Math.min(due, 1 + rng.int(0, 2)), 25));
    pool.push(make('stripes', Math.min(due, 1 + rng.int(0, 1))));
    pool.push(make('charm', Math.min(due, 1 + rng.int(0, 2))));
  }
  // new clients are due the day they sign, so there is always money to make
  pool.push(make('earn', Math.max(40, Math.round((price * Math.max(1.5, Math.min(due, 5) * 0.8)) / 10) * 10)));
  if (cal.isWorkday && due >= 3) pool.push(make('tips', Math.max(5, Math.round((price * 0.12 * Math.min(due, 5)) / 5) * 5), 20));
  // three different kinds, at most one door goal so the day is not all knocking
  const out: DailyGoal[] = [];
  const bag = [...pool];
  while (out.length < 3 && bag.length) {
    const i = rng.int(0, bag.length - 1);
    const g = bag.splice(i, 1)[0];
    const doorish = (k: GoalKind) => k === 'knocks' || k === 'deals';
    if (doorish(g.kind) && out.some((o) => doorish(o.kind)) && bag.some((b) => !doorish(b.kind))) continue;
    out.push(g);
  }
  return out;
}

/** Make sure today's goals exist. */
export function ensureGoals(state: GameState): void {
  if (state.goals && state.goals.day === state.day) return;
  state.goals = { day: state.day, list: rollGoals(state), sweep: false };
}

/** Update progress, pay out finished goals. Returns the labels of goals finished by this call. */
export function checkGoals(state: GameState): string[] {
  ensureGoals(state);
  const g = state.goals!;
  const done: string[] = [];
  for (const goal of g.list) {
    if (goal.done) continue;
    goal.progress = Math.max(0, metric(state, goal.kind) - goal.base);
    if (goal.progress >= goal.target) {
      goal.done = true;
      goal.progress = goal.target;
      addLedger(state, goal.reward, 'other_in', `Goal: ${goal.label}`);
      addXp(state, goal.xp);
      done.push(goal.label);
    }
  }
  if (!g.sweep && g.list.length && g.list.every((x) => x.done)) {
    g.sweep = true;
    const bonus = r2(Math.round(Math.min(250, avgPrice(state) + 10)));
    addLedger(state, bonus, 'other_in', 'Goal: clean sweep');
    addXp(state, 40);
    done.push('Clean sweep');
  }
  return done;
}

/** Sweep bonus shown on the hub before it is earned. */
export function sweepBonus(state: GameState): number {
  return Math.round(Math.min(250, avgPrice(state) + 10));
}
