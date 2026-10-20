"use client";

import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useData } from "@/hooks/useData";
import { cn } from "../ui/cn";

const styles = {
  synced: { pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-emerald-500" },
  syncing: { pill: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300", dot: "bg-amber-500 animate-pulse" },
  offline: { pill: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", dot: "bg-zinc-400" },
  error: { pill: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300", dot: "bg-red-500" },
} as const;

/** "Live"-style status pill: green Synced / amber Syncing… / gray Offline · N pending / red error. */
export function SyncPill({ dotOnly }: { dotOnly?: boolean }) {
  const { state, pendingCount } = useSyncStatus();
  const { engine } = useData();
  const s = styles[state];
  const text =
    state === "synced"
      ? "Synced"
      : state === "syncing"
        ? "Syncing…"
        : state === "offline"
          ? `Offline${pendingCount > 0 ? ` · ${pendingCount} pending` : ""}`
          : pendingCount > 0
            ? `Sync error · ${pendingCount} pending`
            : "Sync error";
  return (
    <button
      type="button"
      onClick={() => engine.trigger()}
      title="Sync now"
      aria-live="polite"
      aria-label={`Sync status: ${text}`}
      data-testid="sync-pill"
      data-state={state}
      className={cn("inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition", s.pill, dotOnly && "px-2.5")}
    >
      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
      <span className={cn(dotOnly && "sr-only")}>{text}</span>
    </button>
  );
}
