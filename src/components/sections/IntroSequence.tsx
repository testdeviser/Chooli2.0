'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { COPY, INTRO, TEXT, TIMELINE } from '@/lib/animation/config';
import { introClock } from '@/lib/animation/introClock';
import { progress } from '@/lib/animation/progress';
import { applyReveal, visibility } from '@/lib/animation/reveal';
import { useDeviceProfile } from '@/lib/hooks/useDeviceProfile';
import { ScrollHint } from '@/components/ui/ScrollHint';
import { GusIntro } from './GusIntro';
import { AboutChooli } from './AboutChooli';

const Experience = dynamic(() => import('@/components/3d/Experience'), { ssr: false });

/** the moment shown when the sequence cannot be scrubbed (reduced motion / no WebGL) */
const STILL_PROGRESS = 0.985;

/** scroll fraction -> timeline progress (piecewise linear, see TIMELINE.scrollMap) */
function mapScroll(s: number) {
  const m = TIMELINE.scrollMap;
  for (let i = 1; i < m.length; i++) {
    const [s0, p0] = m[i - 1];
    const [s1, p1] = m[i];
    if (s <= s1) return p0 + ((p1 - p0) * (s - s0)) / Math.max(1e-6, s1 - s0);
  }
  return m[m.length - 1][1];
}

/**
 * The pinned, scroll-controlled 3D introduction.
 *
 * Pinning uses `position: sticky` (no scroll hijacking, no layout shift); one GSAP
 * ScrollTrigger maps the section's scroll range to a single 0..1 progress value that
 * drives the camera, the character and every text reveal.
 *
 * All copy is real HTML in the document, so it is readable without WebGL.
 */
