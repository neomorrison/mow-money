// Door to door: knocking and applying pitch outcomes (docs/DESIGN.md sections 7 and 8).
import type { ActionResult, Client, GameState, Id, KnockResult, PitchContext, PitchOutcome } from '../core/types';
import { clamp } from '../core/rng';
import { ARCHETYPE_BY_ID } from '../data/archetypes';
import { COLD_LINES, NOT_INTERESTED_DIY, NOT_INTERESTED_RIVAL, fill } from '../data/dialogue';
import { pickFresh } from '../data/pick';
import { HOOD_BY_ID } from '../data/hoods';
import { DAY_END, EVENING_START, KNOCK_EARLY, KNOCK_MORNING, KNOCK_OPEN, XP_DEAL } from './constants';
import { calendar } from './calendar';
import { hasLegacy, hasPerk, logDay, newId, r1, r2, withRng } from './util';
import { reputation } from './reputation';
import { fairPrice, serviceMult } from './pricing';
import {
  clientForHouse, clientsOnStreet, checkUnlocks, grassHeight, hs, houseHoodKey, houseInfo, isHoa, isLead, knockBlockReason,
  providerOf, rivalFor, travelMinutes, TUTORIAL_HOUSE,
} from './world';
import { ownerKit } from './kit';
import { addXp } from './owner';
import { checkAchievements } from './achievements';
import { checkGoals } from './goals';

export function knockMinutes(state: GameState): number {
  let m = hasPerk(state, 'door_pro') ? 2 : 4;
  if (hasLegacy(state, 'quick_knocks')) m -= 1;
  return Math.max(1, m);
}

export function answerChance(state: GameState, houseId: Id, minute: number): number {
  const info = houseInfo(state, houseId);
  const arch = ARCHETYPE_BY_ID[info.archetypeId];
  const cal = calendar(state.day);
  let p = minute >= EVENING_START ? arch?.home.evening ?? 0.5 : arch?.home.day ?? 0.5;
  if (cal.weekday >= 5) p = Math.min(0.95, p * 1.3);
  if (hasPerk(state, 'door_pro')) p = Math.min(0.97, p * 1.1);
  if (isLead(state, state.houses[houseId])) p = Math.max(p, 0.85);
  // Early birds: fewer people come to the door before 08:30, a few more by 09:00.
  if (minute < KNOCK_EARLY) p *= 0.6;
  else if (minute < KNOCK_MORNING) p *= 0.85;
  return clamp(p, 0, 0.97);
}

export function pitchContext(state: GameState, houseId: Id): PitchContext {
  const info = houseInfo(state, houseId);
  const s = state.houses[houseId];
  const grassIn = grassHeight(state, houseId);
  const hoa = isHoa(state, s);
  const kind = info.lot.kind;
  // Section 7 need multipliers that depend on today: overgrown and HOA pressure.
  let need = 1;
  if (grassIn > 5.5) need *= 1.12;
  if (hoa) need *= 1.2;
  const kit = ownerKit(state);
  const eco = kit.mowerSpec.id === 'reel' || (kit.mowerSpec.fuelGalPerHr ?? 0) === 0;
  const tutorial = houseId === TUTORIAL_HOUSE && (Number(state.flags.tutorial) || 0) === 1;
  return {
    house: { ...info, V: r2(info.V * need) },
    grassIn,
    reputation: reputation(state),
    fairPrice: fairPrice(info.lawnM2, 7, kind),
    clientsOnStreet: clientsOnStreet(state, info),
    warmTrust: isLead(state, s) ? s?.leadTrust ?? 0.15 : 0,
    provider: providerOf(state, info),
    rival: rivalFor(state, info),
    ecoEquipment: eco,
    hoa,
    perks: [...state.owner.perks],
    season: calendar(state.day).season,
    tutorial,
  };
}

/** Chance a homeowner who opens the door is not interested at all (never reaches the pitch). */
export function notInterestedChance(state: GameState, houseId: Id): number {
  const s = state.houses[houseId];
  if (isLead(state, s) || isHoa(state, s)) return 0.05;
  const info = houseInfo(state, houseId);
  const h = grassHeight(state, houseId);
  const rival = rivalFor(state, info);
  if (rival) return clamp(rival.priceIndex < 1 ? 0.4 : 0.55, 0, 0.9);
  return clamp(0.65 - 0.12 * (h - 3), 0.1, 0.7);
}

function advanceTutorialKnocks(state: GameState): void {
  if (Number(state.flags.tutorial) === 3 && state.stats.knocks >= 3) state.flags.tutorial = 4;
}

