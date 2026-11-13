'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SMOOTH_SCROLL } from '@/lib/animation/config';

/**
 * Smooth scrolling for the whole page (Lenis), driven by GSAP's ticker so the scroll position,
 * the ScrollTrigger-driven 3D intro and every frame are updated in the same tick - no
 * double smoothing, no lag-then-catch-up jumps. Touchpad / wheel input is eased into one
 * fluid motion; the native scrollbar stays. Visitors with reduced motion keep 1:1 scrolling.
 */
export function SmoothScroll() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({
      lerp: SMOOTH_SCROLL.lerp,
      wheelMultiplier: SMOOTH_SCROLL.wheelMultiplier,
      smoothWheel: true,
      anchors: true,
      autoRaf: false,
      respectReducedMotion: true,
    });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // pause while something locks page scrolling (the full-screen menu sets overflow: hidden)
    const html = document.documentElement;
    const lock = new MutationObserver(() => {
      if (html.style.overflow === 'hidden') lenis.stop();
      else lenis.start();
    });
    lock.observe(html, { attributes: true, attributeFilter: ['style'] });
    return () => {
      lock.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
