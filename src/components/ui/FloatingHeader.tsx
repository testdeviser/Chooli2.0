'use client';

import { useEffect, useRef, useState } from 'react';
import { INTRO, LINKS } from '@/lib/animation/config';
import { introClock } from '@/lib/animation/introClock';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { label: 'Home', href: '#intro' },
  { label: 'Services', href: LINKS.seo },
  { label: 'Locations', href: LINKS.locations },
  { label: 'Industries', href: LINKS.industries },
  { label: 'Blog', href: LINKS.blog },
  { label: 'About', href: LINKS.about },
  { label: 'Contact Us', href: LINKS.contact },
];

/**
 * Floating header: a compact orange MENU button on the left; a morning / night scene switch
 * and a "Let's Talk" call to action on the right. Both slide in once the opening sequence reaches them; the menu
 * button opens a full-screen navigation panel.
 */
export function FloatingHeader() {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const [pastIntro, setPastIntro] = useState(false);

  // the intro animation is over once the first white section has slid up to the header
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const next = document.getElementById('after-intro');
      setPastIntro(!!next && next.getBoundingClientRect().top <= 90);
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };
  }, []);

  // appear when the opening sequence gets here (or after a safety delay if the 3D scene never starts)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const e = introClock.elapsed();
      clearTimeout(timer);
      timer = setTimeout(() => setShown(true), Math.max(0, (INTRO.headerAt - Math.max(e, 0)) * 1000));
    };
    if (introClock.started) schedule();
    const off = introClock.onStart(schedule);
    const fallback = setTimeout(() => setShown(true), 9000);
    return () => {
      off();
      clearTimeout(timer);
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header
        className={`pointer-events-none fixed inset-x-0 top-4 z-50 flex items-center justify-between px-4 md:top-5 md:px-[3vw] ${shown ? 'header-in' : 'header-out'}`}
        aria-label="Site header"
      >
        <div className="flex items-center">
        {/* compact brand logo: joins the header once the 3D intro is over (the mountain word is
            the brand until then) */}
        <a
          href="#intro"
          aria-label="Chooli Digital Marketing - back to top"
          tabIndex={pastIntro ? 0 : -1}
          aria-hidden={!pastIntro}
          className="hdr-logo pointer-events-auto flex h-[44px] items-center overflow-hidden rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
          style={{
            width: pastIntro ? 52 : 0,
            marginRight: pastIntro ? 10 : 0,
            opacity: pastIntro ? 1 : 0,
            transform: pastIntro ? 'none' : 'translateX(-12px)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/chooli-logo.svg" alt="" width={52} height={44} className="h-[38px] w-[52px] shrink-0 object-contain" />
        </a>
        {/* compact menu button (left) */}
        <button
          ref={button}
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((o) => !o)}
          className={`header-menu hdr-menu group pointer-events-auto flex h-[42px] items-center gap-2.5 rounded-[10px] pl-3.5 pr-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 md:h-[44px] ${open ? 'is-open' : ''}`}
        >
          <span aria-hidden className="menu-icon">
            <span className="menu-icon-top" />
            <span className="menu-icon-bottom" />
          </span>
          <span className="font-sans text-[0.72rem] font-extrabold uppercase tracking-[0.22em]">{open ? 'Close' : 'Menu'}</span>
        </button>
        </div>

        {/* scene switch + call to action (right) */}
        <div className="header-cta pointer-events-auto flex items-center gap-3">
        <ThemeToggle />
        {/* the one primary CTA (brand board: "Talk About Your Business"; navy on orange) */}
        <a
          href={LINKS.contact}
          className="hdr-cta group inline-flex h-[42px] items-center gap-3 rounded-full pl-5 pr-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 md:h-[44px]"
        >
          <span className="font-sans text-[0.72rem] font-extrabold uppercase tracking-[0.14em]">Talk About Your Business</span>
          <span aria-hidden className="hdr-cta-badge flex h-[34px] w-[34px] items-center justify-center rounded-full md:h-[36px] md:w-[36px]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </a>
        </div>
      </header>

      <div
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        className={`fixed inset-0 z-40 bg-brand-deep/[0.97] backdrop-blur-md transition-[opacity,visibility] duration-500 ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}
      >
        <nav className="mx-auto flex h-full max-w-[1180px] flex-col justify-center px-8 pb-10 pt-32 md:px-12 md:pt-36">
          <ul className="space-y-1">
            {NAV.map((item, i) => (
              <li key={item.label} className="overflow-hidden">
                <a
                  href={item.href}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setOpen(false)}
                  style={{ transitionDelay: open ? `${120 + i * 55}ms` : '0ms' }}
                  className={`group inline-flex items-baseline gap-4 font-display text-[clamp(2.2rem,5.5vw,4.6rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-paper transition-[transform,opacity,color] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:text-brand-orange ${open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
                >
                  <span className="font-sans text-sm font-bold tracking-[0.2em] text-brand-orange">{String(i + 1).padStart(2, '0')}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={LINKS.phone}
            tabIndex={open ? 0 : -1}
            className={`mt-12 inline-flex w-fit items-center gap-3 rounded-full bg-brand-orange px-7 py-3.5 font-sans text-sm font-extrabold uppercase tracking-[0.16em] text-brand-navy transition-opacity duration-700 ${open ? 'opacity-100 delay-500' : 'opacity-0'}`}
          >
            Call now
          </a>
        </nav>
      </div>
    </>
  );
}
