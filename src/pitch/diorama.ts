// Neighborhood diorama: a three.js scene of every lot in a neighborhood, with lawns tinted by grass
// height (neat striped green for clients, shaggy yellow-green when overgrown), houses, driveways,
// trees and beds from generateProperty, streets with sidewalks and curbs, and a camera the player
// can pan, zoom and tap. HTML markers float over the houses.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HouseView } from '../core/types';
import { generateProperty, type BedShape, type PropertyLayout } from '../world/property';
import { instantiateModel } from '../core/assets';
import { makeRng, clamp } from '../core/rng';
import { proceduralHouse, houseHeight, lambert, disposeHouseMaterials } from './houses';
import { obstacleMesh, tree, disposePropGeos, SHARED_PROP_GEOS } from './props';

export type MarkerKind = 'client' | 'lead' | 'hoa' | 'rival' | 'cold' | 'nosolicit' | 'none';

export interface DioramaOptions {
  companyColor: string;
  shadows: boolean;
  reducedMotion: boolean;
  onPick(houseId: string | null): void;
}

interface Lot {
  id: string;
  view: HouseView;
  layout: PropertyLayout;
  group: THREE.Group;
  lawn: THREE.Mesh;
  uniforms: { uH: { value: number }; uStripe: { value: number }; uSeed: { value: number }; uSel: { value: number }; uLot: { value: THREE.Vector2 } };
  houseSlot: THREE.Group;
  pick: THREE.Mesh;             // invisible box over the house for tapping
  top: THREE.Vector3;           // world position for the marker
  center: THREE.Vector3;        // world position of the house
  marker: HTMLElement;
}

// ---------------------------------------------------------------- lot frame
// Lot layout coordinates: x across the lot (0..w), z from the street edge (0) to the back (d).
// HouseInfo.mapX/mapZ is the lot center and rotation is the yaw of the lot frame (src/sim/world.ts):
// a lot with rotation 0 has its street edge at mapZ - d/2 and extends toward +z.
export function lotToWorld(v: HouseView, x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const { lot, mapX, mapZ, rotation } = v.info;
  const cx = x - lot.w / 2, cz = z - lot.d / 2;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return out.set(mapX + cx * c + cz * s, 0, mapZ - cx * s + cz * c);
}

