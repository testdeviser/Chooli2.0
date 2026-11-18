'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { LINKS } from '@/lib/animation/config';

const S = LINKS.site;

/**
 * Service labels that drop onto the wordmark, in drop order (one by one).
 * `x`: left edge, % of the section width. `lift`: how far above the top of the letters the
 * pill rests (em; 0 = on the letters, ~2.1 = on top of another pill). `r`: resting tilt (deg).
 * Titles and links are the live site's services (choolidigitalmarketing.com).
 */
const LABELS = [
  { label: 'Local SEO', href: `${S}/seo/local-seo`, x: 7, lift: 0, r: -4 },
  { label: 'Local Service Ads', href: `${S}/ppc-management/local-service-ads`, x: 67.4, lift: 0, r: 3 },
  { label: 'Google Ads', href: `${S}/ppc-management/google-ads`, x: 27.6, lift: 0, r: -3 },
  { label: 'Web Design', href: `${S}/web-development/web-design`, x: 54.9, lift: 0, r: -5 },
  { label: 'SEO', href: `${S}/seo`, x: 19.1, lift: 0, r: 7 },
  { label: 'E-Commerce', href: S, x: 83.9, lift: 0, r: 4 },
  { label: 'PPC Management', href: `${S}/ppc-management`, x: 40.1, lift: 0, r: 2 },
  { label: 'Link Building', href: `${S}/seo/link-building`, x: 11, lift: 2.1, r: -12 },
  { label: 'Meta Ads', href: `${S}/ppc-management/meta-ads`, x: 73, lift: 2.1, r: -9 },
  { label: 'Web Development', href: `${S}/web-development`, x: 45, lift: 2.15, r: 8 },
];
/** top of the CHOOLI DIGITAL letters, as a share of the wordmark's height (SVG units / 508) */
const LETTER_TOP = 52 / 508;

