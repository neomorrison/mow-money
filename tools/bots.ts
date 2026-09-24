// Headless bot players that drive the real sim API (used by tools/balance.ts and tests).
import * as sim from '../src/sim/index';
import type { GameState, HouseView, PitchContext, PitchOutcome, Tone } from '../src/core/types';
import { makeRng, hashSeed, type Rng } from '../src/core/rng';
import { ARCHETYPE_BY_ID } from '../src/data/archetypes';
import { EQUIPMENT_BY_ID } from '../src/data/equipment';
import { HOOD_BY_ID, splitHoodKey } from '../src/data/hoods';

export interface BotProfile {
  name: 'novice' | 'solid' | 'expert';
  qMu: number;
  qSigma: number;
  knocks: number;
  offer: () => number;       // offer as a fraction of R
  toneSkill: number;         // chance to pick the best tone
  upgrades: boolean;
  hires: boolean;
  autopilot: boolean;
  bids: boolean;
  marketing: boolean;
  branches: boolean;
}

export function profile(name: BotProfile['name'], rng: Rng): BotProfile {
  if (name === 'novice') return { name, qMu: 70, qSigma: 8, knocks: 6, offer: () => rng.range(0.9, 1.2), toneSkill: 0.3, upgrades: true, hires: false, autopilot: false, bids: false, marketing: false, branches: false };
  if (name === 'solid') return { name, qMu: 84, qSigma: 6, knocks: 10, offer: () => rng.range(0.93, 1.02), toneSkill: 0.7, upgrades: true, hires: true, autopilot: true, bids: true, marketing: false, branches: false };
  return { name, qMu: 92, qSigma: 4, knocks: 12, offer: () => rng.range(0.97, 1.01), toneSkill: 1, upgrades: true, hires: true, autopilot: true, bids: true, marketing: true, branches: true };
}

export interface Milestones {
  gas: number | null; truck: number | null; hire: number | null; zeroTurn: number | null; bid: number | null;
  seasonClients: number[]; minCash: number; valuationAt: Record<number, number>; million: number | null;
}

/** Simplified negotiation (docs/DESIGN.md section 8) so bots do not depend on the pitch UI. */
export function botNegotiate(ctx: PitchContext, bot: BotProfile, rng: Rng): PitchOutcome {
  const arch = ARCHETYPE_BY_ID[ctx.house.archetypeId];
  let T = 0.35 + 0.10 * (ctx.reputation - 3) + ctx.warmTrust + 0.05 * Math.min(3, ctx.clientsOnStreet);
  if (ctx.perks.includes('silver_tongue')) T += 0.08;
  if (ctx.provider === 'rival') T -= 0.10;
  const tones: Tone[] = ['friendly', 'professional', 'direct', 'funny'];
  const best = tones.reduce((a, b) => ((arch?.tone[b] ?? 0) > (arch?.tone[a] ?? 0) ? b : a), 'professional' as Tone);
  const tone = rng.chance(bot.toneSkill) ? best : rng.pick(tones);
  T += 0.12 * (arch?.tone[tone] ?? 0);
  let V = ctx.house.V;
  if (ctx.grassIn > 5) V *= 1.1;
  else if (ctx.clientsOnStreet > 0) T += 0.08 * Math.min(3, ctx.clientsOnStreet);
  T = Math.max(0, Math.min(1, T));
  const R = V * (0.85 + 0.30 * T);
  let patience = ctx.house.patience + (ctx.perks.includes('closer') ? 1 : 0);
  let rounds = 0;
  let price = R * bot.offer();
  while (patience > 0) {
    rounds++;
    const r = price / R;
    const p = 1 / (1 + Math.exp((r - 1) / 0.035));
    if (rng.chance(p)) return { result: 'deal', price: Math.round(price * 100) / 100, freq: 7, addOns: [], R, trust: T, rounds, minutes: 5 + 2 * rounds, summary: '' };
    patience -= r > 1.4 ? 2 : 1;
    if (patience <= 0) break;
    const counter = R * (ctx.house.anchor + (0.97 - ctx.house.anchor) * (1 - Math.pow(0.55, rounds)));
    // Accept a decent counter, otherwise nudge the offer down.
    if (counter >= ctx.fairPrice * (bot.name === 'expert' ? 0.9 : 0.8) || rounds >= 2) {
      return { result: 'deal', price: Math.round(counter * 100) / 100, freq: 7, addOns: [], R, trust: T, rounds, minutes: 6 + 2 * rounds, summary: '' };
    }
    price = Math.max(counter, price * 0.95);
  }
  return { result: 'cold', rounds, minutes: 6 + 2 * rounds, summary: '' };
}

