// Market: rivals, bids, marketing and leads (docs/DESIGN.md sections 11 and 15).
import type { ActionResult, Bid, Client, GameState, HouseInfo, Id, Rival } from '../core/types';
import type { Rng } from '../core/rng';
import { clamp } from '../core/rng';
import { HOODS, HOOD_BY_ID, TOWNS, TOWN_BY_ID, hoodKey, splitHoodKey } from '../data/hoods';
import { LEAD_DAYS, LEAD_TRUST, MARKETING, MARKETING_DAYS, REFERRAL_TRUST, XP_BID } from './constants';
import { addLedger, newId, r2, logDay } from './util';
import { reputation, starsFor } from './reputation';
import { fairPrice } from './pricing';
import { lovesMowing } from './knock';
import { calendar } from './calendar';
import { clientForHouse, hoodHouses, houseInfo, hs, isCold, isLead, providerOf, siteName, grassHeight, houseHoodKey } from './world';
import { addXp } from './owner';

// ---------------------------------------------------------------- rivals
const RIVAL_NAMES: Record<string, [string, string]> = {
  home: ['Cheap Cuts Lawn Co.', 'Evergreen Elite'],
  riverside: ['River Rat Mowing', 'Prestige Turf'],
  cedar: ['Budget Blades', 'Cedar Crown Landscapes'],
  summit: ['Mow Cheaper', 'Summit Grounds Group'],
};
export function makeRivals(townId: string): Rival[] {
  const [a, b] = RIVAL_NAMES[townId] ?? ['Budget Lawn Co.', 'Premier Grounds'];
  return [
    { id: `${townId}-budget`, name: a, priceIndex: 0.85, quality: 68, color: '#c9793a' },
    { id: `${townId}-premium`, name: b, priceIndex: 1.15, quality: 86, color: '#3a6fc9' },
  ];
}

// ---------------------------------------------------------------- marketing
export function marketingBoost(state: GameState, key: string): number {
  const { townId } = splitHoodKey(key);
  let spend = 0;
  for (const m of state.marketing) {
    if (m.endDay < state.day || m.startDay > state.day) continue;
    if (m.townId !== townId) continue;
    if (m.hoodId === null) spend += m.spend * 0.5;
    else if (hoodKey(m.townId, m.hoodId) === key) spend += m.spend;
  }
  return 0.6 * Math.log(1 + spend / 200);
}

export function buyMarketing(state: GameState, kind: 'flyers' | 'hangers' | 'newspaper', key: string | null): ActionResult {
  const m = MARKETING[kind];
  if (!m) return { ok: false, message: 'Unknown campaign.' };
  let townId = 'home';
  let hoodId: string | null = null;
  if (key) {
    const s = splitHoodKey(key);
    townId = s.townId;
    hoodId = kind === 'newspaper' ? null : s.hoodId;
    if (!state.hoods.includes(key)) return { ok: false, message: 'That neighborhood is locked.' };
    if (hoodId && HOOD_BY_ID[hoodId]?.bidOnly) return { ok: false, message: 'Contracts are won by bid.' };
  } else if (kind !== 'newspaper') {
    return { ok: false, message: 'Pick a neighborhood.' };
  }
  if (state.cash < m.cost) return { ok: false, message: 'Not enough cash.' };
  addLedger(state, -m.cost, 'marketing', `${m.label}${hoodId ? `, ${HOOD_BY_ID[hoodId]?.name}` : `, ${TOWN_BY_ID[townId]?.name}`}`);
  state.marketing.push({ id: newId(state, 'm'), kind, townId, hoodId, spend: m.cost, startDay: state.day, endDay: state.day + MARKETING_DAYS - 1 });
  return { ok: true, message: `${m.label} running for ${MARKETING_DAYS} days.` };
}

// ---------------------------------------------------------------- leads
function leadCandidates(state: GameState, key: string): HouseInfo[] {
  return hoodHouses(state, key).filter((h) => {
    if (clientForHouse(state, h.id)) return false;
    const s = state.houses[h.id];
    // people who love mowing their own lawn never call a lawn company
    if (providerOf(state, h) !== 'rival' && lovesMowing(h.propertySeed)) return false;
    return !isLead(state, s) && !isCold(state, s);
  });
}

export function makeLead(state: GameState, houseId: Id, trust: number, days = LEAD_DAYS): void {
  const s = hs(state, houseId);
  s.leadUntil = state.day + days;
  s.leadTrust = Math.max(s.leadTrust && isLead(state, s) ? s.leadTrust : 0, trust);
}

