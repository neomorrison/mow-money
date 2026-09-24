// Crews: gear, dispatch planning and the daily crew run (docs/DESIGN.md sections 9 and 14).
import type { ActionResult, Client, Crew, CrewPlan, DayReport, EquipmentSpec, Employee, GameState, Id, OwnedItem } from '../core/types';
import type { Rng } from '../core/rng';
import { clamp } from '../core/rng';
import { EQUIPMENT_BY_ID } from '../data/equipment';
import { HOOD_BY_ID, TOWN_BY_ID, splitHoodKey } from '../data/hoods';
import { BLADE_WEAR_PER_1000, BREAKDOWN_FIXED, BREAKDOWN_PER_HOUR, CREW_CAPACITY, CREW_Q_BASE, CREW_Q_SKILL, SAME_HOOD_TRAVEL, SETUP_MINUTES, SKILL_GROWTH } from './constants';
import { addLedger, hasPerk, hasRole, itemByUid, newId, r1, r2 } from './util';
import { canCarry, effectiveStripe, workMinutes } from './kit';
import { grassHeight, houseHoodKey, houseInfo, travelMinutesWith } from './world';
import { applyService, isDue, simulatedJob, ticketFor, daysOverdue } from './jobs';
import { inOwnerKit, wearItem } from './shop';
import { calendar } from './calendar';

const CREW_COLORS = ['#e4572e', '#2e86ab', '#8fb339', '#f3a712', '#a23b72', '#3bb273', '#7768ae', '#e15554'];

export function crewById(state: GameState, id: Id): Crew | undefined {
  return state.crews.find((c) => c.id === id);
}

export function createCrew(state: GameState, name?: string): ActionResult & { crewId: Id | null } {
  if (state.crews.length >= 12) return { ok: false, message: 'Twelve crews is the limit.', crewId: null };
  const n = state.crews.length + 1;
  const crew: Crew = {
    id: newId(state, 'w'), name: (name && name.trim().slice(0, 24)) || `Crew ${n}`, color: CREW_COLORS[(n - 1) % CREW_COLORS.length],
    memberIds: [], vehicleUid: null, mowerUid: null, trimmerUid: null, blowerUid: null, homeHood: null,
  };
  state.crews.push(crew);
  return { ok: true, message: `${crew.name} created.`, crewId: crew.id };
}

export function disbandCrew(state: GameState, crewId: Id): ActionResult {
  const crew = crewById(state, crewId);
  if (!crew) return { ok: false, message: 'Unknown crew.' };
  for (const e of state.staff) if (e.crewId === crewId) e.crewId = null;
  for (const it of state.items) if (it.crewId === crewId) it.crewId = null;
  for (const c of state.clients) if (c.assignee === crewId) c.assignee = 'owner';
  state.crews = state.crews.filter((c) => c.id !== crewId);
  return { ok: true, message: `${crew.name} disbanded.` };
}

export function assignToCrew(state: GameState, employeeId: Id, crewId: Id | null): ActionResult {
  const e = state.staff.find((x) => x.id === employeeId);
  if (!e) return { ok: false, message: 'Unknown employee.' };
  if (crewId !== null && e.role !== 'operator' && e.role !== 'lead') return { ok: false, message: 'Only operators and crew leads mow.' };
  const target = crewId === null ? null : crewById(state, crewId);
  if (crewId !== null && !target) return { ok: false, message: 'Unknown crew.' };
  if (target && !target.memberIds.includes(e.id)) {
    const veh = EQUIPMENT_BY_ID[itemByUid(state, target.vehicleUid)?.specId ?? ''];
    const seats = veh?.seats ?? 4;
    if (target.memberIds.length >= Math.max(seats, 1)) return { ok: false, message: `The ${veh?.name ?? 'vehicle'} has no free seat.` };
  }
  for (const c of state.crews) c.memberIds = c.memberIds.filter((id) => id !== e.id);
  e.crewId = null;
  if (target) { target.memberIds.push(e.id); e.crewId = target.id; }
  return { ok: true, message: target ? `${e.name} joined ${target.name}.` : `${e.name} left the crew.` };
}

