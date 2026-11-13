'use client';

import { useEffect, useRef } from 'react';
import { COPY, TEXT } from '@/lib/animation/config';
import { progress } from '@/lib/animation/progress';
import { applyMask, applyReveal } from '@/lib/animation/reveal';

/**
 * "It's me, Gus." - the character introduction, shown while Gus stands facing the camera.
 *
 *   left   : headline, his line, and the brand-board line
 *   centre : Gus himself (3D)
 *   right  : a short "Chooli at a glance" card
 *
 * Every piece has a `data-step` (scroll offset after the section starts) and fades/rises in
 * on its own; everything leaves together before the camera turns for the About section.
 */
export function GusIntro() {
  const root = useRef<HTMLDivElement>(null);
  const lineA = useRef<HTMLSpanElement>(null);
  const lineB = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-step]') ?? []);
    const base = TEXT.gusHeading.in[0];
    const span = TEXT.gusHeading.in[1] - TEXT.gusHeading.in[0];
    return progress.subscribe((p) => {
      applyMask(lineA.current, p, TEXT.gusHeading);
      applyMask(lineB.current, p, { in: [TEXT.gusHeading.in[0] + 0.015, TEXT.gusHeading.in[1] + 0.015], out: TEXT.gusHeading.out });
      for (const item of items) {
        const step = Number(item.dataset.step);
        const rise = Number(item.dataset.rise ?? 16);
        applyReveal(item, p, { in: [base + step, base + step + span], out: TEXT.gusHeading.out }, rise);
      }
    });
  }, []);

  const g = COPY.gus;
  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      {/* left: the introduction */}
      <div className="absolute inset-x-6 bottom-[8svh] text-center md:inset-x-auto md:bottom-auto md:left-[5.5vw] md:top-1/2 md:w-[min(34rem,33vw)] md:-translate-y-1/2 md:text-left">
        <p data-step="0" style={{ opacity: 0 }} className="glass-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-sans text-[0.66rem] font-extrabold uppercase tracking-[0.26em] text-brand-orange">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
          {g.eyebrow}
        </p>
        <h2 className="text-legible mt-5 font-display text-[clamp(2.8rem,6vw,6.2rem)] font-extrabold leading-[0.95] tracking-[-0.02em] text-paper">
          <span className="block overflow-hidden pb-[0.08em]">
            <span ref={lineA} data-line className="block" style={{ opacity: 0 }}>
              It&rsquo;s me,
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.12em]">
            <span ref={lineB} data-line className="block text-brand-orange" style={{ opacity: 0 }}>
              Gus.
            </span>
          </span>
        </h2>
        <p data-step="0.03" style={{ opacity: 0 }} className="text-legible mt-4 font-display text-[clamp(1.15rem,1.6vw,1.55rem)] font-bold leading-snug text-sky">
          {g.sub}
        </p>
        <div data-step="0.045" style={{ opacity: 0 }} className="mt-5 hidden h-px w-24 bg-gradient-to-r from-brand-orange to-transparent md:block" />
        <p data-step="0.05" style={{ opacity: 0 }} className="text-legible mt-5 max-w-[27rem] text-[clamp(0.95rem,1.1vw,1.1rem)] leading-relaxed text-paper/90">
          {g.body}
        </p>
      </div>

      {/* right column: Chooli at a glance */}
      <div className="absolute right-[4.5vw] top-1/2 hidden w-[min(23rem,25vw)] -translate-y-1/2 flex-col gap-4 md:flex">
      {/* Chooli at a glance */}
      <div data-step="0.04" data-rise="22" style={{ opacity: 0 }} className="glass-panel rounded-[22px] px-6 py-5">
        <p className="font-sans text-[0.62rem] font-extrabold uppercase tracking-[0.26em] text-brand-orange">{g.glance.label}</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {g.glance.stats.map((stat) => (
            <div key={stat.v}>
              <p className="font-display text-[2rem] font-extrabold leading-none text-paper">{stat.v}</p>
              <p className="mt-1.5 font-sans text-[0.78rem] font-semibold leading-snug text-sky">{stat.k}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 border-t border-white/15 pt-3.5 font-sans text-[0.82rem] font-semibold text-paper/90">
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-orange" fill="currentColor">
            <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
          </svg>
          {g.glance.line}
        </p>
      </div>
      </div>
    </div>
  );
}
