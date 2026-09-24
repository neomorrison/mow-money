// Jobs: tickets, manual 3D jobs, autopilot, and the shared service pipeline (sections 9, 10, 12, 17).
import type {
  ActionResult, Client, Damage, GameState, Id, JobOutcome, JobTicket, MowJobResult, MowJobSpec, QualityBreakdown,
} from '../core/types';
import type { Rng } from '../core/rng';
import { clamp } from '../core/rng';
import { ARCHETYPE_BY_ID } from '../data/archetypes';
import { HOOD_BY_ID, splitHoodKey } from '../data/hoods';
import { EQUIPMENT_BY_ID } from '../data/equipment';
import { lotForLawn } from '../world/property';
import { hashSeed } from '../core/rng';
import { DAY_END, SETUP_MINUTES, TIME_SCALE, BLADE_WEAR_PER_1000, WET_PENALTY, RAPPORT_START, STREAK_MAX, STREAK_TIP, DAMAGE_SATISFACTION, BREAKDOWN_FIXED, BREAKDOWN_PER_HOUR } from './constants';
import { calendar } from './calendar';
import { addLedger, firstName, hasPerk, hasRole, itemByUid, logDay, r1, r2, withRng } from './util';
import { canCarry, carryError, effectiveStripe, ownerKit, workMinutes } from './kit';
import { computeQuality, simulatedPenalties } from './quality';
import { addRating, starsFor } from './reputation';
import { applyServiceSatisfaction, removeClient } from './clients';
import {
  grassHeight, houseHoodKey, houseInfo, hs, ownerTravelToHouse, preferredHeight, travelMinutes,
} from './world';
import { addXp } from './owner';
import { reactionLine, moodFor, DAMAGE_THING } from './reactions';
import { wearItem } from './shop';
import { checkAchievements, ACHIEVEMENT_BY_ID } from './achievements';
import { checkGoals } from './goals';

// ---------------------------------------------------------------- tickets
export function isDue(state: GameState, c: Client, day = state.day): boolean {
  return c.status === 'active' && c.nextDueDay <= day + 1 && c.lastServiceDay !== day;
}

export function daysOverdue(state: GameState, c: Client): number {
  return Math.max(0, state.day - c.nextDueDay - 1);
}

export function ownerJobEstimate(state: GameState, c: Client, fromTravel?: number): number {
  const info = houseInfo(state, c.houseId);
  const kit = ownerKit(state);
  const travel = fromTravel ?? ownerTravelToHouse(state, c.houseId);
  const wet = state.weather.today === 'rain' || state.weather.today === 'storm';
  const t = workMinutes({
    lawnM2: info.lawnM2, hardscapeM2: info.hardscapeM2, grassIn: grassHeight(state, c.houseId),
    mower: kit.mowerSpec, trimmer: kit.trimmerSpec, blower: kit.blowerSpec,
    speedMult: hasPerk(state, 'quick_feet') ? 1.1 : 1, wet,
  });
  return Math.round(travel + SETUP_MINUTES + t.total);
}

export function ticketFor(state: GameState, c: Client): JobTicket {
  const info = houseInfo(state, c.houseId);
  const key = houseHoodKey(c.houseId);
  const hood = HOOD_BY_ID[splitHoodKey(key).hoodId];
  return {
    clientId: c.id, houseId: c.houseId, address: c.commercial ? siteTitle(state, c) : info.address, hoodKey: key, hoodName: hood?.name ?? key,
    ownerName: info.ownerName, portrait: info.portrait, lawnM2: info.lawnM2, grassIn: grassHeight(state, c.houseId), price: c.price,
    dueDay: c.nextDueDay, daysOverdue: daysOverdue(state, c), satisfaction: c.satisfaction, assignee: c.assignee,
    canAutopilot: c.bestManualQ >= 0 && !c.trial, estMinutes: ownerJobEstimate(state, c), trial: c.trial,
    done: c.lastServiceDay === state.day,
  };
}

function siteTitle(state: GameState, c: Client): string {
  const bid = state.bids.find((b) => b.id === c.commercial?.bidId);
  return bid?.title ?? houseInfo(state, c.houseId).address;
}

