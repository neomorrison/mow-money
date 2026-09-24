// Minimap: the lot seen from above with the street at the bottom, mirrored so left and right match the
// chase view from the street. Cut, uncut and missed cells, the mower, the operator and the vehicle.
import { GrassField, LAWN, HARD, BED, BUILDING, SOLID, SAND, WATER } from './field';
import type { Obstacle } from '../world/property';

export class Minimap {
  private base: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private img: ImageData;
  private ctx: CanvasRenderingContext2D;
  private cssW = 176;
  private cssH = 176;
  private dpr = 1;
  private fit = { s: 1, ox: 0, oy: 0 };
  private hazards: Obstacle[] = [];

  /** Breakable props shown as dots so they can be steered around. */
  setHazards(list: Obstacle[]) { this.hazards = list; }

  constructor(private canvas: HTMLCanvasElement, private f: GrassField) {
    this.base = document.createElement('canvas');
    this.base.width = f.nx;
    this.base.height = f.nz;
    this.bctx = this.base.getContext('2d')!;
    this.img = this.bctx.createImageData(f.nx, f.nz);
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const w = this.canvas.parentElement?.clientWidth ? this.canvas.parentElement.clientWidth - 12 : 176;
    const aspect = this.f.nz / this.f.nx;
    this.cssW = Math.max(80, w);
    this.cssH = Math.min(this.cssW * 1.15, Math.max(this.cssW * 0.6, this.cssW * aspect));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.height = this.cssH + 'px';
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    const s = Math.min(this.cssW / this.f.nx, this.cssH / this.f.nz);
    this.fit = { s, ox: (this.cssW - this.f.nx * s) / 2, oy: (this.cssH - this.f.nz * s) / 2 };
  }

  /** Rebuild the base image from the field (a few times per second). `refIn`: the height unreached grass is held to. */
  redraw(refIn: number, flash: boolean, dirtHi = false) {
    const f = this.f, d = this.img.data;
    const nx = f.nx, nz = f.nz;
    for (let j = 0; j < nz; j++) {
      const row = nz - 1 - j;                 // back of the lot at the top
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const o = (row * nx + (nx - 1 - i)) * 4;   // mirrored x
        let r = 0, g = 0, b = 0, a = 255;
        switch (f.surf[k]) {
          case LAWN: {
            const h = f.h[k];
            const lim = f.limitAt(k, refIn);     // same rule as the coverage score
            if (h <= lim && f.cutBy[k]) {
              const hd = f.heading[k];
              const band = hd === hd && f.cutBy[k] === 1 ? (Math.cos(hd) > 0 ? 1 : 0) : 0.5;
              r = 132 + band * 22; g = 200 + band * 20; b = 92 + band * 10;
            } else if (h <= lim) { r = 92; g = 158; b = 64; }
            else if (flash) { r = 255; g = 140; b = 40; }
            else { r = 58; g = 118; b = 44; }
            if (f.leaves[k] > 0.2) { r = r * 0.5 + 110; g = g * 0.5 + 50; b = b * 0.5 + 10; }
            break;
          }
          case HARD: {
            r = 222; g = 216; b = 204;
            const dbr = Math.min(1, (f.debris[k] + f.leaves[k]) * 3);
            // clippings and leaves on concrete show bright so the cleanup is easy to find
            if (dbr > 0.08) {
              const t = Math.min(1, 0.45 + dbr * 0.55);
              const [cr, cg, cb] = dirtHi ? [255, 128, 24] : [120, 170, 50];
              r = r + (cr - r) * t; g = g + (cg - g) * t; b = b + (cb - b) * t;
            }
            break;
          }
          case BED: r = 140; g = 92; b = 58; break;
          case BUILDING: r = 196; g = 112; b = 86; break;
          case SOLID: r = 44; g = 86; b = 38; break;
          case SAND: r = 234; g = 217; b = 166; break;
          case WATER: r = 90; g = 166; b = 201; break;
          default: a = 0;
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
      }
    }
    this.bctx.putImageData(this.img, 0, 0);
  }

  /** Composite the base with live markers (every frame or two). */
  draw(mower: { x: number; z: number; h: number }, walker: { x: number; z: number; h: number } | null, vehicle: { x: number; z: number }, broken?: Set<Obstacle>) {
    const c = this.ctx, f = this.f;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.cssW, this.cssH);
    c.fillStyle = '#6f8f5a';
    c.fillRect(0, 0, this.cssW, this.cssH);
    c.imageSmoothingEnabled = true;
    const { s, ox, oy } = this.fit;
    c.drawImage(this.base, ox, oy, f.nx * s, f.nz * s);
    const px = (x: number) => ox + (f.nx - (x - f.x0) / f.cs) * s;
    const py = (z: number) => oy + (f.nz - (z - f.z0) / f.cs) * s;
    // vehicle
    c.fillStyle = '#2a7db8';
    c.beginPath();
    c.arc(px(vehicle.x), Math.min(this.cssH - 4, py(vehicle.z)), 4, 0, Math.PI * 2);
    c.fill();
    for (const o of this.hazards) {
      if (broken?.has(o)) continue;
      c.fillStyle = o.kind === 'sprinkler' ? '#2a8fd8' : o.kind === 'gnome' ? '#e0392b' : '#f2b01e';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(px(o.x), py(o.z), 2.6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    const arrow = (x: number, z: number, h: number, col: string, size: number) => {
      c.save();
      c.translate(px(x), py(z));
      // heading h points along (sin h, cos h) in world; screen: x mirrored, z up
      c.rotate(-h);
      c.beginPath();
      c.moveTo(0, -size);
      c.lineTo(size * 0.7, size * 0.8);
      c.lineTo(0, size * 0.4);
      c.lineTo(-size * 0.7, size * 0.8);
      c.closePath();
      c.fillStyle = col;
      c.strokeStyle = '#1c3a24';
      c.lineWidth = 1.5;
      c.fill();
      c.stroke();
      c.restore();
    };
    arrow(mower.x, mower.z, mower.h, '#ffc12e', 7);
    if (walker) arrow(walker.x, walker.z, walker.h, '#ffffff', 5.5);
  }
}
