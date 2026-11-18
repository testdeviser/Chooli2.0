'use client';

import { useEffect, useRef } from 'react';
import { COPY, TEXT } from '@/lib/animation/config';
import { progress } from '@/lib/animation/progress';
import { applyReveal } from '@/lib/animation/reveal';

/** line icons for the four "why Chooli" cards, in COPY.about.points order (24 x 24) */
const POINT_ICONS = [
  // Focused Expertise: target
  <svg key="focus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" />
  </svg>,
  // Real Results: rising trend line
  <svg key="results" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 15.5 5-5 4 3.5 8-8" />
    <path d="M14.5 6H20v5.5" />
    <path d="M3 20.5h18" />
  </svg>,
  // Straightforward & Honest: speech bubble
  <svg key="honest" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 5h17v11h-11l-6 4.5z" />
  </svg>,
  // Business With Purpose: heart
  <svg key="purpose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11Z" />
  </svg>,
];

/**
 * Final intro screen: "Meet Chooli" with four short "why Chooli" points, kept short.
 * Sits to the right of Gus in the three-quarter shot.
 *
 *   two-tone statement headline -> short paragraph -> four cards (icon + number + title + one line)
 *
 * Each piece has a `data-step` (scroll offset after the screen starts) and stays once shown.
 */
export function AboutChooli() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-step]') ?? []);
    const [a, b] = TEXT.about.in;
    return progress.subscribe((p) => {
      for (const item of items) {
        const step = Number(item.dataset.step);
        applyReveal(item, p, { in: [a + step, b + step], out: [2, 2] }, Number(item.dataset.rise ?? 18));
      }
    });
  }, []);

  const c = COPY.about;
  return (
    <div
      ref={root}
      className="absolute inset-x-6 bottom-[6svh] md:inset-x-auto md:bottom-auto md:right-[5vw] md:top-1/2 md:w-[min(46rem,50vw)] md:-translate-y-1/2"
    >
      {/* two-tone statement */}
      <h2 data-step="0" data-rise="24" style={{ opacity: 0 }} className="text-legible font-display text-[clamp(2rem,3.5vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-paper">
        <span className="text-brand-orange">{c.heading}</span> <span className="text-paper">{c.headingRest}</span>
      </h2>
      <p data-step="0.016" style={{ opacity: 0 }} className="text-legible mt-5 max-w-[34rem] text-[clamp(0.98rem,1.1vw,1.12rem)] leading-relaxed text-paper/75">
        <span className="font-semibold text-paper">{c.bodyLead}</span> {c.body}
      </p>

      <ul className="mt-7 grid grid-cols-2 gap-3">
        {c.points.map((point, i) => (
          <li
            key={point.title}
            data-step={(0.03 + i * 0.009).toFixed(3)}
            data-rise="16"
            style={{ opacity: 0 }}
            className="glass-panel flex min-h-[7.6rem] flex-col rounded-[18px] px-4 py-4 md:px-5"
          >
            <span className="flex items-start justify-between">
              <span
                aria-hidden
                className="grid h-11 w-11 place-items-center rounded-2xl md:h-12 md:w-12 bg-brand-orange/15 text-brand-orange ring-1 ring-inset ring-brand-orange/35 [&>svg]:h-[26px] [&>svg]:w-[26px]"
              >
                {POINT_ICONS[i]}
              </span>
              <span className="font-sans text-[0.68rem] font-extrabold tracking-[0.18em] text-brand-orange">{String(i + 1).padStart(2, '0')}</span>
            </span>
            <span className="mt-4 hyphens-auto font-display text-[clamp(0.9rem,1.15vw,1.15rem)] font-bold leading-snug text-paper">{point.title}</span>
            <span className="mt-1.5 font-sans text-[clamp(0.82rem,0.9vw,0.92rem)] leading-snug text-paper/70">{point.body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