/** Jobs due today (one day early allowed), overdue first; jobs finished today come last with done = true. */
export function jobsToday(state: GameState): JobTicket[] {
  if (calendar(state.day).season === 'winter') return [];
  const due = state.clients.filter((c) => isDue(state, c)).sort((a, b) => a.nextDueDay - b.nextDueDay || a.id.localeCompare(b.id));
  const done = state.clients.filter((c) => c.lastServiceDay === state.day);
  return [...due.map((c) => ticketFor(state, c)), ...done.map((c) => ticketFor(state, c))];
}

export function assignJob(state: GameState, clientId: Id, assignee: 'owner' | Id): ActionResult {
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return { ok: false, message: 'Unknown client.' };
  if (assignee !== 'owner' && !state.crews.some((cr) => cr.id === assignee)) return { ok: false, message: 'Unknown crew.' };
  c.assignee = assignee;
  const crew = state.crews.find((cr) => cr.id === assignee);
  return { ok: true, message: assignee === 'owner' ? 'You will do this one.' : `Assigned to ${crew?.name ?? 'crew'}. They mow it when you end the day.` };
}

// ---------------------------------------------------------------- manual job spec
const NOTES: Record<string, string> = {
  retiree: 'Mind the garden gnome.',
  perfectionist: 'Straight lines, please. They will check.',
  family: 'Toys in the yard. Look before you mow.',
  penny: 'No extras, please.',
  hoa: 'Edges must be crisp.',
  techie: 'Quiet near the office window if you can.',
  gardener: 'Mind the flower beds.',
  eco: 'Keep clippings off the patio.',
  landlord: 'Tenants park on the lawn sometimes.',
  dude: 'The hammock stays where it is.',
  veteran: 'Straight lines, like a parade ground.',
  newcouple: 'We just planted new beds.',
  executive: 'A clean finish is expected.',
  facilities: 'Keep clear of the entrance at 9 AM.',
  parks: 'Mind the irrigation heads.',
  greenskeeper: 'Fairway height. No scalping.',
};

function jobNotes(state: GameState, c: Client | null, targetIn: number): string[] {
  if (!c) return ['Practice lawn. No pay, no rating.'];
  const info = houseInfo(state, c.houseId);
  const out: string[] = [`Cut height: ${targetIn.toFixed(targetIn % 0.5 ? 2 : 1)} in.`];
  const n = NOTES[info.archetypeId];
  if (n) out.push(n);
  if (c.wantsStripes || c.addOns.includes('stripes')) out.push('Stripes, please.');
  if (c.addOns.includes('bagging')) out.push('Bag the clippings.');
  if (c.addOns.includes('fertilizer')) out.push('Fertilizer program: keep the height even.');
  if (c.trial) out.push(`Trial mow. They sign if they like it.`);
  return out;
}

