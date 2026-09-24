import { describe, it, expect } from 'vitest';
import { generateProperty, lotForLawn, rectDist, inBed, fenceDist, type PropertyLayout } from '../src/world/property';
import type { HouseStyle, LotSpec } from '../src/core/types';

const RES_STYLES: HouseStyle[] = ['ranch', 'colonial', 'cottage', 'modern'];

function lots(): { seed: number; lot: LotSpec }[] {
  const out: { seed: number; lot: LotSpec }[] = [];
  let seed = 1;
  for (const style of RES_STYLES) {
    for (const lawn of [260, 340, 420, 600, 900]) {
      for (const aspect of [1.1, 1.35, 1.7]) out.push({ seed: seed++ * 7919, lot: lotForLawn(lawn, style, 'residential', aspect) });
    }
  }
  return out;
}

function solidOverlapsHouse(p: PropertyLayout): string | null {
  for (const o of p.obstacles) {
    if (!o.solid) continue;
    if (rectDist(p.house, o.x, o.z) < o.r - 0.01) return `${o.kind} at ${o.x.toFixed(1)},${o.z.toFixed(1)}`;
  }
  return null;
}

describe('property generator', () => {
  it('is deterministic', () => {
    for (const { seed, lot } of lots().slice(0, 20)) {
      const a = generateProperty(seed, lot), b = generateProperty(seed, lot);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
    const a = generateProperty(1, lotForLawn(400, 'ranch', 'residential', 1.3));
    const b = generateProperty(2, lotForLawn(400, 'ranch', 'residential', 1.3));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('never puts solid obstacles inside the house', () => {
    for (const kind of ['residential', 'estate', 'commercial', 'park', 'golf'] as const) {
      for (let s = 0; s < 40; s++) {
        const style: HouseStyle = kind === 'estate' ? 'mansion' : kind === 'commercial' ? 'office' : kind === 'park' ? 'pavilion' : kind === 'golf' ? 'clubhouse' : 'colonial';
        const lawn = kind === 'residential' ? 400 : kind === 'estate' ? 2400 : kind === 'commercial' ? 4000 : kind === 'park' ? 10000 : 20000;
        const p = generateProperty(s * 101 + 3, lotForLawn(lawn, style, kind, kind === 'golf' ? 2.4 : 1.3));
        expect(solidOverlapsHouse(p)).toBeNull();
      }
    }
  });

  it('keeps obstacles inside the lot and off the fences', () => {
    for (const { seed, lot } of lots()) {
      const p = generateProperty(seed, lot);
      for (const o of p.obstacles) {
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x).toBeLessThanOrEqual(lot.w);
        expect(o.z).toBeGreaterThanOrEqual(0);
        expect(o.z).toBeLessThanOrEqual(lot.d);
        for (const f of p.fences) expect(fenceDist(f, o.x, o.z)).toBeGreaterThan(o.r);
      }
    }
  });

  it('beds do not overlap the house or hardscape', () => {
    for (const { seed, lot } of lots()) {
      const p = generateProperty(seed, lot);
      const hard = [...p.driveway, ...p.walkways, ...p.patios];
      for (const bed of p.beds) {
        const cx = bed.kind === 'rect' ? bed.rect.x : bed.x;
        const cz = bed.kind === 'rect' ? bed.rect.z : bed.z;
        expect(rectDist(p.house, cx, cz)).toBeGreaterThan(0);
        for (const h of hard) expect(inBed(bed, h.x, h.z)).toBe(false);
      }
    }
  });

  it('residential lawn is 50 to 70 percent of the lot', () => {
    for (const { seed, lot } of lots()) {
      const p = generateProperty(seed, lot);
      const frac = p.lawnM2 / (lot.w * lot.d);
      expect(frac, `${lot.style} ${lot.w}x${lot.d}`).toBeGreaterThan(0.5);
      expect(frac, `${lot.style} ${lot.w}x${lot.d}`).toBeLessThan(0.7);
    }
  });

  it('has the expected features', () => {
    for (const { seed, lot } of lots()) {
      const p = generateProperty(seed, lot);
      expect(p.driveway.length).toBeGreaterThan(0);
      expect(p.walkways.length).toBeGreaterThan(0);
      expect(p.beds.length).toBeGreaterThan(0);
      expect(p.obstacles.some((o) => o.kind.startsWith('tree'))).toBe(true);
      expect(p.obstacles.some((o) => o.kind === 'mailbox')).toBe(true);
      expect(p.hardscapeM2).toBeGreaterThan(0);
    }
    const golf = generateProperty(5, lotForLawn(20000, 'clubhouse', 'golf', 2.4));
    expect(golf.bunkers!.length).toBeGreaterThan(2);
  });

  it('is fast', () => {
    const all = lots();
    const t0 = performance.now();
    let n = 0;
    for (let k = 0; k < 20; k++) for (const { seed, lot } of all) { generateProperty(seed + k, lot); n++; }
    const per = (performance.now() - t0) / n;
    expect(per).toBeLessThan(0.5);
  });
});
