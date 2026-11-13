'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CLOUDS, ENVIRONMENT } from '@/lib/animation/config';
import { FRONT, SIDE } from '@/lib/animation/timeline';
import { live } from '@/lib/animation/theme';

/** route-frame [side, up, front] -> world direction */
export const toWorld = (v: [number, number, number], out = new THREE.Vector3()) =>
  out.set(SIDE[0] * v[0] + FRONT[0] * v[2], v[1], SIDE[1] * v[0] + FRONT[1] * v[2]);

/**
 * Dusk sky with animated clouds: navy zenith, hazy horizon, an orange glow where the sun
 * sits, and two procedural cloud layers (soft billows + high wisps) that drift in real time.
 * The clouds are part of the sky dome, so every mountain sits in front of them and they
 * move with the camera.
 */
export function Sky({ animate = true }: { animate?: boolean }) {
  const material = useMemo(() => {
    const sun = toWorld([ENVIRONMENT.glowDirection[0], 0, ENVIRONMENT.glowDirection[1]]).normalize();
    const wind = toWorld([CLOUDS.wind[0], 0, CLOUDS.wind[1]]);
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        // these point at the live theme colours, so a theme change updates them in place
        uZenith: { value: live.sky.zenith },
        uMid: { value: live.sky.mid },
        uHorizon: { value: live.sky.horizon },
        uGlow: { value: live.sky.glow },
        uSun: { value: new THREE.Vector3(sun.x, 0.04, sun.z).normalize() },
        uTime: { value: 0 },
        uWind: { value: new THREE.Vector2(wind.x, wind.z) },
        uCover: { value: live.clouds.cover },
        uScale: { value: CLOUDS.size },
        uOpacity: { value: CLOUDS.opacity },
        uLit: { value: live.clouds.lit },
        uShade: { value: live.clouds.shade },
        uRim: { value: live.clouds.rim },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; // always at the far plane
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun;
        uniform float uTime; uniform vec2 uWind; uniform float uCover; uniform float uOpacity; uniform float uScale;
        uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uRim;
        varying vec3 vDir;

        float hash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float s = 0.0, a = 0.5;
          mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 6; i++) { s += a * noise(p); p = r * p * 2.02 + 11.3; a *= 0.5; }
          return s;
        }

        // puffy (billowed) noise: rounded cumulus lobes instead of streaks
        float billow(vec2 p) {
          float s = 0.0, a = 0.5;
          mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 5; i++) { s += a * (1.0 - abs(noise(p) * 2.0 - 1.0)); p = r * p * 2.03 + 7.7; a *= 0.5; }
          return s;
        }

        // cloud density on a gently curved layer: little stretching toward the horizon
        float cloudDensity(vec2 p, vec2 drift, float detailAmt) {
          vec2 w = vec2(fbm(p * 0.45 + drift * 0.35), fbm(p * 0.45 + vec2(3.1, 7.4) - drift * 0.25));
          float coverage = fbm(p * 0.32 + w * 0.7 + drift * 0.15);
          float lobes = billow(p * 1.25 + w * 1.1 + drift);
          float d = coverage * 0.8 + lobes * 0.42;
          if (detailAmt > 0.0) d -= (fbm(p * 4.2 + w * 2.0 + drift * 1.4) - 0.5) * 0.22 * detailAmt;
          return d;
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
          col = mix(col, uZenith, smoothstep(0.16, 0.7, h));
          vec2 sunDir2 = normalize(uSun.xz);
          float az = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
          float band = exp(-max(h, 0.0) * 7.5);
          col += uGlow * (pow(az, 3.0) * 0.55 + pow(az, 28.0) * 0.6) * band;

          if (d.y > 0.0) {
            vec2 p = d.xz / (d.y + 0.38) * uScale;
            vec2 drift = uWind * uTime;
            float raw = cloudDensity(p, drift, 1.0);
            float dens = smoothstep(uCover, uCover + 0.28, raw);
            // light: how much cloud lies between this point and the sun
            float toward = cloudDensity(p + sunDir2 * 0.16, drift, 0.0);
            float shadow = exp(-max(toward - uCover, 0.0) * 3.2);
            float thin = 1.0 - dens;
            vec3 cloud = mix(uShade, uLit, clamp(shadow * (0.55 + 0.45 * thin), 0.0, 1.0));
            // sunset light catching the thin edges, strongest on the sun side
            float sunSide = pow(az, 2.5);
            cloud += uRim * sunSide * (0.25 + 0.9 * thin * shadow);
            // far clouds dissolve into the horizon haze
            float haze = 1.0 - smoothstep(0.02, 0.3, d.y);
            cloud = mix(cloud, col, haze * 0.7);
            float vis = smoothstep(0.02, 0.12, d.y) * (1.0 - smoothstep(0.6, 0.98, d.y));
            col = mix(col, cloud, dens * 0.92 * vis * uOpacity);
          }

          col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.08, d.y));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    if (animate) material.uniforms.uTime.value += Math.min(delta, 0.1) * CLOUDS.speed;
    material.uniforms.uCover.value = live.clouds.cover;
  });

  return (
    <mesh material={material} scale={500} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[1, 64, 32]} />
    </mesh>
  );
}

export function Fog() {
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    const fog = scene.fog as THREE.FogExp2 | null;
    if (!fog) return;
    fog.color.copy(live.fogColor);
    fog.density = live.fogDensity;
  });
  return <fogExp2 attach="fog" args={[live.fogColor.getHex(), live.fogDensity]} />;
}
