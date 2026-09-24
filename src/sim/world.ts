// World generation and views: towns, neighborhoods, houses, grass heights, travel.
// Generated data is cached per (seed, town, hood) and never saved.
import type {
  ActionResult, ArchetypeSpec, Client, GameState, HoodKind, HoodSpec, HoodView, HouseInfo, HouseState, HouseStyle,
  HouseView, Id, Provider, Rival, TownView,
} from '../core/types';
import { hashSeed, makeRng, clamp } from '../core/rng';
import { HOODS, HOOD_BY_ID, TOWNS, TOWN_BY_ID, hoodKey, splitHoodKey } from '../data/hoods';
import { ARCHETYPES, ARCHETYPE_BY_ID, LAST_NAMES, STREET_NAMES, firstNameFor } from '../data/archetypes';
import { PORTRAIT_GENDER } from '../data/assets';
import { generateProperty, lotForLawn } from '../world/property';
import { EQUIPMENT_BY_ID } from '../data/equipment';
import { fairPrice, toSqft } from './pricing';
import { diyHeight, growAvgDays } from './growth';
import { DAY_END, SAME_HOOD_TRAVEL } from './constants';
import { ownerKit } from './kit';
import { reputation } from './reputation';
import { hasPerk, joinAnd, addLedger, money0 } from './util';

// ---------------------------------------------------------------- generation
const cache = new Map<string, HouseInfo[]>();
const byId = new Map<string, HouseInfo>();

export const TUTORIAL_HOUSE = 'home.maple.0';
const ROAD = 6;               // street centerline to lot front (half road + sidewalk)

const SITE_NAMES: Record<string, Record<string, string[]>> = {
  pinecrest: {
    office: ['Pinecrest Office Park, Building A', 'Pinecrest Office Park, Building B', 'Pinecrest Office Park, Building C', 'Summit Bank Campus', 'Northgate Medical Offices', 'Pinecrest Tech Center'],
    church: ['Grace Community Church', 'St. Anne Parish', 'First Lutheran Church'],
    school: ['Pinecrest Elementary', 'Lincoln Middle School', 'Westfield Academy'],
  },
  parks: { pavilion: ['Memorial Park', 'Riverbend Ball Fields', 'Lincoln Soccer Complex', 'Veterans Field', 'Town Green', 'Cedar Grove Park'] },
  links: { clubhouse: ['Fairway Links Golf Club'] },
};

const HOOD_ANGLE: Record<string, number> = { maple: 0.3, oak: 1.4, willow: 2.5, heritage: 3.6, pinecrest: 4.7, parks: 5.6, links: 3.0 };
const TOWN_POS: Record<string, [number, number]> = { home: [0, 0], riverside: [22, 4], cedar: [-6, 30], summit: [-30, 14] };

function cacheKey(seed: number, townId: string, hoodId: string) { return `${seed}|${townId}|${hoodId}`; }

function pickArchetype(rng: ReturnType<typeof makeRng>, hood: HoodSpec): ArchetypeSpec {
  const pool = ARCHETYPES.filter((a) => a.hoods.includes(hood.id));
  return rng.weighted(pool.length ? pool : ARCHETYPES, (a) => a.weight);
}

function kindForLot(hood: HoodSpec): HoodKind { return hood.kind; }

