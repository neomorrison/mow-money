import { describe, it, expect } from 'vitest';
import { makeRng, hashSeed } from '../src/core/rng';
import { encodeSave, decodeSave } from '../src/core/save';

describe('core', () => {
  it('rng is deterministic', () => {
    const a = makeRng(42), b = makeRng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
    expect(hashSeed('maple', 3)).toBe(hashSeed('maple', 3));
    expect(hashSeed('maple', 3)).not.toBe(hashSeed('maple', 4));
  });
  it('save codec round-trips', () => {
    const s: any = { v: 1, day: 3, cash: 12.5, clients: [{ id: 'c1' }] };
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
});
