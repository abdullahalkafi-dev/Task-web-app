"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** Segmented control: muted container, the active tab is a white pill with a soft shadow. */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  accentActive,
}: {
  /** Orange label on the active tab (task editor status control). */
  accentActive?: boolean;
  options: TabOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex items-center gap-1 rounded-full bg-surface-muted p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition duration-150 ease-out",
              active ? cn("bg-surface shadow-sm2", accentActive ? "text-orange-700 dark:text-orange-300" : "text-ink") : "text-ink-2 hover:text-ink",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
