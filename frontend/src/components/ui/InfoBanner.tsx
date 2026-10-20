import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "./cn";

/** White strip with a gradient icon tile, bold lead + text and a light pill action. */
export function InfoBanner({
  title,
  children,
  action,
  icon,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-3 rounded-[20px] bg-surface p-3 pr-3 shadow-sm2 sm:flex-nowrap", className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-white">
        {icon ?? <Sparkles size={18} strokeWidth={1.75} />}
      </span>
      <p className="min-w-0 flex-1 text-sm text-ink-2">
        <strong className="font-semibold text-ink">{title}</strong> {children}
      </p>
      {action}
    </div>
  );
}
