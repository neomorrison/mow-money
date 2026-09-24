// Visuals for the mower and the operator: GLB when available, procedural otherwise. The character walks,
// pushes, sits or stands depending on the mower and the tool in hand.
import * as THREE from 'three';
import type { EquipmentSpec } from '../core/types';
import { instantiateModel } from '../core/assets';
import { ModelKit, markShared, tintBody } from './models';

const JOINTS = ['Head', 'Torso', 'ArmL', 'ArmR', 'LegL', 'LegR'] as const;
type Joint = (typeof JOINTS)[number];

interface Spinner { obj: THREE.Object3D; r: number; rest: number; rate: number }

export class MowerVisual {
  root = new THREE.Group();
  inner: THREE.Object3D;
  seat: THREE.Vector3 | null;
  handle: THREE.Vector3 | null;
  /** Where the operator goes (GLB 'Driver' empty): feet for walk-behinds and stand-ons, character root when seated. */
  driver: THREE.Vector3 | null = null;
  private spinners: Spinner[] = [];
  private disposed = false;

  constructor(private kit: ModelKit, spec: EquipmentSpec, color: THREE.Color) {
    const p = kit.mower(spec, color.getHex());
    this.inner = p.group;
    this.seat = p.seat;
    this.handle = p.handle;
    this.root.add(this.inner);
    instantiateModel(spec.model).then((m) => {
      if (!m || this.disposed) return;
      markShared(m);
      tintBody(m, color);
      // a seat or handle node in the GLB wins over the procedural guess
      m.updateMatrixWorld(true);
      const box = new THREE.Box3(), size = new THREE.Vector3();
      m.traverse((o) => {
        if (o.name === 'Driver') { this.driver = new THREE.Vector3(); o.getWorldPosition(this.driver); }
        const wheel = /^Wheel/i.test(o.name), reel = /^Reel/i.test(o.name);
        if (wheel || reel) {
          box.setFromObject(o); box.getSize(size);
          const r = Math.max(0.05, Math.max(size.y, size.z) / 2);
          this.spinners.push({ obj: o, r, rest: o.rotation.x, rate: reel ? 3 : 1 });
        }
      });
      this.root.remove(this.inner);
      this.inner.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.geometry.dispose(); });
      this.inner = m;
      this.root.add(m);
    }).catch(() => {});
  }
  private rolled = 0;
  /** Roll the wheels (and reels) by a signed distance in meters. */
  roll(ds: number) {
    if (!this.spinners.length || ds === 0) return;
    this.rolled += ds;
    for (const w of this.spinners) w.obj.rotation.x = w.rest + (this.rolled / w.r) * w.rate;
  }

  dispose() { this.disposed = true; }
}

export type Pose = 'stand' | 'walk' | 'push' | 'sit' | 'standon' | 'trim' | 'blow' | 'broom';

export class Character {
  root = new THREE.Group();
  private model: THREE.Object3D;
  private joints: Partial<Record<Joint, THREE.Object3D>> = {};
  private rest: Partial<Record<Joint, THREE.Euler>> = {};
  private phase = 0;
  private toolObj: THREE.Object3D | null = null;
  private disposed = false;

