// Automatic boustrophedon driving for headless tests (harness window.__mow.autoMow) and demos.
// Lanes run along z, spaced a little under one deck width. Each lane is split into the stretches the
// mower can reach; stretches are visited band by band (front yard, then the next band back) snaking
// across x. A stuck timer skips waypoints the mower cannot reach.
import { rectDist, fenceDist, inBed, type PropertyLayout } from '../world/property';
import type { Colliders } from './mower';
import type { Body } from './mower';

export class AutoPilot {
  private pts: { x: number; z: number }[] = [];
  private i = 0;
  private best = Infinity;
  private stuckT = 0;
  done = false;

  constructor(L: PropertyLayout, c: Colliders, private deckWidth: number, private rc: number, private arrive: number, startX: number, startZ: number) {
    const hw = deckWidth / 2;
    const W = L.lot.w, D = L.lot.d;
    const spacing = deckWidth * 0.85;
    const free = (x: number, z: number) => {
      for (const o of c.circles) if (Math.hypot(x - o.x, z - o.z) < o.r + rc + 0.05) return false;
      for (const b of c.boxes) if (rectDist(b, x, z) < rc + 0.05) return false;
      for (const f of c.fences) if (fenceDist(f, x, z) < rc + (f.kind === 'hedge' ? 0.42 : 0.12)) return false;
      for (const p of c.ponds) if (inBed(p, x, z, rc)) return false;
      for (const b of L.beds) if (inBed(b, x, z, hw * 0.9)) return false;
      for (const o of L.obstacles) if (!o.solid && Math.hypot(x - o.x, z - o.z) < o.r + hw + 0.1) return false;
      return true;
    };
    const lanes: { x: number; segs: [number, number][] }[] = [];
    const xs: number[] = [];
    for (let x = hw; x < W - hw; x += spacing) xs.push(x);
    xs.push(W - hw);
    const step = Math.max(0.2, D / 400);
    for (const x of xs) {
      const segs: [number, number][] = [];
      let s0 = -1;
      for (let z = 0.2; z <= D - hw; z += step) {
        const ok = free(x, z);
        if (ok && s0 < 0) s0 = z;
        if (!ok && s0 >= 0) { if (z - step - s0 > 0.6) segs.push([s0, z - step]); s0 = -1; }
      }
      if (s0 >= 0) segs.push([s0, D - hw]);
      lanes.push({ x, segs });
    }
    let cx = startX, cz = startZ;
    const maxBands = Math.max(...lanes.map((l) => l.segs.length), 0);
    for (let band = 0; band < maxBands; band++) {
      const order = band % 2 === 0 ? lanes : [...lanes].reverse();
      for (const l of order) {
        const s = l.segs[band];
        if (!s) continue;
        const a = { x: l.x, z: s[0] }, b = { x: l.x, z: s[1] };
        const first = Math.hypot(a.x - cx, a.z - cz) <= Math.hypot(b.x - cx, b.z - cz) ? a : b;
        const second = first === a ? b : a;
        this.pts.push(first, second);
        cx = second.x; cz = second.z;
      }
    }
    if (!this.pts.length) this.done = true;
  }

  get progress() { return this.pts.length ? this.i / this.pts.length : 1; }

  /** Target heading and throttle toward the current waypoint, or null when finished. */
  steer(b: Body, dt: number): { target: number; mag: number } | null {
    if (this.i >= this.pts.length) { this.done = true; return null; }
    const p = this.pts[this.i];
    const dx = p.x - b.x, dz = p.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d < this.arrive) { this.i++; this.best = Infinity; this.stuckT = 0; return this.steer(b, 0); }
    if (d < this.best - 0.08) { this.best = d; this.stuckT = 0; }
    else { this.stuckT += dt; if (this.stuckT > 2.2) { this.i++; this.best = Infinity; this.stuckT = 0; } }
    return { target: Math.atan2(dx, dz), mag: Math.max(0.35, Math.min(1, d / 1.2)) };
  }
}
