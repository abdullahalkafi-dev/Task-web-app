import type { ReactNode } from "react";
import { cn } from "./cn";

/** Gradient-outlined pill (reference: due-date pill). Used for the Estimated Time. */
export function GradientPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("gradient-pill inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium text-ink-2", className)}>
      {children}
    </span>
  );
}
