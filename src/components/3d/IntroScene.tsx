'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CAMERA, CHARACTER, ENVIRONMENT, TIMELINE } from '@/lib/animation/config';
import { clamp, smoothstep } from '@/lib/animation/math';
import { progress } from '@/lib/animation/progress';
import { HEADING, ROUTE_END, ROUTE_LENGTH, characterState, routePoint, shotState } from '@/lib/animation/timeline';
import { Fog, Sky, toWorld } from './Atmosphere';
import { BrandWord } from './BrandWord';
import { Footprints } from './Landscape';
import { Mist } from './Mist';
import { PostFX } from './PostFX';
import { live, theme } from '@/lib/animation/theme';
import { introClock } from '@/lib/animation/introClock';

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
import { Character, type CharacterHandle } from './Character';
import { Ground, Mountain, type Terrain } from './Mountain';

interface IntroSceneProps {
  /** lighter mountain, no shadows (phones / low-power devices) */
  lite?: boolean;
  reducedMotion?: boolean;
  /** render one fixed moment of the sequence instead of following scroll */
  fixedProgress?: number;
  onReady?: () => void;
}

const SAMPLE_STEP = 0.1; // metres between ground samples along the route

/**
 * The one continuous scene: mountain + character + camera, all driven from a single
 * scroll-progress value. Nothing in here keeps its own animation clock except the
 * optional idle breathing and the one-time opening pull-back of the camera.
 */