/** Organic plus marketing leads for one day. Returns the addresses of new leads. */
export function rollLeads(state: GameState, rng: Rng): string[] {
  const rep = reputation(state);
  const out: string[] = [];
  for (const key of state.hoods) {
    const hood = HOOD_BY_ID[splitHoodKey(key).hoodId];
    if (!hood || hood.bidOnly) continue;
    let signs = 0;
    for (const c of state.clients) if (houseHoodKey(c.houseId) === key && state.houses[c.houseId]?.yardSign) signs++;
    const lambda = hood.baseLeads * (0.5 + rep / 5) * (1 + marketingBoost(state, key)) + 0.05 * signs;
    const n = rng.poisson(lambda);
    for (let i = 0; i < n; i++) {
      const pool = leadCandidates(state, key);
      if (!pool.length) break;
      const h = rng.pick(pool);
      makeLead(state, h.id, LEAD_TRUST);
      out.push(h.address);
    }
  }
  return out;
}

/** Weekly referrals from happy clients. */
export function rollReferrals(state: GameState, rng: Rng): { address: string; from: string }[] {
  const out: { address: string; from: string }[] = [];
  for (const c of [...state.clients]) {
    if (c.commercial) continue;
    const sign = state.houses[c.houseId]?.yardSign ? 1 : 0;
    const p = 0.10 * clamp((c.satisfaction - 72) / 28, 0, 1) * (1 + 0.5 * sign);
    if (!rng.chance(p)) continue;
    const key = houseHoodKey(c.houseId);
    const pool = leadCandidates(state, key);
    if (!pool.length) continue;
    const h = rng.pick(pool);
    makeLead(state, h.id, REFERRAL_TRUST);
    out.push({ address: h.address, from: houseInfo(state, c.houseId).ownerName });
  }
  return out;
}

/** HOA letter: overgrown lawns in one neighborhood are warned and become leads. */
export function hoaLetter(state: GameState, rng: Rng): string | null {
  const keys = state.hoods.filter((k) => { const h = HOOD_BY_ID[splitHoodKey(k).hoodId]; return h && !h.bidOnly; });
  if (!keys.length) return null;
  const key = rng.pick(keys);
  let n = 0;
  for (const h of hoodHouses(state, key)) {
    if (clientForHouse(state, h.id)) continue;
    if (grassHeight(state, h.id) < 4.8) continue;
    const s = hs(state, h.id);
    s.hoaUntil = state.day + 10;
    makeLead(state, h.id, LEAD_TRUST, 10);
    n++;
  }
  if (!n) return null;
  const hood = HOOD_BY_ID[splitHoodKey(key).hoodId];
  return `The ${hood.name} HOA sent letters about tall grass. ${n} ${n === 1 ? 'house needs' : 'houses need'} a mow.`;
}

// ---------------------------------------------------------------- bids
function rivalRep(r: Rival): number { return starsFor(r.quality); }

export function openBids(state: GameState): Bid[] {
  return state.bids.filter((b) => b.status === 'open');
}