/** Best spare item of a category for the owner (not on a crew, not `except`, fits the rest of the kit). */
function ownerReplacement(state: GameState, cat: string, except: Id): OwnedItem | undefined {
  const o = state.owner;
  const mine = (uid: Id | null) => itemByUid(state, uid);
  return state.items
    .filter((i) => i.uid !== except && !i.crewId && EQUIPMENT_BY_ID[i.specId]?.category === cat && !inOwnerKit(state, i.uid))
    .filter((i) => {
      const s = EQUIPMENT_BY_ID[i.specId];
      if (cat === 'mower') { const v = EQUIPMENT_BY_ID[mine(o.vehicleUid)?.specId ?? 'bike']; return !v || canCarry(v, s); }
      if (cat === 'vehicle') { const m = EQUIPMENT_BY_ID[mine(o.mowerUid)?.specId ?? 'reel']; return !m || canCarry(s, m); }
      return true;
    })
    .sort((a, b) => (EQUIPMENT_BY_ID[b.specId]?.tier ?? 0) - (EQUIPMENT_BY_ID[a.specId]?.tier ?? 0))[0];
}

export function setCrewGear(state: GameState, crewId: Id, gear: { vehicleUid?: Id | null; mowerUid?: Id | null; trimmerUid?: Id | null; blowerUid?: Id | null }): ActionResult {
  const crew = crewById(state, crewId);
  if (!crew) return { ok: false, message: 'Unknown crew.' };
  const slots: [keyof typeof gear, 'vehicleUid' | 'mowerUid' | 'trimmerUid' | 'blowerUid', string][] = [
    ['vehicleUid', 'vehicleUid', 'vehicle'], ['mowerUid', 'mowerUid', 'mower'], ['trimmerUid', 'trimmerUid', 'trimmer'], ['blowerUid', 'blowerUid', 'blower'],
  ];
  // Validate first.
  for (const [k, , cat] of slots) {
    const uid = gear[k];
    if (uid === undefined || uid === null) continue;
    const it = itemByUid(state, uid);
    if (!it) return { ok: false, message: 'You do not own that item.' };
    const spec = EQUIPMENT_BY_ID[it.specId];
    if (spec?.category !== cat) return { ok: false, message: `That is not a ${cat}.` };
    if (inOwnerKit(state, uid) && !ownerReplacement(state, cat, uid)) {
      if (cat === 'mower' || cat === 'vehicle') return { ok: false, message: `The ${spec.name} is your only ${cat}. Buy another for yourself first.` };
    }
    if (it.crewId && it.crewId !== crewId) {
      const other = crewById(state, it.crewId);
      if (other) return { ok: false, message: `The ${spec.name} is with ${other.name}.` };
    }
  }
  for (const [k, field, cat] of slots) {
    const uid = gear[k];
    if (uid === undefined) continue;
    // Taking something out of the owner's kit: the owner falls back to the best spare.
    if (uid && inOwnerKit(state, uid)) {
      const rep = ownerReplacement(state, cat, uid);
      const slot = (cat + 'Uid') as 'mowerUid' | 'trimmerUid' | 'blowerUid' | 'vehicleUid';
      state.owner[slot] = rep ? rep.uid : null;
    }
    const old = itemByUid(state, crew[field]);
    if (old && old.crewId === crewId) old.crewId = null;
    crew[field] = uid;
    const it = itemByUid(state, uid);
    if (it) it.crewId = crewId;
  }
  const v = EQUIPMENT_BY_ID[itemByUid(state, crew.vehicleUid)?.specId ?? ''];
  const m = EQUIPMENT_BY_ID[itemByUid(state, crew.mowerUid)?.specId ?? ''];
  if (v && m && !canCarry(v, m)) return { ok: true, message: `Gear set. The ${v.name} cannot carry the ${m.name}.` };
  return { ok: true, message: 'Gear set.' };
}

