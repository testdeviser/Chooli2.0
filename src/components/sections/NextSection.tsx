'use client';

import { useEffect, useRef, useState } from 'react';
import { LINKS } from '@/lib/animation/config';

/**
 * "What we actually do" - the four core services, the first section after the 3D intro.
 * It slides up over the pinned scene (negative top margin, rounded top).
 *
 * The cards sit on a gentle 3D curve (outer cards angled more); hovering a card turns it to
 * face the visitor and lifts it. Copy from the approved design; colours from the brand board.
 */
const SERVICES = [
  {
    title: 'SEO & Local Search',
    body: 'Get found by the people already searching for what you offer.',
    href: LINKS.seo,
    tone: 'bg-brand-orange',
    angle: 19,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
        <circle cx="42" cy="42" r="30" />
        <path d="M64 64 86 86" />
      </svg>
    ),
  },
  {
    title: 'Paid Advertising',
    body: 'Reach the right audience, turn clicks into leads, and track results.',
    href: LINKS.site,
    tone: 'bg-brand-navy',
    angle: 11,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M14 40h18l40-22v64L32 60H14z" />
        <path d="M32 40v20M24 60l6 24h10l-4-24" />
      </svg>
    ),
  },
  {
    title: 'Web Development',
    body: 'Build a website that looks great, works smoothly, and converts.',
    href: LINKS.site,
    tone: 'bg-brand-ridge',
    angle: -11,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M36 22 10 50l26 28M64 22l26 28-26 28" />
      </svg>
    ),
  },
  {
    title: 'E-Commerce Management',
    body: 'Manage and grow your online sales across major marketplaces.',
    href: LINKS.site,
    tone: 'bg-brand-sky',
    angle: -19,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M18 30h64v56H18zM18 30l8-14h48l8 14" />
        <path d="M38 46a12 12 0 0 0 24 0" />
      </svg>
    ),
  },
];

export function NextSection() {
  const root = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={root}
      id="after-intro"
      aria-labelledby="services-heading"
      className={`services relative z-10 -mt-[100svh] rounded-t-[2.25rem] bg-white text-brand-ink shadow-[0_-30px_80px_-20px_rgba(4,26,53,0.65)] motion-reduce:mt-0 motion-reduce:rounded-none ${shown ? 'is-in' : ''}`}
    >
      <div className="mx-auto flex min-h-[100svh] max-w-[1480px] flex-col justify-center px-[4vw] py-24 md:py-28">
        <div className="text-center">
          <p className="svc-rise font-sans text-[0.8rem] font-extrabold uppercase tracking-[0.04em] text-brand-orange">What we actually do</p>
          <h2
            id="services-heading"
            className="svc-rise mx-auto mt-3 max-w-[48rem] font-display text-[clamp(2rem,4vw,3.4rem)] font-extrabold leading-[1.1] tracking-[-0.025em] text-brand-navy"
            style={{ transitionDelay: '80ms' }}
          >
            Digital Marketing Services Built Around Growth.
          </h2>
        </div>

        <ul className="svc-stage mt-14 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-8">
          {SERVICES.map((s, i) => (
            <li key={s.title} className="svc-card-wrap" style={{ ['--angle' as string]: `${s.angle}deg`, transitionDelay: `${220 + i * 110}ms` }}>
              <a
                href={s.href}
                className={`svc-card group relative flex h-full min-h-[17.5rem] flex-col overflow-hidden rounded-[22px] p-9 text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-brand-orange ${s.tone}`}
              >
                <h3 className="font-display text-[1.45rem] font-extrabold leading-tight tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-4 max-w-[17rem] text-[0.97rem] leading-relaxed text-white/85">{s.body}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-8 font-sans text-[0.95rem] font-semibold text-white/90">
                  Know more
                  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </span>
                <span aria-hidden className="pointer-events-none absolute -bottom-3 -right-2 h-28 w-28 text-white/25 transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-105">
                  {s.icon}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
