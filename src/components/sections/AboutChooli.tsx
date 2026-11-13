'use client';

import { useEffect, useRef } from 'react';
import { COPY, TEXT } from '@/lib/animation/config';
import { progress } from '@/lib/animation/progress';
import { applyReveal } from '@/lib/animation/reveal';

/**
 * Final intro screen: "Why Choose Chooli", kept short.
 * Sits to the right of Gus in the three-quarter shot.
 *
 *   two-tone statement headline -> short paragraph -> four compact numbered cards
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
        {c.heading} <span className="text-paper">{c.headingRest}</span>
      </h2>
      <p data-step="0.016" style={{ opacity: 0 }} className="text-legible mt-5 max-w-[34rem] text-[clamp(0.98rem,1.1vw,1.12rem)] leading-relaxed text-paper/75">
        <span className="font-semibold text-paper">{c.bodyLead}</span> {c.body}
      </p>

      <ul className="mt-7 grid grid-cols-2 gap-3">
        {c.why.map((title, i) => (
          <li
            key={title}
            data-step={(0.03 + i * 0.009).toFixed(3)}
            data-rise="16"
            style={{ opacity: 0 }}
            className="glass-panel flex min-h-[6.6rem] flex-col justify-between rounded-[18px] px-5 py-4"
          >
            <span className="self-end font-sans text-[0.68rem] font-extrabold tracking-[0.18em] text-brand-orange">{String(i + 1).padStart(2, '0')}</span>
            <span className="mt-2 font-display text-[clamp(0.98rem,1.15vw,1.15rem)] font-bold leading-snug text-paper">{title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
