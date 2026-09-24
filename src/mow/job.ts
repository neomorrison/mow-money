// The mowing job: owns the renderer, scene, grass field, actors, HUD and the frame loop.
import * as THREE from 'three';
import type { Damage, MowJobResult, MowJobSpec, QualityBreakdown } from '../core/types';
import type { Settings } from '../core/save';
import { audio, type LoopHandle } from '../audio/index';
import { computeQuality, DAY_END, SETUP_MINUTES } from '../sim/index';
import { generateProperty, inBed, type Obstacle } from '../world/property';
import { GrassField, LAWN, HARD } from './field';
import { makeGrassUniforms, type GrassUniforms } from './shaders';
import { Blades, BLADE_COUNTS } from './blades';
import { ModelKit } from './models';
import { World } from './world';
import { Body, buildColliders, resolve, type Colliders, type DriveInput, type VehicleParams, wrapAngle } from './mower';
import { cutDeck, makeDeckOutcome, trim, blow, type DeckParams, type TrimOutcome, type BlowOutcome } from './cutting';
import { computeResult, estimateQuality, liveResult, projectedResult, type ScoreState } from './scoring';
import { Hud } from './hud';
import { Input, type Action } from './input';
import { CameraRig } from './camera';
import { Sky } from './sky';
import { Particles, Rain } from './fx';
import { Minimap } from './minimap';
import { MowerVisual, Character, type Pose } from './actors';
import { Tutorial } from './tutorial';
import { AutoPilot } from './autopilot';
import type { MowCallbacks } from './index';

const VEHICLE_NAME: Record<string, string> = {
  veh_bike: 'bike', veh_pickup: 'truck', veh_pickup_trailer: 'truck', veh_crewtruck: 'truck', veh_boxtruck: 'truck',
};

export class MowJob {
  // setup
  private spec: MowJobSpec;
  private settings: Settings;
  private cb: MowCallbacks;
  private host: HTMLElement;
  private touch: boolean;
  private companyColor: THREE.Color;

  // scene
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private rig!: CameraRig;
  private sky!: Sky;
  private kit: ModelKit;
  private world!: World;
  private blades!: Blades;
  private particles = new Particles(2400);
  private rain: Rain | null = null;
  private u!: GrassUniforms;
  field: GrassField;
  private layout;
  private colliders: Colliders;

  // actors
  private mower = new Body();
  private walker = new Body();
  private mowerVis!: MowerVisual;
  private char!: Character;
  private mowerParams: VehicleParams;
  private walkParams: VehicleParams = { maxSpeed: 2, turnRate: 4.6, zeroTurn: true, carSteer: false, accel: 7 };
  private deckHalf: number;
  private mowerR: number;

  // job state
  tool: 1 | 2 | 3 = 1;
  deckIdx = 0;
  private deckHeights: number[];
  private bag = 0;
  private bagCap = 0;
  private bagWarned = false;
  private damages: Damage[] = [];
  private damaged = new Set<Obstacle>();
  private damagedBeds = new Set<number>();
  private bedWarned = new Set<number>();
  private damagedFences = new Set<unknown>();
  private stripeStrength: number;
  private stripeVis: number;
  private active = 0;           // seconds of active (unpaused, started) play
  private frame = 1;
  private started = false;
  private paused = false;
  private ended = false;
  private flashT = 0;
  private flashed = false;
  private moved = 0;
  private mowerArea = 0;
  private lastQ: QualityBreakdown | null = null;
  private lastResult: MowJobResult | null = null;
  private statT = 0;
  private miniT = 0;
  private hudT = 0;
  private crunchT = 0;
  private bumpT = 0;
  private sunsetShown = false;
  private auto: AutoPilot | null = null;
  private autoSpeed = 1;
  private tutorial: Tutorial;
  private deck = makeDeckOutcome(1);
  private trimOut: TrimOutcome = { cells: 0, cut: 0, removed: 0, tallest: 0 };
  private blowOut: BlowOutcome = { moved: 0, cells: 0 };
  private deckP: DeckParams;
  private sharpNow: number;

  // ui
  private hud!: Hud;
  private input!: Input;
  private minimap!: Minimap;
  private loops: { engine: LoopHandle | null; tool: LoopHandle | null; amb: LoopHandle | null } = { engine: null, tool: null, amb: null };
  private raf = 0;
  private lastT = 0;
  private ro: ResizeObserver | null = null;
  private disposed = false;
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private clockT = 0;
  private listeners: [EventTarget, string, EventListener][] = [];

  constructor(host: HTMLElement, spec: MowJobSpec, cb: MowCallbacks, settings: Settings) {
    this.spec = spec; this.cb = cb; this.settings = settings; this.host = host;
    const force = typeof window !== 'undefined' ? (window as unknown as { __mmForceTouch?: boolean }).__mmForceTouch : undefined;
    this.touch = force ?? (typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.matchMedia?.('(pointer: coarse)').matches !== false);
    this.companyColor = new THREE.Color(spec.companyColor || '#d9483b');
    this.kit = new ModelKit(spec.season);
    this.layout = generateProperty(spec.propertySeed, spec.lot, { practice: spec.kind === 'practice' });
    this.field = new GrassField({ layout: this.layout, grassIn: spec.grassIn, leaves: spec.leaves, seed: spec.propertySeed });
    this.colliders = buildColliders(this.layout);
    this.deck = makeDeckOutcome(this.layout.beds.length);

    const m = spec.mower;
    this.deckHeights = m.deckHeights?.length ? m.deckHeights : [2, 2.5, 3, 3.5];
    let best = 0;
    for (let i = 0; i < this.deckHeights.length; i++) if (Math.abs(this.deckHeights[i] - spec.targetIn) < Math.abs(this.deckHeights[best] - spec.targetIn)) best = i;
    this.deckIdx = best;
    this.deckHalf = (m.deckWidth ?? 1) / 2;
    // the deck housing sticks out past the blades: this is why edges need the trimmer
    this.mowerR = this.deckHalf + (m.rideOn ? 0.18 : 0.1);
    const perks = new Set(spec.perks);
    this.mowerParams = {
      maxSpeed: (m.speed ?? 3) * (!m.rideOn && perks.has('quick_feet') ? 1.1 : 1),
      turnRate: m.turnRate ?? 2.4,
      zeroTurn: !!m.zeroTurn,
      carSteer: !!m.rideOn && !m.zeroTurn,
      accel: m.rideOn ? 2.6 : 4.2,
      assist: settings.laneAssist === false ? 0 : 0.2,
    };
    this.stripeStrength = (m.stripe ?? 0.3) + (spec.striping ? 0.25 : 0) + (perks.has('straight_lines') ? 0.1 : 0);
    this.stripeVis = Math.min(1, 0.35 + 0.65 * Math.min(1, this.stripeStrength));
    this.bagCap = spec.bagging ? (m.bagCapacityM2 ?? 140) : 0;
    this.sharpNow = spec.sharpness;
    this.tutorial = new Tutorial(spec.tutorial);
    this.deckP = {
      x: 0, z: 0, prevX: 0, prevZ: 0, heading: 0, width: m.deckWidth ?? 1, length: Math.min(0.7, Math.max(0.4, (m.deckWidth ?? 1) * 0.4)),
      deckIn: 3, deckIndex: 0, maxGrassIn: m.maxGrassIn ?? 6, stripeVis: this.stripeVis, bagActive: false, mulching: !!m.mulching,
      discharge: m.id === 'reel' || m.id === 'gangreel' ? 0 : m.mulching ? 0.35 : 1, wet: spec.wet, frame: 0, time: 0, dt: 0,
      autoStripe: !!spec.autoStripe, bandW: Math.max(0.8, m.deckWidth ?? 1),
    };

    this.build();
  }