export function generateHood(seed: number, townId: string, hoodId: string): HouseInfo[] {
  const key = cacheKey(seed, townId, hoodId);
  const hit = cache.get(key);
  if (hit) return hit;
  const hood = HOOD_BY_ID[hoodId];
  const town = TOWN_BY_ID[townId];
  if (!hood || !town) return [];
  const base = hashSeed(seed, town.seedSalt, hoodId);
  const hr = makeRng(base);
  const rivalShare = hr.range(0.20, 0.35);
  const streets = STREET_NAMES[hoodId] ?? ['Main St'];
  const n = hood.houses;
  const nStreets = hood.bidOnly ? 1 : Math.min(streets.length, n > 30 ? 3 : n > 16 ? 2 : 1);
  const perStreet = Math.ceil(n / nStreets);
  const gap = hood.kind === 'estate' ? 8 : hood.bidOnly ? 22 : 2;

  // First pass: lots and hidden values.
  interface Draft { info: HouseInfo; street: number; side: number; slot: number }
  const drafts: Draft[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < n; i++) {
    const rng = makeRng(hashSeed(base, 'house', i));
    const tutorial = townId === 'home' && hoodId === 'maple' && i === 0;
    const arch = tutorial ? ARCHETYPE_BY_ID['retiree'] : pickArchetype(rng, hood);
    const style: HouseStyle = rng.pick(hood.styles);
    const kind = kindForLot(hood);
    const target = tutorial ? hood.lawnM2[0] + 12 : rng.range(hood.lawnM2[0], hood.lawnM2[1]);
    const aspect = kind === 'residential' ? rng.range(1.25, 1.8) : kind === 'estate' ? rng.range(1.0, 1.45) : rng.range(0.8, 1.25);
    const lot = lotForLawn(target, style, kind, aspect);
    const propertySeed = hashSeed(base, 'prop', i);
    let lawnM2 = target;
    let hardscapeM2 = target * 0.08;
    try {
      const layout = generateProperty(propertySeed, lot);
      if (Number.isFinite(layout.lawnM2) && layout.lawnM2 > 20) lawnM2 = layout.lawnM2;
      if (Number.isFinite(layout.hardscapeM2) && layout.hardscapeM2 >= 0) hardscapeM2 = layout.hardscapeM2;
    } catch { /* keep the target values */ }
    lawnM2 = Math.round(lawnM2);
    hardscapeM2 = Math.round(hardscapeM2);

    // Portrait first, then a name that matches the person in it.
    const portrait = tutorial ? 'p_retiree_2' : rng.pick(arch.portraits);
    let ownerName = 'Rose Albright';
    if (!tutorial) {
      for (let tries = 0; tries < 8; tries++) {
        ownerName = `${firstNameFor(PORTRAIT_GENDER[portrait], rng.pick)} ${rng.pick(LAST_NAMES)}`;
        if (!usedNames.has(ownerName) && !ownerName.startsWith('Rose ')) break;
      }
    }
    usedNames.add(ownerName);
    const wealth = rng.range(hood.wealth[0], hood.wealth[1]) * arch.wealthMult;
    const fair = fairPrice(lawnM2, 7, kind);
    const V = fair * wealth * arch.needMult * rng.logNormal(0, 0.08);
    const E = clamp(arch.expect + rng.range(-5, 5), 55, 95);
    const patience = Math.max(1, arch.patience + rng.int(-1, 1));
    const anchor = clamp(arch.anchor + rng.range(-0.05, 0.05), 0.4, 0.95);
    const wantsStripes = rng.chance(arch.wantsStripes);
    const noSoliciting = !tutorial && !hood.bidOnly && rng.chance(0.08);
    const initialProvider: Provider = tutorial ? 'diy' : hood.bidOnly ? 'rival' : rng.chance(rivalShare) ? 'rival' : 'diy';
    const mowCycle = rng.int(arch.mowCycle[0], arch.mowCycle[1]);
    const mowPhase = rng.int(0, Math.max(0, mowCycle - 1));

    const s = Math.min(nStreets - 1, Math.floor(i / perStreet));
    const j = i - s * perStreet;
    const side = hood.bidOnly ? i % 2 : j % 2;
    const slot = hood.bidOnly ? Math.floor(i / 2) : Math.floor(j / 2);
    const streetName = streets[s % streets.length];
    const number = hood.bidOnly ? 1200 + 100 * i : hood.kind === 'estate' ? 1000 + 20 * slot + (side ? 10 : 1) : 100 + 2 * slot + (side ? 2 : 1);
    const info: HouseInfo = {
      id: `${townId}.${hoodId}.${i}`, townId, hoodId, index: i,
      street: streetName, number, address: `${number} ${streetName}`,
      mapX: 0, mapZ: 0, rotation: 0, lot, propertySeed,
      lawnM2, lawnSqft: Math.round(toSqft(lawnM2)), hardscapeM2,
      ownerName, archetypeId: arch.id, portrait,
      wealth: Math.round(wealth * 1000) / 1000,
      V: Math.round(V * 100) / 100, E: Math.round(E * 10) / 10, patience, anchor: Math.round(anchor * 1000) / 1000,
      wantsStripes, noSoliciting, initialProvider, mowCycle, mowPhase,
    };
    drafts.push({ info, street: s, side, slot });
  }

  // Second pass: positions along the streets. Lot centers; rotation 0 faces -z (street at lower z).
  const maxD = Math.max(...drafts.map((d) => d.info.lot.d));
  const spacing = 2 * (ROAD + maxD) + 16;
  const cursors = new Map<string, number>();
  for (const d of drafts) {
    const k = `${d.street}:${d.side}`;
    const x0 = cursors.get(k) ?? 0;
    const { w, d: depth } = d.info.lot;
    d.info.mapX = Math.round((x0 + w / 2) * 10) / 10;
    const zs = d.street * spacing;
    d.info.mapZ = Math.round((d.side === 0 ? zs + ROAD + depth / 2 : zs - ROAD - depth / 2) * 10) / 10;
    d.info.rotation = d.side === 0 ? 0 : Math.PI;
    cursors.set(k, x0 + w + gap);
  }
  // Center each street on x = 0.
  for (let s = 0; s < nStreets; s++) {
    const onStreet = drafts.filter((d) => d.street === s);
    const maxX = Math.max(...onStreet.map((d) => d.info.mapX + d.info.lot.w / 2));
    for (const d of onStreet) d.info.mapX = Math.round((d.info.mapX - maxX / 2) * 10) / 10;
  }
  const out = drafts.map((d) => d.info);
  // Site names are unique within a neighborhood (two offices never share "Building B").
  if (hood.bidOnly) {
    const used = new Map<string, number>();
    for (const h of out) {
      const names = SITE_NAMES[h.hoodId]?.[h.lot.style];
      if (!names?.length) continue;
      const n = used.get(h.lot.style) ?? 0;
      used.set(h.lot.style, n + 1);
      h.siteName = n < names.length ? names[(h.index + n) % names.length] : `${names[n % names.length]} ${Math.floor(n / names.length) + 1}`;
    }
    // resolve any clash left by the offset pick
    const seen = new Set<string>();
    for (const h of out) {
      if (!h.siteName) continue;
      let name = h.siteName;
      for (let k = 2; seen.has(name); k++) name = `${h.siteName} ${k}`;
      h.siteName = name;
      seen.add(name);
    }
  }
  cache.set(key, out);
  for (const h of out) byId.set(`${seed}|${h.id}`, h);
  return out;
}