function mowerTier(state: GameState): number {
  const uid = state.owner.mowerUid;
  const it = state.items.find((i) => i.uid === uid);
  return it ? EQUIPMENT_BY_ID[it.specId].tier : 0;
}

function tryBuy(state: GameState, id: string, reserve: number): boolean {
  const s = EQUIPMENT_BY_ID[id];
  const entry = sim.shop(state).find((e) => e.spec.id === id);
  if (!entry || entry.reason) return false;
  if (state.cash - entry.price < reserve) return false;
  return sim.buy(state, id).ok && !!s;
}

function owns(state: GameState, id: string) { return state.items.some((i) => i.specId === id); }

function weeklyCosts(state: GameState): number {
  const wages = state.staff.filter((e) => !e.laidOff).reduce((s, e) => s + e.wage * 10 * 6, 0);
  const loans = state.loans.reduce((s, l) => s + l.weeklyPayment, 0);
  return wages + loans + (state.insured ? sim.insuranceWeekly(state) : 0);
}

function shopping(state: GameState, bot: BotProfile): void {
  const base = bot.name === 'novice' ? 250 : 120;
  const reserve = base + weeklyCosts(state) * 1.5;
  const cal = sim.calendar(state.day);
  if (cal.season === 'winter') return;
  if (mowerTier(state) < 1) tryBuy(state, 'push21', bot.name === 'novice' ? 150 : 20);
  if (!owns(state, 'trimmer') && !owns(state, 'protrimmer') && mowerTier(state) >= 1) tryBuy(state, 'trimmer', reserve);
  if (!owns(state, 'blower') && !owns(state, 'backpack') && owns(state, 'trimmer')) tryBuy(state, 'blower', reserve);
  if (bot.name === 'novice') {
    if (!state.items.some((i) => i.specId === 'pickup') && state.day > 20) tryBuy(state, 'pickup', reserve + 1500);
    if (owns(state, 'pickup') && mowerTier(state) < 3) tryBuy(state, 'walkbehind', reserve + 1000);
    return;
  }
  if (mowerTier(state) < 2 && owns(state, 'blower')) tryBuy(state, 'selfprop', reserve + 300);
  if (!owns(state, 'pickup') && !owns(state, 'pickup_trailer')) tryBuy(state, 'pickup', reserve);
  if (owns(state, 'pickup') && mowerTier(state) < 3) tryBuy(state, 'walkbehind', reserve);
  if (!owns(state, 'stripekit') && mowerTier(state) >= 2) tryBuy(state, 'stripekit', reserve + 500);
  if (!owns(state, 'pickup_trailer') && mowerTier(state) >= 3) tryBuy(state, 'pickup_trailer', reserve + 500);
  if (owns(state, 'pickup_trailer') && mowerTier(state) < 4) tryBuy(state, 'zt48', reserve);
  if (!owns(state, 'sharpener') && mowerTier(state) >= 3) tryBuy(state, 'sharpener', reserve + 1500);
  if (!owns(state, 'protrimmer') && mowerTier(state) >= 4) tryBuy(state, 'protrimmer', reserve + 1000);
  if (!owns(state, 'backpack') && mowerTier(state) >= 4) tryBuy(state, 'backpack', reserve + 1000);
  if (mowerTier(state) >= 4 && mowerTier(state) < 5) tryBuy(state, 'zt60', reserve + 6000);
  // Big iron for contracts.
  if (bot.name === 'expert' || state.cash > 60000) {
    if (!owns(state, 'widearea')) tryBuy(state, 'widearea', reserve + 8000);
    if (!owns(state, 'gangreel')) tryBuy(state, 'gangreel', reserve + 15000);
  }
  for (const it of state.items) {
    if (it.sharpness < 0.7 && EQUIPMENT_BY_ID[it.specId].category === 'mower' && state.cash > 50 && it.uid === state.owner.mowerUid) sim.sharpen(state, it.uid);
    if (it.condition < 0.75 && state.cash > reserve + 500) sim.repair(state, it.uid);
  }
}

