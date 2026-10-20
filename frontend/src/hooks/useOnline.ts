"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Browser connectivity (navigator.onLine). */
export function useSyncOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
