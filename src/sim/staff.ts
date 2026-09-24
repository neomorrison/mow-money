// Staff: hiring board, wages, morale, quits, sales reps (docs/DESIGN.md section 14).
import type { ActionResult, Candidate, Client, Employee, GameState, Id, StaffRole } from '../core/types';
import type { Rng } from '../core/rng';
import { clamp } from '../core/rng';
import { LAST_NAMES, firstNameFor } from '../data/archetypes';
import { PORTRAIT_GENDER } from '../data/assets';
import { STAFF_PORTRAIT_KEYS } from '../data/assets';
import { HOOD_BY_ID, splitHoodKey } from '../data/hoods';
import { JOB_AD_COST, PAID_HOURS, SALES_COMMISSION, SALES_KNOCKS, SKILL_GROWTH, WAGE_TABLE } from './constants';
import { addLedger, hasPerk, newId, r1, r2, logDay, withRng } from './util';
import { reputation } from './reputation';
import { clientForHouse, grassHeight, hoodHouses, hs, isCold, providerOf } from './world';
import { calendar } from './calendar';
import { serviceMult } from './pricing';

export const ROLE_LABEL: Record<StaffRole, string> = {
  operator: 'Operator', lead: 'Crew Lead', sales: 'Sales Rep', mechanic: 'Mechanic', office: 'Office Manager', manager: 'Operations Manager',
};

export const TRAITS: { id: string; blurb: string }[] = [
  { id: 'Perfectionist', blurb: '+3 job quality, a little slower.' },
  { id: 'Speedy', blurb: 'Works 10% faster.' },
  { id: 'Chatty', blurb: 'Great at the door, slow on the job.' },
  { id: 'Unreliable', blurb: 'Misses more days.' },
  { id: 'Veteran', blurb: 'Years of experience.' },
  { id: 'Loyal', blurb: 'Morale holds steady.' },
  { id: 'Night Owl', blurb: 'Not a morning person.' },
];

export function marketWage(role: StaffRole, skill: number): number {
  const t = WAGE_TABLE[role] ?? WAGE_TABLE.operator;
  return Math.round((t.base + t.perSkill * clamp(skill, 0, 100)) * 100) / 100;
}

function makeCandidate(state: GameState, rng: Rng): Candidate {
  const role = rng.weighted<StaffRole>(['operator', 'lead', 'sales', 'mechanic', 'office', 'manager'],
    (r) => ({ operator: 38, lead: 22, sales: 16, mechanic: 9, office: 8, manager: 7 }[r]));
  let skill = role === 'manager' ? rng.range(45, 90) : role === 'lead' ? rng.range(35, 85) : rng.range(12, 75);
  const traits: string[] = [];
  const nTraits = rng.chance(0.6) ? (rng.chance(0.3) ? 2 : 1) : 0;
  const pool = TRAITS.map((t) => t.id);
  for (let i = 0; i < nTraits; i++) {
    const t = rng.pick(pool);
    if (!traits.includes(t)) traits.push(t);
  }
  if (traits.includes('Speedy') && traits.includes('Perfectionist')) traits.splice(traits.indexOf('Speedy'), 1);
  if (traits.includes('Veteran')) skill = Math.min(100, skill + 15);
  let speed = rng.range(0.85, 1.15);
  if (traits.includes('Speedy')) speed += 0.1;
  if (traits.includes('Perfectionist') || traits.includes('Chatty')) speed -= 0.05;
  let reliability = rng.range(0.9, 0.99);
  if (traits.includes('Unreliable')) reliability -= 0.12;
  const askWage = Math.round(marketWage(role, skill) * rng.range(0.95, 1.15) * 4) / 4;
  const portrait = rng.pick(STAFF_PORTRAIT_KEYS as readonly string[]);
  return {
    id: newId(state, 'k'),
    name: `${firstNameFor(PORTRAIT_GENDER[portrait], rng.pick)} ${rng.pick(LAST_NAMES)}`,
    portrait,
    role, wage: askWage, skill: Math.round(skill), speed: r2(clamp(speed, 0.8, 1.25)), reliability: r2(clamp(reliability, 0.7, 0.995)),
    traits, askWage,
  };
}

export function refreshCandidates(state: GameState, rng: Rng): void {
  const n = rng.int(4, 6);
  state.candidates = [];
  for (let i = 0; i < n; i++) state.candidates.push(makeCandidate(state, rng));
}

export function postJobAd(state: GameState): ActionResult {
  if (state.cash < JOB_AD_COST) return { ok: false, message: 'Not enough cash.' };
  addLedger(state, -JOB_AD_COST, 'other_out', 'Job posting');
  withRng(state, (rng) => refreshCandidates(state, rng));
  return { ok: true, message: 'New candidates on the board.' };
}

