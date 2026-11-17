'use client';

import { useEffect, useRef, useState } from 'react';
import { INTRO, LINKS } from '@/lib/animation/config';
import { introClock } from '@/lib/animation/introClock';
import { ThemeToggle } from './ThemeToggle';

interface NavLink {
  label: string;
  href: string;
}
interface NavGroup extends NavLink {
  children?: NavLink[];
}
interface NavItem extends NavLink {
  /** submenu: groups (Services) or a flat list of links (Location) */
  groups?: NavGroup[];
}

const S = LINKS.site;

/** small line icons for submenu rows: one per service, a pin for locations (24 x 24) */
const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ROW_ICONS: Record<string, React.ReactNode> = {
  SEO: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  ),
  'PPC Management': (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M3.5 9.5h4l9-5v15l-9-5h-4z" />
      <path d="M7.5 9.5v5M5.8 14.5l1.4 5h2.4l-1-5" />
    </svg>
  ),
  'Web Development': (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="m8.5 5.5-6 6.5 6 6.5M15.5 5.5l6 6.5-6 6.5" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M12 21s7-5.6 7-11.2a7 7 0 0 0-14 0C5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </svg>
  ),
};

/** same structure as the live site's main menu (choolidigitalmarketing.com) */
const NAV: NavItem[] = [
  { label: 'Home', href: '#intro' },
  {
    label: 'Services',
    href: LINKS.seo,
    groups: [
      {
        label: 'SEO',
        href: `${S}/seo`,
        children: [
          { label: 'Local SEO', href: `${S}/seo/local-seo` },
          { label: 'Link Building', href: `${S}/seo/link-building` },
        ],
      },
      {
        label: 'PPC Management',
        href: `${S}/ppc-management`,
        children: [
          { label: 'Google Ads Management', href: `${S}/ppc-management/google-ads` },
          { label: 'Local Service Ads', href: `${S}/ppc-management/local-service-ads` },
          { label: 'Meta Ads Management', href: `${S}/ppc-management/meta-ads` },
        ],
      },
      {
        label: 'Web Development',
        href: `${S}/web-development`,
        children: [{ label: 'Web Design', href: `${S}/web-development/web-design` }],
      },
    ],
  },
  {
    label: 'Location',
    href: LINKS.locations,
    groups: [
      { label: 'New Albany, IN', href: `${S}/locations/new-albany-in-digital-marketing` },
      { label: 'Clarksville, IN', href: `${S}/locations/clarksville-in-digital-marketing` },
      { label: 'Jeffersonville, IN', href: `${S}/locations/jeffersonville-in-digital-marketing` },
      { label: 'Sellersburg, IN', href: `${S}/locations/sellersburg-in-digital-marketing` },
      { label: 'Louisville, KY', href: `${S}/locations/louisville-ky-digital-marketing` },
    ],
  },
  { label: 'Industries', href: LINKS.industries },
  { label: 'Blog', href: LINKS.blog },
  { label: 'About', href: LINKS.about },
  { label: 'Contact Us', href: LINKS.contact },
  { label: 'Giving Back', href: LINKS.givingBack },
];

/**
 * Floating header: a compact orange MENU button on the left; a morning / night scene switch
 * and a "Let's Talk" call to action on the right. Both slide in once the opening sequence reaches them; the menu
 * button opens a full-screen navigation panel.
 */
