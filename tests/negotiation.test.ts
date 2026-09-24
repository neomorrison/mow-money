import { describe, it, expect } from 'vitest';
import type { HouseInfo, PitchContext } from '../src/core/types';
import { ARCHETYPE_BY_ID } from '../src/data/archetypes';
import { ARCHETYPE_LINES, GENERIC, PLAYER, NOBODY_HOME, NO_SOLICITING } from '../src/data/dialogue';
import { resetRecentLines } from '../src/data/pick';
import {
  availablePoints, counterPrice, createNegotiation, pAccept, previewBucket, reservation, step, offerTotal,
  type NegotiationState,
} from '../src/sim/negotiation';

function ctxFor(arch: string, over: Partial<PitchContext> = {}, house: Partial<HouseInfo> = {}): PitchContext {
  const a = ARCHETYPE_BY_ID[arch];
  const info: HouseInfo = {
    id: 'home.maple.3', townId: 'home', hoodId: 'maple', index: 3, street: 'Maple Ln', number: 14, address: '14 Maple Ln',
    mapX: 0, mapZ: 0, rotation: 0, lot: { w: 20, d: 30, style: 'ranch', kind: 'residential' }, propertySeed: 99,
    lawnM2: 340, lawnSqft: 3660, hardscapeM2: 40, ownerName: 'Rose Albright', archetypeId: arch, portrait: a.portraits[0],
    wealth: 1, V: 40, E: a.expect, patience: a.patience, anchor: a.anchor, wantsStripes: false, noSoliciting: false,
    initialProvider: 'diy', mowCycle: 10, mowPhase: 2, ...house,
  };
  return {
    house: info, grassIn: 4.5, reputation: 3, fairPrice: 40, clientsOnStreet: 0, warmTrust: 0, provider: 'diy', rival: null,
    ecoEquipment: true, hoa: false, perks: [], season: 'spring', tutorial: false, companyName: 'Mow Money', ...over,
  };
}

const R7 = (n: NegotiationState) => reservation(n, 7, []);

describe('pAccept', () => {
  it('matches the design anchors', () => {
    expect(pAccept(0.9)).toBeGreaterThan(0.94);
    expect(pAccept(0.9)).toBeLessThan(0.96);
    expect(pAccept(1)).toBeCloseTo(0.5, 10);
    expect(pAccept(1.1)).toBeGreaterThan(0.04);
    expect(pAccept(1.1)).toBeLessThan(0.06);
  });
  it('is monotone decreasing', () => {
    let prev = 1;
    for (let r = 0.5; r <= 1.6; r += 0.01) { const p = pAccept(r); expect(p).toBeLessThanOrEqual(prev); prev = p; }
  });
});