export function hire(state: GameState, candidateId: Id): ActionResult {
  const c = state.candidates.find((x) => x.id === candidateId);
  if (!c) return { ok: false, message: 'That candidate is gone.' };
  if (!state.insured) return { ok: false, message: 'Buy insurance before your first hire.' };
  if (state.cash < c.askWage * PAID_HOURS) return { ok: false, message: 'Not enough cash for the first day of wages.' };
  const e: Employee = {
    id: newId(state, 'e'), name: c.name, portrait: c.portrait, role: c.role, wage: c.askWage, skill: c.skill, speed: c.speed,
    reliability: c.reliability, morale: 68, traits: [...c.traits], hiredDay: state.day, jobs: 0, crewId: null,
  };
  state.staff.push(e);
  state.flags.hires = (Number(state.flags.hires) || 0) + 1;
  state.candidates = state.candidates.filter((x) => x.id !== candidateId);
  return { ok: true, message: `${e.name} hired as ${ROLE_LABEL[e.role].toLowerCase()}.` };
}

export function removeFromCrews(state: GameState, employeeId: Id): void {
  for (const crew of state.crews) crew.memberIds = crew.memberIds.filter((id) => id !== employeeId);
}

export function fire(state: GameState, employeeId: Id): ActionResult {
  const e = state.staff.find((x) => x.id === employeeId);
  if (!e) return { ok: false, message: 'Unknown employee.' };
  removeFromCrews(state, employeeId);
  state.staff = state.staff.filter((x) => x.id !== employeeId);
  // Others notice.
  for (const o of state.staff) o.morale = r1(clamp(o.morale - 2, 0, 100));
  return { ok: true, message: `${e.name} let go.` };
}

export function setWage(state: GameState, employeeId: Id, wage: number): ActionResult {
  const e = state.staff.find((x) => x.id === employeeId);
  if (!e) return { ok: false, message: 'Unknown employee.' };
  if (!Number.isFinite(wage) || wage < 7.25) return { ok: false, message: 'Minimum wage is $7.25.' };
  const w = Math.round(wage * 4) / 4;
  if (w > e.wage) {
    e.lastRaiseDay = state.day;
    e.morale = r1(clamp(e.morale + Math.min(10, (w - e.wage) * 2), 0, 100));
  } else if (w < e.wage) {
    e.morale = r1(clamp(e.morale - Math.min(25, (e.wage - w) * 4), 0, 100));
  }
  e.wage = w;
  return { ok: true, message: `Wage set to $${w.toFixed(2)} an hour.` };
}

export function assignSalesHood(state: GameState, employeeId: Id, key: string): ActionResult {
  const e = state.staff.find((x) => x.id === employeeId);
  if (!e) return { ok: false, message: 'Unknown employee.' };
  if (e.role !== 'sales') return { ok: false, message: 'Only sales reps knock doors.' };
  if (!state.hoods.includes(key)) return { ok: false, message: 'That neighborhood is locked.' };
  const hood = HOOD_BY_ID[splitHoodKey(key).hoodId];
  if (!hood || hood.bidOnly) return { ok: false, message: 'Contracts are won by bid.' };
  e.assignedHood = key;
  return { ok: true, message: `${e.name} now works ${hood.name}.` };
}

export function moraleTarget(state: GameState, e: Employee): number {
  const recentRaise = e.lastRaiseDay !== undefined && state.day - e.lastRaiseDay <= 14 ? 1 : 0;
  let t = 60 + 1.2 * (e.wage - marketWage(e.role, e.skill)) + 10 * recentRaise;
  if (hasPerk(state, 'motivator')) t += 10;
  if (e.traits.includes('Loyal')) t += 5;
  return clamp(t, 0, 100);
}

export function driftMorale(state: GameState): void {
  for (const e of state.staff) {
    if (e.laidOff) continue;
    const t = moraleTarget(state, e);
    const rate = e.traits.includes('Loyal') ? 0.05 : 0.10;
    e.morale = r1(clamp(e.morale + rate * (t - e.morale), 0, 100));
  }
}

export function weeklyQuits(state: GameState, rng: Rng): { name: string; event: string }[] {
  const out: { name: string; event: string }[] = [];
  for (const e of [...state.staff]) {
    if (e.laidOff) continue;
    const p = 0.25 / (1 + Math.exp((e.morale - 30) / 6));
    if (rng.chance(p)) {
      removeFromCrews(state, e.id);
      state.staff = state.staff.filter((x) => x !== e);
      out.push({ name: e.name, event: 'Quit.' });
      // An operations manager hires a replacement from the board.
      if (state.staff.some((m) => m.role === 'manager' && !m.laidOff)) {
        const rep = state.candidates.filter((c) => c.role === e.role).sort((a, b) => b.skill - a.skill)[0];
        if (rep) {
          const res = hire(state, rep.id);
          if (res.ok) {
            const hired = state.staff[state.staff.length - 1];
            if (e.crewId) {
              const crew = state.crews.find((c) => c.id === e.crewId);
              if (crew) { crew.memberIds.push(hired.id); hired.crewId = crew.id; }
            }
            if (e.assignedHood) hired.assignedHood = e.assignedHood;
            out.push({ name: hired.name, event: `Hired to replace ${e.name}.` });
          }
        }
      }
    }
  }
  return out;
}

