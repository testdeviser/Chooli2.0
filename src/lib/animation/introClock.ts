/**
 * Clock for the one-time opening sequence (mountain -> CHOOLI rises -> header -> copy).
 * Starts when the 3D scene is first on screen. Not React state: the 3D scene reads it
 * every frame, the DOM reads it through `onStart`.
 */
let startedAt: number | null = null;
let skipped = false;
const listeners = new Set<() => void>();

export const introClock = {
  /** seconds since the sequence started (Infinity when skipped, -1 before start) */
  elapsed() {
    if (skipped) return Infinity;
    return startedAt === null ? -1 : (performance.now() - startedAt) / 1000;
  },
  start() {
    if (startedAt !== null) return;
    startedAt = performance.now();
    listeners.forEach((l) => l());
  },
  /** reduced motion / no WebGL: show the end state at once */
  skip() {
    skipped = true;
    listeners.forEach((l) => l());
  },
  get started() {
    return skipped || startedAt !== null;
  },
  onStart(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