export function setCrewHome(state: GameState, crewId: Id, key: string | null): ActionResult {
  const crew = crewById(state, crewId);
  if (!crew) return { ok: false, message: 'Unknown crew.' };
  if (key !== null && !state.hoods.includes(key)) return { ok: false, message: 'That neighborhood is locked.' };
  crew.homeHood = key;
  const hood = key ? HOOD_BY_ID[splitHoodKey(key).hoodId] : null;
  return { ok: true, message: hood ? `${crew.name} is based in ${hood.name}.` : `${crew.name} works anywhere.` };
}

// ---------------------------------------------------------------- planning
export interface CrewGear { vehicle: EquipmentSpec | null; mower: EquipmentSpec | null; trimmer: EquipmentSpec | null; blower: EquipmentSpec | null }
export function crewGear(state: GameState, crew: Crew): CrewGear {
  const g = (uid: Id | null) => { const it = itemByUid(state, uid); return it ? EQUIPMENT_BY_ID[it.specId] ?? null : null; };
  return { vehicle: g(crew.vehicleUid), mower: g(crew.mowerUid), trimmer: g(crew.trimmerUid), blower: g(crew.blowerUid) };
}

export function crewMembers(state: GameState, crew: Crew): Employee[] {
  return crew.memberIds.map((id) => state.staff.find((e) => e.id === id)).filter((e): e is Employee => !!e && !e.laidOff);
}

function crewTown(crew: Crew): string {
  return crew.homeHood ? splitHoodKey(crew.homeHood).townId : 'home';
}
function crewBase(crew: Crew): string {
  const t = crewTown(crew);
  return t === 'home' ? 'hq' : `${t}.maple`;
}

export function crewProblem(state: GameState, crew: Crew, members = crewMembers(state, crew)): string {
  const g = crewGear(state, crew);
  if (!members.length) return 'Needs at least one member.';
  if (!g.mower) return 'Needs a mower.';
  if (!g.vehicle) return 'Needs a vehicle.';
  if (!canCarry(g.vehicle, g.mower)) return `The ${g.vehicle.name} cannot carry the ${g.mower.name}.`;
  const mowerItem = itemByUid(state, crew.mowerUid);
  if (mowerItem?.broken) return 'The mower is broken.';
  const town = crewTown(crew);
  if (town !== 'home') {
    const managers = state.staff.filter((e) => e.role === 'manager' && !e.laidOff).length;
    if (managers < state.towns.length - 1) return `Needs an operations manager in ${TOWN_BY_ID[town]?.name ?? town}.`;
  }
  return '';
}

interface PlannedJob { client: Client; minutes: number; travel: number; hood: string }
export interface CrewRoute { jobs: PlannedJob[]; minutes: number; skipped: Client[] }

function crewJobMinutes(state: GameState, c: Client, g: CrewGear, members: Employee[]): number {
  const info = houseInfo(state, c.houseId);
  const speed = members.length ? members.reduce((s, e) => s + e.speed, 0) / members.length : 1;
  const wet = state.weather.today === 'rain';
  const t = workMinutes({
    lawnM2: info.lawnM2, hardscapeM2: info.hardscapeM2, grassIn: grassHeight(state, c.houseId),
    mower: g.mower!, trimmer: g.trimmer, blower: g.blower, speedMult: speed, wet, crewSize: members.length,
  });
  return SETUP_MINUTES + t.total;
}

