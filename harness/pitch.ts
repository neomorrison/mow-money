// Pitch harness.
//   /harness/pitch.html?arch=perfectionist&grass=6&rep=3.5        standalone negotiation
//     extra params: perks=read_the_room,silver_tongue  provider=rival  clients=2  warm=0.25  hoa=1  eco=0  debug=1  seed=7
//   /harness/pitch.html?view=hood&hood=home.maple                 neighborhood screen (real sim, mock world if the sim is not ready)
//     extra params: mock=1 (force the mock world), tutorial=1
import * as sim from '../src/sim';
import { store } from '../src/core/store';
import { hashSeed, makeRng } from '../src/core/rng';
import { ARCHETYPES, ARCHETYPE_BY_ID, FIRST_NAMES, LAST_NAMES, STREET_NAMES } from '../src/data/archetypes';
import { HOOD_BY_ID, splitHoodKey } from '../src/data/hoods';
import type {
  Client, GameState, HouseInfo, HouseState, HouseView, HouseStyle, JobTicket, KnockResult, PitchContext, PitchOutcome, Rival,
} from '../src/core/types';
import { PitchScreen, configurePitchApi, mountNeighborhood } from '../src/pitch';
import { reservation, situationalNeed } from '../src/sim/negotiation';
import { lotForLawn } from '../src/world/property';

const qs = new URLSearchParams(location.search);
const app = document.getElementById('app')!;
const RIVAL: Rival = { id: 'budget', name: 'CutRate Lawns', priceIndex: 0.85, quality: 68, color: '#7a4fb3' };
const RIVAL_PREMIUM: Rival = { id: 'premium', name: 'Emerald Estates', priceIndex: 1.15, quality: 86, color: '#1b7f79' };
(window as any).__pitch = {};

function fair(m2: number, freq = 7): number {
  const A = m2 * 10.764;
  return (20 + 0.052 * Math.pow(A, 0.725)) * (freq === 14 ? 1.2 : 1);
}

function bar(links: [string, string][]): void {
  const b = document.createElement('div');
  b.className = 'h-bar';
  b.innerHTML = links.map(([l, h]) => (h ? `<a href="${h}">${l}</a>` : `<span>${l}</span>`)).join('');
  document.body.appendChild(b);
}

// ---------------------------------------------------------------- standalone negotiation
function sampleHouse(archId: string, seed: number, m2 = 340): HouseInfo {
  const a = ARCHETYPE_BY_ID[archId] ?? ARCHETYPES[0];
  const rng = makeRng(seed);
  const lot = lotForLawn(m2, 'colonial', 'residential', 1.4);
  const w = 1.0 * a.wealthMult;
  const first = archId === 'retiree' ? 'Rose' : rng.pick(FIRST_NAMES);
  return {
    id: 'home.maple.0', townId: 'home', hoodId: 'maple', index: 0, street: 'Maple Ln', number: 14, address: '14 Maple Ln',
    mapX: 0, mapZ: 0, rotation: 0, lot, propertySeed: seed, lawnM2: m2, lawnSqft: m2 * 10.764, hardscapeM2: 40,
    ownerName: `${first} ${rng.pick(LAST_NAMES)}`, archetypeId: a.id, portrait: a.portraits[0], wealth: w,
    V: fair(m2) * w * a.needMult * rng.logNormal(0, 0.08), E: a.expect + rng.range(-5, 5), patience: a.patience + rng.int(-1, 1),
    anchor: a.anchor + rng.range(-0.05, 0.05), wantsStripes: rng.chance(a.wantsStripes), noSoliciting: false,
    initialProvider: 'diy', mowCycle: 10, mowPhase: 0,
  };
}

