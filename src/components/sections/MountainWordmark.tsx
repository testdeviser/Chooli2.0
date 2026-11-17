'use client';

import { useEffect, useRef } from 'react';

/** Mountain-filled brand statement, matching the supplied two-line reference. */
export function MountainWordmark() {
    const section = useRef<HTMLElement>(null);
  const mountain = useRef<SVGImageElement>(null);

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
    <section ref={section} aria-labelledby="mountain-wordmark-heading" className="relative z-10 bg-white">
      <h2 id="mountain-wordmark-heading" className="sr-only">Chooli Digital Marketing</h2>
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
    </section>
  );
}