'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { CINEMATIC, MOUNTAIN, RANGE, mountainPosition } from '@/lib/animation/config';
import { live } from '@/lib/animation/theme';
import { FRONT, ROUTE_END } from '@/lib/animation/timeline';
import { GROUND_GLSL, createGroundMaterial, groundUniforms, injectWorldPosition } from './groundShader';

/** Terrain queries used by the character route and the camera. */
export interface Terrain {
  /** world-space ground height under (x, z) */
  heightAt: (x: number, z: number) => number;
}

interface MountainProps {
  lite?: boolean;
  receiveShadow?: boolean;
  onReady?: (terrain: Terrain) => void;
}

/**
 * The mountain GLB with its own textured material (colour, normal, roughness/occlusion).
 * The GLB carries an "edge" vertex colour (1 at the border of the scan, 0 inside); it is
 * used here to fade the border into the ground plane instead of tinting the mountain.
 * Self-contained: swap the URLs in config.ts to use a different environment.
 */
export function Mountain({ lite = false, receiveShadow = true, onReady }: MountainProps) {
  const gltf = useGLTF(lite ? MOUNTAIN.urlLite : MOUNTAIN.url, false, true);

  const glowUniform = useRef<{ value: number } | null>(null);
  const mesh = useMemo(() => {
    let found: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => {
      if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
    });
    return found as THREE.Mesh | null;
  }, [gltf]);

  const material = useMemo(() => {
    const source = mesh?.material as THREE.MeshStandardMaterial | undefined;
    const mat = source ? source.clone() : new THREE.MeshStandardMaterial();
    for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap]) if (t) t.anisotropy = 8;
    mat.metalness = 0;
    mat.vertexColors = !!mesh?.geometry.getAttribute('color');
    const uniforms = {
      uGrade: { value: MOUNTAIN.grade },
      uLow: { value: new THREE.Color(MOUNTAIN.gradeLow) },
      uHigh: { value: new THREE.Color(MOUNTAIN.gradeHigh) },
      uEdge: { value: MOUNTAIN.edgeFade },
      // alpenglow (live theme colours; strength is copied every frame)
      uWarm: { value: live.glow.warm },
      uCool: { value: live.glow.cool },
      uGlow: { value: live.glow.strength },
      uGlowH: { value: new THREE.Vector2(...CINEMATIC.glowHeight) },
      ...groundUniforms(),
    };
    glowUniform.current = uniforms.uGlow;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      injectWorldPosition(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uGrade; uniform vec3 uLow; uniform vec3 uHigh; uniform float uEdge;
           uniform vec3 uWarm; uniform vec3 uCool; uniform float uGlow; uniform vec2 uGlowH;
           ${GROUND_GLSL}`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           {
             float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
             vec3 graded = mix(uLow, uHigh, smoothstep(0.12, 0.85, lum));
             diffuseColor.rgb = mix(diffuseColor.rgb, graded, uGrade);
             // alpenglow: warm light on the upper mountain, cool shade toward its foot
             float hgt = smoothstep(uGlowH.x, uGlowH.y, vGroundPos.y);
             vec3 tint = mix(uCool, uWarm, hgt * hgt * (3.0 - 2.0 * hgt));
             diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * tint * 1.45, vec3(1.0)), uGlow);
           }`,
        )
        .replace(
          '#include <color_fragment>',
          `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
             diffuseColor.rgb = mix(diffuseColor.rgb, groundAlbedo(vGroundPos.xz), clamp(vColor.r * uEdge, 0.0, 1.0));
           #endif`,
        );
    };
    mat.customProgramCacheKey = () => 'chooli-mountain';
    return mat;
  }, [mesh]);

  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    if (glowUniform.current) glowUniform.current.value = live.glow.strength;
  });

  // BVH for fast ground queries (route heights, camera clearance)
  useEffect(() => {
    if (!mesh) return;
    const geometry = mesh.geometry as unknown as { boundsTree?: unknown };
    if (!geometry.boundsTree) geometry.boundsTree = new MeshBVH(mesh.geometry);
    mesh.raycast = acceleratedRaycast;
    mesh.updateWorldMatrix(true, false);

    const raycaster = new THREE.Raycaster();
    (raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const origin = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    const hits: THREE.Intersection[] = [];
    const terrain: Terrain = {
      heightAt(x, z) {
        origin.set(x, 400, z);
        raycaster.set(origin, down);
        hits.length = 0;
        mesh.raycast(raycaster, hits);
        if (!hits.length) return MOUNTAIN.groundY;
        let y = -Infinity;
        for (const h of hits) y = Math.max(y, h.point.y);
        return Math.max(y, MOUNTAIN.groundY);
      },
    };
    onReady?.(terrain);
    return () => {
      geometry.boundsTree = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh]);

  useEffect(() => {
    if (!mesh) return;
    mesh.material = material;
    mesh.receiveShadow = receiveShadow;
    mesh.castShadow = false;
  }, [mesh, material, receiveShadow]);

  // copies around the scene (same geometry + material, no shadows, never ray-cast)
  const range = useMemo(() => {
    if (!mesh) return [];
    const heading = Math.atan2(FRONT[0], FRONT[1]); // route direction; the main mountain is behind it
    return RANGE.map((r, i) => {
      const a = heading + Math.PI - (r.angle * Math.PI) / 180;
      const dir: [number, number] = [Math.sin(a), Math.cos(a)];
      const scene = gltf.scene.clone(true);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = material;
        m.castShadow = false;
        m.receiveShadow = false;
      });
      return {
        key: i,
        scene,
        position: [ROUTE_END[0] + dir[0] * r.distance, 0, ROUTE_END[1] + dir[1] * r.distance] as [number, number, number],
        // local +z (the mountain's good southern face) turned to look back at the route
        rotation: a + Math.PI + ((r.spin ?? 0) * Math.PI) / 180,
        scale: [r.mirror ? -r.scale : r.scale, r.scale, r.scale] as [number, number, number],
      };
    });
  }, [gltf, mesh, material]);

  if (!mesh) return null;
  return (
    <>
      <group position={mountainPosition} rotation-y={MOUNTAIN.rotationY}>
        <group scale={MOUNTAIN.scale}>
          <primitive object={gltf.scene} />
        </group>
      </group>
      {range.map((r) => (
        <group key={r.key} position={r.position} rotation-y={r.rotation} scale={r.scale}>
          <group position={mountainPosition}>
            <group scale={MOUNTAIN.scale}>
              <primitive object={r.scene} />
            </group>
          </group>
        </group>
      ))}
    </>
  );
}

/** Flat ground with a procedural snow-and-rock texture; the character walks on it. */
export function Ground() {
  const material = useMemo(() => createGroundMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={MOUNTAIN.groundY} receiveShadow material={material}>
      <circleGeometry args={[560, 64]} />
    </mesh>
  );
}
