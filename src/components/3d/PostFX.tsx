'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CINEMATIC } from '@/lib/animation/config';

/** contrast / saturation lift and a soft vignette, applied after tone mapping */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: CINEMATIC.contrast },
    uSaturation: { value: CINEMATIC.saturation },
    uVignette: { value: CINEMATIC.vignette },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uContrast; uniform float uSaturation; uniform float uVignette; uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;
      vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(0.35, 1.05, length(d) * 1.15);
      col *= 1.0 - v * uVignette;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

/**
 * Renders the scene through a short effect chain: scene -> soft bloom on the brightest
 * highlights -> tone mapping + colour space -> grade (contrast, saturation, vignette).
 * Takes over rendering from react-three-fiber (render priority 1).
 */
export function PostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const { composer, grade } = useMemo(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const B = CINEMATIC.bloom;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), B.strength, B.radius, B.threshold));
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    return { composer, grade };
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
    grade.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  }, [composer, grade, size, dpr]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
}