  constructor(private kit: ModelKit, shirt: THREE.Color) {
    this.model = kit.person(shirt.getHex());
    this.root.add(this.model);
    this.bind(this.model);
    instantiateModel('char_worker').then((m) => {
      if (!m || this.disposed) return;
      const found: Partial<Record<Joint, THREE.Object3D>> = {};
      m.traverse((o) => { for (const j of JOINTS) if (o.name === j) found[j] = o; });
      if (JOINTS.some((j) => !found[j])) return;   // not rigged the way we animate: keep procedural
      markShared(m);
      tintBody(m, shirt);
      this.root.remove(this.model);
      this.model.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.geometry.dispose(); });
      this.model = m;
      this.root.add(m);
      this.bind(m);
    }).catch(() => {});
  }

  private bind(m: THREE.Object3D) {
    this.joints = {};
    this.rest = {};
    m.traverse((o) => {
      for (const j of JOINTS) if (o.name === j && !this.joints[j]) { this.joints[j] = o; this.rest[j] = o.rotation.clone(); }
    });
  }

  setTool(kind: 'trimmer' | 'blower' | 'backpack' | 'broom' | 'shears' | null) {
    if (this.toolObj) {
      this.root.remove(this.toolObj);
      this.toolObj.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.geometry.dispose(); });
      this.toolObj = null;
    }
    if (kind) { this.toolObj = this.kit.tool(kind); this.root.add(this.toolObj); }
  }

  private rot(j: Joint, x: number, z = 0) {
    const o = this.joints[j], r = this.rest[j];
    if (!o || !r) return;
    o.rotation.set(r.x + x, r.y, r.z + z);
  }

  /** speed in m/s drives the stride. */
  animate(pose: Pose, speed: number, dt: number, t: number) {
    this.phase += dt * (2.2 + speed * 2.6) * (speed > 0.05 ? 1 : 0);
    const sw = Math.min(1, speed / 1.6);
    const s = Math.sin(this.phase);
    const bob = Math.abs(Math.cos(this.phase)) * 0.03 * sw;
    this.model.position.y = 0;
    switch (pose) {
      case 'sit':
        this.rot('LegL', -1.45); this.rot('LegR', -1.45);
        this.rot('ArmL', -0.95, 0.1); this.rot('ArmR', -0.95, -0.1);
        this.rot('Torso', 0.05); this.rot('Head', Math.sin(t * 0.7) * 0.05);
        break;
      case 'standon':
        this.rot('LegL', 0); this.rot('LegR', 0);
        this.rot('ArmL', -0.75); this.rot('ArmR', -0.75);
        this.rot('Torso', 0.08); this.rot('Head', 0);
        break;
      case 'push':
        this.rot('LegL', s * 0.55 * sw); this.rot('LegR', -s * 0.55 * sw);
        this.rot('ArmL', -0.8 + s * 0.04 * sw); this.rot('ArmR', -0.8 - s * 0.04 * sw);
        this.rot('Torso', 0.14); this.rot('Head', -0.08);
        this.model.position.y = bob;
        break;
      case 'trim':
        this.rot('LegL', s * 0.5 * sw); this.rot('LegR', -s * 0.5 * sw);
        this.rot('ArmL', -0.7 + Math.sin(t * 5) * 0.08); this.rot('ArmR', -0.55 + Math.sin(t * 5) * 0.08);
        this.rot('Torso', 0.12); this.rot('Head', -0.15);
        if (this.toolObj) this.toolObj.rotation.y = Math.sin(t * 3.2) * 0.35;
        this.model.position.y = bob;
        break;
      case 'blow':
      case 'broom':
        this.rot('LegL', s * 0.5 * sw); this.rot('LegR', -s * 0.5 * sw);
        this.rot('ArmL', -0.5 + (pose === 'broom' ? Math.sin(t * 4) * 0.25 : 0)); this.rot('ArmR', -0.6 + (pose === 'broom' ? Math.sin(t * 4) * 0.25 : 0));
        this.rot('Torso', 0.06); this.rot('Head', -0.1);
        if (this.toolObj) this.toolObj.rotation.y = pose === 'blow' ? Math.sin(t * 1.3) * 0.25 : 0;
        this.model.position.y = bob;
        break;
      default:
        this.rot('LegL', s * 0.6 * sw); this.rot('LegR', -s * 0.6 * sw);
        this.rot('ArmL', -s * 0.5 * sw); this.rot('ArmR', s * 0.5 * sw);
        this.rot('Torso', 0); this.rot('Head', 0);
        this.model.position.y = bob;
    }
  }

  dispose() { this.disposed = true; }
}