function garage(state: GameState, cat: string) {
  return state.items.filter((i) => !i.crewId && EQUIPMENT_BY_ID[i.specId].category === cat
    && ![state.owner.mowerUid, state.owner.trimmerUid, state.owner.blowerUid, state.owner.vehicleUid].includes(i.uid))
    .sort((a, b) => EQUIPMENT_BY_ID[b.specId].tier - EQUIPMENT_BY_ID[a.specId].tier);
}

function equipCrew(state: GameState, crewId: string, reserve: number): void {
  const crew = state.crews.find((c) => c.id === crewId)!;
  const gear: Parameters<typeof sim.setCrewGear>[2] = {};
  if (!crew.vehicleUid) {
    let v = garage(state, 'vehicle').find((i) => i.specId !== 'bike');
    if (!v && tryBuy(state, 'pickup', reserve)) v = garage(state, 'vehicle').find((i) => i.specId === 'pickup');
    if (v) gear.vehicleUid = v.uid;
  }
  const vehUid = gear.vehicleUid ?? crew.vehicleUid;
  const vspec = vehUid ? EQUIPMENT_BY_ID[state.items.find((i) => i.uid === vehUid)!.specId] : null;
  if (!crew.mowerUid && vspec) {
    let m = garage(state, 'mower').find((i) => (EQUIPMENT_BY_ID[i.specId].transportSize ?? 1) <= (vspec.capacity ?? 1) && !['gangreel', 'widearea', 'reel'].includes(i.specId));
    if (!m) {
      for (const id of ['zt48', 'walkbehind', 'selfprop', 'push21']) {
        if ((EQUIPMENT_BY_ID[id].transportSize ?? 1) > (vspec.capacity ?? 1)) continue;
        if (tryBuy(state, id, reserve)) { m = garage(state, 'mower').find((i) => i.specId === id); if (m) break; }
      }
    }
    if (m) gear.mowerUid = m.uid;
  }
  if (!crew.trimmerUid) {
    let t = garage(state, 'trimmer').find((i) => i.specId !== 'shears');
    if (!t && tryBuy(state, 'trimmer', reserve)) t = garage(state, 'trimmer').find((i) => i.specId === 'trimmer');
    if (t) gear.trimmerUid = t.uid;
  }
  if (!crew.blowerUid) {
    let b = garage(state, 'blower').find((i) => i.specId !== 'broom');
    if (!b && tryBuy(state, 'blower', reserve)) b = garage(state, 'blower').find((i) => i.specId === 'blower');
    if (b) gear.blowerUid = b.uid;
  }
  if (Object.keys(gear).length) sim.setCrewGear(state, crewId, gear);
}

/** Give crews real equipment: a trailer rig and a zero-turn once the reputation allows it. */
function upgradeCrews(state: GameState, reserve: number): void {
  for (const crew of state.crews) {
    const mower = state.items.find((i) => i.uid === crew.mowerUid);
    const tier = mower ? EQUIPMENT_BY_ID[mower.specId].tier : -1;
    if (tier >= 4) continue;
    const zt = sim.shop(state).find((e) => e.spec.id === 'zt48');
    const rig = sim.shop(state).find((e) => e.spec.id === 'pickup_trailer');
    if (!zt || !rig || zt.reason || rig.reason) return;
    const veh = state.items.find((i) => i.uid === crew.vehicleUid);
    const needRig = !veh || (EQUIPMENT_BY_ID[veh.specId].capacity ?? 1) < 3;
    const cost = zt.price + (needRig ? rig.price : 0);
    if (state.cash - cost < reserve) return;
    const oldMower = crew.mowerUid;
    const oldVeh = crew.vehicleUid;
    sim.buy(state, 'zt48');
    const newM = garage(state, 'mower').find((i) => i.specId === 'zt48');
    let newV: string | undefined;
    if (needRig) { sim.buy(state, 'pickup_trailer'); newV = garage(state, 'vehicle').find((i) => i.specId === 'pickup_trailer')?.uid; }
    sim.setCrewGear(state, crew.id, { mowerUid: newM?.uid ?? oldMower, vehicleUid: newV ?? oldVeh });
    for (const uid of [oldMower, needRig ? oldVeh : null]) {
      const it = state.items.find((i) => i.uid === uid);
      if (it && !it.crewId && uid !== state.owner.mowerUid && uid !== state.owner.vehicleUid) sim.sell(state, it.uid);
    }
  }
}