// ---------------------------------------------------------------- lawn material
const LAWN_VERT_HEAD = 'varying vec2 vLot;\n';
const LAWN_FRAG_HEAD = `
varying vec2 vLot;
uniform float uH;
uniform float uStripe;
uniform float uSeed;
uniform float uSel;
uniform vec2 uLot;
float lhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = lhash(i), b = lhash(i + vec2(1.0, 0.0)), c = lhash(i + vec2(0.0, 1.0)), d = lhash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;
const LAWN_FRAG_BODY = `
#include <color_fragment>
{
  vec2 p = vLot + vec2(uSeed * 17.0, uSeed * 31.0);
  float n1 = lnoise(p * 0.35);
  float n2 = lnoise(p * 1.7);
  float n3 = lnoise(p * 6.0);
  float tall = smoothstep(3.6, 7.0, uH);
  vec3 neat = vec3(0.11, 0.38, 0.07);
  vec3 shag = vec3(0.30, 0.40, 0.08);
  vec3 col = mix(neat, shag, tall);
  col *= 0.9 + 0.2 * n1 * (0.4 + tall);
  col = mix(col, vec3(0.52, 0.48, 0.14), tall * smoothstep(0.5, 0.95, n2) * 0.6);
  col *= 0.9 + 0.18 * n3 * tall;
  float s = step(0.5, fract(vLot.x / 2.4));
  col *= 1.0 + uStripe * (s * 0.3 - 0.1);
  float edge = min(min(vLot.x, uLot.x - vLot.x), min(vLot.y, uLot.y - vLot.y));
  col *= mix(0.82, 1.0, smoothstep(0.1, 0.45, edge));
  col = mix(col, col * 1.25 + vec3(0.04, 0.04, 0.0), uSel);
  diffuseColor.rgb = col;
}
`;

function lawnMaterial(uniforms: Lot['uniforms']): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = LAWN_VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLot = position.xz;');
    shader.fragmentShader = LAWN_FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', LAWN_FRAG_BODY);
  };
  m.customProgramCacheKey = () => 'mm-lawn-v2';
  return m;
}

// ---------------------------------------------------------------- diorama
export class Diorama {
  readonly canvas: HTMLCanvasElement;
  readonly markerLayer: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 1, 2000);
  private lots = new Map<string, Lot>();
  private statics = new THREE.Group();
  private tufts: THREE.InstancedMesh | null = null;
  private ring: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private raf = 0;
  private disposed = false;
  private selected: string | null = null;
  private target = new THREE.Vector3();
  private goal: THREE.Vector3 | null = null;
  private dist = 120;
  private distGoal = 120;
  private azimuth = Math.PI * 0.23;
  private polar = 0.92;
  private bounds = new THREE.Box3(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 0, 50));
  private ro: ResizeObserver;
  private pointers = new Map<number, { x: number; y: number }>();
  private downAt: { x: number; y: number; t: number; moved: number } | null = null;
  private pinch0 = 0;
  private dist0 = 0;
  private tmp = new THREE.Vector3();
  private timer = new THREE.Timer();
  private tutorialId: string | null = null;
  private removeListeners: () => void;
  private size = { w: 1, h: 1 };
  private dirty = true;
  private baked = false;
  private bakedGroup = new THREE.Group();

  constructor(private host: HTMLElement, private opts: DioramaOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = opts.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'pitch-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'Neighborhood map. Drag to pan, scroll or pinch to zoom, arrow keys to move.');
    host.appendChild(this.canvas);
    this.markerLayer = document.createElement('div');
    this.markerLayer.className = 'pitch-markers';
    host.appendChild(this.markerLayer);

    const sky = new THREE.Color('#bfe3f5');
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 260, 720);
    this.scene.add(new THREE.HemisphereLight(0xfdf6e3, 0x6d8f4e, 1.55));
    this.sun = new THREE.DirectionalLight(0xfff1d0, 2.1);
    this.sun.castShadow = opts.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.4;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.statics);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.ring.renderOrder = 2;
    this.scene.add(this.ring);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.removeListeners = this.bindInput();
    if (import.meta.env?.DEV) (window as unknown as { __pitchDiorama?: Diorama }).__pitchDiorama = this;
    this.loop();
  }

  // ---------------------------------------------------------------- build
  /** Build the whole neighborhood (first call) or refresh lawns and markers (later calls). */
  setHouses(views: HouseView[]): void {
    this.dirty = true;
    if (this.lots.size === 0) this.build(views);
    for (const v of views) {
      const lot = this.lots.get(v.info.id);
      if (!lot) continue;
      lot.view = v;
      lot.uniforms.uH.value = v.grassIn;
      // Fresh stripes on client lawns the player has mowed, fading as the grass grows back.
      const mowed = !!v.client && v.client.lastServiceDay >= 0;
      lot.uniforms.uStripe.value = mowed ? clamp((5.2 - v.grassIn) / 1.6, 0, 1) : v.grassIn < 3.6 ? 0.2 : 0;
    }
    this.buildTufts();
  }

  private build(views: HouseView[]): void {
    const box = new THREE.Box3();
    box.makeEmpty();
    const loads: Promise<void>[] = [];
    for (const v of views) {
      const layout = safeLayout(v);
      const group = new THREE.Group();
      group.position.copy(lotToWorld(v, v.info.lot.w / 2, 0));   // the group origin is the middle of the street edge
      group.rotation.y = v.info.rotation;
      this.scene.add(group);
      const { w, d } = v.info.lot;
      const uniforms = { uH: { value: v.grassIn }, uStripe: { value: 0 }, uSeed: { value: (v.info.propertySeed % 997) / 997 }, uSel: { value: 0 }, uLot: { value: new THREE.Vector2(w, d) } };
      // Lawn: plane in the lot frame (position.xz are lot meters), shifted so x = 0 is the lot middle.
      const lawn = new THREE.Mesh(lotPlaneGeometry(w, d), lawnMaterial(uniforms));
      lawn.position.set(-w / 2, 0.02, 0);
      lawn.receiveShadow = true;
      lawn.userData.houseId = v.info.id;
      group.add(lawn);
      this.addLotFeatures(group, layout, v);
      const houseSlot = new THREE.Group();
      group.add(houseSlot);
      const hh = houseHeight(layout.house.style);
      const pick = new THREE.Mesh(new THREE.BoxGeometry(layout.house.w, 1, layout.house.d), PICK_MAT);
      pick.scale.y = hh;
      pick.position.set(layout.house.x - w / 2, hh / 2, layout.house.z);
      if (layout.house.rot) pick.rotation.y = layout.house.rot;
      group.add(pick);
      loads.push(this.placeHouse(houseSlot, layout, v, pick));
      const center = lotToWorld(v, layout.house.x, layout.house.z);
      const top = center.clone().setY(hh + 2.2);
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'pitch-marker';
      marker.dataset.id = v.info.id;
      marker.setAttribute('aria-label', v.info.address);
      marker.addEventListener('click', (e) => { e.stopPropagation(); this.opts.onPick(v.info.id); });
      this.markerLayer.appendChild(marker);
      this.lots.set(v.info.id, { id: v.info.id, view: v, layout, group, lawn, uniforms, houseSlot, pick, top, center, marker });
      for (const [x, z] of [[0, 0], [v.info.lot.w, 0], [0, v.info.lot.d], [v.info.lot.w, v.info.lot.d]]) box.expandByPoint(lotToWorld(v, x, z));
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(-40, 0, -40), new THREE.Vector3(40, 0, 40));
    this.bounds.copy(box);
    this.buildStreets(views);
    this.buildSurroundings(box);
    box.getCenter(this.target);
    this.target.y = 0;
    const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    this.dist = this.distGoal = clamp(span * 0.95, 60, 420);
    const s = span * 0.75 + 40;
    const cam = this.sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s; cam.near = 1; cam.far = 900;
    cam.updateProjectionMatrix();
    this.sun.position.copy(this.target).add(new THREE.Vector3(-120, 220, -80));
    this.sun.target.position.copy(this.target);
    this.scene.add(this.bakedGroup);
    // Merge the static scenery once every house model has settled (a few draw calls instead of thousands).
    const timeout = new Promise<void>((r) => setTimeout(r, 12000));
    Promise.race([Promise.all(loads).then(() => undefined), timeout]).then(() => this.bake());
  }

  private addLotFeatures(group: THREE.Group, L: PropertyLayout, v: HouseView): void {
    const w = v.info.lot.w;
    const toLocal = (x: number) => x - w / 2;
    const concrete = lambert('#d8d3c8');
    const paver = lambert('#c8b89c');
    for (const r of L.driveway) this.flatBox(group, concrete, toLocal(r.x), r.z, r.w, r.d, 0.06, r.rot);
    for (const r of L.walkways) this.flatBox(group, paver, toLocal(r.x), r.z, r.w, r.d, 0.05, r.rot);
    for (const r of L.patios) this.flatBox(group, lambert('#bfb3a0'), toLocal(r.x), r.z, r.w, r.d, 0.07, r.rot);
    const mulch = lambert('#6b4b35');
    const rng = makeRng(v.info.propertySeed ^ 0x51f1);
    const flowerCols = ['#f06a8a', '#ffd23f', '#ffffff', '#b07cf0', '#ff8c42'];
    for (const b of L.beds) {
      let mesh: THREE.Mesh;
      let rx = 1, rz = 1, cx = 0, cz = 0;
      if (b.kind === 'rect') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(b.rect.w, 0.12, b.rect.d), mulch);
        mesh.position.set(toLocal(b.rect.x), 0.06, b.rect.z);
        mesh.rotation.y = b.rect.rot ?? 0;
        rx = b.rect.w / 2; rz = b.rect.d / 2; cx = b.rect.x; cz = b.rect.z;
      } else {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 20), mulch);
        mesh.scale.set(b.rx, 1, b.rz);
        mesh.position.set(toLocal(b.x), 0.06, b.z);
        mesh.rotation.y = b.rot;
        rx = b.rx; rz = b.rz; cx = b.x; cz = b.z;
      }
      mesh.receiveShadow = true;
      group.add(mesh);
      const n = Math.min(14, Math.max(3, Math.round(rx * rz * 1.4)));
      for (let i = 0; i < n; i++) {
        const f = new THREE.Mesh(FLOWER_GEO, lambert(rng.pick(flowerCols)));
        const a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.next()) * 0.8;
        f.position.set(toLocal(cx) + Math.cos(a) * rx * rr, 0.25, cz + Math.sin(a) * rz * rr);
        f.scale.setScalar(rng.range(0.7, 1.2));
        group.add(f);
      }
    }
    for (const f of L.fences) {
      const dx = f.x2 - f.x1, dz = f.z2 - f.z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      const hgt = f.kind === 'hedge' ? 1.3 : 1.1;
      const thick = f.kind === 'hedge' ? 0.9 : 0.1;
      const mat = f.kind === 'hedge' ? lambert('#3f7a35') : f.kind === 'iron' ? lambert('#2f3136') : lambert('#fbfbf5');
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, hgt, thick), mat);
      m.position.set(toLocal((f.x1 + f.x2) / 2), hgt / 2, (f.z1 + f.z2) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      m.castShadow = true;
      group.add(m);
    }
    // trees, shrubs and props
    for (const o of L.obstacles) {
      const m = obstacleMesh(o, toLocal(o.x), o.z, v.info.propertySeed + Math.round(o.x * 13 + o.z * 7));
      if (m) group.add(m);
    }
    for (const b of L.bunkers ?? []) this.blob(group, lambert('#ecd9a0'), b, toLocal);
    for (const b of L.ponds ?? []) this.blob(group, lambert('#5aa9d6'), b, toLocal);
    // Parked car on some driveways
    const d0 = L.driveway[0];
    if (d0 && rng.chance(0.45)) {
      const car = parkedCar(rng.pick(['#d64545', '#3b6fb6', '#f2f2f2', '#2b2b2b', '#8fb7c9', '#e8b93b', '#6a8f5a']));
      car.position.set(toLocal(d0.x), 0, Math.min(d0.z + d0.d / 2 - 3, d0.z + 1));
      car.rotation.y = Math.abs(d0.w) > Math.abs(d0.d) ? Math.PI / 2 : 0;
      group.add(car);
    }
    // Mailbox at the curb if the layout has none
    if (!L.obstacles.some((o) => o.kind === 'mailbox')) {
      const post = new THREE.Mesh(boxG(0.12, 1.1, 0.12), lambert('#6b5540'));
      const box = new THREE.Mesh(boxG(0.3, 0.3, 0.55), lambert(rng.pick(['#2f3d4a', '#b8322a', '#f4f4f4'])));
      const mx = d0 ? toLocal(d0.x) - d0.w / 2 - 0.8 : toLocal(w * 0.2);
      post.position.set(mx, 0.55, 0.5);
      box.position.set(mx, 1.15, 0.5);
      group.add(post, box);
    }
  }

  private blob(group: THREE.Group, mat: THREE.Material, b: BedShape, toLocal: (x: number) => number): void {
    if (b.kind === 'rect') { this.flatBox(group, mat, toLocal(b.rect.x), b.rect.z, b.rect.w, b.rect.d, 0.05, b.rect.rot); return; }
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 24), mat);
    m.scale.set(b.rx, 1, b.rz);
    m.position.set(toLocal(b.x), 0.03, b.z);
    m.rotation.y = b.rot;
    m.receiveShadow = true;
    group.add(m);
  }

  private flatBox(group: THREE.Group, mat: THREE.Material, x: number, z: number, w: number, d: number, h: number, rot?: number): void {
    const m = new THREE.Mesh(boxG(w, h, d), mat);
    m.position.set(x, h / 2, z);
    if (rot) m.rotation.y = rot;
    m.receiveShadow = true;
    group.add(m);
  }

  private placeHouse(slot: THREE.Group, L: PropertyLayout, v: HouseView, pick: THREE.Mesh): Promise<void> {
    const hx = L.house.x - v.info.lot.w / 2, hz = L.house.z;
    const style = L.house.style;
    const proc = proceduralHouse(style, L.house.w, L.house.d, v.info.propertySeed);
    proc.position.set(hx, 0, hz);
    if (L.house.rot) proc.rotation.y = L.house.rot;
    slot.add(proc);
    const residential = ['ranch', 'colonial', 'cottage', 'modern', 'mansion'].includes(style);
    const key = (residential ? 'house_' : 'bld_') + style;
    return instantiateModel(key).then((model) => {
      if (!model || this.disposed || this.baked) return;   // too late: the fallback house is already baked in
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      if (size.x < 0.01 || size.z < 0.01) return;
      const s = Math.min(L.house.w / size.x, L.house.d / size.z) * 1.02;
      model.scale.setScalar(s);
      const c = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
      wrap.add(model);
      wrap.rotation.y = Math.PI + (L.house.rot ?? 0);   // model front faces +Z, the street is at -z
      wrap.position.set(hx, 0, hz);
      slot.remove(proc);
      slot.add(wrap);
      slot.userData.model = key;
      const lot = this.lots.get(v.info.id);
      if (lot) lot.top.y = size.y * s + 2.2;
      pick.scale.y = size.y * s;
      pick.position.y = size.y * s / 2;
      this.dirty = true;
    }).catch(() => { /* keep the procedural house */ });
  }

  /** Merge every static mesh (scenery, props, houses) into one mesh per material. */
  private bake(): void {
    if (this.disposed || this.baked) return;
    this.baked = true;
    this.scene.updateMatrixWorld(true);
    const keep = new Set<THREE.Object3D>([this.ring]);
    for (const lot of this.lots.values()) { keep.add(lot.lawn); keep.add(lot.pick); }
    if (this.tufts) keep.add(this.tufts);
    type Bucket = { mat: THREE.Material; cast: boolean; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] };
    const buckets = new Map<string, Bucket>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || keep.has(m) || (m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
      if (Array.isArray(m.material)) return;
      const mat = m.material as THREE.Material & { map?: THREE.Texture | null };
      if (mat.map || mat.transparent || !mat.visible) return;
      const src = m.geometry;
      if (!src.getAttribute('position') || src.morphAttributes.position) return;
      const withColor = !!mat.vertexColors && !!src.getAttribute('color');
      const g = flatGeometry(src, withColor);
      g.applyMatrix4(m.matrixWorld);
      const key = `${mat.uuid}|${m.castShadow ? 1 : 0}|${withColor ? 'c' : ''}`;
      let b = buckets.get(key);
      if (!b) { b = { mat, cast: m.castShadow, geos: [], meshes: [] }; buckets.set(key, b); }
      b.geos.push(g);
      b.meshes.push(m);
    });
    for (const b of buckets.values()) {
      let merged: THREE.BufferGeometry | null = null;
      try { merged = mergeGeometries(b.geos, false); } catch { merged = null; }
      b.geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.bakedGroup.add(mesh);
      for (const m of b.meshes) m.parent?.remove(m);
    }
    this.dirty = true;
  }

  private buildTufts(): void {
    if (this.tufts) { this.scene.remove(this.tufts); this.tufts.dispose(); this.tufts = null; }
    const items: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const base = new THREE.Color();
    for (const lot of this.lots.values()) {
      const h = lot.uniforms.uH.value;
      if (h < 4.6) continue;
      const v = lot.view;
      const L = lot.layout;
      const rng = makeRng(v.info.propertySeed ^ 0x7a11);
      const area = v.info.lot.w * v.info.lot.d;
      const n = Math.min(420, Math.round(area * 0.3 * clamp((h - 4.4) / 2.5, 0.3, 1.4)));
      const hs = clamp(h / 6, 0.7, 1.8);
      for (let i = 0; i < n; i++) {
        const x = rng.range(0.4, v.info.lot.w - 0.4);
        const z = rng.range(0.4, v.info.lot.d - 0.4);
        if (insideRect(x, z, L.house, 0.8) || L.driveway.some((r) => insideRect(x, z, r, 0.3)) || L.walkways.some((r) => insideRect(x, z, r, 0.2)) || L.patios.some((r) => insideRect(x, z, r, 0.2))) continue;
        lotToWorld(v, x, z, p);
        e.set(0, rng.range(0, Math.PI), 0);
        q.setFromEuler(e);
        const s = rng.range(0.7, 1.3);
        sc.set(s, s * hs * rng.range(0.8, 1.25), s);
        items.push({ m: new THREE.Matrix4().compose(p, q, sc), c: base.setHSL(rng.range(0.17, 0.24), rng.range(0.4, 0.55), rng.range(0.28, 0.4)).clone() });
      }
    }
    if (!items.length) return;
    const mesh = new THREE.InstancedMesh(TUFT_GEO, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), items.length);
    items.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.tufts = mesh;
    this.scene.add(mesh);
  }

  private buildStreets(views: HouseView[]): void {
    const byStreet = new Map<string, HouseView[]>();
    for (const v of views) {
      const k = v.info.street;
      if (!byStreet.has(k)) byStreet.set(k, []);
      byStreet.get(k)!.push(v);
    }
    const asphalt = lambert('#5a5d63');
    const walk = lambert('#dcd8ce');
    const curb = lambert('#b9b5ab');
    const line = lambert('#f4d35e');
    const SIDEWALK = 1.6, CURB = 0.35;
    for (const [, hs] of byStreet) {
      // Street axis: along the lot frame x of the first house; normal points from the street into the lots.
      const r0 = hs[0].info.rotation;
      const ax = new THREE.Vector3(Math.cos(r0), 0, -Math.sin(r0));
      const nrm = new THREE.Vector3(Math.sin(r0), 0, Math.cos(r0));
      // Signed distance of each front edge along the normal, and extents along the axis.
      const sides: { off: number; dir: number; lo: number; hi: number }[] = [];
      let lo = Infinity, hi = -Infinity;
      for (const v of hs) {
        const f = lotToWorld(v, v.info.lot.w / 2, 0);
        const dir = Math.sign(Math.cos(v.info.rotation - r0)) || 1;
        const off = f.dot(nrm);
        const along = f.dot(ax);
        const half = v.info.lot.w / 2;
        lo = Math.min(lo, along - half); hi = Math.max(hi, along + half);
        sides.push({ off, dir, lo: along - half, hi: along + half });
      }
      const pos = sides.filter((s) => s.dir > 0), neg = sides.filter((s) => s.dir < 0);
      const edgeP = pos.length ? Math.min(...pos.map((s) => s.off)) : null;   // lots extend toward +n from here
      const edgeN = neg.length ? Math.max(...neg.map((s) => s.off)) : null;   // lots extend toward -n from here
      let center: number, roadW: number;
      if (edgeP !== null && edgeN !== null && edgeP > edgeN) {
        center = (edgeP + edgeN) / 2;
        roadW = Math.max(5, edgeP - edgeN - 2 * (SIDEWALK + CURB));
      } else if (edgeP !== null) { roadW = 7.5; center = edgeP - SIDEWALK - CURB - roadW / 2; }
      else if (edgeN !== null) { roadW = 7.5; center = edgeN + SIDEWALK + CURB + roadW / 2; }
      else continue;
      const len = hi - lo + 16;
      const mid = (lo + hi) / 2;
      const place = (m: THREE.Mesh, offN: number, y: number) => {
        m.position.copy(ax).multiplyScalar(mid).addScaledVector(nrm, offN).setY(y);
        m.rotation.y = r0;
        m.receiveShadow = true;
        this.statics.add(m);
      };
      place(new THREE.Mesh(boxG(len, 0.05, roadW), asphalt), center, 0.025);
      for (const s of [1, -1]) {
        const cOff = center + s * (roadW / 2 + CURB / 2);
        place(new THREE.Mesh(boxG(len, 0.16, CURB), curb), cOff, 0.08);
        const wOff = center + s * (roadW / 2 + CURB + SIDEWALK / 2);
        place(new THREE.Mesh(boxG(len, 0.1, SIDEWALK), walk), wOff, 0.05);
      }
      // dashed center line
      const dashes = Math.floor(len / 6);
      for (let i = 0; i < dashes; i++) {
        const m = new THREE.Mesh(boxG(2.4, 0.02, 0.18), line);
        const a = lo - 8 + 3 + i * 6;
        m.position.copy(ax).multiplyScalar(a).addScaledVector(nrm, center).setY(0.06);
        m.rotation.y = r0;
        this.statics.add(m);
      }
      // street lamps every ~30 m on one side
      for (let a = lo + 6; a < hi; a += 32) {
        const lamp = lampPost();
        lamp.position.copy(ax).multiplyScalar(a).addScaledVector(nrm, center - (roadW / 2 + CURB + 0.4)).setY(0);
        this.statics.add(lamp);
      }
    }
  }

  private buildSurroundings(box: THREE.Box3): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), lambert('#a9c27e'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((box.min.x + box.max.x) / 2, -0.02, (box.min.z + box.max.z) / 2);
    ground.receiveShadow = true;
    this.statics.add(ground);
    // Tree line around the neighborhood
    const rng = makeRng(0xa11ce);
    const pad = 26;
    const minX = box.min.x - pad, maxX = box.max.x + pad, minZ = box.min.z - pad, maxZ = box.max.z + pad;
    const perim = 2 * ((maxX - minX) + (maxZ - minZ));
    const n = Math.min(160, Math.round(perim / 7));
    for (let i = 0; i < n; i++) {
      let t = rng.next() * perim;
      let x: number, z: number;
      const W = maxX - minX, D = maxZ - minZ;
      if (t < W) { x = minX + t; z = minZ; } else if ((t -= W) < D) { x = maxX; z = minZ + t; } else if ((t -= D) < W) { x = maxX - t; z = maxZ; } else { t -= W; x = minX; z = maxZ - t; }
      x += rng.range(-9, 9); z += rng.range(-9, 9);
      const kind = rng.pick(['tree_oak', 'tree_maple', 'tree_pine', 'tree_birch'] as const);
      const tr = tree(kind, rng.range(2, 3.6), i * 31 + 7);
      tr.position.set(x, 0, z);
      this.statics.add(tr);
    }
  }

  // ---------------------------------------------------------------- markers and selection
  setMarker(id: string, kind: MarkerKind, html: string, title: string, color?: string): void {
    const lot = this.lots.get(id);
    if (!lot) return;
    this.dirty = true;
    const m = lot.marker;
    m.className = `pitch-marker pitch-marker-${kind}` + (id === this.selected ? ' is-selected' : '') + (id === this.tutorialId ? ' is-tutorial' : '');
    m.innerHTML = html;
    m.title = title;
    m.setAttribute('aria-label', `${lot.view.info.address}. ${title}`);
    m.style.setProperty('--mk', color ?? '');
  }

  setTutorial(id: string | null): void {
    this.tutorialId = id;
    for (const lot of this.lots.values()) lot.marker.classList.toggle('is-tutorial', lot.id === id);
  }

  select(id: string | null, focus = true): void {
    this.selected = id;
    this.dirty = true;
    for (const lot of this.lots.values()) {
      const on = lot.id === id;
      lot.uniforms.uSel.value = on ? 0.6 : 0;
      lot.marker.classList.toggle('is-selected', on);
    }
    const lot = id ? this.lots.get(id) : null;
    this.ring.visible = !!lot;
    if (lot) {
      const r = Math.max(lot.layout.house.w, lot.layout.house.d) * 0.62 + 1.2;
      this.ring.scale.setScalar(r);
      this.ring.userData.base = r;
      this.ring.position.set(lot.center.x, 0.12, lot.center.z);
      if (focus) {
        this.goal = lot.center.clone();
        this.distGoal = Math.min(this.distGoal, 95);
      }
    }
  }

  focusAll(): void {
    const c = this.bounds.getCenter(new THREE.Vector3());
    this.goal = c.setY(0);
    const span = Math.max(this.bounds.max.x - this.bounds.min.x, this.bounds.max.z - this.bounds.min.z);
    this.distGoal = clamp(span * 0.95, 60, 420);
  }

  /** Glide the camera to a house without selecting it. */
  focusOn(id: string, dist = 110): void {
    const lot = this.lots.get(id);
    if (!lot) return;
    this.goal = lot.center.clone();
    this.distGoal = dist;
  }

  zoomBy(f: number): void { this.distGoal = clamp(this.distGoal * f, 28, 480); }

  // ---------------------------------------------------------------- frame
  private resize(): void {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.fov = w < 600 ? 44 : 34;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update(performance.now());
    const dt = Math.min(0.05, this.timer.getDelta());
    const t = this.timer.getElapsed();
    const k = 1 - Math.exp(-dt * (this.opts.reducedMotion ? 30 : 7));
    if (this.goal) {
      this.target.lerp(this.goal, k);
      if (this.target.distanceTo(this.goal) < 0.05) this.goal = null;
    }
    this.dist += (this.distGoal - this.dist) * k;
    const sp = Math.sin(this.polar);
    this.camera.position.set(
      this.target.x + this.dist * sp * Math.sin(this.azimuth),
      this.target.y + this.dist * Math.cos(this.polar),
      this.target.z + this.dist * sp * Math.cos(this.azimuth),
    );
    this.camera.lookAt(this.target);
    const moving = this.goal !== null || Math.abs(this.distGoal - this.dist) > 0.01;
    if (!moving && !this.ring.visible && !this.dirty) return;
    this.dirty = false;
    if (this.ring.visible) {
      const pulse = this.opts.reducedMotion ? 1 : 1 + 0.06 * Math.sin(t * 4);
      this.ring.scale.setScalar(this.ring.userData.base ? this.ring.userData.base * pulse : this.ring.scale.x);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.25 * Math.sin(t * 4);
    }
    this.renderer.render(this.scene, this.camera);
    this.projectMarkers();
  };

  private projectMarkers(): void {
    const { w, h } = this.size;
    for (const lot of this.lots.values()) {
      const p = this.tmp.copy(lot.top).project(this.camera);
      const el = lot.marker;
      if (p.z > 1 || p.x < -1.2 || p.x > 1.2 || p.y < -1.2 || p.y > 1.3) { el.style.display = 'none'; continue; }
      el.style.display = '';
      const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.zIndex = String(1000 - Math.round(p.z * 1000) + (lot.id === this.selected ? 1000 : 0));
    }
  }

  // ---------------------------------------------------------------- input
  private groundAt(cx: number, cy: number, out: THREE.Vector3): boolean {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    return ray.ray.intersectPlane(plane, out) !== null;
  }

  private pick(cx: number, cy: number): string | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const targets: THREE.Object3D[] = [];
    for (const lot of this.lots.values()) targets.push(lot.pick, lot.lawn);
    const hit = ray.intersectObjects(targets, false)[0];
    if (hit) for (const lot of this.lots.values()) if (lot.pick === hit.object || lot.lawn === hit.object) return lot.id;
    return null;
  }

  private bindInput(): () => void {
    const c = this.canvas;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) this.downAt = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      if (this.pointers.size === 2) {
        const [p, q] = [...this.pointers.values()];
        this.pinch0 = Math.hypot(p.x - q.x, p.y - q.y);
        this.dist0 = this.distGoal;
        if (this.downAt) this.downAt.moved = 99;
      }
    };
    const move = (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (this.pointers.size === 1) {
        if (this.downAt) this.downAt.moved += Math.hypot(cur.x - prev.x, cur.y - prev.y);
        if (this.downAt && this.downAt.moved > 5 && this.groundAt(prev.x, prev.y, a) && this.groundAt(cur.x, cur.y, b)) {
          this.target.add(a.sub(b));
          this.goal = null;
          this.clampTarget();
          this.dirty = true;
        }
      } else if (this.pointers.size === 2) {
        const others = [...this.pointers.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
        const o = others[0];
        const d = Math.hypot(cur.x - o.x, cur.y - o.y);
        if (this.pinch0 > 0) this.distGoal = this.dist = clamp(this.dist0 * (this.pinch0 / Math.max(10, d)), 28, 480);
        const mPrev = { x: (prev.x + o.x) / 2, y: (prev.y + o.y) / 2 }, mCur = { x: (cur.x + o.x) / 2, y: (cur.y + o.y) / 2 };
        if (this.groundAt(mPrev.x, mPrev.y, a) && this.groundAt(mCur.x, mCur.y, b)) { this.target.add(a.sub(b)); this.clampTarget(); }
        this.dirty = true;
      }
      this.pointers.set(e.pointerId, cur);
    };
    const up = (e: PointerEvent) => {
      const wasSingle = this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      if (wasSingle && this.downAt && this.downAt.moved < 6 && performance.now() - this.downAt.t < 700) {
        const id = this.pick(e.clientX, e.clientY);
        this.opts.onPick(id);
      }
      if (this.pointers.size === 0) this.downAt = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.distGoal = clamp(this.distGoal * Math.exp(e.deltaY * 0.0012), 28, 480);
    };
    const key = (e: KeyboardEvent) => {
      const step = this.dist * 0.08;
      const fwd = new THREE.Vector3(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth));
      const right = new THREE.Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth));
      let used = true;
      switch (e.key) {
        case 'ArrowUp': case 'w': this.target.addScaledVector(fwd, step); break;
        case 'ArrowDown': case 's': this.target.addScaledVector(fwd, -step); break;
        case 'ArrowLeft': case 'a': this.target.addScaledVector(right, -step); break;
        case 'ArrowRight': case 'd': this.target.addScaledVector(right, step); break;
        case '+': case '=': this.zoomBy(0.85); break;
        case '-': case '_': this.zoomBy(1.18); break;
        default: used = false;
      }
      if (used) { e.preventDefault(); this.goal = null; this.clampTarget(); this.dirty = true; }
    };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', wheel, { passive: false });
    c.addEventListener('keydown', key);
    c.style.touchAction = 'none';
    return () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
      c.removeEventListener('wheel', wheel);
      c.removeEventListener('keydown', key);
    };
  }

  private clampTarget(): void {
    const b = this.bounds;
    this.target.x = clamp(this.target.x, b.min.x - 20, b.max.x + 20);
    this.target.z = clamp(this.target.z, b.min.z - 20, b.max.z + 20);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.removeListeners();
    for (const lot of this.lots.values()) { lot.lawn.geometry.dispose(); (lot.lawn.material as THREE.Material).dispose(); lot.pick.geometry.dispose(); }
    for (const m of this.bakedGroup.children) (m as THREE.Mesh).geometry.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !SHARED_GEOS.has(m.geometry) && !m.geometry.userData.cached) m.geometry.dispose();
    });
    this.tufts?.dispose();
    disposeHouseMaterials();
    disposePropGeos();
    boxCache.forEach((g) => g.dispose());
    boxCache.clear();
    this.timer.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    this.markerLayer.remove();
  }
}

// ---------------------------------------------------------------- helpers and shared geometry
function safeLayout(v: HouseView): PropertyLayout {
  try { return generateProperty(v.info.propertySeed, v.info.lot); } catch {
    const { w, d, style } = v.info.lot;
    const house = { x: w / 2, z: d * 0.45, w: Math.min(w * 0.45, 16), d: Math.min(d * 0.3, 14), style };
    return { seed: v.info.propertySeed, lot: v.info.lot, house, driveway: [], walkways: [], patios: [], beds: [], obstacles: [], fences: [], lawnM2: v.info.lawnM2, hardscapeM2: 0, bounds: { minX: 0, maxX: w, minZ: 0, maxZ: d } };
  }
}

function insideRect(x: number, z: number, r: { x: number; z: number; w: number; d: number; rot?: number }, pad: number): boolean {
  let dx = x - r.x, dz = z - r.z;
  if (r.rot) { const c = Math.cos(-r.rot), s = Math.sin(-r.rot); const nx = dx * c - dz * s; dz = dx * s + dz * c; dx = nx; }
  return Math.abs(dx) <= r.w / 2 + pad && Math.abs(dz) <= r.d / 2 + pad;
}

/** Plane in the lot frame: position.xy are lot meters (x across 0..w, y = z from the street 0..d). */
function lotPlaneGeometry(w: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([0, 0, 0, w, 0, 0, w, 0, d, 0, 0, 0, w, 0, d, 0, 0, d]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  // wind the triangles so the top faces up
  g.setIndex([0, 2, 1, 3, 5, 4]);
  return g;
}

const PICK_MAT = new THREE.MeshBasicMaterial({ visible: false });

/** Non-indexed float copy with position, normal (and color when asked) only, ready to merge. */
function flatGeometry(src: THREE.BufferGeometry, withColor: boolean): THREE.BufferGeometry {
  const g0 = src.index ? src.toNonIndexed() : src;
  const out = new THREE.BufferGeometry();
  const copy = (name: string, size: number) => {
    const a = g0.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) return;
    const arr = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) {
      arr[i * size] = a.getX(i);
      if (size > 1) arr[i * size + 1] = a.getY(i);
      if (size > 2) arr[i * size + 2] = a.getZ(i);
      if (size > 3) arr[i * size + 3] = a.getW(i);
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  };
  copy('position', 3);
  if (g0.getAttribute('normal')) copy('normal', 3);
  else out.computeVertexNormals();
  if (withColor) copy('color', g0.getAttribute('color')!.itemSize);
  if (g0 !== src) g0.dispose();
  return out;
}

const boxCache = new Map<string, THREE.BufferGeometry>();
function boxG(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`;
  let g = boxCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); g.userData.cached = true; boxCache.set(k, g); }
  return g;
}