export function IntroSequence() {
  const root = useRef<HTMLElement>(null);
  const device = useDeviceProfile();
  const [sceneReady, setSceneReady] = useState(false);
  const [active, setActive] = useState(true);
  const [copyIn, setCopyIn] = useState(false);

  const scrub = device.ready && device.webgl && !device.reducedMotion;
  const still = device.ready && !scrub;

  const el = {
    hero: useRef<HTMLDivElement>(null),
    heroAside: useRef<HTMLDivElement>(null),
    hint: useRef<HTMLDivElement>(null),
    scrim: useRef<HTMLDivElement>(null),
    gusScrim: useRef<HTMLDivElement>(null),
  };

  // text reveals: pure function of progress, written straight to the DOM (no re-renders)
  useEffect(
    () =>
      progress.subscribe((p) => {
        applyReveal(el.hero.current, p, TEXT.hero, 16);
        applyReveal(el.heroAside.current, p, TEXT.hero, 16);
        applyReveal(el.hint.current, p, TEXT.scrollHint, 0);
        if (el.gusScrim.current) el.gusScrim.current.style.opacity = visibility(p, TEXT.gusScrim).toFixed(3);
        if (el.scrim.current) el.scrim.current.style.opacity = visibility(p, TEXT.aboutScrim).toFixed(3);
      }),
    // refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // opening sequence: starts when the scene is first shown (skipped without motion / WebGL)
  useEffect(() => {
    if (still) introClock.skip();
    else if (sceneReady) introClock.start();
  }, [sceneReady, still]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      const e = introClock.elapsed();
      timer = setTimeout(() => setCopyIn(true), Math.max(0, (INTRO.copyAt - Math.max(e, 0)) * 1000));
    };
    if (introClock.started) schedule();
    const off = introClock.onStart(schedule);
    const fallback = setTimeout(() => setCopyIn(true), 9500);
    return () => {
      off();
      clearTimeout(timer);
      clearTimeout(fallback);
    };
  }, []);

  // scroll -> progress (single ScrollTrigger, cleaned up with gsap.context)
  useEffect(() => {
    if (!device.ready) return;
    if (!scrub) {
      progress.set(STILL_PROGRESS);
      return;
    }
    const section = root.current;
    if (!section) return;
    gsap.registerPlugin(ScrollTrigger);
    const state = { value: 0 };
    const ctx = gsap.context(() => {
      gsap.to(state, {
        value: 1,
        ease: 'none',
        onUpdate: () => progress.set(mapScroll(state.value)),
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          // the last viewport of the section is where the next section slides over the scene
          end: () => `+=${Math.max(1, section.offsetHeight - window.innerHeight * 2)}`,
          scrub: TIMELINE.scrub,
          invalidateOnRefresh: true,
        },
      });
    }, section);
    return () => {
      ctx.revert();
      progress.set(0);
    };
  }, [device.ready, scrub]);

  // Stop rendering WebGL whenever none of the scene can be seen. The next section slides up
  // OVER the pinned scene, so "the intro section is on screen" is not enough: once that
  // section covers the whole viewport the scene is hidden, and rendering it anyway steals
  // GPU time from page scrolling (that was the jerk in the white sections).
  useEffect(() => {
    const section = root.current;
    if (!section) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const vh = window.innerHeight;
      const intro = section.getBoundingClientRect();
      const next = document.getElementById('after-intro')?.getBoundingClientRect();
      const introOnScreen = intro.bottom > 0 && intro.top < vh;
      // everything from the next section down is opaque, so once its top edge reaches the
      // top of the viewport no part of the scene is visible
      const coveredByNext = !!next && next.top <= 0;
      setActive(introOnScreen && !coveredByNext);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <section
      ref={root}
      id="intro"
      aria-label="Introduction"
      className="relative"
      style={{ height: still ? '100svh' : `${TIMELINE.scrollLengthVh}vh` }}
    >
      <div className="intro-backdrop sticky top-0 h-[100svh] w-full overflow-hidden">
        {/* 3D scene */}
        {device.ready && device.webgl && (
          <div
            className="absolute inset-0 transition-opacity duration-[1400ms] ease-out"
            style={{ opacity: sceneReady ? 1 : 0 }}
          >
            <Experience
              lite={device.lite}
              reducedMotion={device.reducedMotion}
              fixedProgress={still ? STILL_PROGRESS : undefined}
              active={active}
              onReady={() => setSceneReady(true)}
            />
          </div>
        )}

        {/* legibility gradients (decorative) */}
        <div aria-hidden className="scrim-top pointer-events-none absolute inset-x-0 top-0 h-40" />
        <div aria-hidden className="scrim-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" />
        <div
          ref={el.gusScrim}
          aria-hidden
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy-deep/30 to-transparent md:bg-gradient-to-r md:from-navy-deep/80 md:via-navy-deep/25 md:to-transparent"
        />
        <div
          ref={el.scrim}
          aria-hidden
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-deep/95 via-navy-deep/55 to-transparent md:bg-gradient-to-l md:from-navy-deep/90 md:via-navy-deep/45 md:to-transparent"
        />

        {/* Scene 01 - opening */}
        <div className={`intro-enter ${copyIn ? 'intro-entered' : ''} absolute inset-0 pointer-events-none`}>
        <div ref={el.hero} data-reveal className="absolute bottom-[17svh] left-6 right-6 md:bottom-[16svh] md:left-[5.5vw] md:right-auto md:max-w-[42rem]">
          {/* soft local wash behind the copy so it reads on bright snow and on the night sky */}
          <div aria-hidden className="hero-wash" />
          <p className="glass-chip relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-sans text-[0.68rem] font-extrabold uppercase tracking-[0.26em] text-brand-orange">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
            {COPY.hero.eyebrow}
          </p>
          {/* phones keep the original size; desktop: larger, narrower, wraps to 4 balanced lines */}
          <h1 className="text-legible relative mt-4 font-display text-[clamp(1.5rem,2.4vw,2.2rem)] font-bold leading-[1.22] text-paper md:max-w-[10.5em] md:text-balance md:text-[clamp(2rem,3.3vw,3.2rem)] md:leading-[1.12] md:tracking-[-0.01em]">
            {/* each sentence balanced on its own (desktop: 2 + 2 lines) */}
            <span className="block md:text-balance">{COPY.hero.line}</span>
            <span className="block text-brand-orange md:text-balance">{COPY.hero.lineRest}</span>
          </h1>
        </div>
        {/* positioning paragraph, bottom-right, level with the headline */}
        <div ref={el.heroAside} data-reveal className="absolute bottom-[16svh] right-[5.5vw] hidden max-w-[min(23rem,29vw)] md:block">
          <div aria-hidden className="hero-wash" />
          <p className="text-legible relative font-sans text-[clamp(0.95rem,1.05vw,1.08rem)] leading-relaxed text-paper/90">
            {COPY.hero.aside}
          </p>
        </div>
        <div ref={el.hint} data-reveal className="absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-8">
          <ScrollHint />
        </div>
        </div>

        {/* Scene 03 - "It's me, Gus." */}
        <GusIntro />

        {/* Scene 05 - Meet Chooli + Why Choose Chooli */}
        <AboutChooli />
      </div>
    </section>
  );
}
