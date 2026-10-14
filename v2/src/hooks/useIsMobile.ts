"use client";

import { useEffect, useState } from "react";

/** Below this width the layout is a phone's: Tailwind's `md` breakpoint. */
export const MOBILE_BREAKPOINT = 768;

/** True while the viewport is narrower than MOBILE_BREAKPOINT. False on the server. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
