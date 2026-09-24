// Sky dome, sun and ambient light driven by the job clock and the weather.
import * as THREE from 'three';
import type { WeatherKind } from '../core/types';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunCol; uniform vec3 uSunDir; uniform float uHaze;
varying vec3 vDir;
void main() {
  float y = max(vDir.y, 0.0);
  vec3 col = mix(uHorizon, uTop, pow(y, 0.55));
  float s = max(dot(normalize(vDir), uSunDir), 0.0);
  col += uSunCol * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25 * (1.0 - uHaze));
  col = mix(col, uHorizon, uHaze * (1.0 - y) * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Sky {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  dome: THREE.Mesh;
  fog: THREE.Fog;
  private mat: THREE.ShaderMaterial;
  private sunDir = new THREE.Vector3();
  private flash = 0;
  private shadowSpan = 40;
  lightning = 0;
  private baseSun = 2.6;
  private baseHemi = 1.3;

  constructor(scene: THREE.Scene, private weather: WeatherKind, shadows: boolean, mapSize: number) {
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a6b3a, 1.3);
    scene.add(this.hemi);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uHaze: { value: 0 },
      },
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), this.mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    scene.add(this.dome);
    this.fog = new THREE.Fog(0xcfe0ea, 90, 420);
    scene.fog = this.fog;
  }

  setShadowSpan(span: number) {
    this.shadowSpan = span;
    const c = this.sun.shadow.camera;
    c.left = -span; c.right = span; c.top = span; c.bottom = -span;
    c.near = 1; c.far = 400;
    c.updateProjectionMatrix();
  }

  /** minute = owner clock (450..1170). */
  setTime(minute: number) {
    const rise = 370, set = 1215;
    const p = THREE.MathUtils.clamp((minute - rise) / (set - rise), 0.01, 0.99);
    const el = Math.sin(p * Math.PI) * THREE.MathUtils.degToRad(60) + THREE.MathUtils.degToRad(5);
    // sun travels east (+x) to west (-x) across the south (street side, -z)
    const hx = Math.cos(p * Math.PI), hz = -0.55 - 0.45 * Math.sin(p * Math.PI);
    const hl = Math.hypot(hx, hz);
    this.sunDir.set((hx / hl) * Math.cos(el), Math.sin(el), (hz / hl) * Math.cos(el)).normalize();
    // warmth: golden in the early morning, amber in the evening, white around noon
    const sm = (a: number, b: number, x: number) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const low = Math.max(sm(0.62, 0.97, p), sm(0.36, 0.05, p));
    const morning = p < 0.5;
    const warm = new THREE.Color(morning ? 0xffc98a : 0xffa65e);
    const noon = new THREE.Color(0xfff6e6);
    const sunCol = noon.clone().lerp(warm, low);
    let sunI = 2.1 + 1.1 * (1 - low);
    let hemiI = 1.15 + 0.35 * (1 - low);
    const top = new THREE.Color(0x4f95da).lerp(new THREE.Color(0x6a88c0), low * 0.6);
    const hor = new THREE.Color(0xcfe5f2).lerp(new THREE.Color(morning ? 0xf7dcb4 : 0xf6c89a), low * 0.8);
    let haze = 0;
    const skyC = new THREE.Color(0xcfe6ff).lerp(new THREE.Color(0xf2d7b8), low * 0.5);
    const gndC = new THREE.Color(0x5d6e3c);
    switch (this.weather) {
      case 'cloudy':
        sunI *= 0.45; hemiI *= 1.3; top.lerp(new THREE.Color(0x9fb0bf), 0.7); hor.lerp(new THREE.Color(0xd5dade), 0.7);
        sunCol.lerp(new THREE.Color(0xe8ecf0), 0.5); haze = 0.3; skyC.lerp(new THREE.Color(0xdde3e8), 0.6); break;
      case 'rain':
        sunI *= 0.18; hemiI *= 1.1; top.set(0x6f7b86); hor.set(0x9aa4ab); sunCol.set(0xc8d0d8); haze = 0.7; skyC.set(0xa9b4bd); break;
      case 'storm':
        sunI *= 0.12; hemiI *= 1.0; top.set(0x4a535c); hor.set(0x7b858c); sunCol.set(0xb8c0c8); haze = 0.8; skyC.set(0x8b959d); break;
      case 'heat':
        sunI *= 1.1; top.lerp(new THREE.Color(0x7fa9cf), 0.5); hor.lerp(new THREE.Color(0xf4ddb0), 0.7); sunCol.lerp(new THREE.Color(0xffe2b0), 0.4); haze = 0.45;
        skyC.lerp(new THREE.Color(0xf6e3c0), 0.4); break;
      default: break;
    }
    this.sun.color.copy(sunCol);
    this.baseSun = sunI; this.baseHemi = hemiI;
    this.sun.intensity = sunI + this.flash * 6;
    this.hemi.color.copy(skyC);
    this.hemi.groundColor.copy(gndC);
    this.hemi.intensity = hemiI + this.flash * 2;
    const u = this.mat.uniforms;
    (u.uTop.value as THREE.Color).copy(top);
    (u.uHorizon.value as THREE.Color).copy(hor);
    (u.uSunCol.value as THREE.Color).copy(sunCol);
    (u.uSunDir.value as THREE.Vector3).copy(this.sunDir);
    u.uHaze.value = haze;
    this.fog.color.copy(hor);
    const near = this.weather === 'rain' || this.weather === 'storm' ? 45 : this.weather === 'heat' ? 70 : 110;
    this.fog.near = near;
    this.fog.far = near * 4.2;
  }

  /** Keep the shadow box around the area of interest, snapped to texels to avoid shimmer. */
  follow(cx: number, cz: number, dt: number) {
    if (this.weather === 'storm') {
      this.flash = Math.max(0, this.flash - dt * 4);
      if (Math.random() < dt * 0.08) { this.flash = 1; this.lightning++; }
      this.sun.intensity = this.baseSun + this.flash * 6;
      this.hemi.intensity = this.baseHemi + this.flash * 2;
    }
    const texel = (this.shadowSpan * 2) / this.sun.shadow.mapSize.x;
    const x = Math.round(cx / texel) * texel, z = Math.round(cz / texel) * texel;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 150, this.sunDir.y * 150, z + this.sunDir.z * 150);
  }

  dispose() {
    this.dome.geometry.dispose();
    this.mat.dispose();
    this.sun.shadow.map?.dispose();
  }
}