function sortJobs(state: GameState, list: Client[], homeHood: string | null): Client[] {
  const bucket = (c: Client) => (daysOverdue(state, c) > 0 ? 0 : c.nextDueDay <= state.day ? 1 : 2);
  return [...list].sort((a, b) => {
    const d = bucket(a) - bucket(b);
    if (d) return d;
    const ha = houseHoodKey(a.houseId);
    const hb = houseHoodKey(b.houseId);
    if (ha !== hb) {
      if (ha === homeHood) return -1;
      if (hb === homeHood) return 1;
      return ha < hb ? -1 : 1;
    }
    return a.nextDueDay - b.nextDueDay || (a.id < b.id ? -1 : 1);
  });
}

/** Route a crew through candidate jobs within capacity. */
export function routeCrew(state: GameState, crew: Crew, candidates: Client[], members = crewMembers(state, crew), capacity = CREW_CAPACITY): CrewRoute {
  const g = crewGear(state, crew);
  const out: CrewRoute = { jobs: [], minutes: 0, skipped: [] };
  if (!g.mower || !g.vehicle || !members.length) return { ...out, skipped: [...candidates] };
  const speed = g.vehicle.travelSpeedKmh ?? 40;
  const disp = hasPerk(state, 'dispatcher');
  const base = crewBase(crew);
  let loc = base;
  let used = 0;
  for (const c of sortJobs(state, candidates, crew.homeHood)) {
    const hood = houseHoodKey(c.houseId);
    const travel = loc === hood ? SAME_HOOD_TRAVEL : travelMinutesWith(speed, loc, hood, disp);
    const work = crewJobMinutes(state, c, g, members);
    const back = travelMinutesWith(speed, hood, base, disp);
    if (used + travel + work + back > capacity) { out.skipped.push(c); continue; }
    used += travel + work;
    loc = hood;
    out.jobs.push({ client: c, minutes: work, travel, hood });
  }
  out.minutes = Math.round(used + (loc === base ? 0 : travelMinutesWith(speed, loc, base, disp)));
  return out;
}

function crewCandidates(state: GameState, crew: Crew): Client[] {
  return state.clients.filter((c) => c.assignee === crew.id && isDue(state, c));
}

/** Why a ready crew will not go out today (storm, Sunday), or '' when it works tonight. */
export function crewDayOff(state: GameState): string {
  const cal = calendar(state.day);
  if (cal.season === 'winter') return '';
  if (!cal.isWorkday) return 'Sunday: crews are off. Their jobs wait for Monday.';
  if (state.weather.today === 'storm') return 'Storm: crews stay home today. Their jobs move to tomorrow with no late penalty, and crews get half pay.';
  return '';
}

export function crewPlans(state: GameState): CrewPlan[] {
  const winter = calendar(state.day).season === 'winter';
  const off = crewDayOff(state);
  return state.crews.map((crew) => {
    const problem = winter ? 'Off for winter.' : crewProblem(state, crew);
    const cands = winter ? [] : crewCandidates(state, crew);
    const route = problem ? { jobs: [], minutes: 0, skipped: cands } : routeCrew(state, crew, cands);
    return {
      crewId: crew.id, jobs: route.jobs.map((j) => ticketFor(state, j.client)), minutes: route.minutes, capacity: CREW_CAPACITY,
      ready: problem === '', problem: problem || (route.skipped.length ? `${route.skipped.length} ${route.skipped.length === 1 ? 'job does' : 'jobs do'} not fit today.` : ''),
      note: problem ? undefined : off || (route.jobs.length ? 'Mows this route when you end the day.' : undefined),
    };
  });
}

/**
 * Morning check: jobs assigned to a crew that is gone or cannot work, and overdue jobs that do not fit in
 * their crew's day, come back to the owner (or the office manager's dispatch) instead of rotting.
 */
export function reclaimJobs(state: GameState): number {
  if (calendar(state.day).season === 'winter') return 0;
  let n = 0;
  for (const crew of state.crews) {
    const problem = crewProblem(state, crew);
    const cands = crewCandidates(state, crew);
    const skipped = problem ? cands : routeCrew(state, crew, cands).skipped;
    for (const c of skipped) {
      if (problem || daysOverdue(state, c) >= 1) { c.assignee = 'owner'; n++; }
    }
  }
  for (const c of state.clients) {
    if (c.assignee !== 'owner' && !state.crews.some((cr) => cr.id === c.assignee)) { c.assignee = 'owner'; n++; }
  }
  return n;
}