/** Map of street centerlines for a neighborhood (for the map view). */
export function streetsOf(state: GameState, hoodKeyStr: string): { name: string; z: number; x0: number; x1: number }[] {
  const { townId, hoodId } = splitHoodKey(hoodKeyStr);
  const hs = generateHood(state.seed, townId, hoodId);
  const map = new Map<string, { name: string; z: number; x0: number; x1: number }>();
  for (const h of hs) {
    const z = h.rotation === 0 ? h.mapZ - h.lot.d / 2 - ROAD : h.mapZ + h.lot.d / 2 + ROAD;
    const key = h.street + ':' + Math.round(z);
    const e = map.get(key) ?? { name: h.street, z, x0: Infinity, x1: -Infinity };
    e.x0 = Math.min(e.x0, h.mapX - h.lot.w / 2 - 6);
    e.x1 = Math.max(e.x1, h.mapX + h.lot.w / 2 + 6);
    map.set(key, e);
  }
  return [...map.values()];
}

export function siteName(info: HouseInfo): string {
  if (info.siteName) return info.siteName;
  const names = SITE_NAMES[info.hoodId]?.[info.lot.style];
  if (!names) return info.address;
  return names[info.index % names.length];
}

export function houseInfo(state: GameState, houseId: Id): HouseInfo {
  const hit = byId.get(`${state.seed}|${houseId}`);
  if (hit) return hit;
  const parts = houseId.split('.');
  const [townId, hoodId, idx] = [parts[0], parts[1], Number(parts[2])];
  const list = generateHood(state.seed, townId, hoodId);
  const h = list[idx];
  if (!h) throw new Error(`Unknown house ${houseId}`);
  return h;
}

export function hoodHouses(state: GameState, key: string): HouseInfo[] {
  const { townId, hoodId } = splitHoodKey(key);
  return generateHood(state.seed, townId, hoodId);
}

export function houseHoodKey(houseId: Id): string {
  const p = houseId.split('.');
  return `${p[0]}.${p[1]}`;
}

