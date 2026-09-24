import { describe, it, expect } from 'vitest';
import * as sim from '../src/sim/index';
import { encodeSave, decodeSave } from '../src/core/save';
import { makeRng } from '../src/core/rng';
import type { GameState } from '../src/core/types';
import { botNegotiate, profile, runBot } from '../tools/bots';
import { ARCHETYPE_BY_ID } from '../src/data/archetypes';

function walk(o: unknown, path: string, bad: string[]): void {
  if (typeof o === 'number') { if (!Number.isFinite(o)) bad.push(path); return; }
  if (o === null || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${path}[${i}]`, bad)); return; }
  for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`, bad);
}

function invariants(s: GameState): void {
  const bad: string[] = [];
  walk(s, 'state', bad);
  expect(bad).toEqual([]);
  expect(Number.isFinite(s.cash)).toBe(true);
  for (const c of s.clients) {
    expect(c.satisfaction).toBeGreaterThanOrEqual(0);
    expect(c.satisfaction).toBeLessThanOrEqual(100);
  }
  expect(s.owner.minute).toBeGreaterThanOrEqual(sim.DAY_START);
  expect(s.owner.minute).toBeLessThanOrEqual(sim.DAY_END);
  expect(s.ratings.length).toBeLessThanOrEqual(150);
  expect(s.days.length).toBeLessThanOrEqual(120);
  expect(s.lost.length).toBeLessThanOrEqual(40);
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
}

describe('new game', () => {
  it('is deterministic for a seed', () => {
    const a = sim.newGame({ companyName: 'A', color: '#fff', seed: 7 });
    const b = sim.newGame({ companyName: 'A', color: '#fff', seed: 7 });
    expect(a).toEqual(b);
    expect(sim.housesInHood(a, 'home.maple').map((h) => h.info.ownerName)).toEqual(sim.housesInHood(b, 'home.maple').map((h) => h.info.ownerName));
  });
  it('starts with the documented kit, cash and tutorial neighbor', () => {
    const s = sim.newGame({ companyName: 'A', color: '#fff', seed: 7 });
    expect(s.cash).toBe(60);
    expect(s.items.map((i) => i.specId).sort()).toEqual(['bike', 'broom', 'reel', 'shears']);
    expect(s.flags.tutorial).toBe(1);
    expect(s.candidates.length).toBeGreaterThanOrEqual(4);
    const rose = sim.houseView(s, sim.TUTORIAL_HOUSE);
    expect(rose.info.ownerName).toBe('Rose Albright');
    expect(rose.info.archetypeId).toBe('retiree');
    expect(rose.lead).toBe(true);
    expect(rose.grassIn).toBeCloseTo(4.2, 1);
    expect(rose.info.ownerName).toBe("Rose Albright");
    expect(rose.info.portrait).toBe("p_retiree_2");
    expect(sim.hoods(s).find((h) => h.key === 'home.oak')?.lockReason).toMatch(/^Needs /);
    invariants(s);
  });
});