export function buildMowJob(state: GameState, clientId: Id | null): MowJobSpec | { error: string } {
  const cal = calendar(state.day);
  const kit = ownerKit(state);
  if (!kit.mower) return { error: 'You need a mower.' };
  if (!canCarry(kit.vehicleSpec, kit.mowerSpec)) return { error: carryError(kit.vehicleSpec, kit.mowerSpec) };
  const wet = state.weather.today === 'rain' || state.weather.today === 'storm';
  const leaves = cal.season === 'fall' ? r2(0.2 + 0.6 * (cal.dayOfSeason - 1) / Math.max(1, cal.seasonLength - 1)) : 0;
  const bagCapable = ['push21', 'selfprop', 'walkbehind', 'reel'].includes(kit.mowerSpec.id);
  const bagging = !!kit.mowerSpec.bagging || (state.items.some((i) => i.specId === 'bagger') && bagCapable && kit.mowerSpec.id !== 'reel');
  const striping = state.items.some((i) => i.specId === 'stripekit');
  const autoStripe = striping || hasPerk(state, 'straight_lines');
  const perks = state.owner.perks.filter((p) => ['quick_feet', 'edge_master', 'straight_lines', 'autopilot_pro'].includes(p));
  const tutorialFlag = Number(state.flags.tutorial) || 0;
  if (clientId === null) {
    const lot = lotForLawn(300, 'ranch', 'residential', 1.4);
    const travel = travelMinutes(state, state.owner.location, 'hq');
    const start = state.owner.minute + travel;
    if (start + SETUP_MINUTES + 20 > DAY_END) return { error: 'Not enough daylight.' };
    return {
      jobId: `practice-${state.day}-${state.owner.minute}`, kind: 'practice', clientId: null, houseId: null, address: 'Your yard',
      ownerName: 'You', portrait: '', lot, propertySeed: hashSeed(state.seed, 'practice'), grassIn: 4.2, targetIn: 3,
      expectation: 70, wantsStripes: false, mower: kit.mowerSpec, sharpness: kit.mower.sharpness, trimmer: kit.trimmerSpec,
      blower: kit.blowerSpec, bagging, striping, weather: state.weather.today, season: cal.season, startMinute: start,
      timeScale: TIME_SCALE, wet, leaves, perks, notes: jobNotes(state, null, 3), tutorial: tutorialFlag > 0, autoStripe,
      companyColor: state.company.color, vehicleModel: kit.vehicleSpec.model,
    };
  }
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return { error: 'Unknown client.' };
  if (cal.season === 'winter') return { error: 'No mowing in winter.' };
  if (c.lastServiceDay === state.day) return { error: 'Already done today.' };
  const info = houseInfo(state, c.houseId);
  const travel = ownerTravelToHouse(state, c.houseId);
  const start = state.owner.minute + travel;
  const est = ownerJobEstimate(state, c, travel);
  if (state.owner.minute + est > DAY_END + 15) return { error: 'Not enough daylight.' };
  const targetIn = preferredHeight(info);
  const leafJob = false;
  return {
    jobId: `job-${state.day}-${c.id}-${state.owner.minute}`, kind: leafJob ? 'leaves' : 'mow', clientId: c.id, houseId: c.houseId,
    address: c.commercial ? siteTitle(state, c) : info.address, ownerName: info.ownerName, portrait: info.portrait, lot: info.lot,
    propertySeed: info.propertySeed, grassIn: grassHeight(state, c.houseId), targetIn, expectation: c.expectation,
    wantsStripes: c.wantsStripes || c.addOns.includes('stripes'), mower: kit.mowerSpec, sharpness: kit.mower.sharpness,
    trimmer: kit.trimmerSpec, blower: kit.blowerSpec, bagging, striping, weather: state.weather.today, season: cal.season,
    startMinute: start, timeScale: TIME_SCALE, wet, leaves, perks, notes: jobNotes(state, c, targetIn),
    tutorial: tutorialFlag === 2, premiumStripes: c.addOns.includes('stripes'), autoStripe,
    companyColor: state.company.color, vehicleModel: kit.vehicleSpec.model,
  };
}

// ---------------------------------------------------------------- shared service pipeline
export interface ServiceResult {
  paid: number; tip: number; tipParts: { label: string; amount: number }[]; sBefore: number; sAfter: number;
  trialResult?: 'signed' | 'declined'; removed: boolean; events: string[];
}

/**
 * Tips (section 10). Performance: quality over expectation, a streak of good owner jobs and visible stripes.
 * Charm: how much the client likes you (rapport, raised by small talk). Everything scales with the
 * archetype's tip habit.
 */
