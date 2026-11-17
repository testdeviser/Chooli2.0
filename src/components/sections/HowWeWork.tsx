'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * "How we work together" - the four-step process as a vertical timeline.
 *
 * As the visitor scrolls, an orange line fills down the centre rail. Each step switches on
 * when the line reaches its node: the row gets its soft card, the icon tile and number fill
 * with brand sky blue and the node turns solid orange. Steps stay on as you continue and
 * switch off again when you scroll back up. Left / right alternate row by row.
 * Desktop layout.
 */

type Step = { title: string; body: string; icon: ReactNode };

const STEPS: Step[] = [
  {
    title: 'Discover',
    body: 'We learn about your business, goals, and biggest opportunities.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    ),
  },
  {
    title: 'Plan',
    body: 'We create a practical strategy focused on what matters most.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="4.5" width="14" height="16.5" rx="2.5" />
        <path d="M9 3h6v3H9zM8.5 11h.01M11.5 11H16M8.5 15h.01M11.5 15H16" />
      </svg>
    ),
  },
  {
    title: 'Execute',
    body: 'We put the strategy into action and keep things moving.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    title: 'Measure',
    body: 'We track performance, make improvements, and report what matters.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M6 19v-4M12 19V6M18 19v-8" />
      </svg>
    ),
  },
];

/** the line's leading edge sits this far down the viewport (0 = top, 1 = bottom) */
const FOCUS = 0.58;
/** pixels of scroll before the end of the page over which the line stretches to finish */
const END_RAMP = 420;