function runNegotiation(): void {
  const arch = qs.get('arch') ?? 'retiree';
  const seed = Number(qs.get('seed') ?? 7);
  const house = sampleHouse(arch, seed);
  const provider = (qs.get('provider') as PitchContext['provider']) ?? 'diy';
  const grassIn = Number(qs.get('grass') ?? 5);
  house.V *= situationalNeed(grassIn, qs.get('hoa') === '1');
  const ctx: PitchContext = {
    house,
    grassIn,
    reputation: Number(qs.get('rep') ?? 3),
    fairPrice: Math.round(fair(house.lawnM2)),
    clientsOnStreet: Number(qs.get('clients') ?? 1),
    warmTrust: Number(qs.get('warm') ?? 0),
    provider,
    rival: provider === 'rival' ? (qs.get('rival') === 'premium' ? RIVAL_PREMIUM : RIVAL) : null,
    ecoEquipment: qs.get('eco') !== '0',
    hoa: qs.get('hoa') === '1',
    perks: (qs.get('perks') ?? '').split(',').filter(Boolean),
    season: 'spring',
    tutorial: false,
    companyName: 'Mow Money',
  };
  const street = document.createElement('div');
  street.className = 'h-street';
  app.appendChild(street);
  const debug = qs.get('debug') === '1' ? document.createElement('div') : null;
  if (debug) { debug.className = 'h-debug'; document.body.appendChild(debug); }
  const start = () => {
    const p = new PitchScreen(app, {
      ctx, seed, companyColor: '#2f8f4e',
      onClose: (o: PitchOutcome) => showResult(o, start),
    });
    (window as any).__pitch.screen = p;
    if (debug) {
      const tick = () => {
        if (!p.state) return;
        const n = p.state;
        debug.textContent = `V ${house.V.toFixed(2)}  trust ${n.trust.toFixed(3)}  patience ${n.patience}/${n.patienceMax}\nR weekly ${reservation(n, 7, []).toFixed(2)}  R biweekly ${reservation(n, 14, []).toFixed(2)}\nstage ${n.stage}  round ${n.round}  counter ${n.lastCounter ?? '-'}`;
        if (!n.done || document.body.contains(p.root)) requestAnimationFrame(tick);
      };
      tick();
    }
  };
  start();
  bar(ARCHETYPES.slice(0, 13).map((a) => [a.label, `harness/pitch.html?arch=${a.id}&grass=${ctx.grassIn}&rep=${ctx.reputation}${debug ? '&debug=1' : ''}`] as [string, string]).concat([['Neighborhood', 'harness/pitch.html?view=hood']]));
}

function showResult(o: PitchOutcome, again: () => void): void {
  const r = document.createElement('div');
  r.className = 'h-result';
  r.innerHTML = `<h2>${o.result}</h2><pre>${JSON.stringify(o, null, 2)}</pre><button type="button" class="pitch-btn pitch-btn-go">Again</button>`;
  app.appendChild(r);
  (window as any).__pitch.outcome = o;
  r.querySelector('button')!.addEventListener('click', () => { r.remove(); again(); });
}

// ---------------------------------------------------------------- neighborhood
function runHood(): void {
  const hoodKey = qs.get('hood') ?? 'home.maple';
  let real = qs.get('mock') !== '1';
  let note = 'real sim';
  if (real) {
    try {
      const state = sim.newGame({ companyName: 'Mow Money', color: '#2f8f4e', seed: Number(qs.get('seed') ?? 12345) });
      if (qs.get('tutorial') === '0') state.flags.tutorial = 0;
      store.set(state);
      sim.housesInHood(state, hoodKey);
    } catch (e) {
      real = false;
      note = `mock world (${(e as Error).message})`;
    }
  } else note = 'mock world';
  if (!real) installMock(hoodKey);
  (window as any).__pitch.mode = note;
  console.log('[harness] neighborhood uses', note);
  const handle = mountNeighborhood(app, hoodKey, {
    onStartJob: (id) => console.log('[harness] start job', id),
    onExit: () => console.log('[harness] exit'),
  });
  (window as any).__pitch.handle = handle;
  (window as any).__pitch.store = store;
  (window as any).__pitch.sim = sim;
}