export function rollTip(rng: Rng, c: Client, q: number, tipMult: number, opts: { stripe?: number; streak?: number }): { tip: number; parts: { label: string; amount: number }[] } {
  const parts: { label: string; amount: number }[] = [];
  if (c.commercial || tipMult <= 0) return { tip: 0, parts };
  const margin = q - c.expectation;
  if (margin < -4) return { tip: 0, parts };
  const rapport = clamp(c.rapport ?? RAPPORT_START, 0, 1);
  const p = clamp(0.3 + 0.03 * margin + 0.35 * rapport, 0.05, 0.92);
  if (!rng.chance(p)) return { tip: 0, parts };
  const perf = c.price * (rng.range(0.05, 0.1) + 0.005 * clamp(margin, 0, 25)) * tipMult;
  parts.push({ label: margin >= 10 ? 'Outstanding work' : margin >= 0 ? 'Great work' : 'Thanks', amount: perf });
  const streak = Math.min(STREAK_MAX, opts.streak ?? 0);
  if (streak >= 2) parts.push({ label: `Hot streak x${streak}`, amount: perf * STREAK_TIP * streak });
  const stripe = opts.stripe ?? 0;
  if (stripe >= 0.5) parts.push({ label: 'Stripes', amount: c.price * 0.05 * stripe * (c.wantsStripes ? 2 : 1) * tipMult });
  if (rapport >= 0.3) parts.push({ label: 'They like you', amount: c.price * 0.08 * rapport * tipMult });
  const out = parts.map((x) => ({ label: x.label, amount: r2(x.amount) })).filter((x) => x.amount >= 0.5);
  const tip = r2(out.reduce((a, x) => a + x.amount, 0));
  return tip >= 1 ? { tip, parts: out } : { tip: 0, parts: [] };
}

/** Rapport drifts with each visit: good work and no damage build it, bad visits erode it. */
function driftRapport(c: Client, q: number, damages: number): void {
  let r = c.rapport ?? RAPPORT_START;
  if (q >= c.expectation) r += 0.02;
  else if (q < c.expectation - 10) r -= 0.03;
  r -= 0.05 * damages;
  c.rapport = r2(clamp(r, 0, 1));
}

export function officeBonus(state: GameState): number {
  return hasRole(state, 'office') ? 1.02 : 1;
}

/** Apply one completed service to a client. Handles pay, tips, satisfaction, rating, history, trials, contracts. */
export function applyService(state: GameState, rng: Rng, c: Client, q: number, opts: { by: string; damages: number; cutHeight: number; coverage: number; manual: boolean; ledger?: boolean; stripe?: number; streak?: number }): ServiceResult {
  const info = houseInfo(state, c.houseId);
  const sBefore = c.satisfaction;
  const events: string[] = [];
  const address = c.commercial ? siteTitle(state, c) : info.address;
  let paid = 0;
  let tip = 0;
  let tipParts: { label: string; amount: number }[] = [];
  let trialResult: 'signed' | 'declined' | undefined;
  // Grass after the cut.
  const h = hs(state, c.houseId);
  const hBefore = grassHeight(state, c.houseId);
  const cov = clamp(opts.coverage, 0, 1);
  h.h = r2(Math.min(hBefore, opts.cutHeight) * cov + hBefore * (1 - cov));
  h.hDay = state.day;
  addRating(state, q);
  if (c.trial) {
    if (q >= c.expectation - 5) {
      c.trial = false;
      trialResult = 'signed';
      events.push('Trial passed. Contract signed.');
    } else {
      trialResult = 'declined';
      events.push('They declined after the trial.');
      state.stats.jobs += 1;
      logDay(state, (l) => l.jobs.push({ clientId: c.id, address, by: opts.by, q: r1(q), paid: 0 }));
      removeClient(state, c, 'Declined after the trial', null, false);
      return { paid: 0, tip: 0, tipParts, sBefore, sAfter: sBefore, trialResult, removed: true, events };
    }
  } else {
    paid = r2(c.price * officeBonus(state));
    if (opts.ledger !== false) addLedger(state, paid, 'job', `${address}`);
    const arch = ARCHETYPE_BY_ID[info.archetypeId];
    const t = rollTip(rng, c, q, arch?.tipMult ?? 1, { stripe: opts.stripe, streak: opts.streak });
    if (t.tip > 0) {
      tip = t.tip;
      tipParts = t.parts;
      if (opts.ledger !== false) addLedger(state, tip, 'tip', `Tip, ${address}`);
      events.push(`Tip: $${tip.toFixed(2)}`);
      state.flags.tips = (Number(state.flags.tips) || 0) + 1;
    }
  }
  driftRapport(c, q, opts.damages);
  applyServiceSatisfaction(state, c, q, opts.damages);
  c.lastServiceDay = state.day;
  // a visit a day early keeps the schedule; a late one restarts it from today
  c.nextDueDay = Math.max(state.day, c.nextDueDay) + c.freq;
  c.lastQ = r1(q);
  if (opts.manual) c.bestManualQ = Math.max(c.bestManualQ, r1(q));
  c.visits += 1;
  c.totalPaid = r2(c.totalPaid + paid + tip);
  c.tips = r2(c.tips + tip);
  c.damages += opts.damages;
  c.history.push(Math.round(q));
  if (c.history.length > 8) c.history.splice(0, c.history.length - 8);
  if (c.commercial) {
    c.commercial.lowStreak = q < 70 ? c.commercial.lowStreak + 1 : 0;
    if (c.commercial.lowStreak >= 3) {
      events.push('Contract terminated after three poor visits.');
      removeClient(state, c, 'Contract terminated for poor quality', null, true);
    }
  }
  const st = state.stats;
  st.jobs += 1;
  st.revenue = r2(st.revenue + paid + tip);
  st.bestQ = Math.max(st.bestQ, r1(q));
  if (q >= 95) st.perfectJobs += 1;
  st.m2Mowed = Math.round(st.m2Mowed + info.lawnM2 * cov);
  st.damages += opts.damages;
  if (opts.ledger !== false) logDay(state, (l) => l.jobs.push({ clientId: c.id, address, by: opts.by, q: r1(q), paid: r2(paid + tip) }));
  return { paid, tip, tipParts, sBefore, sAfter: c.satisfaction, trialResult, removed: false, events };
}