export function placeBid(state: GameState, bidId: Id, amount: number): ActionResult {
  const bid = state.bids.find((b) => b.id === bidId);
  if (!bid || bid.status !== 'open') return { ok: false, message: 'That request is closed.' };
  if (!state.insured) return { ok: false, message: 'Buy insurance before your first commercial bid.' };
  if (!state.hoods.includes(hoodKey(bid.townId, bid.hoodId))) return { ok: false, message: 'That neighborhood is locked.' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Enter a bid.' };
  bid.myBid = r2(amount);
  return { ok: true, message: 'Bid submitted.' };
}

export function spawnBids(state: GameState, rng: Rng): string[] {
  const out: string[] = [];
  const cal = calendar(state.day);
  if (cal.season === 'winter') return out;
  for (const key of state.hoods) {
    const { townId, hoodId } = splitHoodKey(key);
    const hood = HOOD_BY_ID[hoodId];
    if (!hood?.bidOnly) continue;
    const isGolf = hood.kind === 'golf';
    if (isGolf) {
      if (cal.season !== 'spring' || cal.weekday !== 0 || cal.dayOfSeason > 14) continue;
      const year = cal.year;
      if (state.bids.some((b) => b.hoodId === hoodId && b.townId === townId && Math.floor(b.closesDay / 98) + 1 === year)) continue;
    } else {
      if (cal.weekday !== 0 || !rng.chance(0.3)) continue;
    }
    const sites = hoodHouses(state, key).filter((h) => !clientForHouse(state, h.id)
      && !state.bids.some((b) => b.houseId === h.id && b.status === 'open'));
    if (!sites.length) continue;
    const site = rng.pick(sites);
    const weeks = isGolf ? 12 : rng.int(12, 26);
    const bid: Bid = {
      id: newId(state, 'b'), townId, hoodId, houseId: site.id, title: siteName(site), lawnM2: site.lawnM2, weeks,
      fairPrice: fairPrice(site.lawnM2, 7, hood.kind), closesDay: state.day + 3, status: 'open',
    };
    state.bids.push(bid);
    out.push(`New request for proposal: ${bid.title}.`);
  }
  // Keep the list short.
  const closed = state.bids.filter((b) => b.status !== 'open');
  if (closed.length > 20) {
    const drop = new Set(closed.slice(0, closed.length - 20).map((b) => b.id));
    state.bids = state.bids.filter((b) => !drop.has(b.id));
  }
  return out;
}

/** Resolve bids whose close day has arrived. Returns report lines and any new clients. */
export function resolveBids(state: GameState, rng: Rng): { events: string[]; won: Client[] } {
  const events: string[] = [];
  const won: Client[] = [];
  const rep = reputation(state);
  for (const bid of state.bids) {
    if (bid.status !== 'open' || state.day < bid.closesDay) continue;
    const rivals = state.rivals[bid.townId] ?? [];
    let best = { score: Infinity, amount: 0, name: '' };
    for (const r of rivals) {
      const amount = r2(bid.fairPrice * r.priceIndex * rng.logNormal(0, 0.08));
      const score = amount / (1 + 0.12 * (rivalRep(r) - 3.5));
      if (score < best.score) best = { score, amount, name: r.name };
    }
    if (bid.myBid === undefined) {
      bid.status = 'expired';
      bid.winningBid = best.amount;
      bid.winner = best.name;
      continue;
    }
    const mine = bid.myBid / (1 + 0.12 * (rep - 3.5));
    if (mine < best.score && !clientForHouse(state, bid.houseId)) {
      bid.status = 'won';
      bid.winningBid = bid.myBid;
      bid.winner = 'You';
      const info = houseInfo(state, bid.houseId);
      const c: Client = {
        id: newId(state, 'c'), houseId: bid.houseId, since: state.day, price: bid.myBid, freq: 7, addOns: [],
        R: r2(bid.fairPrice * 1.1), satisfaction: 70, expectation: info.E, wantsStripes: info.wantsStripes,
        lastServiceDay: -1, nextDueDay: state.day + 1, lastQ: -1, bestManualQ: -1, visits: 0, totalPaid: 0, tips: 0, damages: 0,
        assignee: 'owner', trial: false, commercial: { bidId: bid.id, weeksLeft: bid.weeks, lowStreak: 0 }, status: 'active', history: [],
      };
      state.clients.push(c);
      const h = hs(state, bid.houseId);
      h.provider = 'me';
      h.h = grassHeight(state, bid.houseId);
      h.hDay = state.day;
      addXp(state, XP_BID);
      state.flags.bidsWon = (Number(state.flags.bidsWon) || 0) + 1;
      if (info.lot.kind === 'golf') state.flags.golfContract = 1;
      won.push(c);
      events.push(`You won the ${bid.title} contract at $${bid.myBid.toFixed(0)} a week for ${bid.weeks} weeks.`);
      logDay(state, (l) => l.newClients.push({ address: bid.title, price: c.price, by: 'Bid' }));
    } else {
      bid.status = 'lost';
      bid.winningBid = best.amount;
      bid.winner = best.name;
      events.push(`${best.name} won ${bid.title} at $${best.amount.toFixed(0)}.`);
    }
  }
  return { events, won };
}

/** Weekly contract bookkeeping (Sundays): count down terms. */
export function tickContracts(state: GameState, rng: Rng, onLost: (c: Client, reason: string) => void): void {
  for (const c of [...state.clients]) {
    if (!c.commercial) continue;
    c.commercial.weeksLeft -= 1;
    // a week with no visit counts like a poor visit; three in a row and the site cancels
    if (state.day - c.since >= 7 && c.lastServiceDay < state.day - 7) {
      c.commercial.lowStreak += 1;
      c.satisfaction = Math.max(0, Math.round((c.satisfaction - 15) * 10) / 10);
      if (c.commercial.lowStreak >= 3) { onLost(c, 'Contract terminated: missed visits'); continue; }
    }
    if (c.commercial.weeksLeft <= 0) onLost(c, 'Contract ended');
  }
  void rng;
}

export function allTownsHoodKeys(): string[] {
  const out: string[] = [];
  for (const t of TOWNS) for (const h of HOODS) out.push(hoodKey(t.id, h.id));
  return out;
}

export function providerSummary(state: GameState, key: string): { me: number; rival: number; diy: number } {
  const out = { me: 0, rival: 0, diy: 0 };
  for (const h of hoodHouses(state, key)) {
    const p = providerOf(state, h);
    if (p === 'me') out.me++;
    else if (p === 'rival') out.rival++;
    else out.diy++;
  }
  return out;
}
