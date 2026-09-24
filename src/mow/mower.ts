// Arcade kinematics and collision for the mower and the walking character.
// Heading convention: forward = (sin h, cos h) in (x, z); a model facing +Z uses rotation.y = h.
import type { PropertyLayout, Obstacle, FenceSeg, Rect } from '../world/property';
import { inBed, fenceDist } from '../world/property';
import { SIDEWALK_Z } from './field';

export interface Colliders {
  circles: { x: number; z: number; r: number; ob: Obstacle | null }[];
  boxes: Rect[];
  fences: FenceSeg[];
  ponds: NonNullable<PropertyLayout['ponds']>;
  minX: number; maxX: number; minZ: number; maxZ: number;
}

export function buildColliders(L: PropertyLayout): Colliders {
  const circles: Colliders['circles'] = [];
  for (const o of L.obstacles) {
    if (!o.solid) continue;
    // trees block at the trunk; the canopy is overhead
    const r = o.kind === 'soccer_goal' ? 0.9 : o.r;
    circles.push({ x: o.x, z: o.z, r, ob: o });
  }
  return {
    circles, boxes: [L.house], fences: L.fences, ponds: L.ponds ?? [],
    minX: 0, maxX: L.lot.w, minZ: SIDEWALK_Z + 0.1, maxZ: L.lot.d,
  };
}

export interface Hit { kind: 'none' | 'solid' | 'house' | 'fence' | 'bounds' | 'water' | 'extra'; fence: FenceSeg | null; speedInto: number }

/**
 * Push a circle out of every collider. `edge` is how far the body may reach past the lot line
 * (0 means the circle stays inside). Returns what was hit most recently.
 */
export function resolve(c: Colliders, pos: { x: number; z: number }, r: number, boundR: number, extra: { x: number; z: number; r: number } | null, hit: Hit): void {
  hit.kind = 'none'; hit.fence = null;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (let i = 0; i < c.circles.length; i++) {
      const o = c.circles[i];
      const dx = pos.x - o.x, dz = pos.z - o.z;
      const min = r + o.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1e-4;
      const push = min - d;
      pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      hit.kind = 'solid'; moved = true;
    }
    if (extra) {
      const dx = pos.x - extra.x, dz = pos.z - extra.z;
      const min = r + extra.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 1e-4;
        pos.x += (dx / d) * (min - d); pos.z += (dz / d) * (min - d);
        hit.kind = 'extra'; moved = true;
      }
    }
    for (const b of c.boxes) {
      const hx = b.w / 2, hz = b.d / 2;
      const lx = pos.x - b.x, lz = pos.z - b.z;
      const cx = lx < -hx ? -hx : lx > hx ? hx : lx;
      const cz = lz < -hz ? -hz : lz > hz ? hz : lz;
      const dx = lx - cx, dz = lz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 0 && d2 < r * r) {
        const d = Math.sqrt(d2);
        pos.x += (dx / d) * (r - d); pos.z += (dz / d) * (r - d);
        hit.kind = 'house'; moved = true;
      } else if (d2 === 0) {
        // inside: leave by the nearest side
        const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
        if (px < pz) pos.x = b.x + Math.sign(lx || 1) * (hx + r);
        else pos.z = b.z + Math.sign(lz || 1) * (hz + r);
        hit.kind = 'house'; moved = true;
      }
    }
    for (const f of c.fences) {
      const t = f.kind === 'hedge' ? 0.38 : 0.08;
      const d = fenceDist(f, pos.x, pos.z);
      if (d >= r + t) continue;
      // nearest point
      const vx = f.x2 - f.x1, vz = f.z2 - f.z1;
      const l2 = vx * vx + vz * vz || 1e-9;
      let u = ((pos.x - f.x1) * vx + (pos.z - f.z1) * vz) / l2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const nx = pos.x - (f.x1 + vx * u), nz = pos.z - (f.z1 + vz * u);
      const nd = Math.hypot(nx, nz) || 1e-4;
      const push = r + t - nd;
      pos.x += (nx / nd) * push; pos.z += (nz / nd) * push;
      hit.kind = 'fence'; hit.fence = f; moved = true;
    }
    if (!moved) break;
  }
  for (const p of c.ponds) {
    if (inBed(p, pos.x, pos.z, r * 0.4)) { hit.kind = 'water'; break; }
  }
  const minX = c.minX + boundR, maxX = c.maxX - boundR, minZ = c.minZ + Math.min(boundR, 0.3), maxZ = c.maxZ - boundR;
  if (pos.x < minX) { pos.x = minX; if (hit.kind === 'none') hit.kind = 'bounds'; }
  if (pos.x > maxX) { pos.x = maxX; if (hit.kind === 'none') hit.kind = 'bounds'; }
  if (pos.z < minZ) { pos.z = minZ; if (hit.kind === 'none') hit.kind = 'bounds'; }
  if (pos.z > maxZ) { pos.z = maxZ; if (hit.kind === 'none') hit.kind = 'bounds'; }
}