const FLOWER_GEO = new THREE.IcosahedronGeometry(0.22, 0);
const SHRUB_GEO = new THREE.IcosahedronGeometry(1, 1);
const ROCK_GEO = new THREE.DodecahedronGeometry(1, 0);
const TUFT_GEO = (() => {
  // three crossed blades
  const g = new THREE.BufferGeometry();
  const v: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const c = Math.cos(a) * 0.15, s = Math.sin(a) * 0.15;
    v.push(-c, 0, -s, c, 0, s, 0, 0.55, 0);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  // Normals point up so the blades take the same light as the lawn under them.
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(v.length / 3).fill([0, 1, 0]).flat(), 3));
  return g;
})();
const SHARED_GEOS = new Set<THREE.BufferGeometry>([FLOWER_GEO, SHRUB_GEO, ROCK_GEO, TUFT_GEO, ...SHARED_PROP_GEOS]);

function parkedCar(color: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxG(1.8, 0.8, 4.2), lambert(color));
  body.position.y = 0.65;
  body.castShadow = true;
  const cab = new THREE.Mesh(boxG(1.6, 0.7, 2.1), lambert('#9fc3d8'));
  cab.position.set(0, 1.35, -0.2);
  cab.castShadow = true;
  const roof = new THREE.Mesh(boxG(1.62, 0.08, 1.9), lambert(color));
  roof.position.set(0, 1.72, -0.2);
  g.add(body, cab, roof);
  for (const x of [-0.85, 0.85]) for (const z of [-1.3, 1.3]) {
    const w = new THREE.Mesh(boxG(0.3, 0.6, 0.6), lambert('#222222'));
    w.position.set(x, 0.3, z);
    g.add(w);
  }
  return g;
}

function lampPost(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(boxG(0.16, 4.4, 0.16), lambert('#3d4148'));
  pole.position.y = 2.2;
  const head = new THREE.Mesh(boxG(0.5, 0.3, 0.5), lambert('#fff3c4', { emissive: 0x6b5a20 }));
  head.position.y = 4.45;
  pole.castShadow = true;
  g.add(pole, head);
  return g;
}
