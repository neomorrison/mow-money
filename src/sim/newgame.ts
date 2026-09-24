// New game and save migration.
import type { GameState, OwnedItem } from '../core/types';
import { hashSeed, makeRng } from '../core/rng';
import { SAVE_VERSION } from '../core/save';
import { TOWNS } from '../data/hoods';
import { DAY_START, FUEL_START } from './constants';
import { initialWeather } from './weather';
import { makeRivals } from './market';
import { refreshCandidates } from './staff';
import { TUTORIAL_HOUSE, generateHood } from './world';
import { LEGACY_PERKS } from './legacy';

function item(uid: string, specId: string, day: number): OwnedItem {
  return { uid, specId, sharpness: 1, condition: 1, hours: 0, boughtDay: day, paid: 0, crewId: null };
}

export function newGame(opts: { companyName: string; color: string; seed?: number; legacyPerks?: string[]; legacyPoints?: number; runs?: number }): GameState {
  const seed = (opts.seed ?? hashSeed(opts.companyName || 'mow', Date.now())) >>> 0;
  const perks = (opts.legacyPerks ?? []).filter((p) => LEGACY_PERKS.some((l) => l.id === p));
  const rng = makeRng(hashSeed(seed, 'sim'));
  const state: GameState = {
    v: SAVE_VERSION,
    seed,
    rng: 0,
    company: { name: (opts.companyName || 'Mow Money').slice(0, 32), color: opts.color || '#3f8f3a', foundedDay: 0 },
    day: 0,
    cash: 60,
    owner: {
      xp: 0, level: 1, skillPoints: 0, perks: [], minute: DAY_START, location: 'hq',
      mowerUid: 'i1', trimmerUid: 'i2', blowerUid: 'i3', vehicleUid: 'i4', jobsToday: 0,
    },
    weather: initialWeather(rng, 0),
    ratings: [],
    towns: ['home'],
    hoods: ['home.maple'],
    houses: {},
    clients: [],
    lost: [],
    items: [item('i1', 'reel', 0), item('i2', 'shears', 0), item('i3', 'broom', 0), item('i4', 'bike', 0)],
    staff: [],
    candidates: [],
    crews: [],
    loans: [],
    insured: false,
    bids: [],
    marketing: [],
    rivals: Object.fromEntries(TOWNS.map((t) => [t.id, makeRivals(t.id)])),
    ledger: [],
    days: [],
    stats: { jobs: 0, manualJobs: 0, revenue: 0, bestQ: 0, perfectJobs: 0, deals: 0, knocks: 0, m2Mowed: 0, peakClients: 0, damages: 0 },
    achievements: [],
    flags: { tutorial: 1 },
    legacy: { points: opts.legacyPoints ?? 0, perks, runs: opts.runs ?? 0 },
    nextId: 10,
  };
  state.weather.fuelPrice = FUEL_START;
  // Legacy perks.
  if (perks.includes('seed_money')) state.cash += 1500;
  if (perks.includes('local_legend')) state.ratings = Array(10).fill(4.5);
  if (perks.includes('head_start')) state.owner.skillPoints += 1;
  if (perks.includes('gas_start')) {
    state.items.push(item('i5', 'push21', 0));
    state.owner.mowerUid = 'i5';
  }
  // Candidates for the first Monday.
  refreshCandidates(state, rng);
  // The neighbor: a warm lead with a shaggy lawn.
  generateHood(seed, 'home', 'maple');
  state.houses[TUTORIAL_HOUSE] = { id: TUTORIAL_HOUSE, h: 5.0, hDay: 0, leadUntil: 7, leadTrust: 0.3 };
  state.rng = rng.state() >>> 0;
  return state;
}

/** Upgrade an older or partial save in place. */
export function migrate(state: GameState): GameState {
  const s = state as GameState & Record<string, unknown>;
  const fresh = newGame({ companyName: s.company?.name ?? 'Mow Money', color: s.company?.color ?? '#3f8f3a', seed: typeof s.seed === 'number' ? s.seed : 1 });
  const fill = <K extends keyof GameState>(k: K) => { if (s[k] === undefined || s[k] === null) (s as GameState)[k] = fresh[k]; };
  (['v', 'seed', 'rng', 'company', 'day', 'cash', 'owner', 'weather', 'ratings', 'towns', 'hoods', 'houses', 'clients', 'lost', 'items', 'staff',
    'candidates', 'crews', 'loans', 'insured', 'bids', 'marketing', 'rivals', 'ledger', 'days', 'stats', 'achievements', 'flags', 'legacy', 'nextId'] as const)
    .forEach((k) => fill(k));
  state.owner = { ...fresh.owner, ...state.owner };
  state.weather = { ...fresh.weather, ...state.weather };
  if (!Array.isArray(state.weather.forecast) || state.weather.forecast.length < 3) state.weather.forecast = fresh.weather.forecast;
  state.stats = { ...fresh.stats, ...state.stats };
  state.legacy = { ...fresh.legacy, ...state.legacy };
  state.company = { ...fresh.company, ...state.company };
  for (const t of TOWNS) if (!state.rivals[t.id]) state.rivals[t.id] = fresh.rivals[t.id];
  if (!state.towns.includes('home')) state.towns.unshift('home');
  if (!state.hoods.includes('home.maple')) state.hoods.unshift('home.maple');
  if (!Number.isFinite(state.cash)) state.cash = 0;
  if (!Number.isFinite(state.day) || state.day < 0) state.day = 0;
  if (!Number.isFinite(state.nextId)) state.nextId = 1000;
  for (const c of state.clients) {
    c.addOns = Array.isArray(c.addOns) ? c.addOns : [];
    c.history = Array.isArray(c.history) ? c.history : [];
    if (!Number.isFinite(c.satisfaction)) c.satisfaction = 60;
    if (!Number.isFinite(c.R) || c.R <= 0) c.R = c.price;
    if (!c.status) c.status = 'active';
    if (c.assignee === undefined) c.assignee = 'owner';
  }
  for (const e of state.staff) if (!Array.isArray(e.traits)) e.traits = [];
  for (const cr of state.crews) if (!Array.isArray(cr.memberIds)) cr.memberIds = [];
  for (const it of state.items) {
    if (!Number.isFinite(it.sharpness)) it.sharpness = 1;
    if (!Number.isFinite(it.condition)) it.condition = 1;
    if (it.crewId === undefined) it.crewId = null;
  }
  // The owner must always have a mower and a vehicle.
  const has = (uid: string | null) => !!uid && state.items.some((i) => i.uid === uid);
  if (!has(state.owner.mowerUid)) {
    const m = state.items.find((i) => i.specId === 'reel') ?? (state.items.push(item(`i${state.nextId++}`, 'reel', state.day)), state.items[state.items.length - 1]);
    state.owner.mowerUid = m.uid;
  }
  if (!has(state.owner.vehicleUid)) {
    const v = state.items.find((i) => i.specId === 'bike') ?? (state.items.push(item(`i${state.nextId++}`, 'bike', state.day)), state.items[state.items.length - 1]);
    state.owner.vehicleUid = v.uid;
  }
  state.v = SAVE_VERSION;
  return state;
}