export function autoDispatch(state: GameState): ActionResult {
  if (calendar(state.day).season === 'winter') return { ok: true, message: 'Nothing to dispatch in winter.' };
  reclaimJobs(state);
  const ready = state.crews.filter((c) => crewProblem(state, c) === '');
  if (!ready.length) return { ok: false, message: 'No crew is ready. A crew needs a member, a mower and a vehicle that can carry it.' };
  const readyIds = new Set(ready.map((c) => c.id));
  // Jobs for the owner or for crews that cannot work are up for grabs.
  const pool = state.clients.filter((c) => isDue(state, c) && (c.assignee === 'owner' || !readyIds.has(c.assignee)));
  let moved = 0;
  // Existing routes.
  const loads = new Map<string, Client[]>();
  for (const crew of ready) loads.set(crew.id, routeCrew(state, crew, crewCandidates(state, crew)).jobs.map((j) => j.client));
  for (const c of sortJobs(state, pool, null)) {
    const hood = houseHoodKey(c.houseId);
    const town = splitHoodKey(hood).townId;
    const options = ready.filter((cr) => crewTown(cr) === town || (town === 'home' && !cr.homeHood));
    options.sort((a, b) => {
      const ah = a.homeHood === hood ? 0 : 1;
      const bh = b.homeHood === hood ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return (loads.get(a.id)?.length ?? 0) - (loads.get(b.id)?.length ?? 0);
    });
    for (const crew of options) {
      const current = loads.get(crew.id) ?? [];
      const trial = routeCrew(state, crew, [...current, c]);
      if (trial.jobs.some((j) => j.client === c)) {
        loads.set(crew.id, trial.jobs.map((j) => j.client));
        c.assignee = crew.id;
        moved++;
        break;
      }
    }
  }
  const off = crewDayOff(state);
  const later = off ? ' They start on the next working day.' : ' They mow them when you end the day.';
  if (moved) return { ok: true, message: `${moved} ${moved === 1 ? 'job' : 'jobs'} handed to your crews.${later}` };
  const withCrews = state.clients.filter((c) => isDue(state, c) && c.assignee !== 'owner').length;
  const leftMine = state.clients.filter((c) => isDue(state, c) && c.assignee === 'owner').length;
  if (leftMine) return { ok: true, message: `No room left in your crews' day for your ${leftMine} remaining ${leftMine === 1 ? 'job' : 'jobs'}.` };
  if (withCrews) return { ok: true, message: `Your crews already have every due job (${withCrews}).${later}` };
  return { ok: true, message: 'No jobs due right now.' };
}

// ---------------------------------------------------------------- daily run
export function crewQualityParams(state: GameState, crew: Crew, members: Employee[], g: CrewGear): { mu: number; sigma: number } {
  let wsum = 0;
  let skill = 0;
  for (const e of members) { const w = e.role === 'lead' ? 2 : 1; wsum += w; skill += w * e.skill; }
  skill = wsum ? skill / wsum : 0;
  const morale = members.length ? members.reduce((s, e) => s + e.morale, 0) / members.length : 50;
  const moraleFactor = 0.85 + 0.15 * morale / 100;
  const cap = g.mower?.qualityCap ?? 85;
  let mu = CREW_Q_BASE + CREW_Q_SKILL * (skill / 100) * moraleFactor;
  if (members.some((e) => e.role === 'lead')) mu += 4;
  if (members.some((e) => e.traits.includes('Perfectionist'))) mu += 3;
  mu = Math.min(cap, mu);
  if (!g.trimmer) mu -= 8;
  if (!g.blower) mu -= 4;
  const sigma = 12 - 8 * skill / 100;
  return { mu, sigma };
}

