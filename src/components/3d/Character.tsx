'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { CHARACTER } from '@/lib/animation/config';

export interface CharacterHandle {
  /** the object to position / rotate in the world */
  group: THREE.Group | null;
  /**
   * Deterministic pose: `phase` = walk cycles completed (fraction = position in cycle),
   * `walkWeight` 0..1 blends standing -> walking, `idleTime` = seconds into the idle clip.
   */
  setPose: (phase: number, walkWeight: number, idleTime: number, gestureTime?: number, gestureWeight?: number) => void;
  /** length of the gesture clip in seconds (0 if the model has none) */
  gestureDuration: number;
  /** 0 = invisible, 1 = fully visible (fades the materials, drops the shadow when faint) */
  setOpacity: (opacity: number) => void;
}

export interface CharacterProps {
  url?: string;
  clips?: { idle: string; walk: string; gesture?: string };
  scale?: number;
  facingOffset?: number;
  castShadow?: boolean;
  materials?: Record<string, { color: string; roughness: number; metalness: number }>;
}

/**
 * Shifts a clip so it starts at t = 0 (Blender exports start at frame 1).
 * Every track gets its own copy of the key times first: glTF clips share one time array
 * across all of their channels, so shifting in place would shift that array once per track.
 * Clips are cloned so the cached GLTF result is never modified (safe across remounts).
 */
function normalizeClip(source: THREE.AnimationClip) {
  const clip = source.clone();
  clip.tracks.forEach((t) => {
    t.times = t.times.slice();
  });
  let t0 = Infinity;
  clip.tracks.forEach((t) => (t0 = Math.min(t0, t.times[0])));
  if (t0 > 0 && Number.isFinite(t0)) clip.tracks.forEach((t) => t.shift(-t0));
  clip.resetDuration();
  return clip;
}

/**
 * Rigged character with a standing clip and an in-place walk clip.
 * It never plays on its own clock: the parent calls `setPose` every frame.
 *
 * To replace the Mixamo stand-in with Gus, export a GLB that contains an idle clip and an
 * in-place walk clip, then update CHARACTER in config.ts (url, clip names, stride, scale).
 */
export const Character = forwardRef<CharacterHandle, CharacterProps>(function Character(
  {
    url = CHARACTER.url,
    clips = CHARACTER.clips,
    scale = CHARACTER.scale,
    facingOffset = CHARACTER.facingOffset,
    castShadow = true,
    materials = CHARACTER.materials,
  },
  ref,
) {
  const group = useRef<THREE.Group>(null);
  const fade = useRef(1);
  const gltf = useGLTF(url, false, true);

  const rig = useMemo(() => {
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const find = (name: string) => gltf.animations.find((c) => c.name === name);
    const idleClip = find(clips.idle);
    const walkClip = find(clips.walk);
    if (!walkClip) console.warn(`[Character] walk clip "${clips.walk}" not found in ${url}`);
    const gestureClip = clips.gesture ? find(clips.gesture) : undefined;
    const idle = idleClip ? mixer.clipAction(normalizeClip(idleClip)) : null;
    const walk = walkClip ? mixer.clipAction(normalizeClip(walkClip)) : null;
    const gesture = gestureClip ? mixer.clipAction(normalizeClip(gestureClip)) : null;
    return { mixer, idle, walk, gesture };
  }, [gltf, clips.idle, clips.walk, clips.gesture, url]);

  useEffect(() => {
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = castShadow;
      m.receiveShadow = false;
      m.frustumCulled = false; // skinned bounds are unreliable while animating
      const mat = m.material as THREE.MeshStandardMaterial;
      // the body is solid: some exports arrive in "blend" mode with depth writing off,
      // which lets the ground draw over the character
      mat.transparent = false;
      mat.depthWrite = true;
      mat.needsUpdate = true;
      const override = materials?.[mat.name];
      if (override) {
        mat.color.set(override.color);
        mat.roughness = override.roughness;
        mat.metalness = override.metalness;
      }
    });
  }, [gltf, castShadow, materials]);

  // actions are started here (not in useMemo) so React strict-mode remounts restart them
  useEffect(() => {
    [rig.idle, rig.walk, rig.gesture].forEach((a) => {
      if (!a) return;
      a.reset();
      a.play();
      a.paused = true; // time is always written by setPose
    });
    return () => {
      rig.mixer.stopAllAction();
    };
  }, [rig]);

  useImperativeHandle(
    ref,
    () => ({
      get group() {
        return group.current;
      },
      get gestureDuration() {
        return rig.gesture ? rig.gesture.getClip().duration : 0;
      },
      setPose(phase, walkWeight, idleTime, gestureTime = 0, gestureWeight = 0) {
        const { mixer, idle, walk, gesture } = rig;
        const g = gesture ? Math.min(1, Math.max(0, gestureWeight)) : 0;
        if (walk) {
          const d = walk.getClip().duration;
          const cycle = phase - Math.floor(phase);
          walk.time = cycle * d;
          walk.setEffectiveWeight((idle ? walkWeight : 1) * (1 - g));
        }
        if (idle) {
          const d = idle.getClip().duration;
          idle.time = d > 0 ? idleTime % d : 0;
          idle.setEffectiveWeight((walk ? 1 - walkWeight : 1) * (1 - g));
        }
        if (gesture) {
          gesture.time = Math.min(gestureTime, gesture.getClip().duration);
          gesture.setEffectiveWeight(g);
        }
        mixer.update(0);
      },
      setOpacity(o) {
        if (Math.abs(o - fade.current) < 1e-3) return;
        fade.current = o;
        if (group.current) group.current.visible = o > 0.005;
        gltf.scene.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = m.material as THREE.MeshStandardMaterial;
          const transparent = o < 0.999;
          if (mat.transparent !== transparent) {
            mat.transparent = transparent;
            mat.needsUpdate = true;
          }
          mat.opacity = o;
          m.castShadow = castShadow && o > 0.45;
        });
      },
    }),
    [rig, gltf, castShadow],
  );

  return (
    <group ref={group}>
      <group scale={scale} rotation-y={facingOffset}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
});

useGLTF.preload(CHARACTER.url, false, true);