export function IntroScene({ lite = false, reducedMotion = false, fixedProgress, onReady }: IntroSceneProps) {
  const character = useRef<CharacterHandle>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const readySent = useRef(false);
  const mountedAt = useRef<number | null>(null);
  // mouse parallax: target from the pointer, smoothed every frame
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const gesture = useRef({ active: false, t: 0, w: 0 });
  useEffect(() => {
    if (reducedMotion || fixedProgress !== undefined) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const leave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [reducedMotion, fixedProgress]);

  // ground heights along the route, lightly smoothed so the body does not jitter
  const ground = useMemo(() => {
    if (!terrain) return null;
    const n = Math.ceil(ROUTE_LENGTH / SAMPLE_STEP) + 1;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [x, z] = routePoint(Math.min(i * SAMPLE_STEP, ROUTE_LENGTH));
      raw[i] = terrain.heightAt(x, z);
    }
    const out = new Float32Array(n);
    const w = 6; // +-0.6 m
    for (let i = 0; i < n; i++) {
      let s = 0;
      let c = 0;
      for (let k = -w; k <= w; k++) {
        const j = i + k;
        if (j >= 0 && j < n) {
          s += raw[j];
          c++;
        }
      }
      out[i] = s / c;
    }
    return out;
  }, [terrain]);

  // dev helper: `__chooliTerrain.heightAt(x, z)` in the console, for planning routes
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && terrain) {
      (window as unknown as { __chooliTerrain?: Terrain }).__chooliTerrain = terrain;
    }
  }, [terrain]);

  const heightAtDistance = useCallback(
    (d: number) => {
      if (!ground) return 0;
      const f = clamp(d / SAMPLE_STEP, 0, ground.length - 1);
      const i = Math.floor(f);
      const j = Math.min(i + 1, ground.length - 1);
      return ground[i] + (ground[j] - ground[i]) * (f - i);
    },
    [ground],
  );

  const v = useMemo(
    () => ({
      char: new THREE.Vector3(),
      end: new THREE.Vector3(),
      cam: new THREE.Vector3(),
      look: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
      sunDir: toWorld(live.sunDirection.toArray() as [number, number, number]).normalize(),
      rimDir: toWorld(ENVIRONMENT.rimDirection).normalize(),
      front: toWorld([0, 0, 1]),
    }),
    [],
  );

  // still frames (reduced motion) render on demand: ask for a frame when inputs change
  // still frames render on demand: a theme switch must request frames for its cross-fade
  useEffect(() => theme.subscribe(() => invalidate()), [invalidate]);

  useEffect(() => {
    invalidate();
  }, [ground, size, fixedProgress, invalidate]);

  useEffect(() => {
    camera.near = CAMERA.near;
    camera.far = CAMERA.far;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame((state, delta) => {
    // theme cross-fade (morning <-> night): step the blend, then copy it to the lights
    if (theme.step(delta)) invalidate();
    if (hemi.current) {
      hemi.current.color.copy(live.hemiSky);
      hemi.current.groundColor.copy(live.hemiGround);
      hemi.current.intensity = live.hemiIntensity;
    }
    if (sun.current) {
      sun.current.color.copy(live.sunColor);
      sun.current.intensity = live.sunIntensity;
    }
    if (rim.current) {
      rim.current.color.copy(live.rimColor);
      rim.current.intensity = live.rimIntensity;
    }
    if (fill.current) {
      fill.current.color.copy(live.fillColor);
      fill.current.intensity = live.fillIntensity;
    }
    toWorld(live.sunDirection.toArray() as [number, number, number], v.sunDir).normalize();

    const rig = character.current;
    if (!rig?.group || !ground || !terrain) return;
    if (mountedAt.current === null) mountedAt.current = state.clock.elapsedTime;

    const p = fixedProgress ?? progress.value;

    // character ------------------------------------------------------------
    const cs = characterState(p);
    const [cx, cz] = routePoint(cs.distance);
    v.char.set(cx, heightAtDistance(cs.distance), cz);
    rig.group.position.copy(v.char);
    rig.group.rotation.y = HEADING;
    rig.group.visible = true;
    const breathing = CHARACTER.idleBreathing && !reducedMotion && cs.walkWeight < 1;
    // arm stretch: once, in real time, when Gus arrives at the "It's me, Gus." screen
    const gs = gesture.current;
    const dur = rig.gestureDuration;
    const arrived = dur > 0 && !reducedMotion && fixedProgress === undefined && cs.walkWeight < 0.01 && p >= TIMELINE.walk[1] - 0.002 && p < CHARACTER.gesture.until;
    const dt = Math.min(delta, 0.1);
    if (arrived) {
      if (!gs.active) {
        gs.active = true;
        gs.t = 0;
      } else gs.t += dt;
      const G = CHARACTER.gesture;
      gs.w = gs.t >= dur ? 0 : smoothstep(0, G.blendIn, gs.t) * (1 - smoothstep(dur - G.blendOut, dur, gs.t));
    } else {
      gs.active = false;
      gs.w = Math.max(0, gs.w - dt / CHARACTER.gesture.leave);
    }
    rig.setPose(cs.phase, cs.walkWeight, breathing ? state.clock.elapsedTime : 0, Math.min(gs.t, dur), gs.w);
    // hidden in the opening shot, fades in out of the haze as the visitor starts scrolling
    rig.setOpacity(smoothstep(CHARACTER.fadeIn[0], CHARACTER.fadeIn[1], p));

    // camera ---------------------------------------------------------------
    const aspect = size.width / Math.max(1, size.height);
    const shot = shotState(p, aspect);
    v.end.set(ROUTE_END[0], heightAtDistance(ROUTE_LENGTH), ROUTE_END[1]);
    v.cam.copy(v.end).add(toWorld(shot.cam, v.tmp));
    v.look.copy(v.char).add(toWorld(shot.look, v.tmp));

    if (!reducedMotion && fixedProgress === undefined) {
      // opening pull-back: starts close to the mountain and eases out to the wide shot.
      // Scrolling a little finishes it early (scroll takes over smoothly).
      const e = introClock.elapsed();
      const auto = e < 0 ? 0 : easeInOutCubic(clamp(e / CAMERA.pullBack.duration));
      const byScroll = smoothstep(0, CAMERA.pullBack.scroll, p);
      const close = 1 - Math.max(auto, byScroll);
      if (close > 0.0001) {
        v.cam.add(toWorld(CAMERA.pullBack.from, v.tmp).multiplyScalar(close));
        v.look.add(toWorld(CAMERA.pullBack.lookFrom, v.tmp).multiplyScalar(close));
      }
    }

    // mouse parallax, proportional to the camera's distance from what it looks at
    const pt = pointer.current;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 2.5);
    pt.sx += (pt.x - pt.sx) * k;
    pt.sy += (pt.y - pt.sy) * k;
    if (Math.abs(pt.sx) + Math.abs(pt.sy) > 1e-4) {
      const dist = v.cam.distanceTo(v.look);
      v.cam.add(toWorld([pt.sx * CAMERA.parallax[0] * dist, pt.sy * CAMERA.parallax[1] * dist, 0], v.tmp));
    }

    const floor = terrain.heightAt(v.cam.x, v.cam.z) + CAMERA.minClearance;
    if (v.cam.y < floor) v.cam.y = floor;

    camera.position.copy(v.cam);
    camera.lookAt(v.look);
    if (Math.abs(camera.fov - shot.fov) > 0.001) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }

    // key light + its shadow frustum follow the character --------------------
    if (sun.current) {
      sun.current.position.copy(v.char).addScaledVector(v.sunDir, 60);
      sun.current.target.position.copy(v.char);
      sun.current.target.updateMatrixWorld();
    }

    if (!readySent.current) {
      readySent.current = true;
      onReady?.();
    }
  });

  const r = ENVIRONMENT.shadowRadius;
  return (
    <>
      <Sky animate={!reducedMotion} />
      <BrandWord fixedProgress={fixedProgress} />
      <Fog />
      <hemisphereLight ref={hemi} args={[live.hemiSky.getHex(), live.hemiGround.getHex(), live.hemiIntensity]} />
      <directionalLight
        ref={sun}
        color={live.sunColor.getHex()}
        intensity={live.sunIntensity}
        castShadow={!lite}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      >
        <orthographicCamera attach="shadow-camera" args={[-r, r, r, -r, 1, 140]} />
      </directionalLight>
      <directionalLight
        ref={rim}
        color={live.rimColor.getHex()}
        intensity={live.rimIntensity}
        position={[v.rimDir.x * 50, v.rimDir.y * 50, v.rimDir.z * 50]}
      />
      <directionalLight
        ref={fill}
        color={live.fillColor.getHex()}
        intensity={live.fillIntensity}
        position={[v.front.x * 30, 14, v.front.z * 30]}
      />

      <Mountain lite={lite} receiveShadow={!lite} onReady={setTerrain} />
      <Ground />
      <Footprints fixedProgress={fixedProgress} />
      <Mist animate={!reducedMotion} />
      {!lite && <PostFX />}
      <group visible={!!terrain}>
        <Character ref={character} castShadow={!lite} />
      </group>
    </>
  );
}