export function HowWeWork() {
  const list = useRef<HTMLOListElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLSpanElement | null)[]>([]);
  const [reached, setReached] = useState(0); // how many steps are switched on

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = -1;
    const update = () => {
      frame = 0;
      const box = list.current?.getBoundingClientRect();
      const first = nodes.current[0]?.getBoundingClientRect();
      const end = nodes.current[STEPS.length - 1]?.getBoundingClientRect();
      if (!box || !first || !end || !rail.current || !fill.current) return;
      // rail runs from the first node's centre to the last node's centre
      const top = first.top + first.height / 2;
      const bottom = end.top + end.height / 2;
      const length = Math.max(1, bottom - top);
      rail.current.style.top = `${top - box.top}px`;
      rail.current.style.height = `${length}px`;
      // near the end of the page there may be no scroll left to bring the last step up to the
      // focus line, so over the final stretch the line also reaches further down the viewport
      const vh = window.innerHeight;
      const remaining = document.documentElement.scrollHeight - window.scrollY - vh;
      const ramp = Math.min(1, Math.max(0, 1 - remaining / END_RAMP));
      const lead = vh * (FOCUS + (0.92 - FOCUS) * ramp);
      const filled = reduced ? length : Math.min(length, Math.max(0, lead - top));
      fill.current.style.transform = `scaleY(${(filled / length).toFixed(4)})`;
      if (head.current) {
        head.current.style.transform = `translate(-50%, calc(${filled.toFixed(1)}px - 50%))`;
        head.current.style.opacity = filled > 2 && filled < length - 2 ? '1' : '0';
      }
      let count = 0;
      nodes.current.forEach((n) => {
        if (!n) return;
        const r = n.getBoundingClientRect();
        if (reduced || r.top + r.height / 2 <= top + filled + 0.5) count++;
      });
      if (count !== last) {
        last = count;
        setReached(count);
      }
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };
  }, []);

  return (
    <section aria-labelledby="process-heading" className="relative z-10 bg-white pb-32 pt-28 text-brand-ink" style={{
  backgroundImage: "url('/images/how-we-work-bg.png')",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}}>
      <div className="mx-auto max-w-[46rem] px-6 text-center">
        <p className="font-sans text-[0.8rem] font-extrabold uppercase tracking-[0.04em] text-brand-orange">How we work together</p>
        <h2 id="process-heading" className="mt-4 font-display text-[clamp(2.2rem,3.8vw,3.4rem)] font-extrabold leading-[1.12] tracking-[-0.025em] text-brand-navy">
          A Simple, No-Nonsense Approach
        </h2>
        <p className="mx-auto mt-7 max-w-[38rem] text-[1.1rem] leading-relaxed text-brand-ink/70">
          No confusing processes. No unnecessary complications. Just a clear plan focused on helping your business move
          forward.
        </p>
      </div>

      <ol ref={list} className="relative mx-auto mt-16 flex max-w-[56rem] flex-col gap-5 px-6">
        {/* centre rail: faint track + orange fill that grows with scroll */}
        <div ref={rail} aria-hidden className="pointer-events-none absolute left-1/2 z-20 w-[2px] -translate-x-1/2 bg-brand-orange/20">
          <div ref={fill} className="absolute inset-0 origin-top bg-brand-orange" style={{ transform: 'scaleY(0)' }} />
          {/* glowing dot riding the front of the line */}
          <div
            ref={head}
            className="absolute left-1/2 top-0 h-3 w-3 rounded-full bg-brand-orange shadow-[0_0_0_5px_rgba(245,134,42,0.18),0_0_16px_3px_rgba(245,134,42,0.55)] transition-opacity duration-300"
            style={{ transform: 'translate(-50%, -50%)', opacity: 0 }}
          />
        </div>

        {STEPS.map((step, i) => {
          const on = i < reached;
          const flip = i % 2 === 1; // even-numbered steps: copy on the left, icon on the right
          const number = String(i + 1).padStart(2, '0');
          const badge = (
            <div className={`flex items-center gap-5 ${flip ? 'flex-row-reverse justify-start' : ''}`}>
              <span
                className={`relative flex h-[5.3rem] w-[5.3rem] items-center justify-center overflow-hidden rounded-[22px] bg-brand-sky/12 transition-[box-shadow,transform] duration-700 ${
                  on ? 'scale-100 shadow-[0_18px_34px_-14px_rgba(23,55,106,0.6)]' : 'scale-95'
                }`}
              >
                {/* brand gradient that fills the tile from the bottom up when the line arrives */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(150deg,#7DB6DC_0%,#60A0CC_42%,#1F559B_100%)] transition-[clip-path] duration-700 ease-[cubic-bezier(0.22,0.8,0.2,1)]"
                  style={{ clipPath: on ? 'inset(0 0 0 0 round 22px)' : 'inset(100% 0 0 0 round 22px)' }}
                />
                {/* soft top highlight for depth */}
                <span
                  aria-hidden
                  className={`absolute inset-0 bg-[radial-gradient(120%_70%_at_30%_0%,rgba(255,255,255,0.35),transparent_60%)] transition-opacity duration-700 ${on ? 'opacity-100' : 'opacity-0'}`}
                />
                <span className={`relative h-8 w-8 transition-colors duration-500 ${on ? 'text-white delay-200' : 'text-brand-sky'}`}>{step.icon}</span>
              </span>
              <span
                className={`flex h-9 min-w-9 items-center justify-center rounded-[10px] px-2 font-sans text-[0.95rem] font-semibold transition-colors duration-500 ${
                  on ? 'bg-[linear-gradient(150deg,#60A0CC,#1F559B)] text-white' : 'bg-brand-sky/12 text-brand-sky'
                }`}
              >
                {number}
              </span>
            </div>
          );
          const copy = (
            <div className={flip ? 'text-right' : ''}>
              <h3
                className={`font-display text-[1.6rem] font-extrabold tracking-[-0.015em] transition-colors duration-500 ${
                  on ? 'text-brand-navy' : 'text-brand-navy/45'
                }`}
              >
                {step.title}
              </h3>
              <p
                className={`mt-3 max-w-[20rem] text-[1.02rem] leading-[1.75] transition-colors duration-500 ${flip ? 'ml-auto' : ''} ${
                  on ? 'text-brand-ink/75' : 'text-brand-ink/45'
                }`}
              >
                {step.body}
              </p>
            </div>
          );
          return (
            <li
              key={step.title}
              className={`relative grid grid-cols-[1fr_5.5rem_1fr] items-center rounded-[30px] px-12 py-10 transition-[background-color,box-shadow] duration-700 ${
                on ? 'bg-paper shadow-[0_1px_0_rgba(23,55,106,0.04)]' : 'bg-transparent'
              }`}
            >
              <div className={flip ? 'flex justify-end' : ''}>{flip ? copy : badge}</div>
              <div className="flex justify-center">
                <span
                  ref={(n) => {
                    nodes.current[i] = n;
                  }}
                  aria-hidden
                  className={`relative z-30 flex h-11 w-11 items-center justify-center rounded-[12px] border-[1.5px] border-brand-orange transition-[background-color,transform,box-shadow] duration-500 ${
                    on ? 'scale-100 bg-brand-orange shadow-[0_0_0_6px_rgba(245,134,42,0.16)]' : 'scale-90 bg-white'
                  }`}
                >
                  {/* inner square: a faint orange seed while waiting, a white core once reached */}
                  <span
                    className={`block h-3 w-3 rounded-[3.5px] transition-[background-color,transform] duration-500 ${
                      on ? 'scale-100 bg-white delay-150' : 'scale-75 bg-brand-orange/25'
                    }`}
                  />
                </span>
              </div>
              <div className={flip ? 'flex justify-end' : ''}>{flip ? badge : copy}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
