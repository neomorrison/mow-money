import { describe, it, expect } from 'vitest';
import { generateProperty, lotForLawn } from '../src/world/property';
import { GrassField, LAWN, HARD } from '../src/mow/field';
import { cutDeck, makeDeckOutcome, trim, blow, type DeckParams } from '../src/mow/cutting';
import { stripePattern, computeResult, estimateQuality, type ScoreState } from '../src/mow/scoring';
import { EQUIPMENT_BY_ID } from '../src/data/equipment';
import type { MowJobSpec } from '../src/core/types';

function field(grassIn = 4.5, leaves = 0) {
  const lot = lotForLawn(400, 'ranch', 'residential', 1.3);
  const layout = generateProperty(99, lot);
  return new GrassField({ layout, grassIn, leaves, seed: 99 });
}

function deck(f: GrassField, over: Partial<DeckParams> = {}): DeckParams {
  return {
    x: 0, z: 0, prevX: 0, prevZ: 0, heading: 0, width: 1.2, length: 0.5, deckIn: 3, maxGrassIn: 7,
    stripeVis: 0.8, bagActive: false, mulching: true, discharge: 0.35, wet: false, autoStripe: false, bandW: 1.2, frame: 1, time: 0, dt: 1 / 60, ...over,
  };
}

/** Drive the deck along a straight line in small steps. */
function drive(f: GrassField, p: DeckParams, x0: number, z0: number, x1: number, z1: number, frame0 = 1) {
  const out = makeDeckOutcome(f.layout.beds.length);
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05);
  const h = Math.atan2(x1 - x0, z1 - z0);
  let px = x0, pz = z0;
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
    cutDeck(f, { ...p, x, z, prevX: px, prevZ: pz, heading: h, frame: frame0 + i, time: (frame0 + i) / 60 }, out);
    px = x; pz = z;
  }
  return frame0 + n + 5;
}

function lawnSpot(f: GrassField): { x: number; z: number } {
  // a lawn point with lawn all around (1.5 m)
  for (let j = 20; j < f.nz - 20; j += 5) for (let i = 20; i < f.nx - 20; i += 5) {
    let ok = true;
    for (let dj = -15; dj <= 15 && ok; dj += 3) for (let di = -15; di <= 15 && ok; di += 3) if (f.surf[(j + dj) * f.nx + i + di] !== LAWN) ok = false;
    if (ok) return { x: f.cx(i), z: f.cz(j) };
  }
  throw new Error('no open lawn');
}