function hireRole(state: GameState, roles: string[], minSkill = 40): string | null {
  const pick = () => state.candidates.filter((x) => roles.includes(x.role) && x.skill >= minSkill && !x.traits.includes('Unreliable'))
    .sort((a, b) => (b.skill + (b.role === 'lead' ? 10 : 0)) - (a.skill + (a.role === 'lead' ? 10 : 0)))[0];
  let c = pick();
  for (let i = 0; i < 3 && !c && state.cash > 1000; i++) { sim.postJobAd(state); c = pick(); }
  if (!c) return null;
  const res = sim.hire(state, c.id);
  if (!res.ok) return null;
  const e = state.staff[state.staff.length - 1];
  // Pay a little above market to keep morale.
  sim.setWage(state, e.id, Math.max(e.wage, sim.marketWage(e.role, e.skill) + 1));
  return e.id;
}

function staffing(state: GameState, bot: BotProfile, backlog: number): void {
  if (!bot.hires) return;
  const cal = sim.calendar(state.day);
  if (cal.season === 'winter') return;
  const reserve = 800 + weeklyCosts(state) * 2;
  // Fill crews that lost members.
  for (const crew of state.crews) {
    const members = crew.memberIds.length;
    if (members < 2 && state.cash > reserve + 300) {
      if (!state.insured) sim.setInsurance(state, true);
      const id = hireRole(state, members === 0 ? ['lead', 'operator'] : ['operator', 'lead']);
      if (id) sim.assignToCrew(state, id, crew.id);
    }
    equipCrew(state, crew.id, reserve);
  }
  upgradeCrews(state, reserve + 2000);
  // A new crew when the owner cannot keep up.
  const plans = sim.crewPlans(state).filter((p) => p.ready);
  const util = plans.length ? plans.reduce((s, p) => s + p.minutes / p.capacity, 0) / plans.length : 1;
  const allReady = sim.crewPlans(state).every((p) => p.ready);
  const need = !allReady ? false : state.crews.length === 0 ? backlog >= 3 && state.clients.length > 30 : backlog >= 3 && util > 0.75;
  const maxCrews = bot.name === 'expert' ? 12 : 6;
  if (need && state.crews.length < maxCrews && state.cash > reserve + 6500) {
    if (!state.insured) sim.setInsurance(state, true);
    const lead = hireRole(state, ['lead', 'operator']);
    if (lead) {
      const res = sim.createCrew(state);
      if (res.crewId) {
        sim.assignToCrew(state, lead, res.crewId);
        const op = hireRole(state, ['operator']);
        if (op) sim.assignToCrew(state, op, res.crewId);
        equipCrew(state, res.crewId, 200);
      }
    }
  }
  if (state.crews.length >= 2 && !state.staff.some((e) => e.role === 'office') && state.cash > reserve + 2000) hireRole(state, ['office']);
  if (state.crews.length >= 3 && !state.staff.some((e) => e.role === 'mechanic') && state.cash > reserve + 3000) hireRole(state, ['mechanic']);
  // Keep wages at market so morale holds (Mondays).
  if (cal.weekday === 0) {
    for (const e of state.staff) {
      const mw = sim.marketWage(e.role, e.skill);
      if (e.wage < mw) sim.setWage(state, e.id, mw + 1);
    }
  }
  if (bot.name === 'expert') {
    // Sales reps only where a neighborhood still has room to grow.
    const hv = sim.hoods(state).filter((h) => h.unlocked && !h.spec.bidOnly);
    const open = hv.filter((h) => h.clients < h.houses * 0.45).sort((a, b) => a.clients / a.houses - b.clients / b.houses);
    const reps = state.staff.filter((e) => e.role === 'sales');
    for (const r of reps) {
      const cur = hv.find((h) => h.key === r.assignedHood);
      if (!cur || cur.clients >= cur.houses * 0.45) {
        if (open.length) sim.assignSalesHood(state, r.id, open[0].key);
        else sim.fire(state, r.id);
      }
    }
    if (open.length && reps.length < Math.min(open.length, state.crews.length) && state.cash > reserve + 3000) {
      const id = hireRole(state, ['sales'], 45);
      if (id) sim.assignSalesHood(state, id, open[0].key);
    }
  }
}