  // ---------------------------------------------------------------- construction
  private build() {
    const host = this.host;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.hud = new Hud(host, this.spec, {
      start: () => this.start(),
      resume: () => this.setPaused(false),
      leave: () => this.end(false),
      finish: () => this.requestFinish(),
      finishConfirmed: () => this.end(true),
      tool: (n) => this.setTool(n),
      deck: (d) => this.changeDeck(d),
      camera: () => this.toggleCamera(),
      missed: () => this.flashMissed(),
      pause: () => this.setPaused(true),
      emptyBag: () => this.tryEmptyBag(),
    }, this.touch, this.layout.lawnM2);

    const canvas = document.createElement('canvas');
    canvas.className = 'mmj-gl';
    canvas.tabIndex = 0;
    this.hud.root.insertBefore(canvas, this.hud.root.firstChild!.nextSibling);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
      this.hud.hideLoading();
      this.hud.notice('3D is not available', 'This device could not start WebGL, so the lawn cannot be shown.', 'Leave', () => this.end(false));
      throw new Error('WebGL unavailable');
    }
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.touch ? (this.settings.grassDensity === 'low' ? 1.25 : 1.5) : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = this.settings.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const L = this.layout;
    const span = Math.max(L.lot.w, L.lot.d);
    this.u = makeGrassUniforms(this.field, this.spec.season, this.spec.weather);
    this.u.uWet.value = this.spec.wet || this.spec.weather === 'rain' || this.spec.weather === 'storm' ? 1 : 0;
    this.u.uDull.value = 1 - this.spec.sharpness;
    this.u.uStripeGain.value = 0.16 + 0.22 * Math.min(1, this.stripeStrength);
    this.u.uDeck.value = this.deckHeights[this.deckIdx];
    // lane guides one deck width apart (a little overlap), along the lot depth to start with
    this.guideSpacing = Math.max(0.6, (this.spec.mower.deckWidth ?? 1) * (this.spec.autoStripe ? 1 : 0.92));
    this.u.uGuide.value.set(0, 1, this.guideSpacing, 0);
    this.u.uGuideOn.value = this.settings.laneGuides === false ? 0 : 1;

    this.sky = new Sky(this.scene, this.spec.weather, this.settings.shadows, this.touch ? 1024 : 2048);
    this.sky.setShadowSpan(Math.min(45, span * 0.65 + 8));
    this.world = new World(L, this.kit, this.spec, this.field, this.u, this.companyColor);
    this.scene.add(this.world.group);
    // the parked vehicle blocks the sidewalk (the bike) or the curb lane
    {
      const vp = this.world.vehiclePos, len = this.world.vehicleLen;
      const r = (this.spec.vehicleModel || 'veh_bike') === 'veh_bike' ? 0.42 : 1.0;
      for (let x = vp.x - len / 2 + r; x <= vp.x + len / 2 - r + 0.01; x += r) this.colliders.circles.push({ x, z: vp.z, r, ob: null });
    }

    const m = this.spec.mower;
    const count = BLADE_COUNTS[this.settings.grassDensity] ?? BLADE_COUNTS.medium;
    const half = Math.min(18, Math.max(6.5, 4.8 + (m.deckWidth ?? 1) * 2.1));
    this.blades = new Blades(this.u, count, half, this.spec.propertySeed);
    this.scene.add(this.blades.mesh);
    this.scene.add(this.particles.points);
    if (this.spec.weather === 'rain' || this.spec.weather === 'storm') {
      this.rain = new Rain(this.touch ? 700 : 1400, this.spec.weather === 'storm');
      this.scene.add(this.rain.lines);
    }

    this.mowerVis = new MowerVisual(this.kit, m, this.companyColor);
    this.scene.add(this.mowerVis.root);
    this.char = new Character(this.kit, this.companyColor);
    this.scene.add(this.char.root);
    // where the trimmer cuts and where the blower pushes
    const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const coneGeo = new THREE.CircleGeometry(1, 24, -Math.PI / 2 - 0.45, 0.9);
    coneGeo.rotateX(-Math.PI / 2);
    const indMat = new THREE.MeshBasicMaterial({ color: 0xffd35c, transparent: true, opacity: 0.55, depthWrite: false });
    this.ring = new THREE.Mesh(ringGeo, indMat);
    this.cone = new THREE.Mesh(coneGeo, indMat.clone());
    (this.cone.material as THREE.MeshBasicMaterial).opacity = 0.22;
    this.ring.visible = this.cone.visible = false;
    this.ring.renderOrder = this.cone.renderOrder = 2;
    this.scene.add(this.ring, this.cone);
    // hazard warning: a red ring around a gnome, sprinkler or toy the deck is about to hit
    this.warn = new THREE.Mesh(ringGeo.clone(), new THREE.MeshBasicMaterial({ color: 0xff4b3a, transparent: true, opacity: 0.8, depthWrite: false }));
    this.warn.visible = false;
    this.warn.renderOrder = 3;
    this.scene.add(this.warn);

    // start on the driveway at the sidewalk, facing into the lot
    const d = L.driveway[0];
    const sx = d ? Math.min(Math.max(d.x, this.deckHalf + 0.2), L.lot.w - this.deckHalf - 0.2) : L.lot.w / 2;
    this.mower.place(sx, Math.max(-0.6, this.mowerR - 1.6), 0);
    this.walker.place(sx, -1, 0);

    this.rig = new CameraRig(1, this.settings.reducedMotion);
    this.rig.setVehicleSize(m.deckWidth ?? 1, !!m.rideOn);
    if (this.settings.cameraMode === 'top') this.rig.toggle();
    this.tmpV.set(this.mower.x, 0, this.mower.z);
    this.rig.snap(this.tmpV, this.mower.heading);