// ---------------------------------------------------------------- owner jobs
function ownerFuel(state: GameState, mowHours: number, toolHours: number, travelMin: number): number {
  const kit = ownerKit(state);
  const gal = (kit.mowerSpec.fuelGalPerHr ?? 0) * mowHours
    + ((kit.trimmerSpec?.fuelGalPerHr ?? 0) + (kit.blowerSpec?.fuelGalPerHr ?? 0)) * toolHours * 0.5
    + (kit.vehicleSpec.fuelGalPerHr ?? 0) * (travelMin / 60);
  return r2(gal * state.weather.fuelPrice);
}

function chargeDamages(state: GameState, damages: Damage[], address: string): number {
  let total = 0;
  for (const d of damages) {
    const cost = Math.max(0, Number.isFinite(d.cost) ? d.cost : 0);
    const pay = state.insured ? Math.min(cost, 100) : cost;
    total += pay;
  }
  if (total > 0) addLedger(state, -total, 'damage', `Damage, ${address}`);
  return r2(total);
}

function advanceTutorial(state: GameState): void {
  const t = Number(state.flags.tutorial) || 0;
  if (t === 2 && state.stats.manualJobs > 0) state.flags.tutorial = 3;
  if (Number(state.flags.tutorial) === 3 && state.stats.knocks >= 3) state.flags.tutorial = 4;
}

/** Owner job streak: consecutive jobs that met the client's expectation without damage. */
function nextStreak(state: GameState, c: Client, q: number, damages: number): number {
  const ok = q >= c.expectation && damages === 0;
  const n = ok ? (Number(state.flags.streak) || 0) + 1 : 0;
  state.flags.streak = n;
  return n;
}

function achievementsEvents(state: GameState): string[] {
  return checkAchievements(state).map((id) => `Achievement: ${ACHIEVEMENT_BY_ID[id]?.name ?? id}`);
}

