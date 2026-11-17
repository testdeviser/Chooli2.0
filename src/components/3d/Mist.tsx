'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CINEMATIC, MOUNTAIN } from '@/lib/animation/config';
import { live } from '@/lib/animation/theme';
import { progress } from '@/lib/animation/progress';
import { smoothstep } from '@/lib/animation/math';

export interface MistProps {
  animate?: boolean;
  /** curtains, far to near: [z, height, speed] (world metres) */
  layers?: [number, number, number][];
  /** curtain width (metres) */
  width?: number;
  /** centre of the curtains along x (metres) */
  x?: number;
  /** multiplies the theme's mist opacity */
  density?: number;
  /**
   * optional thinning with scroll: density eases to `to` x density between progress `from[0]`
   * and `from[1]` (e.g. the bank around Gus opening up once he has walked out of it)
   */
  thin?: { from: [number, number]; to: number };
  /** frequency of the billows along the curtain (repeats across its width) */
  billows?: number;
  /** 0 = patchy wisps (default), 1 = full, closed cloud with few gaps */
  cover?: number;
  renderOrder?: number;
}

/**
 * Low mist rolling along the foot of the mountains: a few soft curtains standing just in
 * front of the mountains' southern foot (z = 0), drifting sideways. Dense near the ground,
 * fading upward and toward their ends. Colour and strength follow the theme.
 */
export function Mist({
  animate = true,
  layers = CINEMATIC.mist.layers,
  width = CINEMATIC.mist.width,
  x = 0,
  density = 1,
  thin,
  billows = 26,
  cover = 0,
  renderOrder = 3,
}: MistProps) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: true,
        side: THREE.DoubleSide,
        uniforms: {
          ...THREE.UniformsLib.fog,
          uTime: { value: 0 },
          uColor: { value: live.mist.color },
          uOpacity: { value: live.mist.opacity },
          uBillows: { value: billows },
          uCover: { value: cover },
        },
        vertexShader: /* glsl */ `
          #include <common>
          #include <fog_pars_vertex>
          attribute vec3 layer; // x: seed, y: height, z: speed
          varying vec2 vUv;
          varying vec3 vLayer;
          void main() {
            vUv = uv;
            vLayer = layer;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: /* glsl */ `
          #include <common>
          #include <fog_pars_fragment>
          uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uBillows; uniform float uCover;
          varying vec2 vUv;
          varying vec3 vLayer;
          float h2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float n2(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
          }
          float fbm(vec2 p) {
            float s = 0.0, a = 0.5;
            for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.05 + 13.7; a *= 0.5; }
            return s;
          }
          void main() {
            // uv.x along the curtain (0..1), uv.y up (0 at the ground, 1 at the top)
            vec2 p = vec2(vUv.x * uBillows + uTime * 0.05 * vLayer.z + vLayer.x * 7.0, vUv.y * 2.4 - uTime * 0.02);
            float billow = fbm(p + vec2(fbm(p * 0.6 + uTime * 0.01), 0.0));
            float vertical = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.25, 1.0, vUv.y));
            float ends = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
            float a = min(1.0, smoothstep(0.32 - 0.22 * uCover, 0.85 - 0.3 * uCover, billow) * vertical * ends * uOpacity);
            gl_FragColor = vec4(uColor, a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      }),
    [billows, cover],
  );

  // one merged geometry: a vertical plane per curtain, facing the camera side (+z)
  const geometry = useMemo(() => {
    const pos: number[] = [];
    const uv: number[] = [];
    const lay: number[] = [];
    const idx: number[] = [];
    const W = width;
    layers.forEach(([z, h, speed], i) => {
      const base = pos.length / 3;
      const y0 = MOUNTAIN.groundY - 0.3;
      pos.push(x - W / 2, y0, z, x + W / 2, y0, z, x + W / 2, y0 + h, z, x - W / 2, y0 + h, z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let k = 0; k < 4; k++) lay.push(i * 1.37, h, speed);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('layer', new THREE.Float32BufferAttribute(lay, 3));
    g.setIndex(idx);
    return g;
  }, [layers, width, x]);

  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  useFrame((_, delta) => {
    if (animate) material.uniforms.uTime.value += Math.min(delta, 0.1);
    const k = thin ? 1 + (thin.to - 1) * smoothstep(thin.from[0], thin.from[1], progress.value) : 1;
    material.uniforms.uOpacity.value = live.mist.opacity * density * k;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={renderOrder} />;
}
