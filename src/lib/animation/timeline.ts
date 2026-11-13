import { CHARACTER, ROUTE, SHOTS, TIMELINE, type Shot } from './config';
import { clamp, easeInOut, lerp, remap, smoothstep, trapezoid } from './math';

/* ------------------------------------------------------------------ route */

const dirLen = Math.hypot(ROUTE.direction[0], ROUTE.direction[1]) || 1;
/** unit vector the character walks along (toward the opening camera), world XZ */
export const FRONT: [number, number] = [ROUTE.direction[0] / dirLen, ROUTE.direction[1] / dirLen];
/** screen-right when looking at the character from the front, world XZ */
export const SIDE: [number, number] = [FRONT[1], -FRONT[0]];

export const ROUTE_LENGTH = ROUTE.cycles * CHARACTER.stride;
export const ROUTE_END: [number, number] = [
  ROUTE.start[0] + FRONT[0] * ROUTE_LENGTH,
  ROUTE.start[1] + FRONT[1] * ROUTE_LENGTH,
];
/** Y rotation that makes a +Z-facing model face along the route */
export const HEADING = Math.atan2(FRONT[0], FRONT[1]);

export const routePoint = (distance: number): [number, number] => [
  ROUTE.start[0] + FRONT[0] * distance,
  ROUTE.start[1] + FRONT[1] * distance,
];

/* -------------------------------------------------------------- character */

export interface CharacterState {
  /** metres travelled along the route */
  distance: number;
  /** walk cycles completed; fractional part is the position inside the cycle */
  phase: number;
  /** 0 = standing pose, 1 = full walk */
  walkWeight: number;
}

/**
 * Pure function of scroll progress, so the same scroll position always gives the same
 * pose. The walk cycle advances with DISTANCE (not time): one cycle per stride length,
 * which is what keeps the feet from sliding, forwards or backwards.
 */
export function characterState(p: number): CharacterState {
  const t = remap(p, TIMELINE.walk[0], TIMELINE.walk[1]);
  const distance = ROUTE_LENGTH * trapezoid(t, ROUTE.easePortion);
  const b = ROUTE.blendDistance;
  const walkWeight = smoothstep(0, b, distance) * smoothstep(0, b, ROUTE_LENGTH - distance);
  return { distance, phase: distance / CHARACTER.stride, walkWeight };
}

/* ----------------------------------------------------------------- camera */

export interface ShotState {
  cam: [number, number, number];
  look: [number, number, number];
  fov: number;
}

/**
 * Adapts a composition to the viewport. Portrait screens get a longer lens distance so
 * the character is never cropped, and the side offset used to push the character to the
 * left on desktop is removed (the copy sits below the character on phones).
 */
export function resolveShot(shot: Shot, aspect: number): ShotState {
  const narrow = clamp(remap(1.45 - aspect, 0, 0.85)); // 0 = landscape, 1 = phone portrait
  const close = shot.cam[2] < 12; // medium shots only
  const pull = close ? lerp(1, 1.95, narrow) : lerp(1, 1.12, narrow);
  const sideKeep = 1 - narrow;
  return {
    cam: [shot.cam[0] * (close ? lerp(1, 0.75, narrow) : 1), shot.cam[1] + (close ? 0.12 * narrow : 0), shot.cam[2] * pull],
    look: [shot.look[0] * sideKeep, shot.look[1] - (close ? 1.0 * narrow : 0), shot.look[2] * sideKeep],
    fov: close ? shot.fov : lerp(shot.fov, shot.fov * 1.45, narrow),
  };
}

const mix3 = (a: number[], b: number[], t: number): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Smoothly interpolated camera composition for a scroll position. */
export function shotState(p: number, aspect: number, shots: Shot[] = SHOTS): ShotState {
  p = clamp(p);
  let i = 0;
  while (i < shots.length - 2 && p > shots[i + 1].at) i++;
  const a = resolveShot(shots[i], aspect);
  const b = resolveShot(shots[i + 1], aspect);
  const t = easeInOut(remap(p, shots[i].at, shots[i + 1].at));
  return { cam: mix3(a.cam, b.cam, t), look: mix3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t) };
}