export function completeManualJob(state: GameState, spec: MowJobSpec, raw: MowJobResult): JobOutcome {
  // measurements come from the 3D scene; never let a bad number into the save
  const fin = (x: number, d: number) => (Number.isFinite(x) ? x : d);
  const result: MowJobResult = {
    ...raw,
    coverage: clamp(fin(raw.coverage, 0), 0, 1), stripe: clamp(fin(raw.stripe, 0), 0, 1),
    cutHeightIn: fin(raw.cutHeightIn, spec.targetIn) > 0 ? fin(raw.cutHeightIn, spec.targetIn) : spec.targetIn,
  };
  const breakdown = computeQuality(spec, result);
  const kit = ownerKit(state);
  const travel = spec.kind === 'practice' ? travelMinutes(state, state.owner.location, 'hq')
    : spec.houseId ? ownerTravelToHouse(state, spec.houseId) : 0;
  const gameMinutes = Math.max(0, Number.isFinite(result.gameMinutes) ? result.gameMinutes : 0);
  const minutes = Math.round(travel + SETUP_MINUTES + gameMinutes);
  const o = state.owner;
  o.minute = Math.min(DAY_END, o.minute + minutes);
  o.location = spec.kind === 'practice' || !spec.houseId ? 'hq' : houseHoodKey(spec.houseId);
  // Wear and fuel.
  const engineHours = Math.max(0, Number.isFinite(result.engineHours) ? result.engineHours : gameMinutes / 60);
  wearItem(kit.mower, engineHours, Number.isFinite(result.sharpnessLoss) ? result.sharpnessLoss : 0);
  wearItem(kit.trimmer, engineHours * 0.3, 0);
  wearItem(kit.blower, engineHours * 0.15, 0);
  wearItem(kit.vehicle, travel / 60, 0);
  const fuelCost = ownerFuel(state, engineHours, engineHours * 0.4, travel);
  if (fuelCost > 0) addLedger(state, -fuelCost, 'fuel', 'Fuel');
  const q = breakdown.q;

  if (!result.completed) {
    const res = abandonCore(state);
    void res;
    return emptyOutcome(spec, breakdown, minutes, fuelCost, 'You left before finishing.');
  }
  if (spec.kind === 'practice' || !spec.clientId) {
    advanceTutorial(state);
    const out = emptyOutcome(spec, breakdown, minutes, fuelCost, 'Nice practice run.');
    out.events.push(...achievementsEvents(state));
    return out;
  }
  const c = state.clients.find((x) => x.id === spec.clientId);
  if (!c) return emptyOutcome(spec, breakdown, minutes, fuelCost, 'That client is gone.');
  const info = houseInfo(state, c.houseId);
  const damageCost = chargeDamages(state, result.damages ?? [], info.address);
  return withRng(state, (rng) => {
    const nDamage = (result.damages ?? []).length;
    const streak = c.trial ? Number(state.flags.streak) || 0 : nextStreak(state, c, q, nDamage);
    const svc = applyService(state, rng, c, q, { by: 'You', damages: nDamage, cutHeight: result.cutHeightIn, coverage: result.coverage, manual: true, stripe: result.stripe, streak });
    state.stats.manualJobs += 1;
    o.jobsToday += 1;
    const xp = Math.round(q / 5);
    const levels = addXp(state, xp);
    const events = [...svc.events];
    if (levels > 0) events.push(`Level up. You are now level ${state.owner.level}.`);
    advanceTutorial(state);
    events.push(...achievementsEvents(state));
    const mood = svc.trialResult === 'declined' ? 'unhappy' : moodFor(q, c.expectation, (result.damages ?? []).length);
    const firstDamage = (result.damages ?? [])[0];
    const reaction = reactionLine(rng, {
      mood, archetypeId: info.archetypeId, firstName: firstName(info.ownerName),
      damageThing: firstDamage ? DAMAGE_THING[firstDamage.kind] : undefined, trial: svc.trialResult,
      stripes: result.stripe >= 0.6,
    });
    if (streak >= 3) events.push(`Hot streak: ${streak} great jobs in a row.`);
    if (result.stripe >= 0.7) state.flags.stripeJobs = (Number(state.flags.stripeJobs) || 0) + 1;
    for (const g of checkGoals(state)) events.push(`Goal complete: ${g}`);
    return {
      clientId: c.id, q, breakdown, paid: svc.paid, tip: svc.tip, satisfactionBefore: svc.sBefore, satisfactionAfter: svc.sAfter,
      reaction, mood, xp, minutes, fuelCost, damageCost, trialResult: svc.trialResult, events,
      tipParts: svc.tipParts, streak, canTalk: !svc.removed,
    };
  });
}