// ---------------------------------------------------------------- per-house state
export function hs(state: GameState, houseId: Id): HouseState {
  let s = state.houses[houseId];
  if (!s) { s = { id: houseId }; state.houses[houseId] = s; }
  return s;
}
export function peekHs(state: GameState, houseId: Id): HouseState {
  return state.houses[houseId] ?? { id: houseId };
}

export function clientForHouse(state: GameState, houseId: Id): Client | undefined {
  return state.clients.find((c) => c.houseId === houseId);
}

export function providerOf(state: GameState, info: HouseInfo): Provider {
  if (clientForHouse(state, info.id)) return 'me';
  const s = state.houses[info.id];
  if (s?.provider && s.provider !== 'me') return s.provider;
  return info.initialProvider;
}

export function rivalIndexFor(info: HouseInfo): number {
  return hashSeed(info.propertySeed, 'rival') % 100 < 60 ? 0 : 1;
}

export function rivalFor(state: GameState, info: HouseInfo): Rival | null {
  if (providerOf(state, info) !== 'rival') return null;
  const list = state.rivals[info.townId] ?? [];
  return list[rivalIndexFor(info)] ?? list[0] ?? null;
}

export function rivalActiveInHood(state: GameState, key: string): boolean {
  return hoodHouses(state, key).some((h) => providerOf(state, h) === 'rival');
}

/** Client preferred cut height in inches, derived from the house seed. */
export function preferredHeight(info: HouseInfo): number {
  const k = info.lot.kind;
  const step = hashSeed(info.propertySeed, 'height') % 5;
  if (k === 'golf') return 0.5;
  if (k === 'commercial' || k === 'park') return 1.5 + step * 0.25;
  return 2.5 + step * 0.25;
}

export function grassHeight(state: GameState, houseId: Id, day?: number): number {
  const d = day ?? state.day;
  const info = houseInfo(state, houseId);
  const s = state.houses[houseId];
  const client = clientForHouse(state, houseId);
  if (s && typeof s.h === 'number' && typeof s.hDay === 'number' && Number.isFinite(s.h)) {
    if (client) return round2(d <= s.hDay ? s.h : growAvgDays(s.h, s.hDay, d));
    const cycle = providerOf(state, info) === 'rival' ? 7 : info.mowCycle;
    if (d - s.hDay < cycle) return round2(d <= s.hDay ? s.h : growAvgDays(s.h, s.hDay, d));
  }
  if (providerOf(state, info) === 'rival') return diyHeight(info.propertySeed, 7, info.mowPhase % 7, d);
  return diyHeight(info.propertySeed, info.mowCycle, info.mowPhase, d);
}
const round2 = (x: number) => Math.round(x * 100) / 100;

export function clientsOnStreet(state: GameState, info: HouseInfo): number {
  const key = houseHoodKey(info.id);
  let n = 0;
  for (const c of state.clients) {
    if (c.houseId === info.id || houseHoodKey(c.houseId) !== key) continue;
    const other = houseInfo(state, c.houseId);
    if (other.street === info.street) n++;
  }
  return n;
}

// ---------------------------------------------------------------- travel
function locPos(key: string): [number, number] {
  if (key === 'hq' || !key) return TOWN_POS.home;
  const { townId, hoodId } = splitHoodKey(key);
  const t = TOWN_POS[townId] ?? [0, 0];
  const hood = HOOD_BY_ID[hoodId];
  if (!hood) return t;
  const a = HOOD_ANGLE[hoodId] ?? 0;
  return [t[0] + Math.cos(a) * hood.km, t[1] + Math.sin(a) * hood.km];
}

