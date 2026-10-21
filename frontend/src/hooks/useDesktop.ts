"use client";
import { useEffect, useState } from "react";
import type { DesktopState } from "@/lib/desktop-contract";
import { flushLocalWrites } from "@/lib/local-save";

export function useDesktop(): DesktopState | null {
  const [state, setState] = useState<DesktopState | null>(null);
  useEffect(() => {
    const bridge = window.dayflowDesktop;
    if (!bridge) return;
    let active = true;
    void bridge.getState().then((value) => { if (active) setState(value); }).catch(() => undefined);
    const unsubscribe = bridge.onState(setState);
    return () => { active = false; unsubscribe(); };
  }, []);
  return state;
}

/** Mounted once at the root, including sign-in and connection screens. */
export function useDesktopLifecycle(): void {
  useEffect(() => {
    const bridge = window.dayflowDesktop;
    if (!bridge) return;
    const unsubscribe = bridge.onFlush(flushLocalWrites);
    void bridge.getState().catch(() => undefined);
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('[role="dialog"], [role="menu"]')) return;
      void bridge.collapse().catch(() => undefined);
    };
    window.addEventListener("keydown", escape);
    return () => { unsubscribe(); window.removeEventListener("keydown", escape); };
  }, []);
}
