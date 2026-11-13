'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { SHOTS } from '@/lib/animation/config';
import { IntroScene } from './IntroScene';

export interface ExperienceProps {
  lite?: boolean;
  reducedMotion?: boolean;
  fixedProgress?: number;
  /** stop rendering while the intro is off-screen */
  active?: boolean;
  onReady?: () => void;
}

/** The WebGL canvas. Loaded with next/dynamic (ssr: false) by the intro section. */
export default function Experience({ lite = false, reducedMotion = false, fixedProgress, active = true, onReady }: ExperienceProps) {
  const still = fixedProgress !== undefined;
  return (
    <Canvas
      shadows={!lite}
      // capped below the screen's full density: the post effects make every extra pixel costly,
      // and a steady frame rate matters more than the last bit of sharpness while scrolling
      dpr={lite ? [1, 1.25] : [1, 1.5]}
      frameloop={!active ? 'never' : still ? 'demand' : 'always'}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: SHOTS[0].fov, near: 0.1, far: 600, position: [0, 10, 80] }}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden
    >
      <color attach="background" args={['#041A35']} />
      <Suspense fallback={null}>
        <IntroScene lite={lite} reducedMotion={reducedMotion} fixedProgress={fixedProgress} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
