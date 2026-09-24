// Clients: satisfaction, churn, price changes (docs/DESIGN.md section 10).
import type { ActionResult, AddOn, Client, Frequency, GameState, Id } from '../core/types';
import type { Rng } from '../core/rng';
import { clamp } from '../core/rng';
import { CHURN_MID, CHURN_SCALE, CHURN_WEEK_MAX, RIVAL_CHURN_MULT, DAMAGE_SATISFACTION } from './constants';
import { houseInfo, hs, houseHoodKey, rivalActiveInHood, rivalIndexFor, grassHeight } from './world';
import { calendar } from './calendar';
import { serviceMult } from './pricing';
import { r1, r2, withRng, logDay } from './util';

export function hWeek(S: number): number {
  return CHURN_WEEK_MAX / (1 + Math.exp((S - CHURN_MID) / CHURN_SCALE));
}
export function hDayFromWeek(hw: number): number {
  return 1 - Math.pow(1 - clamp(hw, 0, 0.999999), 1 / 7);
}

export function clientRivalMult(state: GameState, c: Client): number {
  if (c.satisfaction >= 55) return 1;
  const key = houseHoodKey(c.houseId);
  let m = rivalActiveInHood(state, key) ? RIVAL_CHURN_MULT : 1;
  const info = houseInfo(state, c.houseId);
  const war = (state.rivals[info.townId] ?? []).some((r) => (r.priceWarUntil ?? -1) >= state.day);
  if (war) m *= 1.25;
  return m;
}

export function churnRiskWeekly(state: GameState, client: Client): number {
  if (client.commercial) return client.commercial.lowStreak >= 2 ? 0.5 : client.commercial.lowStreak === 1 ? 0.15 : 0.01;
  const hd = hDayFromWeek(hWeek(client.satisfaction)) * clientRivalMult(state, client);
  return clamp(1 - Math.pow(1 - Math.min(0.999, hd), 7), 0, 1);
}

export function satisfactionTarget(q: number, e: number): number {
  return clamp(70 + 1.5 * (q - e), 0, 100);
}

/** Apply a completed service to satisfaction. Returns the new value. */
export function applyServiceSatisfaction(state: GameState, c: Client, q: number, damages: number): number {
  const target = satisfactionTarget(q, c.expectation);
  let s = c.satisfaction + 0.4 * (target - c.satisfaction);
  s -= DAMAGE_SATISFACTION * damages;
  if (c.addOns.includes('fertilizer')) {
    const info = houseInfo(state, c.houseId);
    if (['gardener', 'techie', 'newcouple', 'executive'].includes(info.archetypeId)) s += 2;
  }
  c.satisfaction = r1(clamp(s, 0, 100));
  return c.satisfaction;
}

/** Lateness penalty per day overdue (after the grace day). */
export function latenessPenalty(c: Client): number {
  return 3 + (3 * (c.expectation - 60)) / 35;
}

/** Remove a client. `toRival` decides if a rival picks the house up. */
export function removeClient(state: GameState, c: Client, reason: string, rng: Rng | null, forceRival?: boolean): void {
  const idx = state.clients.indexOf(c);
  if (idx < 0) return;
  state.clients.splice(idx, 1);
  const info = houseInfo(state, c.houseId);
  const h = hs(state, c.houseId);
  const goesRival = forceRival ?? (rng ? rng.chance(0.6) : false);
  h.provider = goesRival ? 'rival' : 'diy';
  h.exClient = true;
  delete h.yardSign;
  h.h = grassHeight(state, c.houseId);
  h.hDay = state.day;
  delete h.leadUntil;
  delete h.leadTrust;
  state.lost.push({ houseId: c.houseId, day: state.day, reason, price: c.price });
  if (state.lost.length > 40) state.lost.splice(0, state.lost.length - 40);
  // Crews and bids keep no reference to the client id; nothing else to clean.
  void rivalIndexFor(info);
  logDay(state, (l) => l.lost.push({ address: info.address, reason }));
}

