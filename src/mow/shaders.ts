// Ground and surroundings materials. Both are MeshLambertMaterial with a patched fragment so they keep
// three.js lighting, fog and shadows while the base color comes from the grass field textures.
import * as THREE from 'three';
import type { GrassField } from './field';
import type { Season } from '../core/types';

export const NOISE_GLSL = /* glsl */`
float mmHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// Scattered small ellipses (leaves, clippings): one candidate per grid cell, shown when its hash < density.
float mmScatter(vec2 p, float cell, float density, float slim, out float tint) {
  vec2 g = p / cell; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  tint = mmHash(id + 7.1);
  if (mmHash(id) > density) return 0.0;
  float a = mmHash(id + 3.3) * 6.2831;
  vec2 o = (vec2(mmHash(id + 1.7), mmHash(id + 9.2)) - 0.5) * 0.36;
  vec2 q = f - o;
  q = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  float e = length(q * vec2(1.0, slim));
  return 1.0 - smoothstep(0.25, 0.3, e);
}
float mmNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = mmHash(i), b = mmHash(i + vec2(1.0, 0.0)), c = mmHash(i + vec2(0.0, 1.0)), d = mmHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

/** Shared uniforms: the ground, blades and surroundings read the same values. */
export interface GrassUniforms {
  uTexA: { value: THREE.Texture };
  uTexB: { value: THREE.Texture };
  uTexC: { value: THREE.Texture };
  uOrigin: { value: THREE.Vector2 };
  uSize: { value: THREE.Vector2 };
  uTime: { value: number };
  uDeck: { value: number };
  uFlash: { value: number };
  uWet: { value: number };
  uDull: { value: number };
  uStripeGain: { value: number };
  uCutA: { value: THREE.Color };
  uCutB: { value: THREE.Color };
  uLongA: { value: THREE.Color };
  uLongB: { value: THREE.Color };
  uTip: { value: THREE.Color };
  uCellSize: { value: number };
  uGuide: { value: THREE.Vector4 };     // lane guides: axis direction (x, z), spacing, offset
  uGuideOn: { value: number };          // 0..1
  uCleanHi: { value: number };          // 0..1 highlight dirty hardscape (blower out, or missed-spot flash)
}

export function seasonPalette(season: Season, weather: string) {
  // fresh cut (light) and long grass (deep) colors, plus seed-head tip color
  let cutA = 0x7fbf4a, cutB = 0x93cc55, longA = 0x3f7f2a, longB = 0x4f8f30, tip = 0xb8c060;
  if (season === 'summer') { cutA = 0x80b843; cutB = 0x98c452; longA = 0x3f7a28; longB = 0x55862f; tip = 0xc8c068; }
  if (season === 'fall') { cutA = 0x86ad45; cutB = 0x9bb655; longA = 0x4a7428; longB = 0x5e7c30; tip = 0xc9b060; }
  if (weather === 'heat') { cutA = 0x93b24a; cutB = 0xa7b85a; longA = 0x587a2c; longB = 0x6f8235; tip = 0xd2bb6a; }
  return { cutA, cutB, longA, longB, tip };
}

export function makeGrassUniforms(field: GrassField, season: Season, weather: string): GrassUniforms {
  const p = seasonPalette(season, weather);
  return {
    uTexA: { value: field.texA },
    uTexB: { value: field.texB },
    uTexC: { value: field.texC },
    uOrigin: { value: new THREE.Vector2(field.x0, field.z0) },
    uSize: { value: new THREE.Vector2(field.nx * field.cs, field.nz * field.cs) },
    uTime: { value: 0 },
    uDeck: { value: 3 },
    uFlash: { value: 0 },
    uWet: { value: 0 },
    uDull: { value: 0 },
    uStripeGain: { value: 0.3 },
    uCutA: { value: new THREE.Color(p.cutA) },
    uCutB: { value: new THREE.Color(p.cutB) },
    uLongA: { value: new THREE.Color(p.longA) },
    uLongB: { value: new THREE.Color(p.longB) },
    uTip: { value: new THREE.Color(p.tip) },
    uCellSize: { value: field.cs },
    uGuide: { value: new THREE.Vector4(0, 1, 1, 0) },
    uGuideOn: { value: 0 },
    uCleanHi: { value: 0 },
  };
}

const UNIFORM_DECL = /* glsl */`
uniform sampler2D uTexA; uniform sampler2D uTexB; uniform sampler2D uTexC;
uniform vec2 uOrigin; uniform vec2 uSize; uniform float uTime; uniform float uDeck; uniform float uFlash;
uniform float uWet; uniform float uDull; uniform float uStripeGain; uniform float uCellSize;
uniform vec3 uCutA; uniform vec3 uCutB; uniform vec3 uLongA; uniform vec3 uLongB; uniform vec3 uTip;
uniform vec4 uGuide; uniform float uGuideOn; uniform float uCleanHi;
`;

/** Lane guides: faint chalk lines on grass that has not been cut yet, one deck width apart. */
export const GUIDE_GLSL = /* glsl */`
vec3 mmGuide(vec3 col, vec2 wp, float cut) {
  if (uGuideOn < 0.001 || cut > 0.5) return col;
  vec2 perp = vec2(uGuide.y, -uGuide.x);
  float u = dot(wp, perp) - uGuide.w;
  float d = abs(fract(u / uGuide.z + 0.5) - 0.5) * uGuide.z;
  float line = 1.0 - smoothstep(0.03, 0.075, d);
  return mix(col, vec3(0.96, 0.96, 0.78), line * 0.42 * uGuideOn);
}
`;

/** Lawn color from height, cut state and stripe lean. Shared by ground (and mirrored in the blade shader). */
export const LAWN_GLSL = /* glsl */`
vec3 mmLawn(vec2 wp, float h, vec2 lean, float cut, vec3 viewDir) {
  float n1 = mmNoise(wp * 0.35);
  float n2 = mmNoise(wp * 2.3);
  float n3 = mmNoise(wp * 11.0);
  float n4 = mmNoise(wp * 31.0);
  float tall = smoothstep(2.2, 7.5, h);
  vec3 cutCol = mix(uCutA, uCutB, n1 * 0.7 + n2 * 0.3);
  vec3 longCol = mix(uLongA, uLongB, n1);
  vec3 col = mix(cutCol, longCol, clamp(tall * 0.8 + (1.0 - cut) * 0.5, 0.0, 1.0));
  // uncut grass: shaggy, uneven, seed-head tips catching light
  float shag = (1.0 - cut) * (0.45 + 0.55 * smoothstep(2.5, 6.0, h));
  col *= mix(1.0, 0.78 + 0.34 * n3 * n4 + 0.1 * n2, shag);
  col = mix(col, uTip, shag * smoothstep(0.62, 0.95, n3) * 0.45);
  // freshly cut: fine even texture, dull blades leave pale torn tips
  col *= mix(1.0, 0.9 + 0.16 * n4 * (0.6 + 0.4 * n3), cut);
  col = mix(col, vec3(0.78, 0.74, 0.55), cut * uDull * 0.22 * n3);
  // stripes: grass bent away from the viewer reflects more light
  vec2 vd = normalize(viewDir.xz + 1e-5);
  float s = dot(lean, vd);
  col *= 1.0 + uStripeGain * s;
  col = mix(col, col * vec3(0.93, 1.0, 0.86), max(0.0, s) * uStripeGain * 0.8);
  return col;
}
`;

function groundFragment(): string {
  // Branches skip work for surfaces that are not present at this pixel (coherent across regions).
  return /* glsl */`
  vec2 wp = vMmWorld.xz;
  vec2 uv = (wp - uOrigin) / uSize;
  vec4 A = texture2D(uTexA, uv);
  vec4 B = texture2D(uTexB, uv);
  vec4 C = texture2D(uTexC, uv);
  float h = A.r * 12.75;
  vec3 col = vec3(0.0);
  float asphW = smoothstep(0.18, 0.3, B.a) * (1.0 - smoothstep(0.42, 0.55, B.a));
  float sandW = smoothstep(0.55, 0.62, B.a) * (1.0 - smoothstep(0.8, 0.9, B.a));
  float waterW = smoothstep(0.85, 0.95, B.a);
  float none = clamp(1.0 - B.r - B.g - B.b - sandW - waterW, 0.0, 1.0);
  float mn = 0.5;
  if (B.r > 0.001) {
    vec2 lean = (A.gb - 0.5) * 2.0;
    vec3 lawn = mmLawn(wp, h, lean, A.a, vMmWorld - cameraPosition);
    if (C.r > 0.004) {
      float cn = mmNoise(wp * 9.0) * 0.7 + mmNoise(wp * 23.0) * 0.3;
      float cr = sqrt(C.r);
      lawn = mix(lawn, vec3(0.26, 0.36, 0.13), smoothstep(1.0 - cr * 0.7, 1.02 - cr * 0.7, cn) * 0.9);
    }
    lawn = mmGuide(lawn, wp, A.a);
    // uDeck is the deck used for most of the lawn; C.a marks cells already cut at their own deck
    float missed = step(uDeck + 0.5, h) * (1.0 - step(0.5, C.a));
    lawn = mix(lawn, vec3(1.0, 0.55, 0.12), missed * uFlash * (0.55 + 0.45 * sin(uTime * 9.0)));
    col += lawn * B.r;
  }
  if (B.g > 0.001) {
    // concrete slabs with joints, or asphalt in parking lots
    float cn2 = mmNoise(wp * 3.0) * 0.5 + mmNoise(wp * 17.0) * 0.5;
    vec3 conc = vec3(0.80, 0.78, 0.74) * (0.93 + 0.1 * cn2);
    vec2 jt = abs(fract(wp / 1.6) - 0.5);
    conc *= 1.0 - (1.0 - smoothstep(0.0, 0.012, 0.5 - max(jt.x, jt.y))) * 0.25;
    if (asphW > 0.001) {
      vec3 asph = vec3(0.19, 0.2, 0.21) * (0.85 + 0.3 * mmNoise(wp * 23.0)) * (0.95 + 0.1 * mmNoise(wp * 1.3));
      conc = mix(conc, asph, asphW);
    }
    col += conc * B.g;
  }
  if (B.b > 0.001 || none > 0.001) {
    mn = mmNoise(wp * 13.0) * 0.6 + mmNoise(wp * 41.0) * 0.4;
    col += mix(vec3(0.33, 0.2, 0.12), vec3(0.47, 0.29, 0.16), mn) * B.b;
    col += vec3(0.3, 0.24, 0.15) * (0.85 + 0.3 * mn) * none;
  }
  if (sandW > 0.001) col += vec3(0.9, 0.82, 0.6) * (0.94 + 0.08 * mmNoise(wp * 6.0)) * sandW;
  if (waterW > 0.001) col += mix(vec3(0.18, 0.42, 0.5), vec3(0.3, 0.6, 0.66), mmNoise(wp * 0.8 + uTime * 0.1)) * waterW;

  if (C.g > 0.004) {
    // clippings: a green film plus thin slivers on concrete and in beds, dense enough to read from the chase camera
    float dg = sqrt(C.g), t1, t2;
    col = mix(col, vec3(0.44, 0.6, 0.16), clamp(dg * 1.5, 0.0, 0.62));
    float d1 = mmScatter(wp, 0.045, min(1.0, dg * 1.6), 3.2, t1);
    float d2 = mmScatter(wp + 0.021, 0.037, min(1.0, dg * 1.3), 3.6, t2);
    col = mix(col, mix(vec3(0.36, 0.55, 0.16), vec3(0.55, 0.7, 0.26), t1), d1 * 0.95);
    col = mix(col, mix(vec3(0.4, 0.58, 0.18), vec3(0.62, 0.66, 0.3), t2), d2 * 0.9);
  }
  if (C.b > 0.004) {
    // fallen leaves, two overlapping layers
    float lb = sqrt(C.b), t1, t2;
    float l1 = mmScatter(wp, 0.12, lb * 0.85, 1.7, t1);
    float l2 = mmScatter(wp + 0.057, 0.1, lb * 0.6, 1.9, t2);
    vec3 c1 = t1 < 0.33 ? vec3(0.85, 0.36, 0.1) : t1 < 0.66 ? vec3(0.92, 0.64, 0.17) : vec3(0.6, 0.3, 0.13);
    vec3 c2 = t2 < 0.4 ? vec3(0.78, 0.26, 0.1) : t2 < 0.75 ? vec3(0.95, 0.72, 0.25) : vec3(0.55, 0.34, 0.16);
    col = mix(col, c1 * (0.9 + 0.2 * t2), l1);
    col = mix(col, c2 * 0.95, l2);
  }
  if (uCleanHi > 0.001 && B.g > 0.001) {
    // dirty concrete glows while the blower is out, so it is obvious what is left to clean
    // same threshold the cleanup score uses (traces under 0.03 do not count)
    float dirt = smoothstep(0.02, 0.07, C.g + C.b) * B.g;
    col = mix(col, vec3(1.0, 0.56, 0.08), dirt * uCleanHi * (0.75 + 0.2 * sin(uTime * 6.0)));
  }
  col *= 1.0 - uWet * 0.14;
  vec4 diffuseColor = vec4(col, opacity);
  `;
}

export function createGroundMaterial(u: GrassUniforms): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMmWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMmWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMmWorld;\n' + UNIFORM_DECL + NOISE_GLSL + LAWN_GLSL + GUIDE_GLSL)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', groundFragment());
  };
  m.customProgramCacheKey = () => 'mm-ground';
  return m;
}

/** Neighbor lawns and the wider world: a tidy lawn with faint stripes, no per-cell data. */
export function createSurroundMaterial(u: GrassUniforms): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMmWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMmWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMmWorld;\n' + UNIFORM_DECL + NOISE_GLSL + LAWN_GLSL)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', /* glsl */`
        vec2 wp = vMmWorld.xz;
        float lot = floor(wp.x / 24.0) + floor(wp.y / 40.0) * 7.0;
        float lr = mmHash(vec2(lot, 3.0));
        float h = 2.6 + lr * 3.2;
        float band = sign(sin(wp.x * 3.14159 / (0.9 + lr)));
        vec2 lean = lr > 0.45 ? vec2(0.0, band * 0.45) : vec2(0.0);
        vec3 col = mmLawn(wp, h, lean, lr > 0.45 ? 1.0 : 0.35, vMmWorld - cameraPosition);
        col *= 0.96 - uWet * 0.12;
        vec4 diffuseColor = vec4(col, opacity);
      `);
  };
  m.customProgramCacheKey = () => 'mm-surround';
  return m;
}
