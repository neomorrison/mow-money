// Procedural low-poly buildings for the neighborhood diorama, used when a house GLB is missing
// (and while it loads). Front door faces -Z (toward the street in the lot frame).
import * as THREE from 'three';
import type { HouseStyle } from '../core/types';
import { makeRng } from '../core/rng';

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function lambert(hex: string | number, opts: { emissive?: number } = {}): THREE.MeshLambertMaterial {
  const key = `${hex}|${opts.emissive ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: new THREE.Color(hex as THREE.ColorRepresentation) });
    if (opts.emissive) m.emissive = new THREE.Color(opts.emissive);
    matCache.set(key, m);
  }
  return m;
}
export function disposeHouseMaterials(): void {
  matCache.forEach((m) => m.dispose());
  matCache.clear();
  geoCache.forEach((g) => g.dispose());
  geoCache.clear();
}

const geoCache = new Map<string, THREE.BufferGeometry>();
export function boxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `b${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); geoCache.set(k, g); }
  return g;
}

/** Gable roof prism: ridge along X, width w (x), depth d (z), height h, base at y = 0. */
function gableGeo(w: number, d: number, h: number): THREE.BufferGeometry {
  const k = `g${w.toFixed(2)}|${d.toFixed(2)}|${h.toFixed(2)}`;
  let g = geoCache.get(k);
  if (g) return g;
  const hw = w / 2, hd = d / 2;
  // vertices: two triangles (ends) and two slopes
  const v = [
    // left end (x = -hw)
    -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
    // right end (x = +hw)
    hw, 0, hd, hw, 0, -hd, hw, h, 0,
    // front slope (z < 0)
    -hw, 0, -hd, -hw, h, 0, hw, h, 0,
    -hw, 0, -hd, hw, h, 0, hw, 0, -hd,
    // back slope (z > 0)
    -hw, 0, hd, hw, 0, hd, hw, h, 0,
    -hw, 0, hd, hw, h, 0, -hw, h, 0,
    // bottom
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd,
    -hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
  ];
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  geoCache.set(k, g);
  return g;
}

/** Hip-ish pyramid roof, base w x d, height h. */
function hipGeo(w: number, d: number, h: number): THREE.BufferGeometry {
  const k = `h${w.toFixed(2)}|${d.toFixed(2)}|${h.toFixed(2)}`;
  let g = geoCache.get(k);
  if (g) return g;
  const hw = w / 2, hd = d / 2, r = Math.max(0, hw - hd);
  const v = [
    -hw, 0, -hd, -r, h, 0, r, h, 0, -hw, 0, -hd, r, h, 0, hw, 0, -hd,
    hw, 0, hd, r, h, 0, -r, h, 0, hw, 0, hd, -r, h, 0, -hw, 0, hd,
    -hw, 0, hd, -r, h, 0, -hw, 0, -hd,
    hw, 0, -hd, r, h, 0, hw, 0, hd,
  ];
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  geoCache.set(k, g);
  return g;
}

const WALLS = ['#f4ead2', '#dfe9f0', '#cfe0c3', '#f6e3a6', '#b85c45', '#fbfbf7', '#c9c4bb', '#e8cfc0', '#a8c3d6', '#d9c7a3'];
const ROOFS = ['#4a4f57', '#6b4a3a', '#44576e', '#b5553c', '#5d5d5d', '#3f5a45'];
const DOORS = ['#b8322a', '#2f5d8a', '#2e6b3e', '#f2c230', '#3a3a3a', '#7a3d7a'];

