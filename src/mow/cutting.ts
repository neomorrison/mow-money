// What the deck, the trimmer and the blower do to the grass field. No allocations in these hot paths:
// outcomes are written into reusable objects.
import { GrassField, LAWN, HARD, BED, SAND } from './field';

export interface DeckParams {
  x: number; z: number; prevX: number; prevZ: number; heading: number;
  width: number; length: number;
  deckIn: number; deckIndex: number;
  maxGrassIn: number;
  stripeVis: number;           // 0..1 how strongly the cut lays the grass over
  bagActive: boolean;
  mulching: boolean;
  discharge: number;           // 0..1 share of clippings thrown out the side chute
  wet: boolean;
  autoStripe: boolean;         // striping kit or perk: the lean follows fixed bands along z, not the heading
  bandW: number;               // auto stripe band width (m)
  frame: number;
  time: number;
  dt: number;
}

export interface DeckOutcome {
  cells: number;               // lawn cells under the deck
  cutCells: number;            // cells whose height went down this frame
  removed: number;             // inches removed, summed over cells
  tallest: number;             // tallest grass cut this frame (inches)
  bagAdd: number;              // m2 of clippings collected
  clumpsLaid: number;
  bedHits: Int32Array;         // per bed id: cells of that bed under the deck
  bedTouched: number[];        // bed ids with hits this frame
  leavesMulched: number;
  newCells: number;            // cells cut for the first time
  pushedOver: number;          // cells only pushed over (grass above max height)
}

export function makeDeckOutcome(beds: number): DeckOutcome {
  return { cells: 0, cutCells: 0, removed: 0, tallest: 0, bagAdd: 0, clumpsLaid: 0, bedHits: new Int32Array(Math.max(1, beds)), bedTouched: [], leavesMulched: 0, newCells: 0, pushedOver: 0 };
}

