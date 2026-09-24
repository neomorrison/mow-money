// Low-detail yard props and trees for the neighborhood diorama (procedural, no GLB needed).
import * as THREE from 'three';
import type { Obstacle } from '../world/property';
import { makeRng, clamp } from '../core/rng';
import { boxGeo, lambert } from './houses';

const cyl = new Map<string, THREE.BufferGeometry>();
function cylGeo(rt: number, rb: number, h: number, seg = 10): THREE.BufferGeometry {
  const k = `${rt}|${rb}|${h}|${seg}`;
  let g = cyl.get(k);
  if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg); cyl.set(k, g); }
  return g;
}
export const SHARED_PROP_GEOS: THREE.BufferGeometry[] = [];
const ICO = new THREE.IcosahedronGeometry(1, 1);
const ICO0 = new THREE.IcosahedronGeometry(1, 0);
const CONE = new THREE.ConeGeometry(1, 1, 8);
const SPHERE = new THREE.SphereGeometry(1, 10, 8);
SHARED_PROP_GEOS.push(ICO, ICO0, CONE, SPHERE);
export function disposePropGeos(): void { cyl.forEach((g) => g.dispose()); cyl.clear(); }

function mesh(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, lambert(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** A tree whose canopy radius is about `size` meters. */
export function tree(kind: string, size: number, seed: number): THREE.Group {
  const rng = makeRng(seed ^ 0x3c6e);
  const g = new THREE.Group();
  const s = clamp(size, 1, 6);
  const pine = kind === 'tree_pine';
  const palm = kind === 'tree_palm';
  const trunkH = pine ? s * 0.7 : palm ? s * 2.4 : s * 1.1;
  const trunk = mesh(cylGeo(0.18, 0.28, 1, 7), kind === 'tree_birch' ? '#ece6da' : palm ? '#a07a52' : '#7a5236');
  trunk.scale.set(s * 0.55, trunkH, s * 0.55);
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  if (pine) {
    for (let i = 0; i < 3; i++) {
      const c = mesh(CONE, i % 2 ? '#2f6b3c' : '#35774a');
      const k = 1 - i * 0.26;
      c.scale.set(s * 1.05 * k, s * 1.25, s * 1.05 * k);
      c.position.y = trunkH + i * s * 0.72 + s * 0.4;
      g.add(c);
    }
  } else if (palm) {
    for (let i = 0; i < 6; i++) {
      const leaf = mesh(boxGeo(0.5, 0.08, 1), '#4f9a3a');
      const a = (i / 6) * Math.PI * 2;
      leaf.scale.set(1, 1, s * 1.1);
      leaf.position.set(Math.sin(a) * s * 0.5, trunkH, Math.cos(a) * s * 0.5);
      leaf.rotation.set(0.35, a, 0);
      g.add(leaf);
    }
  } else {
    const col = kind === 'tree_maple' ? rng.pick(['#4f9a3a', '#5aa541', '#d0702e', '#5aa541']) : kind === 'tree_birch' ? '#8cc152' : rng.pick(['#3f8a3a', '#4a9440', '#3a7f36']);
    const n = kind === 'tree_birch' ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const c = mesh(ICO, col);
      const k = rng.range(0.7, 1.0);
      c.scale.set(s * k, s * k * 0.9, s * k);
      c.position.set(rng.range(-0.4, 0.4) * s, trunkH + s * 0.5 + i * s * 0.25, rng.range(-0.4, 0.4) * s);
      g.add(c);
    }
  }
  g.rotation.y = rng.range(0, Math.PI * 2);
  return g;
}

/** Build the visual for one obstacle in lot-local coordinates (x already shifted to the lot middle). */
export function obstacleMesh(o: Obstacle, x: number, z: number, seed: number): THREE.Object3D | null {
  const sc = o.scale ?? 1;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = o.rot ?? 0;
  const rng = makeRng(seed);
  switch (o.kind) {
    case 'tree_oak': case 'tree_maple': case 'tree_pine': case 'tree_birch': case 'tree_palm':
    {
      const t = tree(o.kind, (o.kind === 'tree_birch' ? 1.5 : 2.1) * sc, seed);
      t.position.set(x, 0, z);
      return t;
    }
    case 'shrub_round': {
      const m = mesh(ICO, rng.pick(['#4d8a3c', '#3f7d35', '#5a9844']), 0, 0.5 * sc, 0);
      m.scale.set(0.8 * sc, 0.65 * sc, 0.8 * sc);
      g.add(m);
      break;
    }
    case 'rock_big': {
      const m = mesh(ICO0, '#9a968c', 0, 0.3, 0);
      m.scale.set(o.r, o.r * 0.55, o.r * 0.9);
      g.add(m);
      break;
    }
    case 'trampoline': {
      g.add(mesh(cylGeo(o.r, o.r, 0.12, 20), '#2d2d33', 0, 0.9, 0));
      g.add(mesh(cylGeo(o.r + 0.08, o.r + 0.08, 0.1, 20), '#3b7dd8', 0, 0.86, 0));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.add(mesh(boxGeo(0.08, 0.9, 0.08), '#555555', Math.cos(a) * o.r, 0.45, Math.sin(a) * o.r));
      }
      break;
    }
    case 'kiddie_pool':
      g.add(mesh(cylGeo(o.r, o.r, 0.3, 20), '#ff8fb1', 0, 0.15, 0));
      g.add(mesh(cylGeo(o.r * 0.86, o.r * 0.86, 0.32, 20), '#6cc7f0', 0, 0.17, 0, false));
      break;
    case 'swingset': {
      const w = 3.2;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const leg = mesh(boxGeo(0.1, 2.5, 0.1), '#c0392b', sx * w / 2, 1.2, sz * 0.5);
          leg.rotation.x = sz * 0.22;
          g.add(leg);
        }
      }
      g.add(mesh(boxGeo(w + 0.2, 0.12, 0.12), '#c0392b', 0, 2.4, 0));
      for (const sx of [-0.7, 0.7]) g.add(mesh(boxGeo(0.5, 0.06, 0.25), '#f2c230', sx, 0.6, 0));
      break;
    }
    case 'birdbath':
      g.add(mesh(cylGeo(0.1, 0.16, 0.9, 8), '#d8d3c8', 0, 0.45, 0));
      g.add(mesh(cylGeo(0.4, 0.25, 0.14, 12), '#d8d3c8', 0, 0.95, 0));
      break;
    case 'doghouse': {
      g.add(mesh(boxGeo(1.1, 0.8, 1.2), '#b5763f', 0, 0.4, 0));
      const roof = mesh(CONE, '#7a3b2e', 0, 1.05, 0);
      roof.scale.set(0.95, 0.5, 0.95);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      break;
    }
    case 'bench':
      g.add(mesh(boxGeo(1.6, 0.08, 0.45), '#8b5e3c', 0, 0.45, 0));
      g.add(mesh(boxGeo(1.6, 0.4, 0.08), '#8b5e3c', 0, 0.7, 0.2));
      for (const sx of [-0.7, 0.7]) g.add(mesh(boxGeo(0.08, 0.45, 0.4), '#333333', sx, 0.22, 0));
      break;
    case 'bbq':
      {
        const bowl = mesh(SPHERE, '#2b2b2b', 0, 0.85, 0);
        bowl.scale.set(0.35, 0.28, 0.35);
        g.add(bowl);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          g.add(mesh(boxGeo(0.05, 0.8, 0.05), '#444444', Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.2));
        }
      }
      break;
    case 'patio_set': {
      g.add(mesh(cylGeo(0.55, 0.55, 0.06, 14), '#f4f4f0', 0, 0.72, 0));
      g.add(mesh(cylGeo(0.05, 0.05, 2.2, 6), '#dddddd', 0, 1.1, 0));
      const um = mesh(CONE, rng.pick(['#e05a47', '#2f8f4e', '#3b6fb6', '#f2c230']), 0, 2.1, 0);
      um.scale.set(1.3, 0.45, 1.3);
      g.add(um);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        g.add(mesh(boxGeo(0.4, 0.45, 0.4), '#ededea', Math.cos(a) * 0.9, 0.23, Math.sin(a) * 0.9));
      }
      break;
    }
    case 'lamppost':
      g.add(mesh(boxGeo(0.12, 2.2, 0.12), '#2f3136', 0, 1.1, 0));
      g.add(mesh(boxGeo(0.3, 0.35, 0.3), '#fff3c4', 0, 2.3, 0));
      break;
    case 'mailbox':
      g.add(mesh(boxGeo(0.1, 1.1, 0.1), '#6b5540', 0, 0.55, 0));
      g.add(mesh(boxGeo(0.28, 0.28, 0.5), rng.pick(['#2f3d4a', '#b8322a', '#f4f4f4']), 0, 1.15, 0));
      break;
    case 'trashcan':
      g.add(mesh(cylGeo(0.3, 0.26, 1, 10), rng.pick(['#3a6e3a', '#3b4652', '#2f5d8a']), 0, 0.5, 0));
      break;
    case 'soccer_goal': {
      const w = 2.4;
      for (const sx of [-1, 1]) g.add(mesh(boxGeo(0.08, 1.2, 0.08), '#ffffff', sx * w / 2, 0.6, 0));
      g.add(mesh(boxGeo(w, 0.08, 0.08), '#ffffff', 0, 1.2, 0));
      break;
    }
    case 'flagpole':
      g.add(mesh(cylGeo(0.05, 0.07, 6, 6), '#dddddd', 0, 3, 0));
      g.add(mesh(boxGeo(1.2, 0.7, 0.03), '#c0392b', 0.62, 5.5, 0));
      break;
    case 'hose_reel':
    {
      const reel = mesh(cylGeo(0.3, 0.3, 0.2, 12), '#2e8b57', 0, 0.35, 0);
      reel.rotation.x = Math.PI / 2;
      g.add(reel);
    }
      break;
    case 'gnome': {
      g.add(mesh(cylGeo(0.1, 0.13, 0.25, 8), '#3b6fb6', 0, 0.12, 0, false));
      const head = mesh(SPHERE, '#f2d1b3', 0, 0.3, 0, false);
      head.scale.setScalar(0.08);
      g.add(head);
      const hat = mesh(CONE, '#d63a2f', 0, 0.44, 0, false);
      hat.scale.set(0.1, 0.22, 0.1);
      g.add(hat);
      break;
    }
    case 'ball': {
      const b = mesh(SPHERE, rng.pick(['#e05a47', '#3b6fb6', '#f2c230']), 0, 0.16, 0, false);
      b.scale.setScalar(0.16);
      g.add(b);
      break;
    }
    case 'sprinkler':
      return null;
    default: {
      g.add(mesh(boxGeo(o.r * 1.2, 0.8, o.r * 1.2), '#9b7a55', 0, 0.4, 0));
    }
  }
  return g;
}