function emptyOutcome(spec: MowJobSpec, breakdown: QualityBreakdown, minutes: number, fuelCost: number, line: string): JobOutcome {
  return {
    clientId: spec.clientId ?? '', q: breakdown.q, breakdown, paid: 0, tip: 0, satisfactionBefore: 0, satisfactionAfter: 0,
    reaction: line, mood: 'neutral', xp: 0, minutes, fuelCost, damageCost: 0, events: [],
  };
}

function abandonCore(state: GameState): void {
  // Nothing is paid and the client is not rated. The job stays due.
  void state;
}

export function abandonManualJob(state: GameState, spec: MowJobSpec, result: MowJobResult): ActionResult {
  const kit = ownerKit(state);
  const travel = spec.kind === 'practice' || !spec.houseId ? travelMinutes(state, state.owner.location, 'hq') : ownerTravelToHouse(state, spec.houseId);
  const gameMinutes = Math.max(0, Number.isFinite(result.gameMinutes) ? result.gameMinutes : 0);
  const minutes = Math.round(travel + SETUP_MINUTES + gameMinutes);
  state.owner.minute = Math.min(DAY_END, state.owner.minute + minutes);
  state.owner.location = spec.kind === 'practice' || !spec.houseId ? 'hq' : houseHoodKey(spec.houseId);
  const engineHours = Math.max(0, Number.isFinite(result.engineHours) ? result.engineHours : gameMinutes / 60);
  wearItem(kit.mower, engineHours, Number.isFinite(result.sharpnessLoss) ? result.sharpnessLoss : 0);
  const fuel = ownerFuel(state, engineHours, 0, travel);
  if (fuel > 0) addLedger(state, -fuel, 'fuel', 'Fuel');
  const damageCost = chargeDamages(state, result.damages ?? [], spec.address);
  if (spec.clientId) {
    const c = state.clients.find((x) => x.id === spec.clientId);
    if (c && (result.damages ?? []).length) {
      c.satisfaction = r1(clamp(c.satisfaction - DAMAGE_SATISFACTION * (result.damages ?? []).length, 0, 100));
      c.damages += (result.damages ?? []).length;
    }
  }
  return { ok: true, message: `Job left unfinished. ${minutes} minutes used${damageCost ? `, $${damageCost.toFixed(0)} in damage` : ''}.` };
}

/** Quality and wear for a simulated job (autopilot or crew). */
export function simulatedJob(state: GameState, rng: Rng, c: Client, mu: number, sigma: number, mowerSpec = ownerKit(state).mowerSpec): { q: number; cut: number } {
  const info = houseInfo(state, c.houseId);
  const wet = state.weather.today === 'rain' || state.weather.today === 'storm';
  const pen = simulatedPenalties({
    grassIn: grassHeight(state, c.houseId), targetIn: preferredHeight(info), wet,
    deckHeights: mowerSpec.deckHeights, maxGrassIn: mowerSpec.maxGrassIn,
  });
  const q = clamp(rng.normal(mu, sigma) - pen.points, 0, 100);
  return { q: r1(q), cut: pen.cut };
}

