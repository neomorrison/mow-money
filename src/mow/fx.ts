// Particles (clippings, bursts, blower dust, falling leaves) in one Points draw call, plus rain streaks.
import * as THREE from 'three';

const PVERT = /* glsl */`
attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha;
uniform float uScale;
void main() {
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */`
varying vec3 vColor; varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // blade-ish sliver
  float d = abs(c.x * 0.8 + c.y * 0.6) * 2.4 + abs(c.x * 0.6 - c.y * 0.8) * 0.9;
  if (d > 0.9 || vAlpha <= 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
  #include <colorspace_fragment>
}`;

export class Particles {
  points: THREE.Points;
  private n: number;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array;
  private size: Float32Array; private alpha: Float32Array; private life: Float32Array; private maxLife: Float32Array;
  private drag: Float32Array; private grav: Float32Array;
  private next = 0;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private alive = 0;

  constructor(n = 2400) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.grav = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, uniforms: { uScale: { value: 400 } } });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }

  setScale(viewportH: number, fov: number) {
    this.mat.uniforms.uScale.value = viewportH / (2 * Math.tan((fov * Math.PI) / 360));
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, g: number, b: number, size: number, life: number, grav = 9.8, drag = 1.5) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.alpha[i] = 1;
    this.grav[i] = grav; this.drag[i] = drag;
    this.alive = Math.max(this.alive, 1);
  }

  /** A puff of pieces in random directions. */
  burst(x: number, y: number, z: number, n: number, colors: number[], speed: number, size: number, up = 3) {
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.setHex(colors[i % colors.length]);
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, c.r, c.g, c.b, size * (0.6 + Math.random() * 0.8), 0.9 + Math.random() * 0.8);
    }
  }

  update(dt: number) {
    if (!this.alive) return;
    let any = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      any++;
      this.life[i] -= dt;
      const o = i * 3;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[o] *= dr; this.vel[o + 2] *= dr;
      this.vel[o + 1] -= this.grav[i] * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      if (this.pos[o + 1] < 0.02) { this.pos[o + 1] = 0.02; this.vel[o] *= 0.3; this.vel[o + 2] *= 0.3; this.vel[o + 1] = 0; }
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = t < 0.3 ? t / 0.3 : 1;
    }
    this.alive = any;
    const g = this.geo;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

export class Rain {
  lines: THREE.LineSegments;
  private pos: Float32Array;
  private n: number;
  private geo: THREE.BufferGeometry;
  private mat: THREE.LineBasicMaterial;
  constructor(n: number, private heavy: boolean) {
    this.n = n;
    this.pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) this.reset(i, 0, 0, true);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: heavy ? 0.55 : 0.4, depthWrite: false });
    this.lines = new THREE.LineSegments(this.geo, this.mat);
    this.lines.frustumCulled = false;
  }
  private reset(i: number, cx: number, cz: number, anyY: boolean) {
    const x = cx + (Math.random() - 0.5) * 36, z = cz + (Math.random() - 0.5) * 36;
    const y = anyY ? Math.random() * 16 : 14 + Math.random() * 4;
    const len = this.heavy ? 0.7 : 0.45;
    const o = i * 6;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.pos[o + 3] = x + 0.08; this.pos[o + 4] = y - len; this.pos[o + 5] = z + 0.03;
  }
  update(dt: number, cx: number, cz: number) {
    const v = (this.heavy ? 22 : 16) * dt;
    for (let i = 0; i < this.n; i++) {
      const o = i * 6;
      this.pos[o + 1] -= v; this.pos[o + 4] -= v;
      this.pos[o] += v * 0.08; this.pos[o + 3] += v * 0.08;
      if (this.pos[o + 4] < 0 || Math.abs(this.pos[o] - cx) > 20 || Math.abs(this.pos[o + 2] - cz) > 20) this.reset(i, cx, cz, false);
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