describe('scripted day one', () => {
  it('knock, sign, mow, end the day', () => {
    const s = sim.newGame({ companyName: 'Flow', color: '#3a3', seed: 99 });
    const rng = makeRng(5);
    const k = sim.knock(s, sim.TUTORIAL_HOUSE);
    expect(k.answered).toBe(true);
    const out = botNegotiate(k.context!, profile('solid', rng), rng);
    const res = sim.applyPitchOutcome(s, sim.TUTORIAL_HOUSE, out.result === 'deal' ? out : { ...out, result: 'deal', price: k.context!.fairPrice });
    expect(res.ok).toBe(true);
    expect(s.flags.tutorial).toBe(2);
    const ticket = sim.jobsToday(s)[0];
    expect(ticket.houseId).toBe(sim.TUTORIAL_HOUSE);
    const spec = sim.buildMowJob(s, ticket.clientId);
    if ('error' in spec) throw new Error(spec.error);
    expect(spec.notes.length).toBeGreaterThan(0);
    const before = s.cash;
    const minute = s.owner.minute;
    const job = sim.completeManualJob(s, spec, sim.debug.syntheticResult(spec, 85));
    expect(job.q).toBeGreaterThan(80);
    expect(job.paid).toBeGreaterThan(0);
    expect(s.cash).toBeGreaterThan(before);
    expect(s.owner.minute).toBeGreaterThan(minute);
    expect(s.flags.tutorial).toBe(3);
    expect(job.reaction.length).toBeGreaterThan(0);
    // Knock a few more doors.
    let n = 0;
    for (const h of sim.housesInHood(s, 'home.maple')) {
      if (n >= 3) break;
      if (!h.canKnock) continue;
      if (s.owner.minute < 480) s.owner.minute = 480;
      const r = sim.knock(s, h.info.id);
      if (r.ok) n++;
    }
    expect(s.flags.tutorial).toBe(4);
    const report = sim.endDay(s);
    expect(report.jobs.length).toBeGreaterThan(0);
    expect(report.revenue).toBeGreaterThan(0);
    expect(s.day).toBe(1);
    expect(s.flags.tutorial).toBe(0);
    expect(s.owner.minute).toBe(sim.DAY_START);
    const c = s.clients[0];
    expect(c.nextDueDay).toBe(7);
    invariants(s);
  });
  it('refuses actions that would run past sundown', () => {
    const s = sim.newGame({ companyName: 'Late', color: '#3a3', seed: 3 });
    s.owner.minute = sim.DAY_END - 1;
    const h = sim.housesInHood(s, 'home.maple').find((x) => x.info.id !== sim.TUTORIAL_HOUSE && x.canKnock)!;
    const r = sim.knock(s, h.info.id);
    expect(r.ok).toBe(false);
  });
});

describe('morning, tips and small talk', () => {
  it('doors can be knocked from the start of the day', () => {
    const s = sim.newGame({ companyName: 'Early', color: '#3a3', seed: 11 });
    expect(s.owner.minute).toBe(sim.DAY_START);
    const h = sim.housesInHood(s, 'home.maple').find((x) => x.info.id !== sim.TUTORIAL_HOUSE && x.canKnock)!;
    const r = sim.knock(s, h.info.id);
    expect(r.ok).toBe(true);
    expect(r.message).not.toMatch(/Too early/);
  });
  it('great work earns performance tips with a readable breakdown, small talk once per visit', () => {
    const s = sim.newGame({ companyName: 'Tips', color: '#3a3', seed: 21 });
    const k = sim.knock(s, sim.TUTORIAL_HOUSE);
    sim.applyPitchOutcome(s, sim.TUTORIAL_HOUSE, { result: 'deal', price: k.context!.fairPrice, freq: 7, addOns: [], trust: 0.7, rounds: 1, minutes: 5, summary: '' });
    const c = s.clients[0];
    expect(c.rapport).toBeGreaterThan(0.3);
    let tips = 0;
    let parts = 0;
    for (let i = 0; i < 12; i++) {
      c.lastServiceDay = -1;
      s.owner.minute = sim.DAY_START;
      const spec = sim.buildMowJob(s, c.id);
      if ('error' in spec) throw new Error(spec.error);
      const out = sim.completeManualJob(s, spec, sim.debug.syntheticResult(spec, Math.min(100, c.expectation + 12)));
      if (out.tip > 0) { tips++; parts += out.tipParts?.length ?? 0; expect(out.tipParts!.reduce((a, p) => a + p.amount, 0)).toBeCloseTo(out.tip, 1); }
      expect(out.canTalk).toBe(true);
      expect(out.streak).toBe(i + 1);
    }
    expect(tips).toBeGreaterThan(4);
    expect(parts).toBeGreaterThan(tips);
    // Rose is a retiree: friendly talk lands, direct talk does not.
    const r0 = c.rapport!;
    const talk = sim.smallTalk(s, c.id, 'friendly');
    expect(talk.ok).toBe(true);
    expect(talk.reaction).toBe('liked');
    expect(talk.reply.length).toBeGreaterThan(0);
    expect(c.rapport!).toBeGreaterThan(r0);
    expect(c.likedTone).toBe('friendly');
    expect(sim.smallTalk(s, c.id, 'direct').ok).toBe(false);
    c.talkDay = -1;
    const cold = sim.smallTalk(s, c.id, 'direct');
    expect(cold.reaction).toBe('disliked');
    expect(cold.tip).toBe(0);
    invariants(s);
  });
});

