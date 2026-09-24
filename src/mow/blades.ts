// Instanced grass blades in a square window around the player. Blade positions wrap toroidally so every
// blade is fixed in world space while the window follows the mower; heights come from the field texture
// in the vertex shader, so a cut shows on the very next frame. One draw call.
import * as THREE from 'three';
import { NOISE_GLSL, LAWN_GLSL, type GrassUniforms } from './shaders';

export const BLADE_COUNTS = { low: 20000, medium: 60000, high: 120000 } as const;

export class Blades {
  mesh: THREE.Mesh;
  half: number;
  private uCenter = { value: new THREE.Vector2() };
  private uHalf: { value: number };
  private geo: THREE.InstancedBufferGeometry;
  private mat: THREE.MeshLambertMaterial;

  constructor(u: GrassUniforms, count: number, half: number, seed: number) {
    this.half = half;
    this.uHalf = { value: half };
    const base = new THREE.BufferGeometry();
    // x = side offset (-0.5..0.5 of blade width), y = t along the blade
    const verts = new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0,
      -0.42, 0.38, 0, 0.42, 0.38, 0,
      -0.26, 0.72, 0, 0.26, 0.72, 0,
      0, 1, 0,
    ]);
    base.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    base.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(21).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    base.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('normal', base.getAttribute('normal'));
    const offs = new Float32Array(count * 2);
    const rnd = new Float32Array(count * 4);
    let s = (seed >>> 0) || 1;
    const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    // jittered grid gives an even carpet without clumping
    const side = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
      const gx = i % side, gy = Math.floor(i / side);
      offs[i * 2] = ((gx + next()) / side) * half * 2;
      offs[i * 2 + 1] = ((gy + next()) / side) * half * 2;
      rnd[i * 4] = next();                  // rotation
      rnd[i * 4 + 1] = 0.7 + next() * 0.6; // width scale
      rnd[i * 4 + 2] = 0.65 + next() * 0.55; // height scale
      rnd[i * 4 + 3] = next();              // color / shag
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offs, 2));
    geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 4));
    geo.instanceCount = count;
    this.geo = geo;
    base.dispose();

    const density = count / (4 * half * half);
    // wider blades when sparse so the carpet stays closed
    const width = THREE.MathUtils.clamp(0.9 / Math.sqrt(density), 0.018, 0.09);

    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u, { uCenter: this.uCenter, uHalf: this.uHalf, uWidth: { value: width } });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', /* glsl */`#include <common>
          uniform sampler2D uTexA; uniform sampler2D uTexB; uniform sampler2D uTexC;
          uniform vec2 uOrigin; uniform vec2 uSize; uniform float uTime; uniform vec2 uCenter; uniform float uHalf; uniform float uWidth;
          uniform float uStripeGain; uniform float uDull;
          uniform vec3 uCutA; uniform vec3 uCutB; uniform vec3 uLongA; uniform vec3 uLongB; uniform vec3 uTip;
          attribute vec2 aOffset; attribute vec4 aRand;
          varying float vT; varying vec2 vLean; varying float vCut; varying float vH; varying vec3 vMmWorld; varying float vRand; varying vec2 vDebris; varying vec3 vLawn; varying float vLeaf;
          ${NOISE_GLSL}
          ${LAWN_GLSL}`)
        .replace('#include <beginnormal_vertex>', /* glsl */`
          vec2 rel = mod(aOffset - uCenter + uHalf, 2.0 * uHalf) - uHalf;
          vec2 bp = uCenter + rel;
          vec2 guv = (bp - uOrigin) / uSize;
          float inside = step(0.0, guv.x) * step(guv.x, 1.0) * step(0.0, guv.y) * step(guv.y, 1.0);
          vec4 A = texture2D(uTexA, guv);
          vec4 B = texture2D(uTexB, guv);
          vec4 C = texture2D(uTexC, guv);
          float hIn = A.r * 12.75;
          vec2 lean = (A.gb - 0.5) * 2.0;
          float cut = A.a;
          float dist = length(rel) / uHalf;
          float fade = 1.0 - smoothstep(0.62, 0.97, dist);
          float lawn = smoothstep(0.55, 0.9, B.r) * inside;
          // uncut grass is ragged: individual blade heights vary a lot more
          float ragged = mix(1.0, 0.55 + 0.9 * aRand.w, 1.0 - cut);
          // exaggerated and non-linear so a fresh cut reads clearly against long grass
          float height = pow(max(hIn, 0.0) / 3.0, 1.35) * 0.105 * aRand.z * ragged * fade * lawn;
          float ang = aRand.x * 6.2831853;
          vec2 wdir = vec2(cos(ang), sin(ang));
          float wind = sin(uTime * 1.6 + bp.x * 0.7 + bp.y * 0.45) * 0.5 + sin(uTime * 2.9 + bp.x * 2.1) * 0.25;
          vec2 shagLean = (vec2(mmHash(bp * 3.1), mmHash(bp * 5.7)) - 0.5) * 0.9 * (1.0 - cut);
          vec2 bend = lean * 0.75 + shagLean + vec2(0.7, 0.35) * wind * 0.18;
          float t = position.y;
          vT = t; vLean = lean; vCut = cut; vH = hIn; vRand = aRand.w; vDebris = C.rb;
          // per-blade lawn color (same function as the ground), evaluated once per vertex
          vLawn = mmLawn(bp, hIn, lean, cut, vec3(bp.x, 0.0, bp.y) - cameraPosition);
          // some instances become fallen leaves resting on top of the grass while leaves are down
          vLeaf = step(aRand.w, C.b * 0.5) * step(0.02, C.b);
          vec3 objectNormal = vLeaf > 0.5 ? vec3(0.0, 1.0, 0.0) : normalize(vec3(bend.x * 0.6, 1.0, bend.y * 0.6));
          #ifdef USE_TANGENT
          vec3 objectTangent = vec3(1.0, 0.0, 0.0);
          #endif
        `)
        .replace('#include <begin_vertex>', /* glsl */`
          vec3 transformed;
          float w = uWidth * aRand.y * (0.6 + 0.4 * smoothstep(0.0, 3.0, hIn));
          transformed.xz = bp + wdir * position.x * w + bend * height * t * t * 0.9;
          transformed.y = height * t * (1.0 - 0.3 * min(1.0, length(bend)) * t);
          if (vLeaf > 0.5) {
            float la = aRand.y * 9.0;
            vec2 ax = vec2(cos(la), sin(la)), ay = vec2(-ax.y, ax.x);
            float ls = (0.07 + 0.05 * aRand.z) * fade * lawn;
            transformed.xz = bp + ax * position.x * ls * 1.3 + ay * (position.y - 0.45) * ls * 1.6;
            transformed.y = height * 0.7 + 0.012 + position.x * 0.012;
          }
          vMmWorld = transformed;
        `);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */`#include <common>
          uniform float uStripeGain; uniform float uDull; uniform float uWet; uniform float uFlash; uniform float uDeck; uniform float uTime;
          uniform vec3 uCutA; uniform vec3 uCutB; uniform vec3 uLongA; uniform vec3 uLongB; uniform vec3 uTip;
          varying float vT; varying vec2 vLean; varying float vCut; varying float vH; varying vec3 vMmWorld; varying float vRand; varying vec2 vDebris; varying vec3 vLawn; varying float vLeaf;`)
        .replace('#include <normal_fragment_begin>', /* glsl */`
          // blades are double sided but always lit as if facing up (no dark back faces)
          float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
          vec3 normal = normalize(vNormal);
          vec3 nonPerturbedNormal = normal;
        `)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', /* glsl */`
          // same palette as the ground under it, so the blade window blends into the far lawn
          vec3 col = vLawn * mix(0.6, 1.16, smoothstep(0.0, 0.9, vT)) * (0.86 + 0.26 * vRand);
          col = mix(col, uTip, (1.0 - vCut) * smoothstep(0.75, 1.0, vT) * step(0.62, vRand) * 0.5);
          col = mix(col, vec3(0.8, 0.75, 0.55), vCut * uDull * smoothstep(0.8, 1.0, vT) * 0.3);
          // clumps and leaves caught in the grass tint the blades
          col = mix(col, vec3(0.3, 0.38, 0.14), vDebris.x * 0.5);
          col = mix(col, vec3(0.82, 0.45, 0.14), vDebris.y * 0.55 * step(0.35, vRand) * smoothstep(0.3, 0.9, vT));
          if (vLeaf > 0.5) {
            float lc = fract(vRand * 37.0);
            col = lc < 0.33 ? vec3(0.86, 0.36, 0.1) : lc < 0.66 ? vec3(0.92, 0.64, 0.18) : vec3(0.62, 0.3, 0.13);
            col *= 0.85 + 0.3 * fract(vRand * 91.0);
          }
          float missed = step(uDeck + 0.5, vH) * (1.0 - vLeaf);
          col = mix(col, vec3(1.0, 0.55, 0.12), missed * uFlash * (0.55 + 0.45 * sin(uTime * 9.0)));
          col *= 1.0 - uWet * 0.12;
          vec4 diffuseColor = vec4(col, opacity);
        `);
    };
    mat.customProgramCacheKey = () => 'mm-blades';
    this.mat = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
  }

  setCenter(x: number, z: number) { this.uCenter.value.set(x, z); }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