export interface DriveInput {
  throttle: number;             // -1..1 keyboard
  steer: number;                // -1..1 keyboard (positive = turn left, counterclockwise seen from above)
  target: number | null;        // absolute heading from the stick, null when keyboard
  mag: number;                  // 0..1 stick magnitude
  slow: boolean;
}

export interface VehicleParams {
  maxSpeed: number;
  turnRate: number;
  zeroTurn: boolean;
  carSteer: boolean;            // ride-ons without zero turn steer like a car
  accel: number;
}

const wrapAngle = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export { wrapAngle };

export class Body {
  x = 0; z = 0; heading = 0;
  v = 0;         // signed forward speed (m/s)
  omega = 0;     // turn rate (rad/s)
  prevX = 0; prevZ = 0;
  hit: Hit = { kind: 'none', fence: null, speedInto: 0 };

  place(x: number, z: number, h: number) { this.x = this.prevX = x; this.z = this.prevZ = z; this.heading = h; this.v = 0; this.omega = 0; }

  /** Integrate one step. speedMult folds in grass, wet ground, perks and precision mode. */
  step(dt: number, inp: DriveInput, p: VehicleParams, speedMult: number) {
    this.prevX = this.x; this.prevZ = this.z;
    const vmax = p.maxSpeed * speedMult;
    let wantV = 0, wantW = 0;
    const turnRate = p.turnRate * (inp.slow ? 0.55 : 1);
    if (inp.target !== null && inp.mag > 0.05) {
      const err = wrapAngle(inp.target - this.heading);
      const aerr = Math.abs(err);
      if (p.carSteer) {
        // car-like: always roll forward while turning toward the target
        wantV = vmax * inp.mag * (aerr > 2.2 ? 0.45 : 1 - 0.4 * (aerr / Math.PI));
        wantW = Math.sign(err) * Math.min(turnRate, aerr * 4);
      } else {
        wantW = Math.sign(err) * Math.min(turnRate, aerr * 5);
        const align = Math.cos(Math.min(aerr, Math.PI / 2));
        wantV = vmax * inp.mag * (aerr > 1.3 ? (p.zeroTurn ? 0 : 0.15) : align * align);
      }
    } else {
      wantV = inp.throttle >= 0 ? inp.throttle * vmax : inp.throttle * vmax * 0.55;
      wantW = inp.steer * turnRate;
      if (!p.zeroTurn && !p.carSteer && Math.abs(inp.throttle) < 0.05) wantW *= 0.8;
    }
    if (p.carSteer) {
      const f = Math.min(1, Math.abs(this.v) / Math.max(0.5, vmax * 0.35));
      wantW *= f * Math.sign(this.v || 1);
    }
    const a = p.accel;
    this.v += (wantV - this.v) * Math.min(1, dt * (Math.abs(wantV) < Math.abs(this.v) ? a * 1.6 : a));
    this.omega += (wantW - this.omega) * Math.min(1, dt * 10);
    this.heading = wrapAngle(this.heading + this.omega * dt);
    this.x += Math.sin(this.heading) * this.v * dt;
    this.z += Math.cos(this.heading) * this.v * dt;
  }

  /** After collision resolution: bleed speed when the body was stopped by something. */
  afterCollide(dt: number) {
    const mx = this.x - this.prevX, mz = this.z - this.prevZ;
    const actual = (mx * Math.sin(this.heading) + mz * Math.cos(this.heading)) / Math.max(1e-4, dt);
    this.hit.speedInto = Math.abs(this.v) - Math.abs(actual);
    if (this.hit.kind !== 'none' && this.hit.kind !== 'bounds') {
      if (Math.abs(actual) < Math.abs(this.v)) this.v = actual * 0.9 + this.v * 0.1;
    }
  }
}
