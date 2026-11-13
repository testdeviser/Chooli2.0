'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CASES } from '@/lib/animation/config';

/**
 * "Real results. No magic." - case-study slider.
 *
 * The active story is a wide brand-blue card (challenge, quote, three results, author and a
 * "Read Story" button); the others are narrow photo cards with the client's logo. Arrows,
 * clicking a card, dragging / swiping, or the keyboard arrows move the slider; the active
 * card stays centred. Custom React slider (no slider library).
 * Desktop layout. Content is placeholder until approved stories are supplied (see CASES).
 */

const GAP = 30;

function sizes(viewport: number) {
  return {
    active: Math.min(870, viewport * 0.55),
    inactive: Math.min(345, viewport * 0.215),
  };
}

export function CaseStudies() {
  const stories = CASES.stories;
  const [active, setActive] = useState(Math.min(2, stories.length - 1));
  const [vw, setVw] = useState(1600);
  const viewport = useRef<HTMLDivElement>(null);
  // drag / swipe: the track follows the pointer, then snaps to the next / previous story
  const [drag, setDrag] = useState(0);
  const dragState = useRef<{ id: number; x0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const measure = () => setVw(viewport.current?.clientWidth ?? window.innerWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const go = useCallback((dir: number) => setActive((i) => (i + dir + stories.length) % stories.length), [stories.length]);

  const { active: wA, inactive: wI } = sizes(vw);
  const offset = vw / 2 - (active * (wI + GAP) + wA / 2) + drag;
  const SNAP = 70; // pixels of drag needed to change story

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragState.current = { id: e.pointerId, x0: e.clientX, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (d.moved) setDrag(dx);
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d || d.id !== e.pointerId) return;
    dragState.current = null;
    if (d.moved) {
      suppressClick.current = true; // a drag is not a click on the card under the pointer
      const dx = e.clientX - d.x0;
      if (dx <= -SNAP) go(1);
      else if (dx >= SNAP) go(-1);
    }
    setDrag(0);
  };

  return (
    <section aria-labelledby="cases-heading" className="relative z-10 overflow-hidden bg-paper py-24 text-brand-ink md:py-28">
      <div className="mx-auto flex max-w-[1480px] items-end justify-between gap-10 px-[4vw]">
        <div>
          <p className="font-sans text-[0.8rem] font-extrabold uppercase tracking-[0.04em] text-brand-orange">{CASES.eyebrow}</p>
          <h2 id="cases-heading" className="mt-3 max-w-[40rem] font-display text-[clamp(2rem,3.6vw,3.3rem)] font-extrabold capitalize leading-[1.12] tracking-[-0.025em] text-brand-navy">
            {CASES.heading}
          </h2>
        </div>
        <div className="flex shrink-0 gap-4 pb-2">
          <button
            type="button"
            aria-label="Previous story"
            onClick={() => go(-1)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-navy text-white shadow-[0_12px_26px_-12px_rgba(23,55,106,0.8)] transition-transform hover:-translate-x-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
          >
            <Arrow dir="left" />
          </button>
          <button
            type="button"
            aria-label="Next story"
            onClick={() => go(1)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange text-white shadow-[0_12px_26px_-12px_rgba(245,134,42,0.9)] transition-transform hover:translate-x-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-navy"
          >
            <Arrow dir="right" />
          </button>
        </div>
      </div>

      <div
        ref={viewport}
        role="region"
        aria-roledescription="carousel"
        aria-label="Case studies"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          if (e.key === 'ArrowRight') go(1);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        className={`mt-16 w-full touch-pan-y select-none outline-none ${drag !== 0 ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <ul
          className="flex h-[40rem] items-center"
          style={{ gap: GAP, transform: `translateX(${offset}px)`, transition: drag !== 0 ? 'none' : 'transform 0.75s cubic-bezier(0.22, 0.8, 0.2, 1)' }}
        >
          {stories.map((s, i) => {
            const isActive = i === active;
            return (
              <li
                key={s.client + i}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${stories.length}`}
                className="relative shrink-0 overflow-hidden rounded-[26px]"
                style={{
                  width: isActive ? wA : wI,
                  height: isActive ? '100%' : '83%',
                  transition: 'width 0.75s cubic-bezier(0.22, 0.8, 0.2, 1), height 0.75s cubic-bezier(0.22, 0.8, 0.2, 1)',
                }}
              >
                {/* photo card (inactive) */}
                <button
                  type="button"
                  tabIndex={isActive ? -1 : 0}
                  aria-label={`Show story ${i + 1}`}
                  onClick={() => setActive(i)}
                  className="case-photo absolute inset-0 flex items-center justify-center text-white transition-opacity duration-500 focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-4 focus-visible:outline-brand-orange"
                  style={{ opacity: isActive ? 0 : 1, pointerEvents: isActive ? 'none' : 'auto' }}
                >
                  <span className="h-20 w-20 drop-shadow-[0_6px_20px_rgba(0,0,0,0.4)]">
                    <Mark kind={s.mark} />
                  </span>
                </button>

                {/* story card (active) */}
                <article
                  aria-hidden={!isActive}
                  className="absolute inset-0 flex flex-col bg-brand-sky p-[3.6rem] text-white transition-opacity duration-500"
                  style={{ opacity: isActive ? 1 : 0, transitionDelay: isActive ? '0.3s' : '0s', pointerEvents: isActive ? 'auto' : 'none' }}
                >
                  <div className="flex items-start justify-between">
                    <span className="h-12 w-12 text-white">
                      <Mark kind={s.mark} />
                    </span>
                    {CASES.placeholder && (
                      <span className="rounded-full bg-white/20 px-3 py-1 font-sans text-[0.62rem] font-extrabold uppercase tracking-[0.2em]">Sample story</span>
                    )}
                  </div>
                  <div className="mt-auto grid grid-cols-[1fr_auto] gap-12">
                    <div>
                      <p className="text-[1.15rem] leading-relaxed text-white/90">{s.problem}</p>
                      <blockquote className="mt-7 border-l-[5px] border-white pl-8 font-display text-[1.45rem] font-bold leading-[1.45]">
                        &ldquo;{s.quote}&rdquo;
                      </blockquote>
                    </div>
                    <dl className="flex flex-col justify-center gap-6 pt-2">
                      {s.metrics.map((m) => (
                        <div key={m.label}>
                          <dt className="font-display text-[1.6rem] font-extrabold leading-none">{m.value}</dt>
                          <dd className="mt-1.5 text-[0.95rem] text-white/85">{m.label}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="mt-12 flex items-center justify-between">
                    <span className="flex items-center gap-4">
                      <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-navy font-display text-[1.3rem] font-bold">
                        {s.author.charAt(0)}
                      </span>
                      <span className="text-[1.3rem]">{s.author}</span>
                    </span>
                    <a
                      href={s.href}
                      tabIndex={isActive ? 0 : -1}
                      className="group inline-flex items-center gap-4 rounded-full bg-brand-orange py-2 pl-8 pr-2 font-display text-[1.1rem] font-bold shadow-[0_14px_30px_-12px_rgba(16,54,109,0.7)] transition-colors hover:bg-[#f79446] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      Read Story
                      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-orange transition-transform duration-300 group-hover:rotate-45">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17 17 7M8 7h9v9" />
                        </svg>
                      </span>
                    </a>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="sr-only" aria-live="polite">
        Story {active + 1} of {stories.length}
      </p>
    </section>
  );
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'left' ? <path d="M19 12H5M11 6l-6 6 6 6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}

/** placeholder client logo marks (to be replaced by real client logos) */
function Mark({ kind }: { kind: string }) {
  const common = { viewBox: '0 0 64 64', className: 'h-full w-full', fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' as const };
  switch (kind) {
    case 'clover':
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full" fill="currentColor">
          <path d="M32 4c6 10 6 18 0 28-6-10-6-18 0-28Zm0 56c-6-10-6-18 0-28 6 10 6 18 0 28ZM4 32c10-6 18-6 28 0-10 6-18 6-28 0Zm56 0c-10 6-18 6-28 0 10-6 18-6 28 0Z" />
        </svg>
      );
    case 'wave':
      return (
        <svg {...common}>
          <path d="M8 22c8-8 16 8 24 0s16 8 24 0M8 34c8-8 16 8 24 0s16 8 24 0M8 46c8-8 16 8 24 0s16 8 24 0" />
        </svg>
      );
    case 'step':
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full" fill="currentColor">
          <path d="M8 12h20l12 14H20zM24 30h20l12 14H36zM8 40h14l10 12H8z" />
        </svg>
      );
    case 'ring':
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" />
          <circle cx="32" cy="32" r="9" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 52V22a14 14 0 0 1 28 0v30M22 52V24a6 6 0 0 1 12 0v28M40 52V30a12 12 0 0 1 12 12v10" />
        </svg>
      );
  }
}
