import { cn } from "./cn";

const palette = ["#F2542D", "#2563EB", "#0F8A7E", "#A855F7", "#EC4899", "#F59E0B"];

export function Avatar({ name, size = 36, className, ring }: { name: string; size?: number; className?: string; ring?: boolean }) {
  const code = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, background: palette[code % palette.length], fontSize: size * 0.4 }}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold uppercase text-white",
        ring && "ring-4 ring-white dark:ring-zinc-800",
        className,
      )}
    >
      {name.slice(0, 1) || "?"}
    </span>
  );
}