export function knock(state: GameState, houseId: Id): KnockResult {
  let info;
  try { info = houseInfo(state, houseId); } catch { return { ok: false, answered: false, minutes: 0, message: 'Unknown house.', context: null }; }
  const fail = (message: string): KnockResult => ({ ok: false, answered: false, minutes: 0, message, context: null });
  if (calendar(state.day).season === 'winter') return fail('Nobody hires a mower in winter.');
  const block = knockBlockReason(state, info);
  if (block) return fail(block);
  const hood = HOOD_BY_ID[info.hoodId];
  if (!hood) return fail('Unknown house.');
  const key = houseHoodKey(houseId);
  const o = state.owner;
  const travel = o.location === key ? 0 : travelMinutes(state, o.location, key);
  const arrive = o.minute + travel;
  const km = knockMinutes(state);
  const neighbor = houseId === TUTORIAL_HOUSE && (Number(state.flags.tutorial) || 0) === 1;
  if (arrive < KNOCK_OPEN && !neighbor) return fail('Too early. Doors open at 7:30 AM.');
  if (arrive + km > DAY_END) return fail(o.minute >= DAY_END - km ? 'Too late to knock.' : 'Not enough daylight.');
  o.minute = arrive + km;
  o.location = key;
  const s = hs(state, houseId);
  s.lastKnockDay = state.day;
  state.stats.knocks += 1;
  const p = neighbor ? 1 : answerChance(state, houseId, arrive);
  const answered = withRng(state, (rng) => rng.chance(p));
  advanceTutorialKnocks(state);
  checkAchievements(state);
  checkGoals(state);
  const minutes = travel + km;
  if (!answered) {
    return { ok: true, answered: false, minutes, message: 'No one answered.', context: null };
  }
  // Not everyone wants a mowing service. Tall lawns are the best prospects.
  if (!neighbor) {
    const pNo = notInterestedChance(state, houseId);
    const no = withRng(state, (rng) => {
      if (!rng.chance(pNo)) return null;
      const rival = rivalFor(state, info);
      const line = rival ? fill(pickFresh(rng, NOT_INTERESTED_RIVAL), { rival: rival.name }) : pickFresh(rng, NOT_INTERESTED_DIY);
      return `${info.ownerName}: "${line}"`;
    });
    if (no) {
      s.coldUntil = Math.max(s.coldUntil ?? 0, state.day + 3);
      return { ok: true, answered: false, minutes, message: no, context: null };
    }
  }
  return { ok: true, answered: true, minutes, message: `${info.ownerName} opened the door.`, context: pitchContext(state, houseId) };
}

/** Pick the stored R so that it is comparable with the per-visit price of the chosen service. */
function comparableR(price: number, R: number, mult: number): number {
  const a = Math.abs(Math.log(price / R));
  const b = Math.abs(Math.log(price / (R * mult)));
  return b < a ? R * mult : R;
}

export function applyPitchOutcome(state: GameState, houseId: Id, outcome: PitchOutcome): ActionResult & { client: Client | null } {
  let info;
  try { info = houseInfo(state, houseId); } catch { return { ok: false, message: 'Unknown house.', client: null }; }
  const o = state.owner;
  const mins = Math.max(0, Number.isFinite(outcome.minutes) ? outcome.minutes : 0);
  o.minute = Math.min(DAY_END, Math.round(o.minute + mins));
  const s = hs(state, houseId);
  if (outcome.result === 'deal' || outcome.result === 'trial') {
    if (clientForHouse(state, houseId)) return { ok: false, message: 'Already a client.', client: null };
    const price = r2(outcome.price && outcome.price > 0 ? outcome.price : fairPrice(info.lawnM2, outcome.freq ?? 7, info.lot.kind));
    const freq = outcome.freq === 14 ? 14 : 7;
    const addOns = (outcome.addOns ?? []).filter((a) => a === 'bagging' || a === 'stripes' || a === 'fertilizer');
    const warm = isLead(state, s) ? s.leadTrust ?? 0.15 : 0;
    const T = clamp(outcome.trust ?? (0.35 + 0.10 * (reputation(state) - 3) + warm), 0, 1);
    const mult = serviceMult(freq, addOns);
    const Rraw = outcome.R && outcome.R > 0 ? outcome.R : info.V * (0.85 + 0.30 * T) * mult;
    const R = r2(comparableR(price, Rraw, mult));
    const c: Client = {
      id: newId(state, 'c'), houseId, since: state.day, price, freq, addOns, R,
      satisfaction: r1(clamp(60 + 20 * T, 0, 100)), expectation: info.E, rapport: r2(clamp(0.15 + 0.45 * T, 0.1, 0.7)),
      wantsStripes: info.wantsStripes || addOns.includes('stripes'),
      lastServiceDay: -1, nextDueDay: state.day, lastQ: -1, bestManualQ: -1, visits: 0, totalPaid: 0, tips: 0, damages: 0,
      assignee: 'owner', trial: outcome.result === 'trial', status: 'active', history: [],
    };
    state.clients.push(c);
    s.provider = 'me';
    s.h = grassHeight(state, houseId);
    s.hDay = state.day;
    delete s.leadUntil;
    delete s.leadTrust;
    delete s.coldUntil;
    state.stats.deals += 1;
    addXp(state, XP_DEAL);
    if ((Number(state.flags.tutorial) || 0) === 1) state.flags.tutorial = 2;
    logDay(state, (l) => l.newClients.push({ address: info.address, price, by: outcome.result === 'trial' ? 'You (trial)' : 'You' }));
    checkUnlocks(state);
    checkAchievements(state);
    checkGoals(state);
    const msg = outcome.result === 'trial' ? `Trial booked with ${info.ownerName}.` : `${info.ownerName} signed at $${price.toFixed(2)}.`;
    return { ok: true, message: msg, client: c };
  }
  if (outcome.result === 'cold') {
    s.coldUntil = state.day + 5;
    return { ok: true, message: withRng(state, (rng) => pickFresh(rng, COLD_LINES)), client: null };
  }
  // Rejected or walked away: no second pitch today.
  s.coldUntil = Math.max(s.coldUntil ?? 0, state.day + 1);
  return { ok: true, message: outcome.result === 'left' ? 'You walked away.' : 'No deal.', client: null };
}
