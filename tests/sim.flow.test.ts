import { describe, it, expect } from 'vitest';
import * as sim from '../src/sim/index';
import { encodeSave, decodeSave } from '../src/core/save';
import { makeRng } from '../src/core/rng';
import type { GameState } from '../src/core/types';
import { botNegotiate, profile, runBot } from '../tools/bots';

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
  expect(s.ratings.length).toBeLessThanOrEqual(60);
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
