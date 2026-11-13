import { smoothstep } from './math';

export interface Window {
  in: number[];
  out: number[];
}

/** 0..1 visibility of an element for a scroll position */
export const visibility = (p: number, w: Window) => smoothstep(w.in[0], w.in[1], p) * (1 - smoothstep(w.out[0], w.out[1], p));

/** fade + rise */
export function applyReveal(el: HTMLElement | null, p: number, w: Window, rise = 22) {
  if (!el) return;
  const tin = smoothstep(w.in[0], w.in[1], p);
  const tout = smoothstep(w.out[0], w.out[1], p);
  const vis = tin * (1 - tout);
  el.style.opacity = vis.toFixed(3);
  el.style.transform = `translate3d(0, ${((1 - tin) * rise - tout * rise).toFixed(2)}px, 0)`;
  el.style.pointerEvents = vis > 0.6 ? 'auto' : 'none';
}

/** masked line reveal: the inner line slides up from behind its overflow-hidden parent */
export function applyMask(el: HTMLElement | null, p: number, w: Window) {
  if (!el) return;
  const tin = smoothstep(w.in[0], w.in[1], p);
  const tout = smoothstep(w.out[0], w.out[1], p);
  el.style.transform = `translate3d(0, ${((1 - tin) * 108 - tout * 108).toFixed(2)}%, 0)`;
  el.style.opacity = (Math.min(1, tin * 1.6) * (1 - tout)).toFixed(3);
}