function doOwnerJobs(state: GameState, bot: BotProfile, rng: Rng): number {
  let done = 0;
  for (let guard = 0; guard < 40; guard++) {
    const t = sim.jobsToday(state).filter((j) => !j.done && j.assignee === 'owner');
    if (!t.length) break;
    // Nearest first: same hood before others.
    t.sort((a, b) => (a.daysOverdue !== b.daysOverdue ? b.daysOverdue - a.daysOverdue : (a.hoodKey === state.owner.location ? -1 : 0) - (b.hoodKey === state.owner.location ? -1 : 0)));
    const job = t.find((j) => state.owner.minute + j.estMinutes <= sim.DAY_END);
    if (!job) break;
    if (bot.autopilot && job.canAutopilot) {
      const r = sim.autopilotJob(state, job.clientId);
      if ('error' in r) { if (r.error.includes('broke')) continue; break; }
      done++;
      continue;
    }
    const spec = sim.buildMowJob(state, job.clientId);
    if ('error' in spec) break;
    const q = Math.max(20, Math.min(100, rng.normal(bot.qMu, bot.qSigma)));
    const res = sim.debug.syntheticResult(spec, q);
    sim.completeManualJob(state, spec, res);
    done++;
  }
  return done;
}

function doKnocks(state: GameState, bot: BotProfile, rng: Rng): void {
  let knocks = 0;
  const hoods = sim.hoods(state).filter((h) => h.unlocked && !h.spec.bidOnly).sort((a, b) => a.travelMinutes - b.travelMinutes);
  for (const hv of hoods) {
    if (knocks >= bot.knocks) break;
    const houses: HouseView[] = sim.housesInHood(state, hv.key).filter((h) => h.canKnock);
    houses.sort((a, b) => Number(b.lead) - Number(a.lead) || Number(a.provider === 'rival') - Number(b.provider === 'rival'));
    for (const h of houses) {
      if (knocks >= bot.knocks) break;
      if (state.owner.minute < 480) state.owner.minute = 480;   // bots start knocking at 8:00
      if (state.owner.minute > sim.DAY_END - 30) return;
      const k = sim.knock(state, h.info.id);
      if (!k.ok) continue;
      knocks++;
      if (!k.answered || !k.context) continue;
      const out = botNegotiate(k.context, bot, rng);
      sim.applyPitchOutcome(state, h.info.id, out);
    }
  }
}

function doBids(state: GameState, bot: BotProfile, rng: Rng): void {
  if (!bot.bids || !state.insured || !state.crews.length) return;
  for (const b of sim.openBids(state)) {
    if (b.myBid !== undefined) continue;
    const f = bot.name === 'expert' ? rng.range(0.86, 0.95) : rng.range(0.9, 1.0);
    sim.placeBid(state, b.id, Math.round(b.fairPrice * f));
  }
}

function doMarketing(state: GameState, bot: BotProfile): void {
  if (!bot.marketing || state.cash < 3000) return;
  if (sim.calendar(state.day).weekday !== 0) return;
  for (const hv of sim.hoods(state)) {
    if (!hv.unlocked || hv.spec.bidOnly) continue;
    if (hv.clients < hv.houses * 0.5 && sim.marketingBoost(state, hv.key) < 0.2) sim.buyMarketing(state, 'flyers', hv.key);
  }
}

