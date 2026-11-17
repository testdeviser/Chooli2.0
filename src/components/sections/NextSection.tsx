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
      <svg viewBox="0 0 100 100" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="40" cy="39" r="27" fill="white" fillOpacity="0.08" />
        <path d="m60 59 22 22" />
        <path d="M40 56s13-12 13-22a13 13 0 1 0-26 0c0 10 13 22 13 22Z" />
        <circle cx="40" cy="34" r="4.5" />
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
      <svg viewBox="0 0 100 100" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 37h17l33-17v48L31 53H14Z" fill="white" fillOpacity="0.08" />
        <path d="M31 37v16M26 53l5 23h12l-7-21" />
        <path d="M75 44h11M74 31l8-7M74 57l8 7" />
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
      <svg viewBox="0 0 100 100" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="11" y="18" width="73" height="59" rx="8" fill="white" fillOpacity="0.08" />
        <path d="M11 33h73M29 43 20 53l9 10M65 43l9 10-9 10M53 42 43 64" />
        <g fill="white" fillOpacity="0.65" stroke="none">
          <circle cx="21" cy="25.5" r="1.8" />
          <circle cx="28" cy="25.5" r="1.8" />
          <circle cx="35" cy="25.5" r="1.8" />
        </g>
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
      <svg viewBox="0 0 100 100" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="17" y="33" width="58" height="48" rx="7" fill="white" fillOpacity="0.08" stroke="none" />
        <path d="M75 48v-8a7 7 0 0 0-7-7H24a7 7 0 0 0-7 7v34a7 7 0 0 0 7 7h25" />
        <path d="M31 38V24a15 15 0 0 1 30 0v14" />
        <circle cx="68" cy="65" r="14" fill="white" fillOpacity="0.08" />
        <path d="m62 65 4 4 7-8" />
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