function hashf(i: number, j: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Cut the swept deck rectangle between the previous and current positions. */
export function cutDeck(f: GrassField, p: DeckParams, out: DeckOutcome): void {
  out.cells = 0; out.cutCells = 0; out.removed = 0; out.tallest = 0; out.bagAdd = 0; out.clumpsLaid = 0;
  out.leavesMulched = 0; out.newCells = 0; out.pushedOver = 0;
  for (const b of out.bedTouched) out.bedHits[b] = 0;
  out.bedTouched.length = 0;

  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const rx = -fz, rz = fx;                         // right-hand side of the mower
  const hw = p.width / 2, hl = p.length / 2;
  const pa = (p.prevX - p.x) * fx + (p.prevZ - p.z) * fz;   // previous position along the heading
  const a0 = Math.min(-hl, pa - hl), a1 = Math.max(hl, pa + hl);
  // bounding box of the swept rectangle
  const ext = Math.max(Math.abs(a0), Math.abs(a1)) + hw;
  const cs = f.cs, nx = f.nx, nz = f.nz;
  const i0 = Math.max(0, Math.floor((p.x - ext - f.x0) / cs)), i1 = Math.min(nx - 1, Math.floor((p.x + ext - f.x0) / cs));
  const j0 = Math.max(0, Math.floor((p.z - ext - f.z0) / cs)), j1 = Math.min(nz - 1, Math.floor((p.z + ext - f.z0) / cs));
  const surf = f.surf, h = f.h;
  const cellA = f.cellArea;
  for (let j = j0; j <= j1; j++) {
    const dz = f.z0 + (j + 0.5) * cs - p.z;
    for (let i = i0; i <= i1; i++) {
      const dx = f.x0 + (i + 0.5) * cs - p.x;
      const along = dx * fx + dz * fz;
      if (along < a0 || along > a1) continue;
      const across = dx * rx + dz * rz;
      if (across < -hw || across > hw) continue;
      const k = j * nx + i;
      const s = surf[k];
      if (s === BED) {
        const b = f.bedId[k];
        if (b >= 0) { if (out.bedHits[b] === 0) out.bedTouched.push(b); out.bedHits[b]++; }
        continue;
      }
      if (s !== LAWN) {
        // the deck sweeps loose leaves off hard surfaces a little (vacuum effect with a bag)
        if (p.bagActive && f.leaves[k] > 0) { f.leaves[k] = Math.max(0, f.leaves[k] - p.dt * 2); f.markC(k); }
        continue;
      }
      out.cells++;
      const newPass = f.passFrame[k] !== p.frame - 1 && f.passFrame[k] !== p.frame;
      f.passFrame[k] = p.frame;
      const hb = h[k];
      let changedC = false;
      if (hb > p.deckIn + 0.01 && newPass) {
        let nh: number;
        if (hb > p.maxGrassIn) { nh = hb - (hb - p.deckIn) * 0.5; out.pushedOver++; }
        else nh = p.deckIn;
        const rem = hb - nh;
        h[k] = nh;
        out.cutCells++;
        out.removed += rem;
        if (hb > out.tallest) out.tallest = hb;
        if (!f.cutOnce[k]) { f.cutOnce[k] = 1; f.uniqueCutCells++; out.newCells++; }
        f.mowerCutCells++;
        f.cutAreaByDeck[p.deckIndex] += cellA;
        f.cutAt[k] = p.deckIn;
        changedC = true;
        const vol = cellA * rem / 3;       // m2 of full-height clippings
        if (p.bagActive) {
          out.bagAdd += vol;
        } else {
          const clumpy = (hb > 5 && !(p.mulching && hb < 7)) || p.wet;
          if (clumpy) {
            f.clump[k] = Math.min(1, f.clump[k] + (rem / 3.5) * (p.wet ? 1.3 : 1));
            f.newClumpT[k] = p.time;
            out.clumpsLaid++;
            changedC = true;
          }
          if (p.discharge > 0) {
            // the side chute throws clippings to the right of the deck
            const dist = hw + 0.3 + hashf(i, j) * 0.55;
            const tx = p.x + rx * dist + fx * along, tz = p.z + rz * dist + fz * along;
            const kk = f.idx(tx, tz);
            if (kk >= 0 && (surf[kk] === HARD || surf[kk] === SAND)) {
              const amt = vol * p.discharge * 14;
              f.debris[kk] = Math.min(1, f.debris[kk] + amt);
              f.generatedDebris += amt;
              f.markC(kk);
            }
          }
        }
      } else {
        // grass already at or under the deck: the pass still counts as mowing it at this height
        if (f.cutAt[k] === 0 && hb <= p.deckIn + 0.01) { f.cutAt[k] = p.deckIn; changedC = true; }
        if (f.clump[k] > 0 && p.time - f.newClumpT[k] > 1.2) {
          // mowing over old clumps again chops them up
          f.clump[k] = Math.max(0, f.clump[k] - p.dt * 5);
          changedC = true;
        }
      }
      if (f.leaves[k] > 0) {
        const before = f.leaves[k];
        f.leaves[k] = Math.max(0, before - p.dt * (p.bagActive ? 6 : 3.2));
        out.leavesMulched += before - f.leaves[k];
        if (p.bagActive) out.bagAdd += (before - f.leaves[k]) * cellA * 0.15;
        changedC = true;
      }
      if (p.autoStripe) {
        // bands across x, alternating direction: perfect stripes however the mower was driven
        const band = Math.floor((f.x0 + (i + 0.5) * cs) / p.bandW);
        f.heading[k] = (band & 1) === 0 ? 0 : Math.PI;
      } else f.heading[k] = p.heading;
      f.lean[k] = p.stripeVis;
      f.cutBy[k] = 1;
      f.markA(k);
      if (changedC) f.markC(k);
    }
  }
}

export interface TrimOutcome { cells: number; cut: number; removed: number; tallest: number }

/** String trimmer or shears: a circle that cuts lawn cells down to the deck height, edges included. */
export function trim(f: GrassField, x: number, z: number, radius: number, deckIn: number, rate: number, dt: number, out: TrimOutcome): void {
  out.cells = 0; out.cut = 0; out.removed = 0; out.tallest = 0;
  const cs = f.cs;
  const i0 = Math.max(0, Math.floor((x - radius - f.x0) / cs)), i1 = Math.min(f.nx - 1, Math.floor((x + radius - f.x0) / cs));
  const j0 = Math.max(0, Math.floor((z - radius - f.z0) / cs)), j1 = Math.min(f.nz - 1, Math.floor((z + radius - f.z0) / cs));
  const r2 = radius * radius;
  for (let j = j0; j <= j1; j++) {
    const dz = f.z0 + (j + 0.5) * cs - z;
    for (let i = i0; i <= i1; i++) {
      const dx = f.x0 + (i + 0.5) * cs - x;
      if (dx * dx + dz * dz > r2) continue;
      const k = j * f.nx + i;
      if (f.surf[k] !== LAWN) continue;
      out.cells++;
      const hb = f.h[k];
      if (hb > deckIn + 0.01) {
        const nh = Math.max(deckIn, hb - rate * dt);
        f.h[k] = nh;
        out.cut++;
        out.removed += hb - nh;
        if (hb > out.tallest) out.tallest = hb;
        if (nh <= deckIn + 0.01) {
          if (!f.cutOnce[k]) { f.cutOnce[k] = 1; f.uniqueCutCells++; }
          f.cutAt[k] = deckIn;
        }
        if (f.cutBy[k] !== 1) f.cutBy[k] = 2;
        f.markA(k);
        f.markC(k);
      } else {
        if (f.cutAt[k] === 0) { f.cutAt[k] = deckIn; f.markC(k); }
        if (f.cutBy[k] === 0) { f.cutBy[k] = 2; f.markA(k); }
      }
    }
  }
}

export interface BlowOutcome { moved: number; cells: number }

/**
 * Blower or broom: a cone in front of the operator pushes clippings and leaves along the blow direction.
 * Anything pushed onto the lawn or out of the grid is gone for the cleanup score (clippings disperse);
 * leaves blown onto the lawn stay there until mowed.
 */
export function blow(f: GrassField, x: number, z: number, heading: number, radius: number, halfAngle: number, strength: number, dt: number, out: BlowOutcome): void {
  out.moved = 0; out.cells = 0;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const cosA = Math.cos(halfAngle);
  const cs = f.cs;
  const step = Math.max(cs * 1.5, 0.35);
  const i0 = Math.max(0, Math.floor((x - radius - f.x0) / cs)), i1 = Math.min(f.nx - 1, Math.floor((x + radius - f.x0) / cs));
  const j0 = Math.max(0, Math.floor((z - radius - f.z0) / cs)), j1 = Math.min(f.nz - 1, Math.floor((z + radius - f.z0) / cs));
  // iterate far to near along the blow direction so material does not jump twice in one frame
  const jStart = fz >= 0 ? j1 : j0, jEnd = fz >= 0 ? j0 - 1 : j1 + 1, jStep = fz >= 0 ? -1 : 1;
  const iStart = fx >= 0 ? i1 : i0, iEnd = fx >= 0 ? i0 - 1 : i1 + 1, iStep = fx >= 0 ? -1 : 1;
  for (let j = jStart; j !== jEnd; j += jStep) {
    const dz = f.z0 + (j + 0.5) * cs - z;
    for (let i = iStart; i !== iEnd; i += iStep) {
      const dx = f.x0 + (i + 0.5) * cs - x;
      const d = Math.hypot(dx, dz);
      if (d > radius || d < 0.05) continue;
      if ((dx * fx + dz * fz) / d < cosA) continue;
      const k = j * f.nx + i;
      const deb = f.debris[k], lv = f.leaves[k];
      if (deb <= 0 && lv <= 0) continue;
      out.cells++;
      const s = f.surf[k];
      const onLawn = s === LAWN;
      // leaves lying in the grass are hard to move; hard surfaces clear fast
      const k1 = Math.min(1, dt * strength * (1 - 0.6 * d / radius) * (onLawn ? 0.35 : 1));
      if (k1 <= 0) continue;
      const tx = x + dx + fx * step, tz = z + dz + fz * step;
      const kk = f.idx(tx, tz);
      const md = deb * k1, ml = lv * k1;
      f.debris[k] = deb - md;
      f.leaves[k] = lv - ml;
      out.moved += md + ml;
      f.markC(k);
      if (kk >= 0) {
        const ts = f.surf[kk];
        if (ts === HARD || ts === SAND) { f.debris[kk] = Math.min(1.5, f.debris[kk] + md); f.leaves[kk] = Math.min(1.5, f.leaves[kk] + ml); f.markC(kk); }
        else if (ts === LAWN) { f.leaves[kk] = Math.min(1.5, f.leaves[kk] + ml * 0.6); if (ml > 0) f.markC(kk); }
        // beds, buildings and everything else swallow it
      }
    }
  }
}

export { BED };
