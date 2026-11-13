'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BRAND_WORD, INTRO } from '@/lib/animation/config';
import { clamp, smoothstep } from '@/lib/animation/math';
import { introClock } from '@/lib/animation/introClock';
import { progress } from '@/lib/animation/progress';
import { live } from '@/lib/animation/theme';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Large "CHOOLI" standing far behind the main peak, so the mountain covers its lower part.
 * The letters are drawn once as a white mask; the colour gradient and transparency come from
 * the current theme in the shader (morning: deep sky blue dissolving into the haze; night:
 * warm white into Chooli orange), so a theme switch cross-fades them. On load the word rises
 * from behind the mountain; it fades out as the character starts walking.
 */
export function BrandWord({ fixedProgress }: { fixedProgress?: number }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uSweep: { value: -1 },
      uTopV: { value: 0.7 },
      uBaseV: { value: 0.3 },
      uTop: { value: live.word.top },
      uMid: { value: live.word.mid },
      uBase: { value: live.word.base },
      uSweepColor: { value: live.word.sweep },
      uAlpha: { value: new THREE.Vector2(live.word.alphaBase, live.word.alphaTop) },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let made: THREE.CanvasTexture | null = null;
    (async () => {
      const family = getComputedStyle(document.documentElement).getPropertyValue('--font-montserrat').trim() || 'sans-serif';
      const px = 520;
      const font = `800 ${px}px ${family}`;
      try {
        await document.fonts.load(font, BRAND_WORD.text);
      } catch {
        /* fall back to whatever is available */
      }
      if (cancelled) return;

      const canvas = document.createElement('canvas');
      const W = 4096;
      const H = 1024;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.font = font;
      ctx.textBaseline = 'alphabetic';
      const letters = BRAND_WORD.text.split('');
      const spacing = px * BRAND_WORD.letterSpacing;
      const widths = letters.map((l) => ctx.measureText(l).width);
      const total = widths.reduce((a, b) => a + b, 0) + spacing * (letters.length - 1);
      const scale = Math.min(1, (W * 0.94) / total);
      ctx.setTransform(scale, 0, 0, scale, (W - total * scale) / 2, (H / 2) * (1 - scale));
      const baseline = H / 2 + px * 0.36;
      const top = baseline - px * 0.74;

      // white mask; colour + transparency are applied per theme in the shader
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255,255,255,0.45)';
      ctx.shadowBlur = 36; // a soft halo so the edges sit in the haze rather than cut out
      // where the letters' top and base land in texture space (v = 1 at the canvas top)
      const yOf = (y: number) => scale * y + (H / 2) * (1 - scale);
      uniforms.uTopV.value = 1 - yOf(top) / H;
      uniforms.uBaseV.value = 1 - yOf(baseline) / H;
      let x = 0;
      letters.forEach((l, i) => {
        ctx.fillText(l, x, baseline);
        x += widths[i] + spacing;
      });

      made = new THREE.CanvasTexture(canvas);
      made.colorSpace = THREE.SRGBColorSpace;
      made.anisotropy = 8;
      setTexture(made);
    })();
    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, []);

  const material = useMemo(
    () =>
      texture
        ? (() => {
            const m = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: 0 });
            m.onBeforeCompile = (shader) => {
              Object.assign(shader.uniforms, uniforms);
              shader.fragmentShader = shader.fragmentShader
                .replace(
                  '#include <common>',
                  `#include <common>
                   uniform float uSweep; uniform float uTopV; uniform float uBaseV;
                   uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBase; uniform vec3 uSweepColor; uniform vec2 uAlpha;`,
                )
                .replace(
                  '#include <map_fragment>',
                  `#include <map_fragment>
                   {
                     // 0 at the base of the letters, 1 at their top
                     float t = clamp((vMapUv.y - uBaseV) / (uTopV - uBaseV), 0.0, 1.0);
                     vec3 c = mix(uBase, uMid, smoothstep(0.0, 0.55, t));
                     c = mix(c, uTop, smoothstep(0.5, 1.0, t));
                     diffuseColor.rgb = c;
                     diffuseColor.a *= mix(uAlpha.x, uAlpha.y, smoothstep(0.0, 0.85, t));
                     // a slow band of light sweeping across the letters
                     float x = vMapUv.x + (vMapUv.y - 0.5) * 0.35;
                     float band = smoothstep(0.09, 0.0, abs(x - uSweep));
                     diffuseColor.rgb = mix(diffuseColor.rgb, uSweepColor, band * 0.75);
                     diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + band * 1.2));
                   }`,
                );
            };
            return m;
          })()
        : null,
    [texture],
  );
  useEffect(() => () => material?.dispose(), [material]);

  useFrame((state) => {
    if (!mesh.current || !material) return;
    // sweep position: crosses the word, then pauses off to the side
    const cycle = (state.clock.elapsedTime % BRAND_WORD.sweepEvery) / BRAND_WORD.sweepEvery;
    uniforms.uSweep.value = -0.3 + smoothstep(0, 0.45, cycle) * 1.6;
    uniforms.uAlpha.value.set(live.word.alphaBase, live.word.alphaTop);
    const p = fixedProgress ?? progress.value;
    // rise from behind the mountain on load
    const t = fixedProgress !== undefined ? Infinity : introClock.elapsed();
    const rise = t < 0 ? 0 : easeOutCubic(clamp((t - INTRO.wordAt) / INTRO.wordDuration));
    mesh.current.position.set(
      BRAND_WORD.position[0],
      BRAND_WORD.position[1] - (1 - rise) * BRAND_WORD.riseFrom,
      BRAND_WORD.position[2],
    );
    const scrollFade = 1 - smoothstep(BRAND_WORD.fade[0], BRAND_WORD.fade[1], p);
    const o = scrollFade * smoothstep(0, 0.6, rise);
    material.opacity = o;
    mesh.current.visible = o > 0.001;
  });

  if (!material) return null;
  const [w, h] = BRAND_WORD.size;
  return (
    <mesh ref={mesh} material={material} position={BRAND_WORD.position} renderOrder={1}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}