export function distanceKm(fromKey: string, toKey: string): number {
  const a = locPos(fromKey);
  const b = locPos(toKey);
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function travelMinutesWith(speedKmh: number, fromKey: string, toKey: string, dispatcher: boolean): number {
  if (fromKey === toKey) return 0;
  const km = distanceKm(fromKey, toKey);
  const m = 4 + (60 * km) / Math.max(1, speedKmh);
  return Math.round(m * (dispatcher ? 0.8 : 1));
}

export function travelMinutes(state: GameState, fromKey: string, toKey: string): number {
  const v = ownerKit(state).vehicleSpec;
  return travelMinutesWith(v.travelSpeedKmh ?? 14, fromKey, toKey, hasPerk(state, 'dispatcher'));
}

export function travelTo(state: GameState, key: string): ActionResult & { minutes: number } {
  const o = state.owner;
  if (key !== 'hq') {
    const { townId, hoodId } = splitHoodKey(key);
    if (!HOOD_BY_ID[hoodId] || !TOWN_BY_ID[townId]) return { ok: false, message: 'Unknown place.', minutes: 0 };
    if (!state.hoods.includes(key)) return { ok: false, message: 'That neighborhood is locked.', minutes: 0 };
  }
  const m = travelMinutes(state, o.location, key);
  if (m === 0) { o.location = key; return { ok: true, message: '', minutes: 0 }; }
  if (o.minute + m > DAY_END) return { ok: false, message: 'Not enough daylight.', minutes: m };
  o.minute += m;
  o.location = key;
  return { ok: true, message: '', minutes: m };
}

/** Travel minutes from the owner's location to a house (3 minutes between houses in the same hood). */
export function ownerTravelToHouse(state: GameState, houseId: Id): number {
  const key = houseHoodKey(houseId);
  if (state.owner.location === key) return SAME_HOOD_TRAVEL;
  return travelMinutes(state, state.owner.location, key);
}

// ---------------------------------------------------------------- unlocks
export function hoodRequirement(state: GameState, hood: HoodSpec): { ok: boolean; reason: string } {
  const u = hood.unlock;
  const need: string[] = [];
  const rep = reputation(state);
  if (u.rep !== undefined && rep < u.rep) need.push(`${u.rep.toFixed(1)} reputation`);
  if (u.clients !== undefined) {
    const n = state.clients.length;
    if (n < u.clients) need.push(`${u.clients} clients`);
  }
  if (u.vehicle && !state.items.some((i) => i.specId !== 'bike' && ownsCategory(i.specId, 'vehicle'))) need.push('a truck');
  if (u.rideOn && !state.items.some((i) => specRideOn(i.specId))) need.push('a riding mower');
  if (u.wideArea && !state.items.some((i) => i.specId === 'widearea')) need.push('a wide-area mower');
  if (u.gang && !state.items.some((i) => i.specId === 'gangreel')) need.push('a gang reel mower');
  if (u.insurance && !state.insured) need.push('insurance');
  if (u.crews !== undefined) {
    const n = state.crews.filter((c) => c.memberIds.length > 0).length;
    if (n < u.crews) need.push(u.crews === 1 ? 'a crew' : `${u.crews} crews`);
  }
  if (!need.length) return { ok: true, reason: '' };
  return { ok: false, reason: `Needs ${joinAnd(need)}.` };
}

function ownsCategory(specId: string, cat: string) { return EQUIPMENT_BY_ID[specId]?.category === cat; }
function specRideOn(specId: string) { const s = EQUIPMENT_BY_ID[specId]; return !!(s && s.category === 'mower' && s.rideOn); }

/** Unlock every hood whose requirements are met. Returns the names of newly unlocked hoods. */
export function checkUnlocks(state: GameState): string[] {
  const out: string[] = [];
  for (const townId of state.towns) {
    for (const hood of HOODS) {
      const key = hoodKey(townId, hood.id);
      if (state.hoods.includes(key)) continue;
      if (hoodRequirement(state, hood).ok) {
        state.hoods.push(key);
        const t = TOWN_BY_ID[townId];
        out.push(townId === 'home' ? hood.name : `${hood.name} (${t?.name ?? townId})`);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- views
export function hoods(state: GameState, townId?: string): HoodView[] {
  const townIds = townId ? [townId] : state.towns;
  const out: HoodView[] = [];
  for (const t of townIds) {
    const townUnlocked = state.towns.includes(t);
    for (const spec of HOODS) {
      const key = hoodKey(t, spec.id);
      const unlocked = state.hoods.includes(key);
      let lockReason = '';
      if (!townUnlocked) lockReason = `Open a branch in ${TOWN_BY_ID[t]?.name ?? t} first.`;
      else if (!unlocked) lockReason = hoodRequirement(state, spec).reason || 'Unlocks overnight.';
      let clients = 0;
      for (const c of state.clients) if (houseHoodKey(c.houseId) === key) clients++;
      let leads = 0;
      const prefix = key + '.';
      for (const id in state.houses) {
        if (!id.startsWith(prefix)) continue;
        const h = state.houses[id];
        if (h.leadUntil !== undefined && h.leadUntil >= state.day && !clientForHouse(state, id)) leads++;
      }
      out.push({
        key, spec, townId: t, unlocked, lockReason, clients, houses: spec.houses, leads,
        travelMinutes: travelMinutes(state, state.owner.location, key),
      });
    }
  }
  return out;
}

export function isLead(state: GameState, s: HouseState | undefined): boolean {
  return !!s && s.leadUntil !== undefined && s.leadUntil >= state.day;
}
export function isHoa(state: GameState, s: HouseState | undefined): boolean {
  return !!s && s.hoaUntil !== undefined && s.hoaUntil >= state.day;
}
export function isCold(state: GameState, s: HouseState | undefined): boolean {
  return !!s && s.coldUntil !== undefined && s.coldUntil > state.day;
}

export function knockBlockReason(state: GameState, info: HouseInfo): string {
  const hood = HOOD_BY_ID[info.hoodId];
  const key = houseHoodKey(info.id);
  const s = state.houses[info.id];
  if (hood?.bidOnly) return 'Won by bid only.';
  if (!state.hoods.includes(key)) return 'Neighborhood locked.';
  if (clientForHouse(state, info.id)) return 'Already a client.';
  if (info.noSoliciting && !isLead(state, s)) return 'No Soliciting sign on the door.';
  if (isCold(state, s)) {
    if (s?.lastKnockDay === state.day && s?.coldUntil === state.day + 1) return 'You already pitched here today.';
    const days = Math.max(1, (s?.coldUntil ?? state.day + 1) - state.day);
    return days === 1 ? 'Not interested right now. Try again tomorrow.' : `Not interested right now. Try again in ${days} days.`;
  }
  return '';
}

export function houseView(state: GameState, houseId: Id): HouseView {
  const info = houseInfo(state, houseId);
  const s = state.houses[houseId] ?? { id: houseId };
  const client = clientForHouse(state, houseId) ?? null;
  const provider = providerOf(state, info);
  let reason = knockBlockReason(state, info);
  if (!reason) {
    if (state.owner.minute >= DAY_END) reason = 'Too late to knock.';
  }
  return {
    info, state: s, grassIn: grassHeight(state, houseId), provider, rival: rivalFor(state, info), client,
    lead: isLead(state, s) && !client, hoa: isHoa(state, s), cold: isCold(state, s),
    canKnock: reason === '', reason,
  };
}

export function housesInHood(state: GameState, key: string): HouseView[] {
  return hoodHouses(state, key).map((h) => houseView(state, h.id));
}

export function towns(state: GameState): TownView[] {
  const managers = state.staff.filter((e) => e.role === 'manager' && !e.laidOff).length;
  const branches = state.towns.length - 1;
  return TOWNS.map((spec, i) => {
    const unlocked = state.towns.includes(spec.id);
    let reason = '';
    if (!unlocked) {
      const prev = TOWNS[i - 1];
      if (prev && !state.towns.includes(prev.id)) reason = `Open ${prev.name} first.`;
      else if (managers <= branches) reason = 'Needs an operations manager.';
      else if (state.cash < spec.branchCost) reason = `Needs ${money0(spec.branchCost)}.`;
    }
    return { spec, unlocked, canOpen: !unlocked && reason === '', reason };
  });
}

export function openBranch(state: GameState, townId: string): ActionResult {
  const view = towns(state).find((t) => t.spec.id === townId);
  if (!view) return { ok: false, message: 'Unknown town.' };
  if (view.unlocked) return { ok: false, message: 'Already open.' };
  if (!view.canOpen) return { ok: false, message: view.reason };
  addLedger(state, -view.spec.branchCost, 'branch', `Branch opened in ${view.spec.name}`);
  state.towns.push(townId);
  const maple = hoodKey(townId, 'maple');
  if (!state.hoods.includes(maple)) state.hoods.push(maple);
  checkUnlocks(state);
  state.flags.branches = state.towns.length - 1;
  return { ok: true, message: `${view.spec.name} branch is open.` };
}

