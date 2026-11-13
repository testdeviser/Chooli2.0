import * as THREE from 'three';
import { GROUND } from '@/lib/animation/config';
import { live } from '@/lib/animation/theme';

/**
 * Procedural snow-and-rock ground, computed from world position in the shader (no image
 * files). Shared by the ground plane and by the mountain, whose border fades into it.
 */
export const groundUniforms = () => ({
  // live theme colours (updated in place when the theme changes)
  uSnow: { value: live.ground.snow },
  uRock: { value: live.ground.rock },
  uRockDark: { value: live.ground.rockDark },
  uSnowCover: { value: GROUND.snowCover },
  uBump: { value: GROUND.bump },
});

export const GROUND_GLSL = /* glsl */ `
  uniform vec3 uSnow; uniform vec3 uRock; uniform vec3 uRockDark;
  uniform float uSnowCover; uniform float uBump;
  varying vec3 vGroundPos;

  float gHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float gNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
  }
  float gFbm(vec2 p) {
    float s = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) { s += a * gNoise(p); p = r * p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
  /** surface relief (metres-ish), used for both colour and bump */
  float gHeight(vec2 p) {
    return gFbm(p * 0.09) * 0.8 + gNoise(p * 1.3) * 0.12 + gNoise(p * 5.0) * 0.03;
  }
  /** snow amount 0..1 */
  float gSnow(vec2 p) {
    float big = gFbm(p * 0.011 + 3.7);
    float mid = gFbm(p * 0.06 + 9.2);
    // snow collects in the hollows of the relief
    float hollow = 1.0 - gFbm(p * 0.09);
    float s = big * 0.65 + mid * 0.2 + hollow * 0.3;
    return smoothstep(1.02 - uSnowCover, 1.12 - uSnowCover, s);
  }
  vec3 groundAlbedo(vec2 p) {
    float fine = gNoise(p * 2.2);
    float grain = gNoise(p * 9.0);
    float mid = gFbm(p * 0.07 + 4.1);
    vec3 rock = mix(uRockDark, uRock, smoothstep(0.25, 0.75, mid + (fine - 0.5) * 0.35));
    rock *= 0.82 + 0.3 * grain;
    vec3 snow = uSnow * (0.93 + 0.1 * fine);
    return mix(rock, snow, gSnow(p));
  }
`;

/** Adds `vGroundPos` (world position) to a material's vertex shader. */
export function injectWorldPosition(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGroundPos;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       vGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
       #ifdef USE_INSTANCING
         vGroundPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
       #endif`,
    );
}

/** The ground plane's material: procedural albedo + bump from the same relief. */
export function createGroundMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const uniforms = groundUniforms();
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    injectWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GROUND_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         diffuseColor.rgb = groundAlbedo(vGroundPos.xz);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(0.95, 0.72, gSnow(vGroundPos.xz));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         {
           vec2 p = vGroundPos.xz;
           float e = 0.08;
           float h0 = gHeight(p);
           float hx = gHeight(p + vec2(e, 0.0));
           float hz = gHeight(p + vec2(0.0, e));
           // fade the relief with distance so the far plain does not shimmer
           float far = smoothstep(60.0, 160.0, length(vGroundPos.xz - cameraPosition.xz));
           vec3 nWorld = normalize(vec3(-(hx - h0) / e * uBump, 1.0, -(hz - h0) / e * uBump));
           nWorld = normalize(mix(nWorld, vec3(0.0, 1.0, 0.0), far));
           normal = normalize((viewMatrix * vec4(nWorld, 0.0)).xyz);
         }`,
      );
  };
  mat.customProgramCacheKey = () => 'chooli-ground';
  return mat;
}
