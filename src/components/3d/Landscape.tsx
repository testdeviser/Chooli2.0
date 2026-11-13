'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CHARACTER, LANDSCAPE, MOUNTAIN, ROUTE } from '@/lib/animation/config';
import { smoothstep } from '@/lib/animation/math';
import { progress } from '@/lib/animation/progress';
import { FRONT, HEADING, SIDE, characterState } from '@/lib/animation/timeline';

/** small deterministic RNG so the landscape is identical on every visit */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ footprints */

/** a Bigfoot print, drawn once: soft blue-grey hollow in the snow */
function footprintTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.filter = 'blur(5px)';
  g.fillStyle = 'rgba(255,255,255,1)';
  // sole: wide forefoot, narrower heel
  g.beginPath();
  g.ellipse(64, 150, 38, 78, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(64, 108, 44, 46, 0, 0, Math.PI * 2);
  g.fill();
  // five toes
  [
    [26, 52, 11],
    [44, 38, 12],
    [64, 32, 13],
    [84, 38, 12],
    [101, 52, 11],
  ].forEach(([x, y, r]) => {
    g.beginPath();
    g.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
    g.fill();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Print {
  /** metres along the route at which the print appears (-Infinity = already there) */
  at: number;
  matrix: THREE.Matrix4;
}

/**
 * Footprints pressed into the snow, forming behind Gus as he walks, left and right in step
 * with his stride. Nothing is shown before he starts walking.
 */
export function Footprints({ fixedProgress }: { fixedProgress?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const F = LANDSCAPE.footprints;

  const prints = useMemo<Print[]>(() => {
    const list: Print[] = [];
    const step = CHARACTER.stride / 2;
    const routeLength = ROUTE.cycles * CHARACTER.stride;
    const rand = rng(7);
    const place = (along: number, i: number, at: number) => {
      const side = i % 2 === 0 ? -1 : 1;
      const wobble = (rand() - 0.5) * 0.05;
      const x = ROUTE.start[0] + FRONT[0] * along + SIDE[0] * (side * F.gauge + wobble);
      const z = ROUTE.start[1] + FRONT[1] * along + SIDE[1] * (side * F.gauge + wobble);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, MOUNTAIN.groundY + 0.015, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, HEADING + Math.PI + side * 0.08 + (rand() - 0.5) * 0.06, 'YXZ')),
        new THREE.Vector3(F.size[0], F.size[1], 1),
      );
      list.push({ at, matrix: m });
    };
    // prints only form as he walks (none before he starts)
    let i = 0;
    for (let d = step * 0.5; d < routeLength - 0.2; d += step) place(d, i++, d + F.formAfter);
    return list;
  }, [F]);

  const material = useMemo(() => {
    const tex = footprintTexture();
    return new THREE.MeshLambertMaterial({
      color: F.color,
      alphaMap: tex,
      transparent: true,
      opacity: F.opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }, [F]);
  useEffect(() => () => material.dispose(), [material]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), []);
  const last = useRef(-1);

  useFrame(() => {
    const inst = mesh.current;
    if (!inst) return;
    const p = fixedProgress ?? progress.value;
    const d = characterState(p).distance;
    if (Math.abs(d - last.current) < 1e-4) return;
    last.current = d;
    prints.forEach((pr, idx) => {
      // a print "presses in" over a short distance once Gus has lifted that foot
      const k = pr.at === -Infinity ? 1 : smoothstep(pr.at, pr.at + 0.35, d);
      pr.matrix.decompose(tmp.p, tmp.q, tmp.s);
      tmp.s.multiplyScalar(Math.max(k, 0.0001));
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      inst.setMatrixAt(idx, tmp.m);
    });
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, prints.length]} material={material} receiveShadow frustumCulled={false} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
}
