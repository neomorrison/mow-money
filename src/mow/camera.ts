// Chase camera (lazy follow, mouse and touch orbit, zoom) and a north-up top-down view.
import * as THREE from 'three';

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  mode: 'chase' | 'top' = 'chase';
  zoom = 1;
  private yaw = 0;             // camera yaw around the target (radians, same convention as heading)
  private orbitYaw = 0;
  private orbitPitch = 0;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private inited = false;
  base = 6;                    // chase distance at zoom 1
  walking = false;             // on foot with a hand tool: pull in closer
  private distNow = 0;

  constructor(aspect: number, private reducedMotion: boolean) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 900);
  }

  setVehicleSize(deckWidth: number, rideOn: boolean) {
    this.base = 7.2 + deckWidth * (rideOn ? 2.0 : 1.7);
  }

  orbit(dx: number, dy: number) {
    if (this.mode === 'top') return;
    this.orbitYaw -= dx * 0.006;
    this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.004, -0.35, 0.6);
  }
  addZoom(d: number) { this.zoom = THREE.MathUtils.clamp(this.zoom * (1 + d), 0.45, 2.8); }

  /** Snap behind the heading (used on start and after teleports). */
  snap(target: THREE.Vector3, heading: number) {
    this.yaw = heading + Math.PI;
    this.inited = false;
    this.update(1, target, heading, 0, 0, 99);
  }

  update(dt: number, target: THREE.Vector3, heading: number, speed: number, forwardBias: number, sinceOrbit: number) {
    const cam = this.camera;
    if (this.mode === 'top') {
      const H = (13 + this.base * 1.6) * this.zoom;
      this.tmp.set(target.x, H, target.z - H * 0.18);
      this.look.copy(target);
      cam.up.set(0, 0, 1);
    } else {
      cam.up.set(0, 1, 0);
      // follow the heading lazily; faster when moving so lanes feel steady
      const want = heading + Math.PI;
      let d = want - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const rate = (this.reducedMotion ? 1.0 : 1.7) * (0.35 + Math.min(1, Math.abs(speed) / 2));
      this.yaw += d * Math.min(1, dt * rate);
      if (sinceOrbit > 2.5) {
        this.orbitYaw *= 1 - Math.min(1, dt * 1.2);
        this.orbitPitch *= 1 - Math.min(1, dt * 1.2);
      }
      const wantDist = (this.walking ? Math.min(this.base, 6.2) : this.base) * this.zoom;
      this.distNow = this.distNow ? this.distNow + (wantDist - this.distNow) * Math.min(1, dt * 3) : wantDist;
      const dist = this.distNow;
      const pitch = 0.62 + this.orbitPitch;
      const yaw = this.yaw + this.orbitYaw;
      this.tmp.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        target.y + Math.sin(pitch) * dist + 0.4,
        target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      this.look.set(target.x - Math.sin(yaw) * forwardBias, target.y + 0.5, target.z - Math.cos(yaw) * forwardBias);
    }
    if (!this.inited) { this.pos.copy(this.tmp); this.inited = true; }
    else this.pos.lerp(this.tmp, Math.min(1, dt * (this.mode === 'top' ? 5 : 7)));
    if (this.pos.y < 0.6) this.pos.y = 0.6;
    cam.position.copy(this.pos);
    cam.lookAt(this.look);
  }

  toggle() {
    this.mode = this.mode === 'chase' ? 'top' : 'chase';
    this.inited = false;
  }
}
