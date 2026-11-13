'use client';

import { useEffect, useState } from 'react';

export interface DeviceProfile {
  /** false until measured on the client */
  ready: boolean;
  reducedMotion: boolean;
  /** phones / low-power devices: lighter mountain, no shadows, lower pixel ratio */
  lite: boolean;
  webgl: boolean;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>({ ready: false, reducedMotion: false, lite: false, webgl: true });

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const small = window.matchMedia('(max-width: 820px)');
    const webgl = hasWebGL();
    const measure = () => {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
      setProfile({ ready: true, reducedMotion: motion.matches, lite: small.matches || weak, webgl });
    };
    measure();
    motion.addEventListener('change', measure);
    small.addEventListener('change', measure);
    return () => {
      motion.removeEventListener('change', measure);
      small.removeEventListener('change', measure);
    };
  }, []);

  return profile;
}