function add(group: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function windows(g: THREE.Group, w: number, y: number, zFront: number, count: number, skipCenter: boolean, h = 1.1): void {
  const glass = lambert('#5d86a8');
  const frame = lambert('#ffffff');
  const step = w / (count + 1);
  for (let i = 1; i <= count; i++) {
    const x = -w / 2 + step * i;
    if (skipCenter && Math.abs(x) < step * 0.6) continue;
    add(g, boxGeo(1.25, h + 0.2, 0.08), frame, x, y, zFront - 0.03, false);
    add(g, boxGeo(1.0, h, 0.1), glass, x, y, zFront - 0.06, false);
  }
}

/**
 * Build a house of the given style fitting a footprint w x d (meters). Returns a group whose origin is
 * the footprint center on the ground; the front door faces -Z.
 */
export function proceduralHouse(style: HouseStyle, w: number, d: number, seed: number): THREE.Group {
  const rng = makeRng(seed ^ 0x9e37);
  const g = new THREE.Group();
  const wall = lambert(rng.pick(WALLS));
  const roof = lambert(rng.pick(ROOFS));
  const door = lambert(rng.pick(DOORS));
  const trim = lambert('#ffffff');
  const W = Math.max(4, w), D = Math.max(4, d);
  const front = -D / 2;
  const doorAt = (x: number, h = 2.1) => {
    add(g, boxGeo(1.3, h + 0.2, 0.1), trim, x, h / 2 + 0.05, front - 0.04, false);
    add(g, boxGeo(1.0, h, 0.14), door, x, h / 2, front - 0.07, false);
  };
  const porchStep = (x: number) => add(g, boxGeo(2.2, 0.25, 1.1), lambert('#b9b2a6'), x, 0.12, front - 0.55);

  switch (style) {
    case 'ranch': {
      const h = 3;
      add(g, boxGeo(W, h, D), wall, 0, h / 2, 0);
      add(g, hipGeo(W + 0.8, D + 0.8, 1.9), roof, 0, h, 0);
      windows(g, W, 1.6, front, Math.max(2, Math.round(W / 3.2)), true);
      doorAt(0); porchStep(0);
      break;
    }
    case 'cottage': {
      const h = 2.8;
      add(g, boxGeo(W, h, D), wall, 0, h / 2, 0);
      const r = add(g, gableGeo(W + 0.6, D + 0.7, 3.2), roof, 0, h, 0);
      r.castShadow = true;
      add(g, boxGeo(0.7, 1.6, 0.7), lambert('#8c5a44'), W * 0.28, h + 2.2, D * 0.15);
      windows(g, W, 1.5, front, 2, true);
      doorAt(0); porchStep(0);
      break;
    }
    case 'colonial': {
      const h = 5.8;
      add(g, boxGeo(W, h, D), wall, 0, h / 2, 0);
      add(g, gableGeo(W + 0.6, D + 0.8, 2.6), roof, 0, h, 0);
      const n = Math.max(3, Math.round(W / 2.8));
      windows(g, W, 1.5, front, n, true);
      windows(g, W, 4.3, front, n, false);
      doorAt(0, 2.3);
      add(g, boxGeo(2.6, 0.2, 1.6), trim, 0, 2.9, front - 0.8);
      add(g, boxGeo(0.2, 2.8, 0.2), trim, -1.1, 1.4, front - 1.5);
      add(g, boxGeo(0.2, 2.8, 0.2), trim, 1.1, 1.4, front - 1.5);
      porchStep(0);
      break;
    }
    case 'modern': {
      const h1 = 3.2, h2 = 3.0;
      add(g, boxGeo(W, h1, D), wall, 0, h1 / 2, 0);
      const w2 = W * 0.62, d2 = D * 0.8;
      add(g, boxGeo(w2, h2, d2), lambert('#f7f7f2'), W * 0.18, h1 + h2 / 2, D * 0.08);
      add(g, boxGeo(W + 0.4, 0.25, D + 0.4), lambert('#3d3d3d'), 0, h1 + 0.1, 0);
      add(g, boxGeo(w2 + 0.4, 0.25, d2 + 0.4), lambert('#3d3d3d'), W * 0.18, h1 + h2 + 0.1, D * 0.08);
      add(g, boxGeo(W * 0.5, 2.2, 0.1), lambert('#6d95b5'), -W * 0.18, 1.5, front - 0.06, false);
      add(g, boxGeo(w2 * 0.8, 1.8, 0.1), lambert('#6d95b5'), W * 0.18, h1 + 1.5, D * 0.08 - d2 / 2 - 0.06, false);
      doorAt(W * 0.3);
      break;
    }
    case 'mansion': {
      const h = 7.4;
      const cw = W * 0.5;
      add(g, boxGeo(cw, h, D), wall, 0, h / 2, 0);
      add(g, hipGeo(cw + 0.8, D + 0.8, 3), roof, 0, h, 0);
      const ww = W * 0.26, wh = 5.4, wd = D * 0.8;
      for (const s of [-1, 1]) {
        add(g, boxGeo(ww, wh, wd), wall, s * (cw / 2 + ww / 2), wh / 2, D * 0.08);
        add(g, hipGeo(ww + 0.6, wd + 0.6, 2.2), roof, s * (cw / 2 + ww / 2), wh, D * 0.08);
        windows(g, ww, 1.6, D * 0.08 - wd / 2, 2, false);
        windows(g, ww, 4.0, D * 0.08 - wd / 2, 2, false);
      }
      windows(g, cw, 1.6, front, 3, true);
      windows(g, cw, 4.4, front, 3, false);
      doorAt(0, 2.6);
      for (const x of [-1.8, -0.6, 0.6, 1.8]) add(g, boxGeo(0.35, 5.8, 0.35), trim, x, 2.9, front - 1.6);
      add(g, boxGeo(4.6, 0.4, 2.2), trim, 0, 5.9, front - 1.1);
      add(g, boxGeo(5, 0.3, 2.6), lambert('#c9c2b4'), 0, 0.15, front - 1.3);
      break;
    }
    case 'office': {
      const h = 7.5;
      add(g, boxGeo(W, h, D), lambert('#8fa9bd'), 0, h / 2, 0);
      for (let y = 1.4; y < h - 0.5; y += 2.4) add(g, boxGeo(W + 0.05, 0.35, D + 0.05), lambert('#e9eef2'), 0, y + 1.0, 0);
      add(g, boxGeo(W + 0.3, 0.3, D + 0.3), lambert('#4c5560'), 0, h + 0.15, 0);
      add(g, boxGeo(3.6, 2.6, 0.2), lambert('#2d3d4c'), 0, 1.3, front - 0.1);
      add(g, boxGeo(5, 0.2, 2.2), lambert('#dcdcdc'), 0, 2.9, front - 1);
      break;
    }
    case 'church': {
      const h = 6;
      add(g, boxGeo(W * 0.7, h, D), lambert('#efe7da'), 0, h / 2, 0);
      add(g, gableGeo(W * 0.7 + 0.6, D + 0.6, 4.2), lambert('#5b3a2e'), 0, h, 0);
      add(g, boxGeo(3, 11, 3), lambert('#efe7da'), 0, 5.5, front + 1.5);
      add(g, hipGeo(3.4, 3.4, 4.5), lambert('#5b3a2e'), 0, 11, front + 1.5);
      doorAt(0, 3);
      break;
    }
    case 'school': {
      const h = 4.2;
      add(g, boxGeo(W, h, D * 0.6), lambert('#b8603e'), 0, h / 2, -D * 0.2);
      add(g, boxGeo(W * 0.3, h, D), lambert('#b8603e'), -W * 0.35, h / 2, 0);
      add(g, boxGeo(W + 0.3, 0.3, D * 0.6 + 0.3), lambert('#e3ddd2'), 0, h + 0.1, -D * 0.2);
      windows(g, W, 2.2, front + D * 0.2, Math.max(4, Math.round(W / 2.5)), true, 1.5);
      doorAt(0, 2.6);
      add(g, boxGeo(0.12, 7, 0.12), lambert('#dddddd'), W * 0.3, 3.5, front - 3);
      break;
    }
    case 'clubhouse': {
      const h = 4.6;
      add(g, boxGeo(W, h, D), lambert('#f3eee0'), 0, h / 2, 0);
      add(g, hipGeo(W + 1.2, D + 1.2, 3.4), lambert('#2f4f3a'), 0, h, 0);
      windows(g, W, 2.2, front, Math.max(4, Math.round(W / 2.6)), true, 1.8);
      doorAt(0, 2.6);
      add(g, boxGeo(W * 0.6, 0.25, 3), lambert('#c9c2b4'), 0, 0.12, front - 1.5);
      break;
    }
    case 'pavilion': {
      const h = 3.4;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, boxGeo(0.35, h, 0.35), lambert('#7a5a3c'), sx * (W / 2 - 0.3), h / 2, sz * (D / 2 - 0.3));
      add(g, hipGeo(W + 1, D + 1, 2.4), lambert('#9a4b33'), 0, h, 0);
      add(g, boxGeo(W, 0.2, D), lambert('#c7c0b2'), 0, 0.1, 0);
      for (let i = -1; i <= 1; i++) add(g, boxGeo(2.4, 0.8, 0.9), lambert('#8b6b4a'), i * W * 0.28, 0.45, 0);
      break;
    }
  }
  return g;
}

/** Default building height (m) for marker placement. */
export function houseHeight(style: HouseStyle): number {
  switch (style) {
    case 'ranch': return 5;
    case 'cottage': return 6.2;
    case 'colonial': return 8.6;
    case 'modern': return 6.6;
    case 'mansion': return 10.5;
    case 'office': return 8;
    case 'church': return 15.5;
    case 'school': return 5;
    case 'clubhouse': return 8;
    case 'pavilion': return 6;
  }
  return 6;
}
