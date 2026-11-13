'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_THEME, THEMES, type ThemeName } from '@/lib/animation/config';
import { applyThemeToDocument, theme } from '@/lib/animation/theme';

const OPTIONS: { name: ThemeName; icon: React.ReactNode }[] = [
  {
    name: 'morning',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      </svg>
    ),
  },
  {
    name: 'night',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill="currentColor">
        <path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11Z" />
      </svg>
    ),
  },
];

/** Morning / night switch for the 3D scene (sun and moon in a glass pill). */
export function ThemeToggle() {
  const current = useSyncExternalStore(theme.subscribe, () => theme.name, () => DEFAULT_THEME);
  useEffect(() => applyThemeToDocument(), []);
  const index = OPTIONS.findIndex((o) => o.name === current);

  return (
    <div
      role="radiogroup"
      aria-label="Scene"
      className="hdr-toggle relative flex h-[42px] items-center gap-1 rounded-full p-1 md:h-[44px]"
    >
      {/* sliding thumb */}
      <span
        aria-hidden
        className="hdr-toggle-thumb absolute top-1 h-[32px] w-[32px] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:h-[34px] md:w-[34px]"
        style={{ left: 4, transform: `translateX(calc(${index} * (100% + 4px)))` }}
      />
      {OPTIONS.map((o) => {
        const active = o.name === current;
        return (
          <button
            key={o.name}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${THEMES[o.name].label} scene`}
            title={`${THEMES[o.name].label} scene`}
            onClick={() => theme.set(o.name)}
            className={`hdr-toggle-opt relative z-[1] flex h-[32px] w-[32px] items-center justify-center rounded-full transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:h-[34px] md:w-[34px] ${
              active ? 'is-active' : ''
            }`}
          >
            {o.icon}
          </button>
        );
      })}
    </div>
  );
}