describe('grass field and cutting', () => {
  it('rasterizes a sensible lawn', () => {
    const f = field();
    const lawnM2 = f.lawnCells * f.cellArea;
    // the grid counts solid obstacles slightly differently than the analytic area, but stays close
    expect(Math.abs(lawnM2 - f.layout.lawnM2) / f.layout.lawnM2).toBeLessThan(0.05);
    expect(f.edgeCells).toBeGreaterThan(100);
  });

  it('cuts cells under the deck to the deck height and records the heading', () => {
    const f = field(4.5);
    const s = lawnSpot(f);
    drive(f, deck(f), s.x, s.z - 1, s.x, s.z + 1);
    const k = f.idx(s.x, s.z);
    expect(f.h[k]).toBeCloseTo(3, 5);
    expect(f.cutBy[k]).toBe(1);
    expect(Math.abs(f.heading[k])).toBeLessThan(1e-6);
    // outside the deck width nothing changed
    const k2 = f.idx(s.x + 0.9, s.z);
    expect(f.h[k2]).toBeGreaterThan(3);
  });

  it('only pushes tall grass halfway down in one pass', () => {
    const f = field(9);
    const s = lawnSpot(f);
    const k = f.idx(s.x, s.z);
    const before = f.h[k];
    let fr = drive(f, deck(f, { maxGrassIn: 7 }), s.x, s.z - 1, s.x, s.z + 1);
    expect(f.h[k]).toBeCloseTo(before - (before - 3) / 2, 4);
    drive(f, deck(f, { maxGrassIn: 7 }), s.x, s.z + 1, s.x, s.z - 1, fr);
    expect(f.h[k]).toBeLessThan(before - (before - 3) / 2);
  });

  it('leaves clumps in tall grass without a bag and not with one', () => {
    const a = field(7.5), b = field(7.5);
    const s = lawnSpot(a);
    drive(a, deck(a, { maxGrassIn: 9, mulching: false }), s.x, s.z - 1, s.x, s.z + 1);
    drive(b, deck(b, { maxGrassIn: 9, mulching: false, bagActive: true }), s.x, s.z - 1, s.x, s.z + 1);
    expect(a.clump[a.idx(s.x, s.z)]).toBeGreaterThan(0.2);
    expect(b.clump[b.idx(s.x, s.z)]).toBe(0);
  });

  it('trims edge cells the mower cannot reach', () => {
    const f = field(4.5);
    let k = -1;
    for (let i = 0; i < f.n; i++) if (f.edge[i] && f.h[i] > 3.2) { k = i; break; }
    const j = Math.floor(k / f.nx), i = k % f.nx;
    const out = { cells: 0, cut: 0, removed: 0, tallest: 0 };
    for (let t = 0; t < 30; t++) trim(f, f.cx(i), f.cz(j), 0.5, 3, 30, 1 / 30, out);
    expect(f.h[k]).toBeCloseTo(3, 5);
  });

  it('blows debris off hard surfaces onto the lawn', () => {
    const f = field();
    // find a hard cell with lawn 1 m to its +x side
    let k = -1;
    for (let i = 0; i < f.n && k < 0; i++) {
      if (f.surf[i] !== HARD) continue;
      const j = Math.floor(i / f.nx), x = f.cx(i % f.nx), z = f.cz(j);
      if (z > 1 && f.surfAt(x + 1.2, z) === LAWN && f.surfAt(x - 0.6, z) === HARD) k = i;
    }
    expect(k).toBeGreaterThan(0);
    const j = Math.floor(k / f.nx), x = f.cx(k % f.nx), z = f.cz(j);
    f.debris[k] = 1;
    const out = { moved: 0, cells: 0 };
    for (let t = 0; t < 180; t++) blow(f, x - 0.6, z, Math.PI / 2, 1.8, 0.45, 6.5, 1 / 60, out);
    let hard = 0;
    for (let i = 0; i < f.n; i++) if (f.surf[i] === HARD) hard += f.debris[i];
    expect(hard).toBeLessThan(0.1);
  });
});

