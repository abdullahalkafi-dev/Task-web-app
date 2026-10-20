"use client";

import { useSyncExternalStore } from "react";
import type { SyncSnapshot } from "@/lib/sync";
import { useData } from "./useData";

export function useSyncStatus(): SyncSnapshot {
  const { engine } = useData();
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
