import { describe, it, expect } from 'vitest';
import * as sim from '../src/sim/index';
import { fairSqft } from '../src/sim/pricing';
import { hWeek } from '../src/sim/clients';
import { growAvgDays, growOnce } from '../src/sim/growth';
import { reputationOf, starsFor } from '../src/sim/reputation';
import { weatherRow } from '../src/sim/weather';
import { WEATHER_KINDS } from '../src/sim/constants';
import { EQUIPMENT_BY_ID } from '../src/data/equipment';
import type { MowJobResult, MowJobSpec, Season } from '../src/core/types';

describe('prices (DESIGN 6)', () => {
  it('matches the documented fair price examples', () => {
    for (const [sqft, usd] of [[3800, 52.7], [11000, 83.6], [22000, 121.2], [43560, 182]]) {
      expect(Math.abs(fairSqft(sqft) - usd)).toBeLessThan(1);
    }
  });
  it('applies biweekly and commercial multipliers', () => {
    const w = sim.fairPrice(1000);
    expect(sim.fairPrice(1000, 14)).toBeCloseTo(w * 1.2, 1);
    expect(sim.fairPrice(1000, 7, 'commercial')).toBeCloseTo(w * 1.15, 1);
    expect(sim.fairPrice(400)).toBeLessThan(sim.fairPrice(800));
  });
});

describe('churn (DESIGN 10)', () => {
  it('weekly hazard matches the documented table', () => {
    expect(hWeek(70)).toBeCloseTo(0.004, 3);
    expect(hWeek(55)).toBeCloseTo(0.033, 2);
    expect(hWeek(40)).toBeCloseTo(0.20, 2);
    expect(hWeek(25)).toBeCloseTo(0.48, 2);
  });
});

describe('grass growth (DESIGN 4)', () => {
  it('weekly spring service from 3.0 in reaches about 4.8 in', () => {
    const h = growAvgDays(3, 0, 7);
    expect(h).toBeGreaterThan(4.5);
    expect(h).toBeLessThan(5.1);
  });
  it('biweekly spring service reaches about 6.3 in', () => {
    const h = growAvgDays(3, 0, 14);
    expect(h).toBeGreaterThan(5.9);
    expect(h).toBeLessThan(6.7);
  });
  it('winter has no growth and heat slows it', () => {
    expect(growOnce(3, 'winter', 'sunny')).toBe(3);
    expect(growOnce(3, 'summer', 'heat')).toBeLessThan(growOnce(3, 'summer', 'sunny'));
    expect(growOnce(3, 'spring', 'sunny', true)).toBeGreaterThan(growOnce(3, 'spring', 'sunny'));
  });
});

describe('reputation', () => {
  it('starts at the 3.0 prior and moves toward recent stars', () => {
    expect(reputationOf([])).toBe(3);
    const fives = Array(60).fill(5);
    const r = reputationOf(fives);
    expect(r).toBeGreaterThan(4.6);
    expect(r).toBeLessThan(5);
    // Recency: the same ratings in a different order give a different result.
    const a = reputationOf([...Array(30).fill(2), ...Array(30).fill(5)]);
    const b = reputationOf([...Array(30).fill(5), ...Array(30).fill(2)]);
    expect(a).toBeGreaterThan(b);
  });
  it('stars are clamped to 1..5', () => {
    expect(starsFor(0)).toBe(1);
    expect(starsFor(100)).toBe(5);
    expect(starsFor(90)).toBeCloseTo(5, 5);
  });
});

describe('weather', () => {
  it('every transition row sums to 1', () => {
    for (const s of ['spring', 'summer', 'fall', 'winter'] as Season[]) {
      for (const k of WEATHER_KINDS) {
        const row = weatherRow(s, k);
        expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        expect(row.every((p) => p >= 0)).toBe(true);
      }
    }
  });
});