describe('negotiation', () => {
  it('computes T0 and R from the context', () => {
    const n = createNegotiation(ctxFor('retiree', { reputation: 4, clientsOnStreet: 2, warmTrust: 0.25 }), 1);
    expect(n.trust).toBeCloseTo(0.35 + 0.1 + 0.25 + 0.1, 6);
    expect(R7(n)).toBeCloseTo(40 * (0.85 + 0.3 * n.trust), 6);
    const s = createNegotiation(ctxFor('retiree', { perks: ['silver_tongue', 'closer'] }), 1);
    expect(s.trust).toBeCloseTo(0.43, 6);
    expect(s.patience).toBe(ARCHETYPE_BY_ID.retiree.patience + 1);
  });

  it('applies tone affinity to trust', () => {
    const n = createNegotiation(ctxFor('perfectionist'), 3);
    const t0 = n.trust;
    step(n, { type: 'opener', tone: 'funny' });
    expect(n.trust).toBeCloseTo(t0 - 0.12, 6);
    const m = createNegotiation(ctxFor('perfectionist'), 3);
    step(m, { type: 'opener', tone: 'professional' });
    expect(m.trust).toBeCloseTo(t0 + 0.12, 6);
  });

  it('values the non-preferred frequency at 0.9 and add-ons by affinity', () => {
    const n = createNegotiation(ctxFor('penny'), 5); // prefers biweekly
    const w = reservation(n, 7, []);
    const b = reservation(n, 14, []);
    expect(w / b).toBeCloseTo(0.9 / 1.2, 6);
    const p = createNegotiation(ctxFor('perfectionist'), 5); // stripes 0.7
    expect(reservation(p, 7, ['stripes']) / reservation(p, 7, [])).toBeCloseTo(1 + 0.10 * 0.7, 6);
    expect(offerTotal(40, ['stripes'])).toBe(44);
  });

  it('gates talking points', () => {
    const n = createNegotiation(ctxFor('retiree', { ecoEquipment: false }), 9);
    expect(availablePoints(n).every((p) => !p.enabled)).toBe(true);
    step(n, { type: 'opener', tone: 'friendly' });
    const pts = Object.fromEntries(availablePoints(n).map((p) => [p.id, p]));
    expect(pts.overgrown.enabled).toBe(true);
    expect(pts.social_proof.enabled).toBe(false);
    expect(pts.eco.enabled).toBe(false);
    expect(pts.beat_current.enabled).toBe(false);
    step(n, { type: 'point', id: 'reputation' });
    step(n, { type: 'point', id: 'free_trial' });
    expect(n.trialUnlocked).toBe(true);
    expect(availablePoints(n).filter((p) => p.enabled)).toHaveLength(0);
  });

  it('overgrown point hurts on a neat lawn and helps on a tall one', () => {
    const neat = createNegotiation(ctxFor('retiree', { grassIn: 3.2 }), 2);
    step(neat, { type: 'opener', tone: 'professional' });
    const t = neat.trust;
    step(neat, { type: 'point', id: 'overgrown' });
    expect(neat.trust).toBeCloseTo(t - 0.10, 6);
    const tall = createNegotiation(ctxFor('retiree', { grassIn: 6.5 }), 2);
    step(tall, { type: 'opener', tone: 'professional' });
    const r0 = R7(tall);
    step(tall, { type: 'point', id: 'overgrown' });
    expect(R7(tall) / r0).toBeCloseTo(1.1, 6);
  });

  it('counters strictly rise toward 0.97 R and never exceed R', () => {
    const n = createNegotiation(ctxFor('penny', {}, { V: 200, patience: 8 }), 11);
    step(n, { type: 'opener', tone: 'direct' });
    const R = reservation(n, 14, []);
    const counters: number[] = [];
    for (let i = 0; i < 7 && !n.done; i++) {
      const res = step(n, { type: 'offer', price: Math.round(R * 1.12), freq: 14, addOns: [] });
      if (res.counter !== null) counters.push(res.counter);
    }
    expect(counters.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < counters.length; i++) expect(counters[i]).toBeGreaterThan(counters[i - 1]);
    expect(counters[0]).toBeLessThan(R * 0.85);
    const last = counters[counters.length - 1];
    expect(last).toBeLessThanOrEqual(R);
    expect(last).toBeGreaterThan(R * 0.93);
    // the formula itself approaches 0.97 R
    expect(counterPrice(n, 40)).toBeLessThanOrEqual(Math.floor(R));
  });

  it('accepting a counter always closes at the counter price', () => {
    for (let seed = 0; seed < 40; seed++) {
      const n = createNegotiation(ctxFor('family'), seed);
      step(n, { type: 'opener', tone: 'friendly' });
      const res = step(n, { type: 'offer', price: Math.round(R7(n) * 1.2), freq: 7, addOns: [] });
      if (res.counter === null) continue;
      const done = step(n, { type: 'accept_counter' });
      expect(done.done).toBe(true);
      expect(done.outcome?.result).toBe('deal');
      expect(done.outcome?.price).toBe(res.counter);
      expect(done.outcome?.trust).toBeGreaterThan(0);
      expect(done.outcome?.R).toBeGreaterThan(0);
    }
  });

  it('patience exhaustion yields cold', () => {
    const n = createNegotiation(ctxFor('techie'), 4);
    step(n, { type: 'opener', tone: 'direct' });
    let res;
    let guard = 0;
    do { res = step(n, { type: 'offer', price: Math.round(R7(n) * 1.25), freq: 7, addOns: [] }); } while (!res.done && ++guard < 20);
    expect(res.outcome?.result).toBe('cold');
    expect(res.outcome?.minutes).toBeGreaterThan(0);
  });

  it('an offended offer drops trust and costs extra patience', () => {
    const n = createNegotiation(ctxFor('retiree'), 8);
    step(n, { type: 'opener', tone: 'friendly' });
    const t = n.trust;
    const p = n.patience;
    const res = step(n, { type: 'offer', price: Math.round(R7(n) * 1.6), freq: 7, addOns: [] });
    expect(res.mood).toBe('offended');
    expect(n.trust).toBeCloseTo(t - 0.15, 6);
    expect(n.patience).toBe(p - 2);
  });

  it('is deterministic for a seed', () => {
    const run = (seed: number) => {
      resetRecentLines();
      const n = createNegotiation(ctxFor('dude'), seed);
      step(n, { type: 'opener', tone: 'funny' });
      step(n, { type: 'point', id: 'free_trial' });
      const out = [];
      for (let i = 0; i < 6 && !n.done; i++) out.push(step(n, { type: 'offer', price: Math.round(R7(n) * 1.02), freq: 14, addOns: [] }));
      return JSON.stringify({ log: n.log, out });
    };
    expect(run(123)).toBe(run(123));
    expect(run(123)).not.toBe(run(124));
  });

  it('a greedy offer at 1.5 R never closes', () => {
    let deals = 0;
    for (let seed = 0; seed < 300; seed++) {
      const n = createNegotiation(ctxFor('retiree', {}, { patience: 6 }), seed);
      step(n, { type: 'opener', tone: 'friendly' });
      let guard = 0;
      while (!n.done && guard++ < 20) {
        const res = step(n, { type: 'offer', price: Math.round(R7(n) * 1.5), freq: 7, addOns: [] });
        if (res.outcome?.result === 'deal') deals++;
      }
    }
    expect(deals).toBe(0);
  });

  it('an offer at 0.85 R almost always closes', () => {
    let deals = 0;
    const N = 300;
    for (let seed = 0; seed < N; seed++) {
      const n = createNegotiation(ctxFor('perfectionist', {}, { V: 60 + (seed % 50) }), seed);
      step(n, { type: 'opener', tone: 'friendly' });
      const res = step(n, { type: 'offer', price: Math.round(R7(n) * 0.85), freq: 7, addOns: [] });
      if (res.outcome?.result === 'deal') deals++;
    }
    expect(deals / N).toBeGreaterThan(0.97);
  });

  it('acceptance frequency near R tracks pAccept', () => {
    let deals = 0;
    const N = 2000;
    for (let seed = 0; seed < N; seed++) {
      const n = createNegotiation(ctxFor('veteran', {}, { V: 1000 }), seed);
      step(n, { type: 'opener', tone: 'professional' });
      const res = step(n, { type: 'offer', price: Math.round(R7(n) * 1.03), freq: 7, addOns: [] });
      if (res.outcome?.result === 'deal') deals++;
    }
    expect(deals / N).toBeGreaterThan(pAccept(1.03) - 0.04);
    expect(deals / N).toBeLessThan(pAccept(1.03) + 0.04);
  });

  it('trial requires the free first mow point and books a trial', () => {
    const n = createNegotiation(ctxFor('newcouple'), 21);
    step(n, { type: 'opener', tone: 'friendly' });
    const blocked = step(n, { type: 'trial', price: 30, freq: 7, addOns: [] });
    expect(blocked.lines).toHaveLength(0);
    step(n, { type: 'point', id: 'free_trial' });
    const res = step(n, { type: 'trial', price: Math.round(R7(n) * 0.95), freq: 7, addOns: [] });
    expect(res.outcome?.result).toBe('trial');
  });

  it('read the room preview matches the revealed bucket', () => {
    const n = createNegotiation(ctxFor('gardener'), 30);
    step(n, { type: 'opener', tone: 'friendly' });
    const price = Math.round(R7(n) * 1.3);
    expect(previewBucket(n, price, 7)).toBe('steep');
    const res = step(n, { type: 'offer', price, freq: 7, addOns: [] });
    expect(res.mood).toBe('steep');
  });

  it('walking away ends with left', () => {
    const n = createNegotiation(ctxFor('hoa'), 1);
    const res = step(n, { type: 'leave' });
    expect(res.outcome?.result).toBe('left');
  });
});

describe('dialogue', () => {
  const all: string[] = [];
  const collect = (v: unknown) => {
    if (typeof v === 'string') all.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  collect(GENERIC); collect(ARCHETYPE_LINES); collect(PLAYER); collect(NOBODY_HOME); collect(NO_SOLICITING);
  it('has no em dashes', () => {
    const EM_DASH = String.fromCharCode(0x2014);
    for (const s of all) expect(s.includes(EM_DASH)).toBe(false);
  });
  it('covers every archetype with greetings', () => {
    for (const id of Object.keys(ARCHETYPE_BY_ID)) {
      expect(ARCHETYPE_LINES[id], id).toBeDefined();
      expect((ARCHETYPE_LINES[id].greet ?? []).length, id).toBeGreaterThanOrEqual(3);
    }
  });
  it('counter lines carry the price', () => {
    for (const s of [...GENERIC.counter, ...Object.values(ARCHETYPE_LINES).flatMap((l) => l.counter ?? [])]) expect(s).toContain('{price}');
  });
});