// A stand-in world with the same shapes as the sim's views, used while the sim is being built.
function installMock(hoodKey: string): void {
  const { townId, hoodId } = splitHoodKey(hoodKey);
  const hood = HOOD_BY_ID[hoodId] ?? HOOD_BY_ID.maple;
  const rng = makeRng(hashSeed('mock', hoodKey));
  const houses: HouseInfo[] = [];
  const streets = (STREET_NAMES[hood.id] ?? ['Main St']).slice(0, 2);
  const perSide = Math.ceil(hood.houses / (streets.length * 2));
  let idx = 0;
  streets.forEach((street, si) => {
    const streetZ = si * 92;
    for (const side of [1, -1]) {
      let x = -perSide * 11;
      for (let k = 0; k < perSide && idx < hood.houses; k++) {
        const m2 = rng.range(hood.lawnM2[0], hood.lawnM2[1]);
        const style = rng.pick(hood.styles) as HouseStyle;
        const lot = lotForLawn(m2, style, hood.kind, rng.range(1.2, 1.6));
        const archs = ARCHETYPES.filter((a) => a.hoods.includes(hood.id));
        const a = idx === 0 ? ARCHETYPE_BY_ID.retiree : rng.weighted(archs, (t) => t.weight);
        const w = rng.range(hood.wealth[0], hood.wealth[1]) * a.wealthMult;
        const num = 2 + idx * 2;
        const cx = x + lot.w / 2;
        houses.push({
          id: `${townId}.${hood.id}.${idx}`, townId, hoodId: hood.id, index: idx, street, number: num, address: `${num} ${street}`,
          mapX: cx, mapZ: streetZ + side * (6.2 + lot.d / 2), rotation: side > 0 ? 0 : Math.PI, lot, propertySeed: hashSeed('prop', idx, hoodKey),
          lawnM2: m2, lawnSqft: m2 * 10.764, hardscapeM2: 40,
          ownerName: idx === 0 ? 'Rose Albright' : `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`, archetypeId: a.id, portrait: rng.pick(a.portraits),
          wealth: w, V: fair(m2) * w * a.needMult * rng.logNormal(0, 0.08), E: a.expect + rng.range(-5, 5), patience: a.patience + rng.int(-1, 1),
          anchor: a.anchor + rng.range(-0.05, 0.05), wantsStripes: rng.chance(a.wantsStripes), noSoliciting: idx > 0 && rng.chance(0.07),
          initialProvider: idx > 0 && rng.chance(0.25) ? 'rival' : 'diy', mowCycle: rng.int(a.mowCycle[0], a.mowCycle[1]), mowPhase: rng.int(0, 10),
        });
        x += lot.w + 1.5;
        idx++;
      }
    }
  });
  const state = {
    v: 1, seed: 12345, rng: 1, company: { name: 'Mow Money', color: '#2f8f4e', foundedDay: 0 }, day: 0, cash: 60,
    owner: { xp: 0, level: 1, skillPoints: 0, perks: qs.get('perks')?.split(',') ?? [], minute: 510, location: hoodKey, mowerUid: null, trimmerUid: null, blowerUid: null, vehicleUid: null, jobsToday: 0 },
    houses: {} as Record<string, HouseState>, clients: [] as Client[], flags: { tutorial: qs.get('tutorial') === '0' ? 0 : 1 } as Record<string, number | boolean | string>,
    stats: { knocks: 0 }, ratings: [],
  } as unknown as GameState;
  const grass = new Map(houses.map((h) => [h.id, h.index === 0 ? 6.4 : Math.round(rng.range(2.8, 7.8) * 10) / 10]));
  const hs = (id: string) => (state.houses[id] ??= { id });
  // A couple of clients, a lead and an HOA letter so every marker shows.
  const mk = (i: number) => houses[i]?.id;
  for (const i of [5, 9]) {
    const h = houses[i];
    if (!h) continue;
    state.clients.push({
      id: `c${i}`, houseId: h.id, since: 0, price: Math.round(fair(h.lawnM2)), freq: 7, addOns: [], R: h.V, satisfaction: 72, expectation: h.E,
      wantsStripes: false, lastServiceDay: -1, nextDueDay: 0, lastQ: -1, bestManualQ: -1, visits: 0, totalPaid: 0, tips: 0, damages: 0,
      assignee: 'owner', trial: false, status: 'active', history: [],
    });
    grass.set(h.id, 3.1);
  }
  if (mk(3)) { hs(mk(3)!).leadUntil = 7; hs(mk(3)!).leadTrust = 0.15; }
  if (mk(12)) hs(mk(12)!).hoaUntil = 7;
  if (mk(15)) hs(mk(15)!).coldUntil = 3;
  store.set(state);

  const view = (h: HouseInfo): HouseView => {
    const st = hs(h.id);
    const client = state.clients.find((c) => c.houseId === h.id) ?? null;
    const provider = client ? 'me' : st.provider ?? h.initialProvider;
    const lead = (st.leadUntil ?? -1) >= state.day;
    const hoa = (st.hoaUntil ?? -1) >= state.day;
    const cold = (st.coldUntil ?? -1) >= state.day;
    const reason = client ? 'Already a client.' : h.noSoliciting ? 'No soliciting.' : cold ? 'They said to try again later.' : st.lastKnockDay === state.day ? 'Already knocked today.' : '';
    return { info: h, state: st, grassIn: grass.get(h.id)!, provider, rival: provider === 'rival' ? RIVAL : null, client, lead, hoa, cold, canKnock: !reason, reason };
  };
  configurePitchApi({
    housesInHood: () => houses.map(view),
    houseView: (_s, id) => view(houses.find((h) => h.id === id)!),
    ownerMinutesLeft: () => 1170 - state.owner.minute,
    fairPrice: (m2, f = 7) => fair(m2, f),
    reputation: () => 3,
    travelMinutes: () => 0,
    calendar: () => ({ day: 0, year: 1, season: 'spring', dayOfSeason: 1, seasonLength: 28, weekday: 0, weekdayName: 'Mon', isWorkday: true, label: 'Spring 1, Year 1' }),
    jobsToday: () => state.clients.map((c): JobTicket => {
      const h = houses.find((x) => x.id === c.houseId)!;
      return {
        clientId: c.id, houseId: h.id, address: h.address, hoodKey, hoodName: hood.name, ownerName: h.ownerName, portrait: h.portrait, lawnM2: h.lawnM2,
        grassIn: grass.get(h.id)!, price: c.price, dueDay: c.nextDueDay, daysOverdue: 0, satisfaction: c.satisfaction, assignee: 'owner',
        canAutopilot: false, estMinutes: 30, trial: c.trial, done: c.lastServiceDay === state.day,
      };
    }).filter((t) => t.dueDay <= state.day),
    knock: (_s, id): KnockResult => {
      const h = houses.find((x) => x.id === id)!;
      const v = view(h);
      if (!v.canKnock) return { ok: false, answered: false, minutes: 0, message: v.reason, context: null };
      state.owner.minute += 4;
      state.stats.knocks++;
      v.state.lastKnockDay = state.day;
      const answered = h.index === 0 || qs.get('answer') === '1' || makeRng(hashSeed(id, state.owner.minute)).chance(0.7);
      if (!answered) return { ok: true, answered: false, minutes: 4, message: 'No one answered.', context: null };
      const onStreet = state.clients.filter((c) => houses.find((x) => x.id === c.houseId)?.street === h.street).length;
      return {
        ok: true, answered: true, minutes: 4, message: '',
        context: {
          house: { ...h, V: h.V * situationalNeed(v.grassIn, v.hoa) }, grassIn: v.grassIn, reputation: 3, fairPrice: Math.round(fair(h.lawnM2)), clientsOnStreet: onStreet,
          warmTrust: v.lead ? v.state.leadTrust ?? 0.15 : 0, provider: v.provider, rival: v.rival, ecoEquipment: true, hoa: v.hoa,
          perks: state.owner.perks, season: 'spring', tutorial: h.index === 0 && state.flags.tutorial === 1, companyName: state.company.name,
        },
      };
    },
    applyPitchOutcome: (_s, id, o) => {
      const h = houses.find((x) => x.id === id)!;
      state.owner.minute += o.minutes;
      if (o.result === 'deal' || o.result === 'trial') {
        const c: Client = {
          id: `c${state.clients.length + 20}`, houseId: id, since: state.day, price: o.price!, freq: o.freq!, addOns: o.addOns ?? [], R: o.R!,
          satisfaction: 60 + 20 * (o.trust ?? 0), expectation: h.E, wantsStripes: h.wantsStripes, lastServiceDay: -1, nextDueDay: state.day,
          lastQ: -1, bestManualQ: -1, visits: 0, totalPaid: 0, tips: 0, damages: 0, assignee: 'owner', trial: o.result === 'trial', status: 'active', history: [],
        };
        state.clients.push(c);
        if (h.index === 0) state.flags.tutorial = 2;
        return { ok: true, message: 'Signed.', client: c };
      }
      if (o.result === 'cold' || o.result === 'rejected') hs(id).coldUntil = state.day + 5;
      return { ok: true, message: '', client: null };
    },
  });
}

if (qs.get('view') === 'hood') runHood();
else runNegotiation();