    this.input = new Input(canvas, this.hud.joy, () => this.active);
    this.input.onAnyInput = () => audio.unlock();
    this.minimap = new Minimap(this.hud.minimap, this.field);
    this.minimap.setHazards(L.obstacles.filter((o) => !o.solid && (o.kind === 'gnome' || o.kind === 'sprinkler' || o.kind === 'ball')));
    this.minimap.redraw(this.deckHeights[this.deckIdx], false);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.hud.root);
    this.resize();
    this.sky.setTime(this.clockMinute());
    this.updateVisuals(0);

    // first frame, then the start card
    this.renderer.render(this.scene, this.rig.camera);
    this.hud.hideLoading();
    this.hud.showStart({ mowerName: m.name, tutorial: this.spec.tutorial });
    this.hud.update(this.hudState());
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    const vis = () => { if (document.hidden && this.started && !this.ended && !this.paused) this.setPaused(true); };
    document.addEventListener('visibilitychange', vis);
    this.listeners.push([document, 'visibilitychange', vis]);
  }

  private resize() {
    const w = Math.max(1, this.hud.root.clientWidth), h = Math.max(1, this.hud.root.clientHeight);
    this.renderer.setSize(w, h, false);
    this.rig.camera.aspect = w / h;
    this.rig.camera.fov = w / h < 0.8 ? 62 : 50;
    this.rig.camera.updateProjectionMatrix();
    this.particles.setScale(h * this.renderer.getPixelRatio(), this.rig.camera.fov);
    this.hud.layout();
    this.minimap.resize();
  }

  // ---------------------------------------------------------------- controls
  private start() {
    if (this.started) return;
    audio.unlock();
    this.started = true;
    this.startAudio();
    this.hud.toast(this.spec.tutorial ? 'Take it slow. Straight lines look best.' : `Cut to ${this.spec.targetIn} in`, 'good');
    (this.renderer.domElement as HTMLCanvasElement).focus();
  }

  setPaused(on: boolean) {
    if (this.ended || !this.started) return;
    if (on === this.paused) { if (on && !this.hud.modalOpen) this.hud.showPause(); return; }
    this.paused = on;
    if (on) { this.hud.showPause(); this.setLoops(false); }
    else { if (this.hud.modalOpen) this.hud.closeModal(); this.setLoops(true); this.lastT = performance.now(); }
  }

  private setTool(n: 1 | 2 | 3) {
    if (!this.started || this.paused || this.ended) return;
    if (n === 2 && !this.spec.trimmer) { this.hud.toast('No trimmer in your kit.', 'warn'); return; }
    if (n === 3 && !this.spec.blower) { this.hud.toast('No blower in your kit.', 'warn'); return; }
    if (n === this.tool) return;
    const prev = this.tool;
    if (prev === 1) {
      // park the mower and step off beside it
      const m = this.mower;
      m.v = 0; m.omega = 0;
      const side = this.spec.mower.rideOn ? this.deckHalf + 0.9 : 0;
      const drv = this.mowerVis.driver;
      const back = this.spec.mower.rideOn ? 0.5 : drv ? -drv.z : (this.mowerVis.handle ? -this.mowerVis.handle.z + 0.45 : 1.2);
      const rx = -Math.cos(m.heading), rz = Math.sin(m.heading);
      this.walker.place(m.x - Math.sin(m.heading) * back + rx * side, m.z - Math.cos(m.heading) * back + rz * side, m.heading);
      resolve(this.colliders, this.walker, 0.26, 0.26, { x: m.x, z: m.z, r: this.deckHalf + 0.15 }, this.walker.hit);
    }
    if (n === 1) {
      // back to the mower
      this.walker.v = 0;
    }
    this.tool = n;
    const t = n === 2 ? this.spec.trimmer : n === 3 ? this.spec.blower : null;
    const kind = t ? (t.id === 'shears' ? 'shears' : t.id === 'broom' ? 'broom' : t.id === 'backpack' ? 'backpack' : n === 2 ? 'trimmer' : 'blower') : null;
    this.char.setTool(kind);
    if (t) this.walkParams.maxSpeed = Math.min(2.4, (t.speed ?? 2) * 0.85) * (this.spec.perks.includes('quick_feet') ? 1.1 : 1);
    this.startToolLoop();
    audio.play('click', { volume: 0.5 });
  }

  private changeDeck(d: -1 | 1) {
    if (this.ended) return;
    const n = Math.max(0, Math.min(this.deckHeights.length - 1, this.deckIdx + d));
    if (n === this.deckIdx) { this.hud.toast(d > 0 ? 'Deck is at its highest.' : 'Deck is at its lowest.', 'warn'); return; }
    this.deckIdx = n;
    this.u.uDeck.value = this.deckHeights[n];
    audio.play('click', { volume: 0.4, rate: d > 0 ? 1.1 : 0.9 });
    const h = this.deckHeights[n];
    const off = Math.abs(h - this.spec.targetIn);
    this.hud.toast(`Deck ${h} in${off > 0.5 ? (h > this.spec.targetIn ? ', higher than the client wants' : ', lower than the client wants') : ''}`, off > 0.5 ? 'warn' : '');
    this.statT = 0;
  }

  private toggleCamera() { this.rig.toggle(); }
  private flashMissed() { this.flashT = 2; this.flashed = true; this.miniT = 0; }

  private requestFinish() {
    if (!this.started || this.ended) return;
    const r = this.measure(true);
    if (r.coverage < 0.85) { this.paused = true; this.setLoops(false); this.hud.confirmFinish(r.coverage); }
    else this.end(true);
  }

  private tryEmptyBag(): boolean {
    if (!this.nearVehicle() || this.bag <= this.bagCap * 0.02) return false;
    this.bag = 0;
    this.bagWarned = false;
    audio.play('bag_empty');
    this.hud.toast('Bag emptied', 'good');
    this.hud.setBagPrompt(false);
    return true;
  }

  private nearVehicle(): boolean {
    const a = this.tool === 1 ? this.mower : this.walker;
    const dx = a.x - this.world.vehiclePos.x, dz = a.z - this.world.vehiclePos.z;
    return Math.hypot(dx, dz) < this.world.vehicleRadius && this.bagCap > 0;
  }

  // ---------------------------------------------------------------- audio
  private startAudio() {
    const amb = this.spec.weather === 'rain' || this.spec.weather === 'storm' ? 'rain_ambience' : 'birds_ambience';
    this.loops.amb = audio.loop(amb, { volume: 0.45 });
    const m = this.spec.mower;
    const key = m.id === 'reel' ? 'reel_loop' : m.rideOn ? 'zt_loop' : 'push_loop';
    this.loops.engine = audio.loop(key, { volume: m.id === 'reel' ? 0 : 0.5, rate: 0.8 });
    try { audio.music('music_mow'); } catch { /* optional */ }
  }
  private startToolLoop() {
    this.loops.tool?.stop();
    this.loops.tool = null;
    const t = this.tool === 2 ? this.spec.trimmer : this.tool === 3 ? this.spec.blower : null;
    if (t && t.loud) this.loops.tool = audio.loop(this.tool === 2 ? 'trimmer_loop' : 'blower_loop', { volume: 0.45 });
  }
  private setLoops(on: boolean) {
    if (!on) {
      this.loops.engine?.setVolume(0); this.loops.tool?.setVolume(0); this.loops.amb?.setVolume(0.1);
    } else {
      this.loops.amb?.setVolume(0.45);
      this.loops.tool?.setVolume(0.45);
    }
  }
  private stopAudio() {
    this.loops.engine?.stop(); this.loops.tool?.stop(); this.loops.amb?.stop();
    this.loops = { engine: null, tool: null, amb: null };
  }

  // ---------------------------------------------------------------- loop
  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    this.frameStep(dt);
  };

  /** One frame. Public so headless tools can step deterministically. */
  frameStep(dt: number) {
    const running = this.started && !this.paused && !this.ended;
    this.input.pollPad();
    for (const a of this.input.takeActions()) this.onAction(a);
    const [ox, oy] = this.input.takeOrbit();
    if (ox || oy) this.rig.orbit(ox, oy);
    const z = this.input.takeZoom();
    if (z) this.rig.addZoom(z);

    if (running) {
      this.active += dt;
      const steps = this.auto ? Math.max(1, Math.ceil(this.autoSpeed)) : 1;
      const sdt = this.auto ? (dt * this.autoSpeed) / steps : dt;
      for (let i = 0; i < steps; i++) this.simulate(sdt);
      if (this.auto) this.active += dt * (this.autoSpeed - 1);
      this.checkClock();
    }
    this.updateVisuals(dt);
    this.field.flush();
    this.renderer.render(this.scene, this.rig.camera);
  }

  private onAction(a: Action) {
    if (a === 'pause') {
      if (this.hud.modalOpen && this.paused) { this.setPaused(false); return; }
      this.setPaused(!this.paused);
      return;
    }
    if (!this.started || this.paused || this.ended) return;
    switch (a) {
      case 'tool1': this.setTool(1); break;
      case 'tool2': this.setTool(2); break;
      case 'tool3': this.setTool(3); break;
      case 'cycleTool': {
        const order: (1 | 2 | 3)[] = [1, 2, 3].filter((n) => n === 1 || (n === 2 && this.spec.trimmer) || (n === 3 && this.spec.blower)) as (1 | 2 | 3)[];
        this.setTool(order[(order.indexOf(this.tool) + 1) % order.length]);
        break;
      }
      case 'deckDown': this.changeDeck(-1); break;
      case 'deckUp': if (!this.tryEmptyBag()) this.changeDeck(1); break;
      case 'missed': this.flashMissed(); break;
      case 'camera': this.toggleCamera(); break;
      case 'finish': this.requestFinish(); break;
    }
  }

  private driveInput(out: DriveInput) {
    const inp = this.input;
    out.slow = inp.slow;
    out.throttle = inp.throttle;
    out.steer = inp.steer;
    out.target = null; out.mag = 0;
    if (inp.stick.active && (inp.stick.x || inp.stick.y)) {
      // stick direction is relative to the camera
      const cam = this.rig.camera;
      cam.getWorldDirection(this.fwd);
      let fx = this.fwd.x, fz = this.fwd.z;
      if (this.rig.mode === 'top') { fx = 0; fz = 1; }
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl; fz /= fl;
      const rx = -fz, rz = fx;   // camera right on the ground (for a camera looking along +z, right is -x)
      const sx = inp.stick.x, sy = inp.stick.y;
      const wx = fx * sy + rx * sx, wz = fz * sy + rz * sx;
      out.target = Math.atan2(wx, wz);
      out.mag = Math.min(1, Math.hypot(sx, sy));
      if (out.mag < 0.15) out.mag = 0;
    }
  }
  private di: DriveInput = { throttle: 0, steer: 0, target: null, mag: 0, slow: false };

  private simulate(dt: number) {
    this.frame++;
    const di = this.di;
    this.driveInput(di);
    const spec = this.spec;
    if (this.tool === 1) {
      const m = this.mower;
      if (this.auto) {
        const s = this.auto.steer(m, dt);
        if (s) { di.target = s.target; di.mag = s.mag; di.throttle = 0; di.steer = 0; }
        else { this.auto = null; di.target = null; di.mag = 0; }
      }
      // tall grass, wet ground and precision mode slow the mower
      const fxh = Math.sin(m.heading), fzh = Math.cos(m.heading);
      const reach = this.deckP.length * 0.5 + 0.1;
      let hsum = 0, hn = 0;
      for (let oi = -1; oi <= 1; oi++) {
        const o = oi * 0.6;
        const x = m.x + fxh * reach - fzh * o * this.deckHalf, z = m.z + fzh * reach + fxh * o * this.deckHalf;
        const k = this.field.idx(x, z);
        if (k >= 0 && this.field.surf[k] === LAWN) { hsum += this.field.h[k]; hn++; }
      }
      const hAhead = hn ? hsum / hn : 0;
      let mult = Math.max(0.4, 1 - 0.06 * Math.max(0, hAhead - 4));
      if (spec.wet) mult *= 0.85;
      if (di.slow) mult *= 0.45;
      // the demo autopilot steers precisely on its own: no lane assist while it drives
      m.step(dt, di, this.auto ? { ...this.mowerParams, assist: 0 } : this.mowerParams, mult);
      const px = m.prevX, pz = m.prevZ;
      resolve(this.colliders, m, this.mowerR, this.deckHalf, null, m.hit);
      if (m.hit.kind === 'water') {
        // slide along the shore instead of stopping dead
        const wet = (x: number, z: number) => (this.layout.ponds ?? []).some((p) => inBed(p, x, z, this.mowerR * 0.4));
        if (!wet(m.x, pz)) m.z = pz;
        else if (!wet(px, m.z)) m.x = px;
        else { m.x = px; m.z = pz; }
        m.v *= 0.6;
      }
      m.afterCollide(dt);
      this.onCollision(m.hit.kind, m.hit.speedInto, m.hit.fence);
      const step = Math.hypot(m.x - px, m.z - pz);
      this.moved += step;
      if (Math.abs(m.omega) < 0.3) {
        const c = Math.abs(Math.cos(m.heading)), sn = Math.abs(Math.sin(m.heading));
        if (c > 0.94) this.runZ += step; else if (sn > 0.94) this.runX += step;
      }
      this.cutWithDeck(dt);
      this.checkProps();
    } else {
      const w = this.walker;
      const px = w.x, pz = w.z;
      w.step(dt, di, this.walkParams, di.slow ? 0.5 : 1);
      resolve(this.colliders, w, 0.26, 0.26, { x: this.mower.x, z: this.mower.z, r: this.deckHalf + 0.15 }, w.hit);
      w.afterCollide(dt);
      this.moved += Math.hypot(w.x - px, w.z - pz);
      if (this.tool === 2) this.useTrimmer(dt);
      else this.useBlower(dt);
    }
  }

  private cutWithDeck(dt: number) {
    const m = this.mower, p = this.deckP, spec = this.spec;
    p.x = m.x; p.z = m.z; p.prevX = m.prevX; p.prevZ = m.prevZ; p.heading = m.heading;
    p.deckIn = this.deckHeights[this.deckIdx];
    p.deckIndex = this.deckIdx;
    p.bagActive = this.bagCap > 0 && this.bag < this.bagCap;
    p.frame = this.frame; p.time = this.active; p.dt = dt;
    const o = this.deck;
    cutDeck(this.field, p, o);
    if (o.cutCells) {
      const area = o.cutCells * this.field.cellArea;
      this.mowerArea += area;
      this.sharpNow = Math.max(0, this.spec.sharpness - 0.12 * (spec.mower.wearMult ?? 1) * (this.mowerArea / 1000));
      this.u.uDull.value = 1 - this.sharpNow;
      this.spawnClippings(o.cutCells, o.tallest, o.removed / Math.max(1, o.cutCells));
      this.crunchT -= dt;
      if (this.crunchT <= 0 && o.tallest > p.deckIn + 0.6) {
        const vol = Math.min(0.85, 0.12 + (o.tallest - p.deckIn) / 5);
        audio.play('cut_crunch', { volume: vol, rate: 0.9 + Math.random() * 0.25 });
        this.crunchT = 0.22 + Math.random() * 0.12;
      }
    }
    if (o.leavesMulched > 0.02 && Math.random() < 0.6) {
      const c = [[0.85, 0.4, 0.12], [0.9, 0.62, 0.18], [0.6, 0.32, 0.14]][Math.floor(Math.random() * 3)];
      this.particles.spawn(m.x, 0.2, m.z, (Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 2, c[0], c[1], c[2], 0.07, 0.8);
    }
    if (p.bagActive && o.bagAdd > 0) {
      this.bag = Math.min(this.bagCap, this.bag + o.bagAdd);
      if (this.bag >= this.bagCap && !this.bagWarned) {
        this.bagWarned = true;
        audio.play('bag_full');
        const vname = VEHICLE_NAME[spec.vehicleModel || 'veh_bike'] ?? 'vehicle';
        this.hud.toast(`Bag full. Empty it at your ${vname}.`, 'warn');
      }
    }
    // flower beds
    if (o.bedTouched.length) {
      const deckCells = (p.width * p.length) / this.field.cellArea;
      for (const b of o.bedTouched) {
        const hits = o.bedHits[b];
        if (hits > deckCells * 0.06) this.world.flowers.squash(b, m.x, m.z, this.deckHalf * 0.9);
        // a graze only warns; driving well into the bed is damage
        if (!this.bedWarned.has(b) && hits > deckCells * 0.06) {
          this.bedWarned.add(b);
          this.hud.toast('Careful: flower bed', 'warn');
        }
        if (!this.damagedBeds.has(b) && hits > deckCells * 0.35) {
          this.damagedBeds.add(b);
          this.addDamage({ kind: 'flowerbed', label: 'Flower bed trampled', points: 6, cost: 30 }, m.x, 0.2, m.z, [0xe8456b, 0xf2c230, 0xf4f4f4, 0x3f7a35]);
          audio.play('break', { volume: 0.6 });
        }
      }
    }
  }

  private spawnClippings(cells: number, tallest: number, avgRemoved: number) {
    const m = this.mower, spec = this.spec;
    const n = Math.min(10, Math.ceil(cells / 12 + avgRemoved * 2));
    const fx = Math.sin(m.heading), fz = Math.cos(m.heading);
    const rx = -fz, rz = fx;
    const bagging = this.deckP.bagActive;
    const reel = spec.mower.id === 'reel' || spec.mower.id === 'gangreel';
    for (let i = 0; i < n; i++) {
      const g = 0.35 + Math.random() * 0.25;
      let x: number, z: number, vx: number, vz: number, vy: number;
      if (bagging) {
        // into the rear bag: a short puff behind the deck
        x = m.x - fx * this.deckP.length * 0.6 + rx * (Math.random() - 0.5) * this.deckHalf;
        z = m.z - fz * this.deckP.length * 0.6 + rz * (Math.random() - 0.5) * this.deckHalf;
        vx = -fx * 1.2 + (Math.random() - 0.5); vz = -fz * 1.2 + (Math.random() - 0.5); vy = 1.5 + Math.random();
      } else if (reel) {
        x = m.x + rx * (Math.random() - 0.5) * this.deckHalf * 2; z = m.z + rz * (Math.random() - 0.5) * this.deckHalf * 2;
        vx = fx * 1.4 + (Math.random() - 0.5) * 0.8; vz = fz * 1.4 + (Math.random() - 0.5) * 0.8; vy = 1.2 + Math.random() * 1.2;
      } else {
        // side discharge chute on the right
        x = m.x + rx * this.deckHalf; z = m.z + rz * this.deckHalf;
        const sp = 3 + Math.random() * 2.5;
        vx = rx * sp + fx * (Math.random() - 0.3) * 1.5; vz = rz * sp + fz * (Math.random() - 0.3) * 1.5; vy = 1 + Math.random() * 1.6;
      }
      this.particles.spawn(x, 0.15, z, vx, vy, vz, g * 0.55, g + 0.25, g * 0.25, tallest > 5 ? 0.09 : 0.065, 0.6 + Math.random() * 0.6, 7, 2.5);
    }
  }

  private checkProps() {
    const m = this.mower, p = this.deckP;
    const fx = Math.sin(m.heading), fz = Math.cos(m.heading);
    for (const [o, obj] of this.world.propByObstacle) {
      if (this.damaged.has(o)) continue;
      const dx = o.x - m.x, dz = o.z - m.z;
      if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
      const along = dx * fx + dz * fz, across = dx * -fz + dz * fx;
      if (Math.abs(along) > p.length / 2 + o.r * 0.6 || Math.abs(across) > this.deckHalf + o.r * 0.4) continue;
      this.damaged.add(o);
      obj.visible = false;
      if (o.kind === 'gnome') {
        this.addDamage({ kind: 'gnome', label: 'Garden gnome broken', points: o.damagePoints, cost: o.damageCost }, o.x, 0.3, o.z, [0xd33a2c, 0x2f5fa0, 0xf4f4f4, 0xf0c8a8]);
        audio.play('gnome_break');
      } else if (o.kind === 'sprinkler') {
        this.addDamage({ kind: 'sprinkler', label: 'Sprinkler head broken', points: o.damagePoints, cost: o.damageCost }, o.x, 0.1, o.z, [0x2b2b2b, 0x555555]);
        // a little geyser
        for (let i = 0; i < 40; i++) this.particles.spawn(o.x, 0.1, o.z, (Math.random() - 0.5) * 1.2, 4 + Math.random() * 3, (Math.random() - 0.5) * 1.2, 0.7, 0.85, 1, 0.08, 1.2 + Math.random() * 0.6, 9, 0.5);
        audio.play('sprinkler_hit');
      } else {
        this.addDamage({ kind: 'toy', label: 'Toy shredded', points: o.damagePoints, cost: o.damageCost }, o.x, 0.2, o.z, [0xe83b3b, 0x3b7be8, 0xf2c230, 0xf4f4f4]);
        audio.play('break', { volume: 0.7 });
      }
    }
  }

  private addDamage(d: Damage, x: number, y: number, z: number, colors: number[]) {
    this.damages.push(d);
    this.particles.burst(x, y, z, 36, colors, 3, 0.1, 3.5);
    this.hud.toast(`${d.label}  -${d.points}`, 'bad');
    this.statT = 0;
  }

  private onCollision(kind: string, speedInto: number, fence: unknown) {
    this.bumpT -= 1 / 60;
    if (kind === 'none' || kind === 'bounds') return;
    if (speedInto > 0.7 && this.bumpT <= 0) {
      audio.play('bump', { volume: Math.min(0.9, 0.25 + speedInto / 5) });
      this.bumpT = 0.5;
    }
    if (kind === 'fence' && fence && this.spec.mower.rideOn && speedInto > 1.8 && !this.damagedFences.has(fence)) {
      this.damagedFences.add(fence);
      this.addDamage({ kind: 'fence', label: 'Fence dented', points: 5, cost: 60 }, this.mower.x, 0.6, this.mower.z, [0xf6f3ec, 0x8a6a4a]);
      audio.play('break', { volume: 0.8 });
    }
  }

  private useTrimmer(dt: number) {
    const t = this.spec.trimmer!;
    const w = this.walker;
    const edge = this.spec.perks.includes('edge_master') ? 1.3 : 1;
    const r = (t.radius ?? 0.5) * edge;
    const hx = w.x + Math.sin(w.heading) * (0.55 + r * 0.3), hz = w.z + Math.cos(w.heading) * (0.55 + r * 0.3);
    const rate = t.id === 'shears' ? 9 : t.id === 'protrimmer' ? 42 : 30;
    trim(this.field, hx, hz, r, this.deckHeights[this.deckIdx], rate, dt, this.trimOut);
    if (this.trimOut.cut > 0) {
      const n = Math.min(4, 1 + Math.floor(this.trimOut.cut / 6));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const g = 0.4 + Math.random() * 0.25;
        this.particles.spawn(hx + Math.cos(a) * r * 0.6, 0.12, hz + Math.sin(a) * r * 0.6, Math.cos(a) * 2.5, 1 + Math.random() * 1.5, Math.sin(a) * 2.5, g * 0.55, g + 0.2, g * 0.25, 0.05, 0.5, 7, 3);
      }
      // trimmer debris lands on nearby concrete
      if (Math.random() < 0.3) {
        const a = Math.random() * Math.PI * 2;
        const k = this.field.idx(hx + Math.cos(a) * (r + 0.3), hz + Math.sin(a) * (r + 0.3));
        if (k >= 0 && this.field.surf[k] === HARD) {
          const amt = 0.04;
          this.field.debris[k] = Math.min(1, this.field.debris[k] + amt);
          this.field.generatedDebris += amt;
          this.field.markC(k);
        }
      }
    }
  }

  private useBlower(dt: number) {
    const t = this.spec.blower!;
    const w = this.walker;
    const broom = t.id === 'broom';
    const r = t.radius ?? 1.4;
    const ox = w.x + Math.sin(w.heading) * 0.4, oz = w.z + Math.cos(w.heading) * 0.4;
    const strength = broom ? 2.2 : t.id === 'backpack' ? 9 : 6.5;
    blow(this.field, ox, oz, w.heading, broom ? r + 0.4 : r + 0.6, broom ? 0.9 : 0.42, strength, dt, this.blowOut);
    if (!broom && Math.random() < 0.7) {
      const a = w.heading + (Math.random() - 0.5) * 0.7;
      const s = 4 + Math.random() * 3;
      const moved = this.blowOut.moved > 0.001;
      const c = moved ? (Math.random() < 0.5 ? [0.45, 0.6, 0.22] : [0.85, 0.5, 0.18]) : [0.85, 0.82, 0.74];
      this.particles.spawn(ox + Math.sin(a) * 0.5, 0.15, oz + Math.cos(a) * 0.5, Math.sin(a) * s, 0.3 + Math.random() * 0.6, Math.cos(a) * s, c[0], c[1], c[2], moved ? 0.07 : 0.05, 0.5, 2, 2.2);
    } else if (broom && this.blowOut.moved > 0.001 && Math.random() < 0.4) {
      this.particles.spawn(ox, 0.08, oz, Math.sin(w.heading) * 1.2, 0.4, Math.cos(w.heading) * 1.2, 0.5, 0.62, 0.3, 0.05, 0.4);
    }
  }

  private clockMinute(): number {
    return this.spec.startMinute + SETUP_MINUTES + this.active * this.spec.timeScale;
  }

  private checkClock() {
    const m = this.clockMinute();
    if (m >= DAY_END && this.sunsetShown) { this.end(true); return; }
    if (m >= DAY_END && !this.sunsetShown) {
      this.sunsetShown = true;
      this.paused = true;
      this.setLoops(false);
      this.hud.notice('Sunset', 'It is too dark to keep mowing. The job ends here.', 'See results', () => this.end(true));
    }
  }

  // ---------------------------------------------------------------- visuals
  private updateVisuals(dt: number) {
    const m = this.mower, w = this.walker, spec = this.spec;
    this.clockT += dt;
    this.u.uTime.value += dt;
    if (this.flashT > 0) { this.flashT -= dt; this.u.uFlash.value = Math.min(1, this.flashT / 0.3); } else this.u.uFlash.value = 0;
    const running = this.started && !this.paused && !this.ended;

    // mower
    const mv = this.mowerVis.root;
    mv.position.set(m.x, 0, m.z);
    mv.rotation.y = m.heading;
    const engineOn = spec.mower.id !== 'reel' && this.started && !this.ended;
    mv.position.y = engineOn && running ? Math.sin(this.u.uTime.value * 55) * 0.004 : 0;

    // operator
    const ch = this.char.root;
    let pose: Pose = 'stand';
    let speed = 0;
    this.mowerVis.roll(m.v * dt);
    const drv = this.mowerVis.driver;
    if (this.tool === 1 && drv) {
      // the GLB says where the operator stands or sits
      this.tmpV.copy(drv).applyAxisAngle(THREE.Object3D.DEFAULT_UP, m.heading);
      ch.position.set(m.x + this.tmpV.x, this.tmpV.y + mv.position.y, m.z + this.tmpV.z);
      ch.rotation.y = m.heading;
      pose = spec.mower.rideOn ? (spec.mower.id === 'standon' ? 'standon' : 'sit') : 'push';
      if (pose === 'push') speed = Math.abs(m.v) + Math.abs(m.omega) * 0.4;
    } else if (this.tool === 1) {
      if (spec.mower.rideOn) {
        const seat = this.mowerVis.seat ?? new THREE.Vector3(0, 1, -1);
        const standon = spec.mower.id === 'standon';
        this.tmpV.set(seat.x, standon ? seat.y : seat.y - 0.88, seat.z + (standon ? 0 : 0.12));
        this.tmpV.applyAxisAngle(THREE.Object3D.DEFAULT_UP, m.heading);
        ch.position.set(m.x + this.tmpV.x, this.tmpV.y + mv.position.y, m.z + this.tmpV.z);
        ch.rotation.y = m.heading;
        pose = standon ? 'standon' : 'sit';
      } else {
        const hz = this.mowerVis.handle ? this.mowerVis.handle.z - 0.42 : -1.3;
        ch.position.set(m.x + Math.sin(m.heading) * hz, 0, m.z + Math.cos(m.heading) * hz);
        ch.rotation.y = m.heading;
        pose = 'push';
        speed = Math.abs(m.v) + Math.abs(m.omega) * 0.4;
      }
    } else {
      ch.position.set(w.x, 0, w.z);
      ch.rotation.y = w.heading;
      speed = Math.abs(w.v);
      const t = this.tool === 2 ? spec.trimmer : spec.blower;
      pose = this.tool === 2 ? 'trim' : t?.id === 'broom' ? 'broom' : 'blow';
    }
    this.char.animate(pose, speed, dt, this.u.uTime.value);
    // tool footprint on the ground
    this.ring.visible = this.tool === 2 && !!spec.trimmer && this.started;
    this.cone.visible = this.tool === 3 && !!spec.blower && this.started;
    if (this.ring.visible) {
      const r = (spec.trimmer!.radius ?? 0.5) * (spec.perks.includes('edge_master') ? 1.3 : 1);
      const off = 0.55 + r * 0.3;
      this.ring.position.set(w.x + Math.sin(w.heading) * off, 0.03, w.z + Math.cos(w.heading) * off);
      this.ring.scale.setScalar(r);
    }
    if (this.cone.visible) {
      const b = spec.blower!;
      const r = (b.radius ?? 1.4) + (b.id === 'broom' ? 0.4 : 0.6);
      this.cone.position.set(w.x + Math.sin(w.heading) * 0.4, 0.03, w.z + Math.cos(w.heading) * 0.4);
      this.cone.rotation.y = w.heading;
      this.cone.scale.setScalar(r);
    }

    // hazard warning ring on the nearest breakable prop in front of the deck
    let near: { x: number; z: number; r: number } | null = null;
    if (this.tool === 1 && this.started && !this.ended) {
      const fx = Math.sin(m.heading), fz = Math.cos(m.heading);
      let best = Infinity;
      for (const o of this.world.propByObstacle.keys()) {
        if (this.damaged.has(o)) continue;
        const dx = o.x - m.x, dz = o.z - m.z;
        const along = dx * fx + dz * fz, across = Math.abs(dx * -fz + dz * fx);
        if (along < -0.6 || along > 3.2 || across > this.deckHalf + 1) continue;
        const d = Math.hypot(dx, dz);
        if (d < best) { best = d; near = o; }
      }
    }
    this.warn.visible = !!near;
    if (near) {
      const pulse = 0.5 + 0.5 * Math.sin(this.u.uTime.value * 10);
      this.warn.position.set(near.x, 0.05, near.z);
      this.warn.scale.setScalar(Math.max(0.35, near.r + 0.25) * (1 + 0.15 * pulse));
      (this.warn.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * pulse;
    }
    // dirty concrete glows while the blower is out or the missed-spot flash runs
    const hiGoal = this.flashT > 0 ? 1 : this.tool === 3 && this.started ? 0.85 : 0;
    this.u.uCleanHi.value += (hiGoal - this.u.uCleanHi.value) * Math.min(1, dt * 6);
    // guides follow the direction the player actually mows (stripes along the depth or across the lot)
    if (!spec.autoStripe) {
      const wantX = this.runX > 8 && this.runX > this.runZ * 1.4 ? true : this.runZ > 8 && this.runZ > this.runX * 1.4 ? false : this.guideAxisX;
      if (wantX !== this.guideAxisX) {
        this.guideAxisX = wantX;
        this.u.uGuide.value.set(wantX ? 1 : 0, wantX ? 0 : 1, this.guideSpacing, 0);
      }
    }

    // camera
    const actor = this.tool === 1 ? m : w;
    this.rig.walking = this.tool !== 1;
    this.tmpV.set(actor.x, 0, actor.z);
    this.rig.update(dt, this.tmpV, actor.heading, actor.v, this.tool === 1 ? -1.2 : -0.6, this.active - this.input.lastOrbitT);
    const cam = this.rig.camera;
    this.sky.dome.position.copy(cam.position);
    this.tmpV2.set(actor.x, 1, actor.z);
    this.world.updateFades(cam.position, this.tmpV2, dt);

    // blades follow the actor, pushed toward what the camera sees
    cam.getWorldDirection(this.fwd);
    const fl = Math.hypot(this.fwd.x, this.fwd.z) || 1;
    const push = this.rig.mode === 'top' ? 0 : this.blades.half * 0.4;
    this.blades.setCenter(actor.x + (this.fwd.x / fl) * push, actor.z + (this.fwd.z / fl) * push);

    // light, weather, particles
    const minute = this.clockMinute();
    if (this.clockT > 0.5 || dt === 0) { this.clockT = 0; this.sky.setTime(minute); }
    this.sky.follow(this.layout.lot.w > 90 || this.layout.lot.d > 90 ? actor.x : this.layout.lot.w / 2, this.layout.lot.w > 90 || this.layout.lot.d > 90 ? actor.z : this.layout.lot.d / 2, dt);
    const lightning = this.sky.lightning;
    if (lightning !== this.lastLightning) { this.lastLightning = lightning; this.hud.flash(); }
    this.particles.update(dt);
    this.rain?.update(dt, cam.position.x, cam.position.z);

    // audio
    if (running) {
      const vmax = this.mowerParams.maxSpeed;
      const load = this.deck.cutCells > 0 ? Math.min(0.25, this.deck.removed / Math.max(1, this.deck.cutCells) / 6) : 0;
      if (spec.mower.id === 'reel') {
        this.loops.engine?.setVolume(this.tool === 1 ? Math.min(0.6, Math.abs(m.v) / vmax * 0.7) : 0);
        this.loops.engine?.setRate(0.8 + Math.abs(m.v) / vmax * 0.5);
      } else {
        const idle = this.tool !== 1;
        this.loops.engine?.setVolume(idle ? 0.22 : 0.5);
        this.loops.engine?.setRate(idle ? 0.8 : 0.85 + (Math.abs(m.v) / vmax) * 0.3 - load * 0.6 + (this.deck.cutCells ? 0.05 : 0));
      }
      if (this.loops.tool) this.loops.tool.setRate(0.9 + Math.min(0.3, Math.abs(w.v) * 0.1) + (this.trimOut.cut ? 0.08 : 0));
    }

    // hud, minimap, live score
    if (running) {
      this.statT -= dt;
      if (this.statT <= 0) {
        this.statT = 1.0;
        this.measure(true, true);
      }
      const near = this.bag > this.bagCap * 0.05 && this.nearVehicle();
      this.hud.setBagPrompt(near);
      const tv = this.lastResult;
      const hint = this.tutorial.update({
        moved: this.moved, areaCut: this.field.uniqueCutCells * this.field.cellArea,
        coverage: tv?.coverage ?? 0, trim: tv?.trim ?? 0, cleanup: tv?.cleanup ?? 1, tool: this.tool,
        hasTrimmer: !!spec.trimmer, hasBlower: !!spec.blower, debris: this.hardDebris, flashed: this.flashed, touch: this.touch,
      }, dt);
      this.hud.setHint(hint, 'First job');
      if (!hint && this.settings.showHints) this.hud.setHint(this.softHint(), 'Tip');
    }
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.hud.update(this.hudState()); }
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.5; this.minimap.redraw(this.deckHeights[this.deckIdx], this.flashT > 0 && Math.sin(this.u.uTime.value * 9) > -0.3, this.tool === 3 || this.flashT > 0); }
    this.miniDrawT -= dt;
    if (this.miniDrawT <= 0) {
      this.miniDrawT = 1 / 15;
      this.minimap.draw({ x: m.x, z: m.z, h: m.heading }, this.tool === 1 ? null : { x: w.x, z: w.z, h: w.heading }, this.world.vehiclePos, this.damaged);
    }
  }
  private lastLightning = 0;
  private miniDrawT = 0;
  private ring!: THREE.Mesh;
  private cone!: THREE.Mesh;
  private warn!: THREE.Mesh;
  private guideSpacing = 1;
  private projected: number | null = null;
  private guideAxisX = false;
  private runX = 0;
  private runZ = 0;
  private hardDebris = 0;

  private softHint(): string | null {
    const r = this.lastResult;
    if (!r) return null;
    if (this.bagCap > 0 && this.bag >= this.bagCap) return `Bag full. Drive to your ${VEHICLE_NAME[this.spec.vehicleModel || 'veh_bike'] ?? 'vehicle'} at the curb and press ${this.touch ? 'the bag prompt' : 'E'}.`;
    const cur = this.deckHeights[this.deckIdx];
    if (this.lastQ && this.lastQ.penalties.some((p) => p.label === 'Grass was scalped' || p.label.startsWith('Lawn stressed')) && this.deckIdx < this.deckHeights.length - 1)
      return `Taking off too much at once stresses the lawn. Raise the deck (${this.touch ? 'up arrow' : 'E'}).`;
    if (this.deck.pushedOver > 20) return 'This grass is too tall for the mower. Make a second pass.';
    if (r.coverage > 0.93 && r.trim < 0.7 && this.spec.trimmer && this.tool === 1) return `Edges left. Trim along beds, walls and trees (${this.touch ? 'trimmer' : '2'}).`;
    if (this.tool === 3 && r.cleanup < 0.97) return 'Glowing orange spots still need clearing. Blow them onto the lawn.';
    if (r.coverage > 0.93 && r.cleanup < 0.8 && this.spec.blower && this.tool !== 3) return `Clippings on the concrete. Blow them back onto the lawn (${this.touch ? 'blower' : '3'}).`;
    void cur;
    return null;
  }

  private hudState() {
    const t = this.tool === 1 ? this.spec.mower : this.tool === 2 ? this.spec.trimmer : this.spec.blower;
    const r = this.lastResult;
    return {
      minute: this.clockMinute(),
      late: this.clockMinute() > DAY_END - 30,
      quality: this.lastQ,
      projected: this.projected,
      coverage: r?.coverage ?? 0,
      trim: r?.trim ?? 0,
      stripe: r?.stripe ?? 0,
      cleanup: r?.cleanup ?? 1,
      tool: this.tool,
      toolName: t?.name ?? '',
      deckIn: this.deckHeights[this.deckIdx],
      targetIn: this.spec.targetIn,
      bag: this.bagCap > 0 ? this.bag / this.bagCap : null,
      sharp: this.sharpNow,
    };
  }

  /** Current measurements and the quality preview (`live`: projected score that grows as you mow). */
  measure(completed: boolean, live = false): MowJobResult {
    const s: ScoreState = {
      field: this.field, deckHeights: this.deckHeights, deckIndex: this.deckIdx, deckWidth: this.spec.mower.deckWidth ?? 1,
      stripeStrength: this.stripeStrength, damages: this.damages, realSeconds: this.active, timeScale: this.spec.timeScale,
      burnsFuel: (this.spec.mower.fuelGalPerHr ?? 0) > 0, wearMult: this.spec.mower.wearMult ?? 1, mowerAreaM2: this.mowerArea,
    };
    const r = computeResult(s, completed);
    this.lastResult = r;
    let q: QualityBreakdown;
    const qr = live ? liveResult(this.field, r) : r;
    try { q = computeQuality(this.spec, qr); } catch { q = estimateQuality(this.spec, qr); }
    if (live && r.coverage > 0.05 && r.coverage < 0.95) {
      const pr = projectedResult(this.field, r);
      try { this.projected = computeQuality(this.spec, pr).q; } catch { this.projected = estimateQuality(this.spec, pr).q; }
    } else this.projected = null;
    this.lastQ = q;
    let hd = 0;
    for (let k = 0; k < this.field.n; k++) if (this.field.surf[k] === HARD) hd += this.field.debris[k] + this.field.leaves[k];
    this.hardDebris = hd;
    return r;
  }

  // ---------------------------------------------------------------- end
  private end(completed: boolean) {
    if (this.ended) return;
    this.ended = true;
    const r = this.measure(completed);
    this.stopAudio();
    const cb = this.cb;
    // let the UI mount the next screen; the host keeps the canvas until dispose()
    setTimeout(() => { if (completed) cb.onFinish(r); else cb.onAbandon(r); }, 0);
  }

  // ---------------------------------------------------------------- debug and harness hooks
  autoMow(speedMult = 1) {
    if (!this.started) this.start();
    this.setTool(1);
    this.autoSpeed = Math.max(0.25, speedMult);
    const carSteer = this.mowerParams.carSteer;
    this.auto = new AutoPilot(this.layout, this.colliders, this.spec.mower.deckWidth ?? 1, this.mowerR, carSteer ? 1.4 : 0.35, this.mower.x, this.mower.z);
  }
  get autoActive() { return !!this.auto; }
  setGamepad(on: boolean) { this.input.padEnabled = on; }
  /** Run the simulation without rendering (headless tests). Stops early when the autopilot finishes. */
  fastForward(seconds: number, dt = 1 / 30) {
    if (!this.started) this.start();
    const hadAuto = !!this.auto;
    const n = Math.ceil(seconds / dt);
    for (let i = 0; i < n; i++) {
      if (this.paused || this.ended) break;
      this.active += dt;
      this.simulate(dt);
      this.particles.update(dt);
      this.checkClock();
      if (hadAuto && !this.auto) break;
    }
    this.measure(true);
    this.miniT = 0;
    this.hudT = 0;
  }
  finishNow() { if (!this.started) this.start(); this.end(true); }
  teleport(x: number, z: number, heading: number) {
    const a = this.tool === 1 ? this.mower : this.walker;
    a.place(x, z, heading);
    this.tmpV.set(x, 0, z);
    this.rig.snap(this.tmpV, heading);
  }
  setClock(minute: number) { this.active = Math.max(0, (minute - this.spec.startMinute - SETUP_MINUTES) / this.spec.timeScale); this.sky.setTime(minute); }
  setCamera(mode: 'chase' | 'top') { if (this.rig.mode !== mode) this.rig.toggle(); }
  selectTool(n: 1 | 2 | 3) { if (!this.started) this.start(); this.setTool(n); }
  /** Trim every edge cell instantly (headless scoring checks). */
  trimAllEdges() {
    const f = this.field, d = this.deckHeights[this.deckIdx];
    for (let k = 0; k < f.n; k++) if (f.edge[k] && f.h[k] > d) { f.h[k] = d; if (!f.cutOnce[k]) { f.cutOnce[k] = 1; f.uniqueCutCells++; } if (f.cutBy[k] !== 1) f.cutBy[k] = 2; f.markA(k); }
  }
  debugState() {
    const r = this.lastResult ?? this.measure(true);
    return {
      started: this.started, paused: this.paused, ended: this.ended, tool: this.tool, deckIn: this.deckHeights[this.deckIdx],
      minute: Math.round(this.clockMinute()), active: Math.round(this.active * 10) / 10, auto: !!this.auto, autoProgress: this.auto?.progress ?? 1,
      mower: { x: +this.mower.x.toFixed(2), z: +this.mower.z.toFixed(2), h: +this.mower.heading.toFixed(2) },
      walker: { x: +this.walker.x.toFixed(2), z: +this.walker.z.toFixed(2) },
      bag: this.bagCap ? +(this.bag / this.bagCap).toFixed(2) : null,
      q: this.lastQ ? Math.round(this.lastQ.q) : null, result: r,
      grid: { nx: this.field.nx, nz: this.field.nz, cs: this.field.cs, lawnCells: this.field.lawnCells, edgeCells: this.field.edgeCells },
      lawnM2: this.layout.lawnM2, lot: this.layout.lot,
    };
  }

  // ---------------------------------------------------------------- dispose
  pause(on: boolean) { if (this.started) this.setPaused(on); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.stopAudio();
    this.ro?.disconnect();
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
    this.input.dispose();
    this.mowerVis.dispose();
    this.char.dispose();
    this.world.dispose();
    this.blades.dispose();
    this.particles.dispose();
    this.rain?.dispose();
    this.ring.geometry.dispose(); (this.ring.material as THREE.Material).dispose();
    this.cone.geometry.dispose(); (this.cone.material as THREE.Material).dispose();
    this.warn.geometry.dispose(); (this.warn.material as THREE.Material).dispose();
    this.sky.dispose();
    this.field.dispose();
    // procedural meshes of the actors
    for (const root of [this.mowerVis.root, this.char.root]) {
      root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.mmShared) m.geometry?.dispose(); });
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) if (mat?.userData?.mmOwned) mat.dispose();
    });
    this.kit.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.hud.dispose();
  }
}

export { wrapAngle };
