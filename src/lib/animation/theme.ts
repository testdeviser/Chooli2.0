import * as THREE from 'three';
import { DEFAULT_THEME, THEMES, THEME_TRANSITION, type ThemeName, type ThemePalette } from './config';

/**
 * Scene theme (morning / night).
 *
 * `live` holds the current, cross-faded values as THREE objects. Shader uniforms point at
 * these objects directly, so stepping the blend updates every material without extra work.
 * The DOM follows through `data-theme` on <html> and `subscribe`.
 */

type Live = {
  sky: { zenith: THREE.Color; mid: THREE.Color; horizon: THREE.Color; glow: THREE.Color };
  fogColor: THREE.Color;
  fogDensity: number;
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  fillColor: THREE.Color;
  fillIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  clouds: { lit: THREE.Color; shade: THREE.Color; rim: THREE.Color; cover: number };
  ground: { snow: THREE.Color; rock: THREE.Color; rockDark: THREE.Color };
  word: { top: THREE.Color; mid: THREE.Color; base: THREE.Color; alphaTop: number; alphaBase: number; sweep: THREE.Color };
  glow: { warm: THREE.Color; cool: THREE.Color; strength: number };
  mist: { color: THREE.Color; opacity: number };
};

function build(p: ThemePalette): Live {
  const c = (s: string) => new THREE.Color(s);
  return {
    sky: { zenith: c(p.sky.zenith), mid: c(p.sky.mid), horizon: c(p.sky.horizon), glow: c(p.sky.glow) },
    fogColor: c(p.fogColor),
    fogDensity: p.fogDensity,
    sunDirection: new THREE.Vector3(...p.sunDirection),
    sunColor: c(p.sunColor),
    sunIntensity: p.sunIntensity,
    rimColor: c(p.rimColor),
    rimIntensity: p.rimIntensity,
    fillColor: c(p.fillColor),
    fillIntensity: p.fillIntensity,
    hemiSky: c(p.hemiSky),
    hemiGround: c(p.hemiGround),
    hemiIntensity: p.hemiIntensity,
    clouds: { lit: c(p.clouds.lit), shade: c(p.clouds.shade), rim: c(p.clouds.rim), cover: p.clouds.cover },
    ground: { snow: c(p.ground.snow), rock: c(p.ground.rock), rockDark: c(p.ground.rockDark) },
    word: {
      top: c(p.word.top),
      mid: c(p.word.mid),
      base: c(p.word.base),
      alphaTop: p.word.alphaTop,
      alphaBase: p.word.alphaBase,
      sweep: c(p.word.sweep),
    },
    glow: { warm: c(p.glow.warm), cool: c(p.glow.cool), strength: p.glow.strength },
    mist: { color: c(p.mist.color), opacity: p.mist.opacity },
  };
}

/** blend `a` -> `b` into `out` (same shape), recursively */
function blend(out: Record<string, unknown>, a: Record<string, unknown>, b: Record<string, unknown>, t: number) {
  for (const k of Object.keys(out)) {
    const o = out[k];
    if (o instanceof THREE.Color) o.lerpColors(a[k] as THREE.Color, b[k] as THREE.Color, t);
    else if (o instanceof THREE.Vector3) o.lerpVectors(a[k] as THREE.Vector3, b[k] as THREE.Vector3, t);
    else if (typeof o === 'number') out[k] = (a[k] as number) + ((b[k] as number) - (a[k] as number)) * t;
    else blend(o as Record<string, unknown>, a[k] as Record<string, unknown>, b[k] as Record<string, unknown>, t);
  }
}

const STORAGE_KEY = 'chooli-scene-theme';
const morning = build(THEMES.morning);
const night = build(THEMES.night);

function initial(): ThemeName {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'morning' || saved === 'night') return saved;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_THEME;
}

let name: ThemeName = initial();
/** 0 = morning, 1 = night (eased while switching) */
let value = name === 'night' ? 1 : 0;
const listeners = new Set<() => void>();

export const live: Live = build(THEMES[name]);

const ease = (t: number) => t * t * (3 - 2 * t);

export const theme = {
  get name() {
    return name;
  },
  set(next: ThemeName) {
    if (next === name) return;
    name = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** advance the cross-fade; returns true while it is still moving */
  step(dt: number) {
    const target = name === 'night' ? 1 : 0;
    if (value === target) return false;
    const d = Math.min(dt, 0.1) / THEME_TRANSITION;
    value = target > value ? Math.min(target, value + d) : Math.max(target, value - d);
    blend(live as unknown as Record<string, unknown>, morning as unknown as Record<string, unknown>, night as unknown as Record<string, unknown>, ease(value));
    return value !== target;
  },
};

/** call once on the client so CSS can follow the theme before anything is clicked */
export function applyThemeToDocument() {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = name;
}
