import type { ReactNode } from "react";

/** White rounded bar with a 3px colored accent on the left, a title and a count badge. */
export function ColumnHeader({
  title,
  count,
  accent,
  right,
}: {
  title: string;
  count: number;
  accent: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-12 items-center gap-3 rounded-2xl bg-surface px-4 shadow-sm2">
      <span aria-hidden className="h-5 w-[3px] rounded-full" style={{ background: accent }} />
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <span className="grid h-6 min-w-6 place-items-center rounded-md bg-surface-muted px-1.5 text-xs font-medium text-ink-2">
        {count}
      </span>
      <div className="ml-auto">{right}</div>
    </div>
  );
}