export function payWages(state: GameState): number {
  let total = 0;
  for (const e of state.staff) {
    if (e.laidOff) continue;
    total += e.wage * PAID_HOURS;
  }
  if (total > 0) addLedger(state, -total, 'wages', `Wages, ${state.staff.filter((e) => !e.laidOff).length} staff`);
  return total;
}

/** Sales reps knock doors in their assigned neighborhoods. */
export function runSalesReps(state: GameState, rng: Rng): { newClients: Client[]; lines: { name: string; event: string }[] } {
  const out: Client[] = [];
  const lines: { name: string; event: string }[] = [];
  const cal = calendar(state.day);
  if (!cal.isWorkday || cal.season === 'winter' || state.weather.today === 'storm') return { newClients: out, lines };
  const rep = reputation(state);
  for (const e of state.staff) {
    if (e.role !== 'sales' || e.laidOff || !e.assignedHood) continue;
    if (rng.chance((1 - e.reliability) * 0.5)) { lines.push({ name: e.name, event: 'No-show today.' }); continue; }
    const key = e.assignedHood;
    const hood = HOOD_BY_ID[splitHoodKey(key).hoodId];
    if (!hood || hood.bidOnly || !state.hoods.includes(key)) continue;
    const houses = hoodHouses(state, key);
    const nonClients = houses.filter((h) => !clientForHouse(state, h.id));
    const remainingShare = nonClients.length / Math.max(1, houses.length);
    const eligible = nonClients.filter((h) => !h.noSoliciting && !isCold(state, state.houses[h.id]));
    const knocks = Math.min(SALES_KNOCKS, eligible.length);
    const chatty = e.traits.includes('Chatty') ? 1.2 : 1;
    let signed = 0;
    // Shuffle-pick without replacement.
    const pool = [...eligible];
    for (let k = 0; k < knocks && pool.length; k++) {
      const i = Math.floor(rng.next() * pool.length);
      const h = pool.splice(i, 1)[0];
      if (!rng.chance(hood.answerRate)) continue;
      const close = (0.08 + 0.22 * (e.skill / 100) * (rep / 5) * remainingShare) * chatty * (providerOf(state, h) === 'rival' ? 0.7 : 1);
      if (!rng.chance(close)) {
        const s = hs(state, h.id);
        s.coldUntil = state.day + 5;
        s.lastKnockDay = state.day;
        continue;
      }
      const T = clamp(0.35 + 0.10 * (rep - 3) + (providerOf(state, h) === 'rival' ? -0.1 : 0), 0, 1);
      const R = h.V * (0.85 + 0.30 * T);
      const price = r2(h.V * (0.88 + 0.20 * e.skill / 100) * rng.logNormal(0, 0.05));
      const c: Client = {
        id: newId(state, 'c'), houseId: h.id, since: state.day, price, freq: 7, addOns: [], R: r2(Math.max(R, price * 0.98)),
        satisfaction: r1(60 + 20 * T), expectation: h.E, wantsStripes: h.wantsStripes, lastServiceDay: -1, nextDueDay: state.day + 1,
        lastQ: -1, bestManualQ: -1, visits: 0, totalPaid: 0, tips: 0, damages: 0, assignee: 'owner', trial: false, status: 'active', history: [],
      };
      state.clients.push(c);
      const s = hs(state, h.id);
      s.provider = 'me';
      s.h = grassHeight(state, h.id);
      s.hDay = state.day;
      delete s.leadUntil; delete s.leadTrust;
      const commission = SALES_COMMISSION * price * (28 / c.freq) * serviceMult(7, []);
      addLedger(state, -commission, 'wages', `Commission, ${e.name}`);
      out.push(c);
      signed++;
      e.skill = Math.round(Math.min(100, e.skill + (100 - e.skill) * SKILL_GROWTH * 4 * (hasPerk(state, 'trainer') ? 2 : 1)) * 1000) / 1000;
      e.jobs += 1;
      logDay(state, (l) => l.newClients.push({ address: h.address, price, by: e.name }));
    }
    if (signed) lines.push({ name: e.name, event: `Signed ${signed} ${signed === 1 ? 'client' : 'clients'} in ${hood.name}.` });
  }
  return { newClients: out, lines };
}