export function FloatingHeader() {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  /** main item whose submenu is shown on the right (hover / focus / click) */
  const [active, setActive] = useState<string | null>(null);
  const submenuOpen = NAV.some((n) => n.groups && n.label === active);
  /** the brand card fills the right side whenever no submenu is open */
  const brandShown = open && !submenuOpen;
  /**
   * Hover intent: while a submenu is open, pointing at another main item only switches after a
   * short pause, and reaching the submenu cancels the switch. So the pointer can travel
   * diagonally from "Services" to its sub-pages across other items without the submenu closing.
   */
  const switchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hoverItem = (label: string | null) => {
    clearTimeout(switchTimer.current);
    if (label === active) return;
    if (submenuOpen) switchTimer.current = setTimeout(() => setActive(label), 320);
    else setActive(label);
  };
  const keepSubmenu = () => clearTimeout(switchTimer.current);
  useEffect(() => {
    if (!open) {
      clearTimeout(switchTimer.current);
      setActive(null);
    }
  }, [open]);
  useEffect(() => () => clearTimeout(switchTimer.current), []);
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
        {/* clicking anywhere that is not a link or the submenu closes the menu */}
        <div
          className="h-full"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('a, button, [data-submenu]')) setOpen(false);
          }}
        >
        <nav className="mx-auto flex h-full max-w-[1240px] items-center px-12 pb-10 pt-28">
          <div className="grid w-full grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-stretch gap-16">
          <div>
            <ul className="space-y-0.5">
              {NAV.map((item, i) => {
                const has = !!item.groups;
                const isActive = active === item.label;
                return (
                  <li
                    key={item.label}
                    className="overflow-hidden"
                    onMouseEnter={() => hoverItem(has ? item.label : null)}
                  >
                    <a
                      href={item.href}
                      tabIndex={open ? 0 : -1}
                      aria-haspopup={has || undefined}
                      aria-expanded={has ? isActive : undefined}
                      onFocus={() => {
                        keepSubmenu();
                        setActive(has ? item.label : null);
                      }}
                      onClick={(e) => {
                        // a parent opens its submenu first (keyboard / touch); a second click follows the link
                        if (has && !isActive) {
                          e.preventDefault();
                          setActive(item.label);
                          return;
                        }
                        setOpen(false);
                      }}
                      style={{ transitionDelay: open ? `${120 + i * 45}ms` : '0ms' }}
                      className={`group flex w-full items-baseline gap-4 font-display text-[clamp(1.7rem,3.2vw,3.1rem)] font-extrabold leading-[1.14] tracking-[-0.02em] transition-[transform,opacity,color] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:text-brand-orange ${isActive ? 'text-brand-orange' : 'text-paper'} ${open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
                    >
                      <span className="w-6 font-sans text-xs font-bold tracking-[0.2em] text-brand-orange">{String(i + 1).padStart(2, '0')}</span>
                      {item.label}
                      {has && (
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className={`ml-auto h-[0.5em] w-[0.5em] shrink-0 self-center transition-transform duration-300 ${isActive ? 'translate-x-1 text-brand-orange' : 'text-paper/50'}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 5 7 7-7 7" />
                        </svg>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
            <a
              href={LINKS.phone}
              tabIndex={open ? 0 : -1}
              className={`mt-10 inline-flex w-fit items-center gap-3 rounded-full bg-brand-orange px-7 py-3.5 font-sans text-sm font-extrabold uppercase tracking-[0.16em] text-brand-navy transition-opacity duration-700 ${open ? 'opacity-100 delay-500' : 'opacity-0'}`}
            >
              Call now
            </a>
          </div>

          {/* submenu of the active item. The divider runs the full height of the main list,
              whether or not a submenu is open; the submenu is centred beside it. */}
          <div
            className={`relative border-l transition-colors duration-500 ${submenuOpen ? 'border-white/15' : 'border-transparent'}`}
          >
            {/* default (no submenu open): a brand card - the logo, centred, and the contact details
                from the live site (choolidigitalmarketing.com) */}
            <div
              data-submenu
              aria-hidden={!brandShown}
              className={`absolute inset-0 flex items-center justify-center pl-6 transition-[opacity,transform,visibility] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${brandShown ? 'visible translate-y-0 opacity-100 delay-300' : 'invisible translate-y-3 opacity-0'}`}
            >
              <div className="glass-panel relative w-full max-w-[30rem] overflow-hidden rounded-[28px] px-10 pb-9 pt-10">
                {/* soft brand glow in the corner */}
                <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(245,134,42,0.22),rgba(245,134,42,0)_65%)]" />

                {/* the logo, centred and large */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/chooli-logo.svg" alt="Chooli Digital Marketing" width={168} height={166} className="relative mx-auto h-auto w-[min(15rem,20vw)] drop-shadow-[0_16px_36px_rgba(4,26,53,0.55)]" />

                <ul className="relative mx-auto mt-8 w-fit space-y-3 border-t border-white/10 pt-7 font-sans text-[1rem] text-paper/85">
                  <li>
                    <a href={LINKS.phone} tabIndex={brandShown ? 0 : -1} className="inline-flex items-center gap-3 transition-colors hover:text-brand-orange">
                      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-brand-orange/15 text-brand-orange">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                        </svg>
                      </span>
                      812-987-7007
                    </a>
                  </li>
                  <li>
                    <a href={LINKS.email} tabIndex={brandShown ? 0 : -1} className="inline-flex items-center gap-3 transition-colors hover:text-brand-orange">
                      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-brand-orange/15 text-brand-orange">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="m3 7 9 6 9-6" />
                        </svg>
                      </span>
                      support@choolidigitalmarketing.com
                    </a>
                  </li>
                  <li className="inline-flex items-center gap-3">
                    <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-brand-orange/15 text-brand-orange">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 21s7-5.6 7-11.2a7 7 0 0 0-14 0C5 15.4 12 21 12 21Z" />
                        <circle cx="12" cy="9.8" r="2.4" />
                      </svg>
                    </span>
                    Rooted in Southern Indiana. Not limited by it.
                  </li>
                </ul>
              </div>
            </div>
            {NAV.filter((item) => item.groups).map((item) => {
              const shown = open && active === item.label;
              return (
                <div
                  key={item.label}
                  data-submenu
                  aria-hidden={!shown}
                  onMouseEnter={keepSubmenu}
                  className={`absolute inset-0 flex flex-col justify-center pl-14 transition-[opacity,transform,visibility] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${shown ? 'visible translate-x-0 opacity-100' : 'invisible translate-x-4 opacity-0'}`}
                >
                  <a
                    href={item.href}
                    tabIndex={shown ? 0 : -1}
                    onClick={() => setOpen(false)}
                    className="mb-5 inline-flex w-fit items-center gap-2 font-sans text-xs font-extrabold uppercase tracking-[0.22em] text-brand-orange transition-colors hover:text-paper"
                  >
                    {item.label === 'Location' ? 'All locations' : item.label}
                    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </a>
                  {/* one row per entry (same style for Services and Location): orange icon, name,
                      arrow. A service's own pages follow it as smaller, indented rows. */}
                  <ul className="border-t border-white/10">
                    {item.groups!.map((g) => (
                      <li key={g.label} className="border-b border-white/10">
                        <a
                          href={g.href}
                          tabIndex={shown ? 0 : -1}
                          onClick={() => setOpen(false)}
                          className="group/row flex items-center gap-3 py-3.5 font-display text-[1.15rem] font-bold text-paper transition-colors hover:text-brand-orange"
                        >
                          <span aria-hidden className="text-brand-orange [&>svg]:h-4 [&>svg]:w-4">
                            {ROW_ICONS[g.label] ?? ROW_ICONS.pin}
                          </span>
                          {g.label}
                          <svg aria-hidden viewBox="0 0 24 24" className="ml-auto h-4 w-4 text-paper/40 transition-transform duration-300 group-hover/row:translate-x-1 group-hover/row:text-brand-orange" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </a>
                        {g.children && (
                          <ul className="-mt-1 pb-2.5 pl-7">
                            {g.children.map((c) => (
                              <li key={c.label}>
                                <a
                                  href={c.href}
                                  tabIndex={shown ? 0 : -1}
                                  onClick={() => setOpen(false)}
                                  className="group/sub flex items-center gap-3 py-1.5 font-sans text-[0.95rem] text-paper/70 transition-colors hover:text-brand-orange"
                                >
                                  <span aria-hidden className="h-px w-3 bg-white/25 transition-colors group-hover/sub:bg-brand-orange" />
                                  {c.label}
                                  <svg aria-hidden viewBox="0 0 24 24" className="ml-auto h-3.5 w-3.5 text-paper/30 transition-transform duration-300 group-hover/sub:translate-x-1 group-hover/sub:text-brand-orange" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M13 6l6 6-6 6" />
                                  </svg>
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          </div>
        </nav>
        </div>
      </div>
    </>
  );
}