export interface CrewDayResult {
  jobs: DayReport['jobs'];
  missed: DayReport['missed'];
  staff: DayReport['staff'];
  revenue: number;
}

export function runCrews(state: GameState, rng: Rng): CrewDayResult {
  const res: CrewDayResult = { jobs: [], missed: [], staff: [], revenue: 0 };
  const cal = calendar(state.day);
  if (!cal.isWorkday || cal.season === 'winter') return res;
  const storm = state.weather.today === 'storm';
  for (const crew of state.crews) {
    const all = crewMembers(state, crew);
    const cands = crewCandidates(state, crew);
    const mustDo = (c: Client) => c.nextDueDay <= state.day;
    const problem = crewProblem(state, crew, all);
    if (problem) {
      for (const c of cands) if (mustDo(c)) res.missed.push({ clientId: c.id, address: houseInfo(state, c.houseId).address, reason: `${crew.name}: ${problem}` });
      continue;
    }
    if (storm) {
      for (const c of cands) if (mustDo(c)) res.missed.push({ clientId: c.id, address: houseInfo(state, c.houseId).address, reason: 'Storm' });
      continue;
    }
    const present: Employee[] = [];
    for (const e of all) {
      // unhappy people call in sick more
      const p = (1 - e.reliability) * 0.5 * (e.traits.includes('Night Owl') && cal.weekday === 0 ? 1.5 : 1) * (1 + Math.max(0, 50 - e.morale) / 25);
      if (rng.chance(p)) res.staff.push({ name: e.name, event: 'No-show today.' });
      else present.push(e);
    }
    if (!present.length) {
      for (const c of cands) if (mustDo(c)) res.missed.push({ clientId: c.id, address: houseInfo(state, c.houseId).address, reason: `${crew.name}: no-show` });
      continue;
    }
    const route = routeCrew(state, crew, cands, present);
    for (const c of route.skipped) if (mustDo(c)) res.missed.push({ clientId: c.id, address: houseInfo(state, c.houseId).address, reason: `${crew.name} ran out of time` });
    const g = crewGear(state, crew);
    const mowerItem = itemByUid(state, crew.mowerUid);
    const vehItem = itemByUid(state, crew.vehicleUid);
    const { mu: baseMu, sigma } = crewQualityParams(state, crew, present, g);
    const stripe = effectiveStripe(state, g.mower!);
    const mech = hasRole(state, 'mechanic') ? 0.4 : 1;
    let paidTotal = 0;
    let tipTotal = 0;
    let fuelGal = 0;
    let travelMin = 0;
    let done = 0;
    let broke = false;
    let lost = 0;       // minutes lost to a breakdown
    let used = 0;
    for (let i = 0; i < route.jobs.length; i++) {
      const j = route.jobs[i];
      const c = j.client;
      const info = houseInfo(state, c.houseId);
      if (used + j.travel + j.minutes + lost > CREW_CAPACITY) { res.missed.push({ clientId: c.id, address: info.address, reason: `${crew.name}: out of time after a breakdown` }); continue; }
      used += j.travel + j.minutes;
      // Breakdowns scale with engine hours; the crew fixes it on site, loses an hour and this job, then carries on.
      const pBreak = BREAKDOWN_PER_HOUR * (1 - (g.mower!.reliability ?? 0.95)) * (1.5 - (mowerItem?.condition ?? 1)) * mech * (j.minutes / 60);
      if (!broke && rng.chance(pBreak)) {
        broke = true;
        lost += 60;
        const cost = Math.round(0.08 * Math.max(g.mower!.price, 150) * (1.2 - (mowerItem?.condition ?? 1)));
        addLedger(state, -cost, 'repair', `Breakdown repair, ${crew.name}`);
        if (mowerItem) mowerItem.condition = Math.max(mowerItem.condition, BREAKDOWN_FIXED);
        res.staff.push({ name: crew.name, event: `${g.mower!.name} broke down. Fixed on site for $${cost}, lost an hour.` });
        res.missed.push({ clientId: c.id, address: info.address, reason: `${crew.name}: mower broke down` });
        continue;
      }
      let mu = baseMu - 10 * (1 - (mowerItem?.sharpness ?? 1));
      // Stripes are a bonus (section 9): crews lay roughly what their mower allows.
      mu += (c.wantsStripes || c.addOns.includes('stripes') ? 5 : 3) * stripe;
      const sim = simulatedJob(state, rng, c, mu, sigma, g.mower!);
      const skillAvg = present.reduce((s, e) => s + e.skill, 0) / present.length;
      const damage = rng.chance(0.04 * (1 - skillAvg / 100)) ? 1 : 0;
      if (damage) {
        const cost = state.insured ? 60 : 90;
        addLedger(state, -cost, 'damage', `Damage, ${info.address}`);
      }
      const svc = applyService(state, rng, c, sim.q, { by: crew.name, damages: damage, cutHeight: sim.cut, coverage: 0.97, manual: false, ledger: false });
      paidTotal += svc.paid;
      tipTotal += svc.tip;
      res.jobs.push({ clientId: c.id, address: info.address, by: crew.name, q: sim.q, paid: r2(svc.paid + svc.tip) });
      const mowH = j.minutes / 60;
      fuelGal += (g.mower!.fuelGalPerHr ?? 0) * mowH + ((g.trimmer?.fuelGalPerHr ?? 0) + (g.blower?.fuelGalPerHr ?? 0)) * mowH * 0.5;
      travelMin += j.travel;
      wearItem(mowerItem, mowH, BLADE_WEAR_PER_1000 * (g.mower!.wearMult ?? 1) * info.lawnM2 / 1000);
      wearItem(itemByUid(state, crew.trimmerUid), mowH * 0.4, 0);
      wearItem(itemByUid(state, crew.blowerUid), mowH * 0.2, 0);
      done++;
      for (const e of present) {
        e.jobs += 1;
        e.skill = Math.round(Math.min(100, e.skill + (100 - e.skill) * SKILL_GROWTH * (hasPerk(state, 'trainer') ? 2 : 1)) * 1000) / 1000;
      }
    }
    wearItem(vehItem, travelMin / 60, 0);
    fuelGal += (g.vehicle!.fuelGalPerHr ?? 0) * (travelMin / 60);
    if (paidTotal > 0) addLedger(state, paidTotal, 'job', `${crew.name}: ${done} ${done === 1 ? 'job' : 'jobs'}`);
    if (tipTotal > 0) addLedger(state, tipTotal, 'tip', `${crew.name}: tips`);
    const fuel = fuelGal * state.weather.fuelPrice * (hasRole(state, 'manager') ? 0.95 : 1);
    if (fuel > 0) addLedger(state, -fuel, 'fuel', `Fuel, ${crew.name}`);
    res.revenue += paidTotal + tipTotal;
    if (done) state.flags.crewJobs = (Number(state.flags.crewJobs) || 0) + done;
  }
  res.revenue = r2(res.revenue);
  return res;
}

export function overnightMaintenance(state: GameState): string[] {
  const out: string[] = [];
  const mech = hasRole(state, 'mechanic');
  const station = state.items.some((i) => i.specId === 'sharpener');
  if (!mech && !station) return out;
  let sharpened = 0;
  for (const it of state.items) {
    const s = EQUIPMENT_BY_ID[it.specId];
    if (s?.category === 'mower' && it.sharpness < 0.999) { it.sharpness = 1; sharpened++; }
    if (mech) {
      if (it.broken) { it.broken = false; out.push(`Mechanic fixed the ${s?.name ?? 'equipment'}.`); }
      it.condition = Math.min(1, Math.round((it.condition + 0.02) * 1000) / 1000);
    }
  }
  void clamp;
  return out;
}
