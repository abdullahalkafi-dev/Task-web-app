import type { ReactNode } from "react";
import { cn } from "./cn";

const tones = {
  neutral: "bg-surface-muted text-ink",
  gray: "bg-st-ns-bg text-st-ns-fg",
  blue: "bg-st-s-bg text-st-s-fg",
  green: "bg-st-c-bg text-st-c-fg",
  orange: "bg-orange-100 text-orange-600",
} as const;

/** Small white tile: pastel icon circle, bold number, muted label. Read-only summary, not a filter. */
export function StatTile({
  icon,
  value,
  label,
  tone = "neutral",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: keyof typeof tones;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface p-3.5 shadow-sm2">
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", tones[tone])}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold leading-tight text-ink">{value}</div>
        <div className="truncate text-xs text-ink-3">{label}</div>
      </div>
    </div>
  );
}