function doBranches(state: GameState, bot: BotProfile): void {
  if (!bot.branches) return;
  const next = sim.towns(state).find((t) => !t.unlocked);
  if (!next) return;
  // Only expand once the current towns are mostly served.
  const res = sim.hoods(state).filter((h) => h.unlocked && !h.spec.bidOnly);
  const share = res.reduce((s, h) => s + h.clients, 0) / Math.max(1, res.reduce((s, h) => s + h.houses, 0));
  if (share < 0.5) return;
  const reserve = 20000 + weeklyCosts(state) * 4;
  const managers = state.staff.filter((e) => e.role === 'manager').length;
  if (managers < state.towns.length && state.cash > next.spec.branchCost + reserve) hireRole(state, ['manager']);
  const again = sim.towns(state).find((t) => t.spec.id === next.spec.id)!;
  if (again.canOpen && state.cash > next.spec.branchCost + reserve) {
    sim.openBranch(state, next.spec.id);
    // Base a crew there.
    const res = sim.createCrew(state, `${next.spec.name} Crew`);
    if (res.crewId) sim.setCrewHome(state, res.crewId, `${next.spec.id}.maple`);
  }
}

export function runBot(name: BotProfile['name'], seed: number, days: number, onDay?: (s: GameState, day: number) => void): { state: GameState; m: Milestones } {
  const rng = makeRng(hashSeed(seed, name, 'bot'));
  const bot = profile(name, rng);
  const state = sim.newGame({ companyName: `${name} lawn`, color: '#3a3', seed });
  const m: Milestones = { gas: null, truck: null, hire: null, zeroTurn: null, bid: null, seasonClients: [], minCash: state.cash, valuationAt: {}, million: null };
  let backlog = 0;
  let busy = 0;
  for (let d = 0; d < days; d++) {
    const cal = sim.calendar(state.day);
    if (cal.season === 'winter' && bot.hires && cal.dayOfSeason === 1) sim.winterLayoff(state, true);
    // Perks.
    const order = ['silver_tongue', 'quick_feet', 'door_pro', 'autopilot_pro', 'straight_lines', 'read_the_room', 'closer', 'motivator', 'dispatcher', 'bulk_buyer', 'trainer', 'edge_master', 'negotiator'];
    while (state.owner.skillPoints > 0) {
      const p = order.find((id) => sim.unlockPerk(state, id).ok);
      if (!p) break;
    }
    shopping(state, bot);
    staffing(state, bot, backlog);
    if (state.crews.length) sim.autoDispatch(state);
    doBids(state, bot, rng);
    doMarketing(state, bot);
    doBranches(state, bot);
    if (cal.season !== 'winter') {
      doOwnerJobs(state, bot, rng);
      // A full day of mowing before any knocking counts as falling behind.
      if (cal.isWorkday && state.owner.minute - sim.DAY_START > 560) busy++;
      else if (cal.isWorkday) busy = 0;
      doKnocks(state, bot, rng);
      doOwnerJobs(state, bot, rng);
    }
    backlog = sim.jobsToday(state).filter((j) => !j.done && j.assignee === 'owner' && j.dueDay <= state.day).length + (busy >= 2 ? 3 : 0);
    if (onDay) onDay(state, d);
    const report = sim.endDay(state);
    if (report.seasonChanged) m.seasonClients.push(state.clients.length);
    // Milestones.
    const has = (pred: (id: string) => boolean) => state.items.some((i) => pred(i.specId));
    if (m.gas === null && has((id) => ['push21', 'selfprop', 'walkbehind'].includes(id) || !!EQUIPMENT_BY_ID[id].rideOn)) m.gas = d;
    if (m.truck === null && has((id) => EQUIPMENT_BY_ID[id].category === 'vehicle' && id !== 'bike')) m.truck = d;
    if (m.hire === null && state.staff.length > 0) m.hire = d;
    if (m.zeroTurn === null && has((id) => !!EQUIPMENT_BY_ID[id].zeroTurn)) m.zeroTurn = d;
    if (m.bid === null && Number(state.flags.bidsWon) > 0) m.bid = d;
    m.minCash = Math.min(m.minCash, state.cash);
    if ((d + 1) % 98 === 0) m.valuationAt[(d + 1) / 98] = sim.valuation(state).total;
    if (m.million === null && sim.valuation(state).total >= 1_000_000) m.million = d;
  }
  return { state, m };
}