describe('quality (DESIGN 9)', () => {
  const spec = (over: Partial<MowJobSpec> = {}): MowJobSpec => ({
    jobId: 't', kind: 'mow', clientId: null, houseId: null, address: '', ownerName: '', portrait: '',
    lot: { w: 20, d: 30, style: 'ranch', kind: 'residential' }, propertySeed: 1, grassIn: 4, targetIn: 3, expectation: 70,
    wantsStripes: false, mower: { ...EQUIPMENT_BY_ID['push21'], qualityCap: 100 }, sharpness: 1, trimmer: null, blower: null,
    bagging: false, striping: false, weather: 'sunny', season: 'spring', startMinute: 450, timeScale: 0.2, wet: false,
    leaves: 0, perks: [], notes: [], tutorial: false, ...over,
  });
  const result = (over: Partial<MowJobResult> = {}): MowJobResult => ({
    completed: true, coverage: 1, evenness: 1, stripe: 1, trim: 1, cleanup: 1, clumps: 0, removedFraction: 0.25,
    damages: [], realSeconds: 100, gameMinutes: 20, areaCutM2: 300, engineHours: 0.3, sharpnessLoss: 0.01, cutHeightIn: 3, ...over,
  });
  it('a perfect job scores 100', () => {
    expect(sim.computeQuality(spec(), result()).q).toBe(100);
  });
  it('coverage is cubed', () => {
    expect(sim.computeQuality(spec(), result({ coverage: 0.9, stripe: 0 })).q).toBeCloseTo(85.4, 0);
  });
  it('stripes are a bonus, never a penalty', () => {
    const none = sim.computeQuality(spec({ wantsStripes: true }), result({ coverage: 0.9, stripe: 0 })).q;
    expect(none).toBeCloseTo(sim.computeQuality(spec(), result({ coverage: 0.9, stripe: 0 })).q, 5);
    expect(sim.computeQuality(spec(), result({ coverage: 0.9, stripe: 0.5 })).q).toBeCloseTo(none + 2.5, 0);
    expect(sim.computeQuality(spec({ wantsStripes: true }), result({ coverage: 0.9, stripe: 0.5 })).q).toBeCloseTo(none + 4, 0);
    // only the paid add-on notices missing stripes
    expect(sim.computeQuality(spec({ premiumStripes: true }), result({ coverage: 0.9, stripe: 0 })).q).toBeCloseTo(none - 4, 0);
  });
  it('applies stress, wet, height and damage penalties with readable labels', () => {
    const b = sim.computeQuality(spec({ wet: true }), result({ stripe: 0, removedFraction: 0.5, cutHeightIn: 4, damages: [{ kind: 'gnome', label: 'Gnome', points: 4, cost: 25 }] }));
    // 100 - 6 stress - 6 wet - 4 height - 4 gnome
    expect(b.q).toBeCloseTo(80, 5);
    const labels = b.penalties.map((p) => p.label);
    expect(labels).toContain('Lawn stressed: cut too much at once');
    expect(labels).toContain('Wet grass');
    expect(labels).toContain('Cut 1.0 in too high');
    expect(labels).toContain('Ran over the garden gnome');
    expect(b.parts.map((p) => p.label)).toEqual(['Coverage', 'Evenness', 'Edges', 'Cleanup', 'No clumps']);
    expect(sim.computeQuality(spec(), result()).parts.map((p) => p.label)).toContain('Stripe bonus');
  });
  it('the mower quality cap and dull blades limit the score', () => {
    const capped = sim.computeQuality(spec({ mower: EQUIPMENT_BY_ID['push21'] }), result({ stripe: 0 }));
    expect(capped.q).toBe(85);
    expect(capped.capped).toBe(true);
    // stripes lift a job past the mower's cap
    expect(sim.computeQuality(spec({ mower: EQUIPMENT_BY_ID['push21'] }), result()).q).toBe(90);
    expect(sim.computeQuality(spec({ sharpness: 0 }), result({ stripe: 0 })).q).toBeCloseTo(88, 5);
  });
  it('never leaves 0..100 and survives garbage input', () => {
    const b = sim.computeQuality(spec(), result({ coverage: NaN, removedFraction: 5, damages: Array(30).fill({ kind: 'fence', label: '', points: 5, cost: 0 }) }));
    expect(b.q).toBe(0);
  });
});

describe('staff and finance formulas', () => {
  it('market wages follow the table', () => {
    expect(sim.marketWage('operator', 50)).toBe(29.5);
    expect(sim.marketWage('manager', 100)).toBe(70);
  });
  it('legacy points are the square root of valuation over 20k', () => {
    expect(sim.legacyPointsFor(2_000_000)).toBe(10);
    expect(sim.legacyPointsFor(1_000_000)).toBe(7);
    expect(sim.legacyPointsFor(0)).toBe(0);
  });
  it('calendar lays out the year', () => {
    expect(sim.calendar(0).label).toBe('Spring 1, Year 1');
    expect(sim.calendar(0).weekdayName).toBe('Mon');
    expect(sim.calendar(28).season).toBe('summer');
    expect(sim.calendar(84).season).toBe('winter');
    expect(sim.calendar(98).year).toBe(2);
    expect(sim.calendar(6).isWorkday).toBe(false);
  });
});