describe('scoring', () => {
  it('scores straight alternating lanes above a scribble', () => {
    const lanes = field(4.5), scribble = field(4.5);
    const L = lanes.layout.lot;
    let fr = 1;
    let dir = 1;
    for (let x = 0.6; x < L.w - 0.6; x += 1.0) {
      fr = drive(lanes, deck(lanes), x, dir > 0 ? 0.2 : L.d - 0.6, x, dir > 0 ? L.d - 0.6 : 0.2, fr);
      dir = -dir;
    }
    // scribble: random headings everywhere
    let s = 7;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let k = 0; k < scribble.n; k++) if (scribble.surf[k] === LAWN) { scribble.cutBy[k] = 1; scribble.heading[k] = rnd() * Math.PI * 2; scribble.h[k] = 3; }
    const a = stripePattern(lanes, 1.2), b = stripePattern(scribble, 1.2);
    expect(a.parallel).toBeGreaterThan(0.8);
    expect(a.alternation).toBeGreaterThan(0.6);
    expect(a.score).toBeGreaterThan(0.7);
    expect(b.score).toBeLessThan(0.4);
  });

  it('auto stripes lay perfect bands however the mower is driven', () => {
    const f = field(4.5);
    const L = f.layout.lot;
    let fr = 1;
    // sloppy diagonal passes
    for (let x = -4; x < L.w + 4; x += 0.9) fr = drive(f, deck(f, { autoStripe: true, bandW: 1.2 }), x, 0.2, x + 4, L.d - 0.4, fr);
    for (let z = 0.4; z < L.d; z += 0.9) fr = drive(f, deck(f, { autoStripe: true, bandW: 1.2 }), 0.3, z, L.w - 0.3, z, fr);
    expect(stripePattern(f, 1.2).score).toBeGreaterThan(0.85);
  });

  it('forgives a slightly wobbly but honest back-and-forth pattern', () => {
    const f = field(4.5);
    const L = f.layout.lot;
    let fr = 1;
    let dir = 1;
    for (let x = 0.6; x < L.w - 0.6; x += 1.05) {
      const wob = dir > 0 ? 0.5 : -0.4;   // passes drift about 2 degrees
      fr = drive(f, deck(f), x, dir > 0 ? 0.2 : L.d - 0.6, x + wob, dir > 0 ? L.d - 0.6 : 0.2, fr);
      dir = -dir;
    }
    expect(stripePattern(f, 1.2).score).toBeGreaterThan(0.75);
  });

  it('builds a complete MowJobResult', () => {
    const f = field(4.5);
    const L = f.layout.lot;
    let fr = 1;
    for (let x = 0.6; x < L.w - 0.6; x += 1.0) fr = drive(f, deck(f), x, 0.2, x, L.d - 0.6, fr);
    const st: ScoreState = {
      field: f, deckHeights: [2, 2.5, 3, 3.5], deckIndex: 2, deckWidth: 1.2, stripeStrength: 0.3, damages: [],
      realSeconds: 200, timeScale: 0.2, burnsFuel: true, wearMult: 1, mowerAreaM2: 380,
    };
    const r = computeResult(st, true);
    expect(r.cutHeightIn).toBe(3);
    expect(r.coverage).toBeGreaterThan(0.75);
    expect(r.coverage).toBeLessThanOrEqual(1);
    expect(r.gameMinutes).toBeCloseTo(40, 5);
    expect(r.engineHours).toBeCloseTo(40 / 60, 3);
    expect(r.sharpnessLoss).toBeCloseTo(0.12 * 0.38, 4);
    expect(r.removedFraction).toBeGreaterThan(0.2);
    expect(r.removedFraction).toBeLessThan(0.5);
    for (const key of ['evenness', 'stripe', 'trim', 'cleanup', 'clumps'] as const) {
      expect(r[key]).toBeGreaterThanOrEqual(0);
      expect(r[key]).toBeLessThanOrEqual(1);
    }
    const spec = { mower: EQUIPMENT_BY_ID.push21, sharpness: 1, wantsStripes: false, wet: false, targetIn: 3 } as unknown as MowJobSpec;
    const q = estimateQuality(spec, r);
    expect(q.q).toBeGreaterThan(40);
    expect(q.q).toBeLessThanOrEqual(85);
  });

  describe('coverage after a deck change', () => {
    const heights = [2.5, 3, 3.5, 4];
    /** Mow the whole lot in lanes along z; lanes left of splitX at 3 in, the rest at 4 in. */
    function mowSplit(f: GrassField, splitX: number) {
      let frame = 1;
      const zA = f.z0, zB = f.z0 + f.nz * f.cs;
      for (let x = 0.4; x < f.layout.lot.w; x += 1.0) {
        const hi = x > splitX;
        frame = drive(f, deck(f, { deckIn: hi ? 4 : 3 }), x, zA, x, zB, frame);
      }
      // trim every edge cell the deck did not reach, at the deck in use for that side
      const out = { cells: 0, cut: 0, removed: 0, tallest: 0 };
      for (let k = 0; k < f.n; k++) {
        if (!f.edge[k]) continue;
        const x = f.cx(k % f.nx), z = f.cz(Math.floor(k / f.nx));
        trim(f, x, z, f.cs * 0.6, x > splitX ? 4 : 3, 1000, 1, out);
      }
    }
    const state = (f: GrassField): ScoreState => ({
      field: f, deckHeights: heights, deckIndex: 3, deckWidth: 1.2, stripeStrength: 0.3, damages: [],
      realSeconds: 200, timeScale: 0.2, burnsFuel: true, wearMult: 1, mowerAreaM2: 380,
    });

    it('grass cut at a raised deck still counts as mowed', () => {
      const f = field(5);
      mowSplit(f, f.layout.lot.w * 0.65);
      const r = computeResult(state(f), true);
      // most of the lawn was cut at 3 in, the rest at 4 in: all of it is mowed, edges included
      expect(r.cutHeightIn).toBe(3);
      expect(r.coverage).toBeGreaterThan(0.97);
      expect(r.trim).toBeGreaterThan(0.97);
      // two heights side by side still cost evenness
      expect(r.evenness).toBeLessThan(0.75);
    });

    it('grass pushed over by the deck is not mowed until a second pass', () => {
      const f = field(9);
      const s = lawnSpot(f);
      const k = f.idx(s.x, s.z);
      const st = { ...state(f), deckIndex: 1 };
      const next = drive(f, deck(f, { deckIn: 3, maxGrassIn: 6 }), s.x, s.z - 1, s.x, s.z + 1);
      expect(f.h[k]).toBeGreaterThan(3.5);
      expect(f.h[k]).toBeGreaterThan(f.limitAt(k, 3));
      drive(f, deck(f, { deckIn: 3, maxGrassIn: 6 }), s.x, s.z - 1, s.x, s.z + 1, next);
      expect(f.h[k]).toBeLessThanOrEqual(f.limitAt(k, 3));
      expect(computeResult(st, true).coverage).toBeGreaterThan(0);
    });

    it('a sweep with the deck raised out of the way is scored at that height', () => {
      const f = field(3);
      let frame = 1;
      for (let x = 0.4; x < f.layout.lot.w; x += 1.0) frame = drive(f, deck(f, { deckIn: 4 }), x, f.z0, x, f.z0 + f.nz * f.cs, frame);
      expect(f.uniqueCutCells).toBe(0);
      // the deck is back at the client's height when the job ends, but the lawn was never cut there
      const r = computeResult({ ...state(f), deckIndex: 1 }, true);
      expect(r.cutHeightIn).toBe(4);
      const spec = { targetIn: 3, wet: false, wantsStripes: false, striping: false, sharpness: 1, mower: { qualityCap: 100 } } as unknown as MowJobSpec;
      expect(estimateQuality(spec, r).penalties.some((p) => p.label === 'Cut too high')).toBe(true);
    });

    it('mowing again at the client height after a raised pass scores the lower height', () => {
      const f = field(2.4);
      let frame = 1;
      for (const d of [3.5, 2.5]) {
        for (let x = 0.4; x < f.layout.lot.w; x += 1.0) frame = drive(f, deck(f, { deckIn: d }), x, f.z0, x, f.z0 + f.nz * f.cs, frame);
      }
      const r = computeResult({ ...state(f), deckIndex: 0, targetIn: 2.5 }, true);
      expect(r.cutHeightIn).toBe(2.5);
      expect(r.coverage).toBeGreaterThan(0.97);
    });

    it('raising the deck and walking away does not count the lawn as mowed', () => {
      const f = field(4);
      const lazy = computeResult({ ...state(f), deckIndex: 3, targetIn: 3 }, true);
      expect(lazy.coverage).toBeLessThan(0.3);
      // grass that really is short enough still counts
      const short = computeResult({ ...state(field(2.4)), deckIndex: 3, targetIn: 3 }, true);
      expect(short.coverage).toBeGreaterThan(0.9);
    });

    it('a mower pass over grass already under the deck counts at that deck', () => {
      const f = field(5);
      const s = lawnSpot(f);
      const k = f.idx(s.x, s.z);
      f.h[k] = 3.8;
      expect(f.cutAt[k]).toBe(0);
      drive(f, deck(f, { deckIn: 4 }), s.x, s.z - 1, s.x, s.z + 1);
      expect(f.h[k]).toBeCloseTo(3.8, 5);
      expect(f.cutAt[k]).toBe(4);
      expect(f.h[k]).toBeLessThanOrEqual(f.limitAt(k, 3));
    });
  });
});
