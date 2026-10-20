"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const KEY = "dayflow-theme";

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

const listeners = new Set<() => void>();

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0E0E10" : "#EEEEEE");
}

export function useTheme(): { theme: Theme; toggle: () => void; set: (t: Theme) => void } {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "light" as Theme,
  );
  const set = useCallback((t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* private mode */
    }
    applyTheme(t);
    listeners.forEach((l) => l());
  }, []);
  const toggle = useCallback(() => set(read() === "dark" ? "light" : "dark"), [set]);
  return { theme, toggle, set };
}

/** Inline script run before first paint to avoid a theme flash. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}`;
