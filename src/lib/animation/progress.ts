/**
 * Scroll progress of the pinned introduction, shared between GSAP (writer), the WebGL
 * render loop (reads `.value` every frame) and the HTML overlays (subscribe).
 * It is deliberately NOT React state: nothing re-renders while scrolling.
 */
type Listener = (value: number) => void;

const listeners = new Set<Listener>();

export const progress = {
  value: 0,
  set(v: number) {
    if (v === this.value) return;
    this.value = v;
    listeners.forEach((l) => l(v));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    l(this.value);
    return () => {
      listeners.delete(l);
    };
  },
};
