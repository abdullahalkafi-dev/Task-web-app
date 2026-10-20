import { cn } from "../ui/cn";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-[10px] bg-accent-orange text-white shadow-sm2"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h10a4 4 0 0 1 0 8H8" />
        <path d="m11 12-3 3 3 3" />
        <path d="M18 5v2" />
      </svg>
    </span>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && <span className="text-[17px] font-semibold tracking-tight text-ink">Dayflow</span>}
    </span>
  );
}
