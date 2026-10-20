"use client";

import { useEffect, useState } from "react";
import { dhakaDateKey } from "@/lib/time";

/**
 * The current Dhaka calendar day. Re-checked every 30 s and on focus/visibility, so a tab left open
 * across midnight flips to the new (empty) day by itself.
 */
export function useDhakaToday(): string {
  const [today, setToday] = useState<string>(() => dhakaDateKey());

  useEffect(() => {
    const check = (): void => setToday(dhakaDateKey());
    const id = setInterval(check, 30_000);
    const onVisible = (): void => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    check();
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