describe('daily goals', () => {
  it('rolls three goals each morning and pays for finished ones', () => {
    const s = sim.newGame({ companyName: 'Goals', color: '#3a3', seed: 31 });
    expect(s.goals?.day).toBe(0);
    expect(s.goals?.list.map((g) => g.kind)).toEqual(['deals', 'knocks', 'stripes']);
    const knockGoal = s.goals!.list.find((g) => g.kind === 'knocks')!;
    const cash = s.cash;
    let n = 0;
    for (const h of sim.housesInHood(s, 'home.maple')) {
      if (n >= knockGoal.target) break;
      if (!h.canKnock || h.info.id === sim.TUTORIAL_HOUSE) continue;
      if (sim.knock(s, h.info.id).ok) n++;
    }
    expect(knockGoal.done).toBe(true);
    expect(s.cash).toBeCloseTo(cash + knockGoal.reward, 2);
    sim.endDay(s);
    expect(s.goals?.day).toBe(1);
    expect(s.goals?.list.length).toBe(3);
    expect(new Set(s.goals!.list.map((g) => g.kind)).size).toBe(3);
    invariants(s);
  });
});

describe('playtest round two fixes', () => {
  const signed = (seed: number, n: number) => {
    const s = sim.newGame({ companyName: 'R2', color: '#3a3', seed });
    s.hoods.push('home.oak');
    const houses = [...sim.housesInHood(s, 'home.maple'), ...sim.housesInHood(s, 'home.oak')].filter((h) => h.canKnock).slice(0, n);
    for (const h of houses) sim.applyPitchOutcome(s, h.info.id, { result: 'deal', price: 50, freq: 7, addOns: [], trust: 0.5, rounds: 1, minutes: 0, summary: '' });
    return s;
  };
  it('spring does not bring every lawn due on the same day', () => {
    const s = signed(41, 14);
    s.clients.forEach((c, i) => { c.nextDueDay = s.day + (i % 7); });
    while (sim.calendar(s.day).season !== 'winter') {
      // keep every lawn on its weekly rotation
      for (const c of s.clients) if (c.nextDueDay <= s.day) { c.lastServiceDay = s.day; c.nextDueDay = s.day + 7; c.satisfaction = 80; }
      sim.endDay(s);
    }
    while (sim.calendar(s.day).season === 'winter') sim.endDay(s);
    const due = new Set(s.clients.map((c) => c.nextDueDay));
    expect(due.size).toBeGreaterThan(3);
  });
  it('a client refuses add-ons they do not care about', () => {
    const s = signed(42, 40);
    const c = s.clients.find((x) => Object.keys(ARCHETYPE_BY_ID[sim.houseInfo(s, x.houseId).archetypeId].addOnAffinity).length === 0)!;
    expect(c).toBeDefined();
    c.price = c.R;
    const before = c.price;
    const r = sim.changeService(s, c.id, { addOns: ['bagging', 'stripes', 'fertilizer'] });
    expect(r.ok).toBe(false);
    expect(c.price).toBe(before);
  });
  it('staff will not work far under the market wage', () => {
    const s = signed(43, 1);
    s.cash = 5000;
    s.insured = true;
    const k = s.candidates[0];
    expect(sim.hire(s, k.id).ok).toBe(true);
    const e = s.staff[0];
    expect(sim.setWage(s, e.id, 7.25).ok).toBe(false);
    expect(sim.setWage(s, e.id, sim.marketWage(e.role, e.skill)).ok).toBe(true);
  });
  it('jobs assigned to a crew that cannot work come back to the owner', () => {
    const s = signed(44, 6);
    s.cash = 20000;
    s.insured = true;
    const cr = sim.createCrew(s, 'Alpha');
    expect(cr.ok).toBe(true);
    const crew = s.crews[0];
    for (const c of s.clients) c.assignee = crew.id;
    sim.endDay(s);
    expect(s.clients.every((c) => c.assignee === 'owner')).toBe(true);
  });
});