/** Comparable R for a client (R is stored per visit for the chosen service). */
export function clientValue(c: Client): number {
  return c.R;
}

export function changePrice(state: GameState, clientId: Id, newPrice: number): ActionResult {
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return { ok: false, message: 'Unknown client.' };
  if (!Number.isFinite(newPrice) || newPrice <= 0) return { ok: false, message: 'Enter a price.' };
  const p = r2(newPrice);
  if (c.commercial) return { ok: false, message: 'Contract prices are fixed.' };
  if (p === c.price) return { ok: true, message: 'No change.' };
  if (p < c.price) {
    const cut = 1 - p / c.price;
    c.price = p;
    c.satisfaction = r1(clamp(c.satisfaction + 20 * cut, 0, 100));
    return { ok: true, message: 'Price lowered.' };
  }
  const raise = p / c.price - 1;
  const cal = calendar(state.day);
  const renewal = cal.season === 'winter' || (cal.season === 'spring' && cal.dayOfSeason <= 7);
  if (p > c.R * 1.0001) {
    c.satisfaction = r1(clamp(c.satisfaction - 8, 0, 100));
    return { ok: false, message: 'They turned the raise down.' };
  }
  c.price = p;
  c.satisfaction = r1(clamp(c.satisfaction - (renewal ? 40 : 60) * raise, 0, 100));
  return { ok: true, message: 'Raise accepted.' };
}

export function changeService(state: GameState, clientId: Id, opts: { freq?: Frequency; addOns?: AddOn[] }): ActionResult {
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return { ok: false, message: 'Unknown client.' };
  if (c.commercial) return { ok: false, message: 'Contract terms are fixed.' };
  const freq: Frequency = opts.freq === 7 || opts.freq === 14 ? opts.freq : c.freq;
  const addOns = opts.addOns ? [...new Set(opts.addOns)].filter((a) => a === 'bagging' || a === 'stripes' || a === 'fertilizer') : c.addOns;
  const before = serviceMult(c.freq, c.addOns);
  const after = serviceMult(freq, addOns);
  const k = after / before;
  c.price = r2(c.price * k);
  c.R = r2(c.R * k);
  if (freq !== c.freq) {
    // Moving the next visit keeps the schedule sensible.
    if (c.lastServiceDay >= 0) c.nextDueDay = Math.max(state.day, c.lastServiceDay + freq);
  }
  c.freq = freq;
  c.addOns = addOns;
  if (addOns.includes('stripes')) c.wantsStripes = true;
  else c.wantsStripes = houseInfo(state, c.houseId).wantsStripes;
  return { ok: true, message: 'Service updated.' };
}

export function dropClient(state: GameState, clientId: Id): ActionResult {
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return { ok: false, message: 'Unknown client.' };
  const info = houseInfo(state, c.houseId);
  withRng(state, (rng) => removeClient(state, c, 'You ended the service', rng, false));
  return { ok: true, message: `${info.address} dropped.` };
}

export function askForYardSign(state: GameState, clientId: Id): ActionResult {
  const c = state.clients.find((x) => x.id === clientId);
  if (!c) return { ok: false, message: 'Unknown client.' };
  const h = hs(state, c.houseId);
  if (h.yardSign) return { ok: false, message: 'Sign already up.' };
  if (c.commercial) return { ok: false, message: 'Not on contract sites.' };
  if (state.flags[`ys:${c.id}`] === state.day) return { ok: false, message: 'Already asked today.' };
  if (c.satisfaction <= 70) {
    state.flags[`ys:${c.id}`] = state.day;
    return { ok: false, message: 'They are not ready to vouch for you yet.' };
  }
  const yes = withRng(state, (rng) => rng.chance(0.7));
  if (!yes) {
    state.flags[`ys:${c.id}`] = state.day;
    return { ok: false, message: 'They would rather not.' };
  }
  h.yardSign = true;
  return { ok: true, message: 'Yard sign is up.' };
}