/** Mountain-filled brand statement, matching the supplied two-line reference. */
export function MountainWordmark() {
    const section = useRef<HTMLElement>(null);
  const mountain = useRef<SVGImageElement>(null);
  const labels = useRef<HTMLDivElement>(null);

  // labels: drop in one by one the first time the section comes into view (once only)
  useEffect(() => {
    const element = section.current;
    const box = labels.current;
    if (!element || !box) return;
    const pills = Array.from(box.querySelectorAll<HTMLElement>('[data-pill]'));
    const rest = (p: HTMLElement) => ({ y: 0, rotation: Number(p.dataset.r), opacity: 1 });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pills.forEach((p) => gsap.set(p, rest(p)));
      return;
    }
    // hidden at their resting places until the drop starts (nothing sits on the title before)
    pills.forEach((p) => gsap.set(p, { y: 0, rotation: Number(p.dataset.r), opacity: 0 }));

    let tl: gsap.core.Timeline | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        tl = gsap.timeline();
        pills.forEach((p, i) => {
          const r = Number(p.dataset.r);
          // start just above the top of the screen and fall the whole way down to the letters
          const fall = p.getBoundingClientRect().bottom + 40;
          const drop = 0.55 + Math.min(fall, 1400) / 2200; // longer way down, a little longer fall
          const at = i * 0.11;
          gsap.set(p, { y: -fall, rotation: r + (i % 2 ? 26 : -24), opacity: 0 });
          tl!
            // fade in during the first part of the fall
            .to(p, { opacity: 1, duration: drop * 0.45, ease: 'power1.out' }, at)
            // fall (accelerating), land, one small bounce; the tilt settles as it lands
            .to(p, { y: 0, duration: drop, ease: 'power2.in' }, at)
            .to(p, { rotation: r, duration: drop * 0.9, ease: 'back.out(2)' }, at + drop * 0.35)
            .to(p, { y: -14, duration: 0.16, ease: 'power2.out' }, at + drop)
            .to(p, { y: 0, duration: 0.2, ease: 'power2.in' }, at + drop + 0.16)
            .to(p, { y: -3, duration: 0.08, ease: 'power1.out' }, at + drop + 0.36)
            .to(p, { y: 0, duration: 0.1, ease: 'power1.in' }, at + drop + 0.44);
        });
      },
      // start the moment the section's top edge comes into view at the bottom of the screen
      { threshold: 0 },
    );
    io.observe(element);
    return () => {
      io.disconnect();
      tl?.kill();
    };
  }, []);

  useEffect(() => {
    const element = section.current;
    const image = mountain.current;
    if (!element || !image) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let previousTime: number | null = null;

    const animate = (time: number) => {
      // Time-based easing keeps the same gentle response on different refresh rates.
      const elapsed = previousTime === null ? 1000 / 60 : Math.min(time - previousTime, 64);
      previousTime = time;
      const blend = 1 - Math.exp(-elapsed / 110);
      x += (targetX - x) * blend;
      y += (targetY - y) * blend;
      const settled = Math.abs(targetX - x) < 0.01 && Math.abs(targetY - y) < 0.01;
      if (settled) {
        x = targetX;
        y = targetY;
      }
      // Only the photograph moves; the letter mask and its shadow remain fixed.
      image.setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)})`);
      frame = settled ? 0 : requestAnimationFrame(animate);
      if (settled) previousTime = null;
    };

    const start = () => {
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const follow = (event: PointerEvent) => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const normalizedX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
      const normalizedY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
      // SVG units: subtle travel, well within the photograph's existing margins.
      targetX = normalizedX * 18;
      targetY = normalizedY * 10;
      start();
    };
    const returnToCentre = () => {
      targetX = 0;
      targetY = 0;
      if (x || y || frame) start();
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = null;
      x = y = targetX = targetY = 0;
      image.removeAttribute('transform');
    };

    element.addEventListener('pointermove', follow, { passive: true });
    element.addEventListener('pointerleave', returnToCentre);
    element.addEventListener('pointercancel', returnToCentre);
    window.addEventListener('blur', returnToCentre);
    reducedMotion.addEventListener('change', stop);
    return () => {
      stop();
      element.removeEventListener('pointermove', follow);
      element.removeEventListener('pointerleave', returnToCentre);
      element.removeEventListener('pointercancel', returnToCentre);
      window.removeEventListener('blur', returnToCentre);
      reducedMotion.removeEventListener('change', stop);
    };
  }, []);

  return (
    <section
      ref={section}
      aria-labelledby="mountain-wordmark-heading"
      className="relative z-10 bg-white pt-[clamp(6rem,9vw,9.5rem)]"
    >
      <h2 id="mountain-wordmark-heading" className="sr-only">Chooli Digital Marketing</h2>
      <div className="relative">
      {/* service labels, resting on the top edge of the letters */}
      <div
        ref={labels}
        className="absolute inset-x-0 z-10 h-0 text-[1.2vw]"
        style={{ top: `${(LETTER_TOP * 100).toFixed(3)}%` }}
      >
        <ul aria-label="Our services">
          {LABELS.map((l) => (
            <li
              key={l.label}
              data-pill
              data-r={l.r}
              className="absolute bottom-0 origin-bottom opacity-0"
              style={{ left: `${l.x}%`, marginBottom: `${l.lift}em` }}
            >
              <a
                href={l.href}
                className="group/pill relative inline-flex items-center overflow-hidden whitespace-nowrap rounded-full border-[1.5px] border-brand-navy/70 bg-white/80 px-[1.15em] py-[0.5em] font-sans font-semibold leading-none text-brand-navy backdrop-blur-sm transition-colors duration-300 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
              >
                {/* navy fill sweeps across on hover */}
                <span
                  aria-hidden
                  className="absolute inset-0 origin-left scale-x-0 rounded-full bg-brand-navy transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover/pill:scale-x-100"
                />
                <span className="relative">{l.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 1920 508"
        className="block h-auto w-full"
      >
        <defs>
          {/* Recover definition from the existing softly washed mountain photograph.
              The source image and the preceding section stay untouched. */}
          <filter id="wordmark-mountain-colour" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope="5" intercept="-4" />
              <feFuncG type="linear" slope="5" intercept="-4" />
              <feFuncB type="linear" slope="5" intercept="-4" />
            </feComponentTransfer>
          </filter>
          <filter id="wordmark-soft-shadow" x="-10%" y="-25%" width="120%" height="150%">
            <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#243349" floodOpacity="0.12" />
          </filter>
          <clipPath id="wordmark-lettering">
            <text
              x="130" y="202" textLength="1660" lengthAdjust="spacingAndGlyphs"
              fontFamily="var(--font-inter), Arial, sans-serif" fontSize="210" fontWeight="900"
            >CHOOLI DIGITAL</text>
            <text
              x="320" y="456" textLength="1280" lengthAdjust="spacingAndGlyphs"
              fontFamily="var(--font-inter), Arial, sans-serif" fontSize="210" fontWeight="900"
            >MARKETING</text>
          </clipPath>
        </defs>
        <g filter="url(#wordmark-soft-shadow)">
          <g clipPath="url(#wordmark-lettering)">
            <image
              ref={mountain}
              href="/images/how-we-work-bg.png"
              x="0" y="-310" width="1920" height="1250"
              preserveAspectRatio="xMidYMid slice"
              filter="url(#wordmark-mountain-colour)"
            />
          </g>
        </g>
      </svg>
      </div>
    </section>
  );
}