describe('crews explain themselves', () => {
  it('says when crews work, why nothing moved, and stays home in storms on half pay', () => {
    const s = sim.newGame({ companyName: 'Crews', color: '#3a3', seed: 77 });
    s.cash = 50000;
    s.insured = true;
    s.hoods.push('home.oak');
    const houses = sim.housesInHood(s, 'home.maple').filter((h) => h.canKnock).slice(0, 5);
    for (const h of houses) sim.applyPitchOutcome(s, h.info.id, { result: 'deal', price: 50, freq: 7, addOns: [], trust: 0.5, rounds: 1, minutes: 0, summary: '' });
    expect(sim.buy(s, 'pickup').ok).toBe(true);
    expect(sim.buy(s, 'push21').ok).toBe(true);
    const k = s.candidates.find((c) => c.role === 'operator' || c.role === 'lead') ?? s.candidates[0];
    k.role = 'operator';
    expect(sim.hire(s, k.id).ok).toBe(true);
    const crewId = sim.createCrew(s, 'Alpha').crewId!;
    const e = s.staff[0];
    expect(sim.assignToCrew(s, e.id, crewId).ok).toBe(true);
    const spare = s.items.find((i) => i.specId === 'reel')!;
    const truck = s.items.find((i) => i.specId === 'pickup')!;
    // the owner keeps the bike and the gas mower, the crew takes the pickup and the reel
    s.owner.vehicleUid = s.items.find((i) => i.specId === 'bike')!.uid;
    expect(sim.setCrewGear(s, crewId, { vehicleUid: truck.uid, mowerUid: spare.uid }).ok).toBe(true);
    const first = sim.autoDispatch(s);
    expect(first.message).toMatch(/when you end the day/);
    const again = sim.autoDispatch(s);
    expect(again.message).toMatch(/already have every due job|not fit in one day's route|No jobs due/);
    s.weather.today = 'storm';
    const plan = sim.crewPlans(s)[0];
    expect(plan.note).toMatch(/^Storm/);
    const before = s.cash;
    sim.endDay(s);
    const wages = before - s.cash;
    expect(wages).toBeGreaterThan(0);
    expect(s.ledger.some((l) => /half pay/.test(l.note))).toBe(true);
  });
});

describe('save migration', () => {
  it('lifts old contract prices and wages to the new economy once', () => {
    const s = sim.newGame({ companyName: 'Old', color: '#3a3', seed: 5 });
    const k = sim.knock(s, sim.TUTORIAL_HOUSE);
    sim.applyPitchOutcome(s, sim.TUTORIAL_HOUSE, { result: 'deal', price: 40, freq: 7, addOns: [], trust: 0.5, rounds: 1, minutes: 5, summary: '' });
    void k;
    delete s.flags.econ2;
    const price = s.clients[0].price;
    sim.migrate(s);
    expect(s.clients[0].price).toBeCloseTo(price * 1.3, 2);
    expect(s.flags.econ2).toBe(1);
    sim.migrate(s);
    expect(s.clients[0].price).toBeCloseTo(price * 1.3, 2);
  });
});

describe('long run with bots', () => {
  it('keeps invariants for 200 days and due dates move forward', () => {
    let lastDay = -1;
    const due = new Map<string, number>();
    runBot('solid', 4242, 200, (s) => {
      expect(s.day).toBeGreaterThan(lastDay);
      lastDay = s.day;
      if (s.day % 10 === 0) invariants(s);
      for (const c of s.clients) {
        const prev = due.get(c.id);
        if (prev !== undefined && c.lastServiceDay >= 0 && sim.calendar(s.day).season !== 'winter') expect(c.nextDueDay).toBeGreaterThanOrEqual(Math.min(prev, c.lastServiceDay + c.freq));
        due.set(c.id, c.nextDueDay);
      }
    });
  }, 60000);

  it('round-trips a mid-game save and stays small after 300 days', () => {
    const { state } = runBot('solid', 777, 300);
    invariants(state);
    const code = encodeSave(state);
    const back = decodeSave(code)!;
    expect(back).toEqual(state);
    const migrated = sim.migrate(JSON.parse(JSON.stringify(back)));
    expect(migrated).toEqual(state);
    expect(code.length).toBeLessThan(60 * 1024);
    // The restored game keeps running.
    sim.endDay(back);
    invariants(back);
  }, 60000);

  it('migrate fills missing fields on a partial save', () => {
    const s = sim.newGame({ companyName: 'Old', color: '#3a3', seed: 5 }) as Partial<GameState>;
    delete s.bids;
    delete s.marketing;
    delete (s.stats as Partial<GameState['stats']>).damages;
    const m = sim.migrate(s as GameState);
    expect(Array.isArray(m.bids)).toBe(true);
    expect(m.stats.damages).toBe(0);
    sim.endDay(m);
    invariants(m);
  });
});
