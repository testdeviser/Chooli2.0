export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 below `a`, 1 above `b`, linear in between */
export const remap = (v: number, a: number, b: number) => (a === b ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a)));

export const smoothstep = (a: number, b: number, v: number) => {
  const t = remap(v, a, b);
  return t * t * (3 - 2 * t);
};

export const easeInOut = (t: number) => t * t * (3 - 2 * t);

/**
 * Distance travelled (0..1) for a move that accelerates for `ramp` of its duration,
 * cruises at constant speed, then decelerates for `ramp`. Constant cruise speed keeps
 * the walk cadence even while the visitor scrolls at a steady rate.
 */
export const trapezoid = (t: number, ramp: number) => {
  t = clamp(t);
  const r = clamp(ramp, 1e-4, 0.5);
  const v = 1 / (1 - r); // cruise speed
  if (t < r) return (v * t * t) / (2 * r);
  if (t > 1 - r) {
    const u = 1 - t;
    return 1 - (v * u * u) / (2 * r);
  }
  return v * (t - r / 2);
};
