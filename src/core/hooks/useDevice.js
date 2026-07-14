import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook untuk mendeteksi apakah sedang di mobile atau desktop.
 * Auto-update saat window di-resize.
 *
 * @returns {{ isMobile: boolean, isDesktop: boolean, width: number, height: number }}
 */
export const useDevice = () => {
  const [dims, setDims] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < MOBILE_BREAKPOINT,
    isDesktop: window.innerWidth >= MOBILE_BREAKPOINT,
  });

  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setDims({
        width: w,
        height: h,
        isMobile: w < MOBILE_BREAKPOINT,
        isDesktop: w >= MOBILE_BREAKPOINT,
      });
    };

    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);

  return dims;
};
