"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind breakpoints used across the app. */
export const useIsMobile = (): boolean => useMediaQuery("(max-width: 767px)");
export const useIsDesktop = (): boolean => useMediaQuery("(min-width: 1024px)");