export function autopilotJob(state: GameState, clientId: Id): JobOutcome | { error: string } {
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return { error: 'Unknown client.' };
  if (calendar(state.day).season === 'winter') return { error: 'No mowing in winter.' };
  if (c.trial) return { error: 'Trial mows are done by hand.' };
  if (c.bestManualQ < 0) return { error: 'Mow this lawn by hand once first.' };
  if (c.lastServiceDay === state.day) return { error: 'Already done today.' };
  const kit = ownerKit(state);
  if (!kit.mower) return { error: 'You need a mower.' };
  if (!canCarry(kit.vehicleSpec, kit.mowerSpec)) return { error: carryError(kit.vehicleSpec, kit.mowerSpec) };
  const info = houseInfo(state, c.houseId);
  const travel = ownerTravelToHouse(state, c.houseId);
  const est = ownerJobEstimate(state, c, travel);
  const o = state.owner;
  if (o.minute + est > DAY_END) return { error: 'Not enough daylight.' };
  return withRng(state, (rng) => {
    // Breakdown check.
    const rel = kit.mowerSpec.reliability ?? 0.97;
    const mech = hasRole(state, 'mechanic') ? 0.4 : 1;
    const workH = Math.max(0, est - travel - SETUP_MINUTES) / 60;
    const pBreak = BREAKDOWN_PER_HOUR * (1 - rel) * (1.5 - (kit.mower?.condition ?? 1)) * mech * workH;
    o.minute += travel;
    o.location = houseHoodKey(c.houseId);
    if (rng.chance(pBreak) && kit.mower) {
      // fixed on the spot: costs money and half an hour, the machine comes back in decent shape
      const cost = Math.round(0.08 * Math.max(kit.mowerSpec.price, 150) * (1.2 - kit.mower.condition));
      addLedger(state, -cost, 'repair', `Breakdown repair, ${kit.mowerSpec.name}`);
      kit.mower.condition = Math.max(kit.mower.condition, BREAKDOWN_FIXED);
      o.minute = Math.min(DAY_END, o.minute + 30);
      return { error: `The ${kit.mowerSpec.name} broke down. Fixed for $${cost}. The job is still due.` };
    }
    const cap = kit.mowerSpec.qualityCap ?? 90;
    const perk = hasPerk(state, 'autopilot_pro') ? 5 : 0;
    const sharp = kit.mower?.sharpness ?? 1;
    const mu = Math.min(cap, c.bestManualQ - 3 + perk) - 10 * (1 - sharp);
    const sim = simulatedJob(state, rng, c, mu, 4, kit.mowerSpec);
    const q = sim.q;
    const work = est - travel;
    o.minute = Math.min(DAY_END, o.minute + work);
    const mowH = (work - SETUP_MINUTES) / 60;
    wearItem(kit.mower, mowH, BLADE_WEAR_PER_1000 * (kit.mowerSpec.wearMult ?? 1) * info.lawnM2 / 1000);
    wearItem(kit.vehicle, travel / 60, 0);
    const fuelCost = ownerFuel(state, mowH * 0.7, mowH * 0.3, travel);
    if (fuelCost > 0) addLedger(state, -fuelCost, 'fuel', 'Fuel');
    const streak = nextStreak(state, c, q, 0);
    const svc = applyService(state, rng, c, q, { by: 'You (autopilot)', damages: 0, cutHeight: sim.cut, coverage: 0.98, manual: false, streak });
    o.jobsToday += 1;
    const xp = Math.round(q / 20);
    const levels = addXp(state, xp);
    const events = [...svc.events];
    if (levels > 0) events.push(`Level up. You are now level ${state.owner.level}.`);
    events.push(...achievementsEvents(state));
    for (const g of checkGoals(state)) events.push(`Goal complete: ${g}`);
    const mood = moodFor(q, c.expectation, 0);
    const reaction = reactionLine(rng, { mood, archetypeId: info.archetypeId, firstName: firstName(info.ownerName) });
    const parts = [{ label: 'Autopilot', value: q, max: 100 }];
    const penalties = state.weather.today === 'rain' || state.weather.today === 'storm' ? [{ label: 'Wet grass', points: WET_PENALTY }] : [];
    const breakdown: QualityBreakdown = { q, stars: Math.round(starsFor(q) * 10) / 10, parts, penalties, capped: false };
    return {
      clientId: c.id, q, breakdown, paid: svc.paid, tip: svc.tip, satisfactionBefore: svc.sBefore, satisfactionAfter: svc.sAfter,
      reaction, mood, xp, minutes: est, fuelCost, damageCost: 0, trialResult: svc.trialResult, events,
      tipParts: svc.tipParts, streak, canTalk: !svc.removed,
    };
  });
}

/** Leaf cleanup is folded into fall mowing (cleanup counts leaves); kept for future one-off jobs. */
export function mowerSpecOf(state: GameState, uid: Id | null) {
  const it = itemByUid(state, uid);
  return it ? EQUIPMENT_BY_ID[it.specId] : undefined;
}

export { effectiveStripe };
