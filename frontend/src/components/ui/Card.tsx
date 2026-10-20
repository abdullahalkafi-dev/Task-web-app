import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({
  tone = "white",
  interactive,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: "white" | "muted"; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card shadow-sm2",
        tone === "white" ? "bg-surface" : "bg-surface-muted",
        interactive && "cursor-pointer transition duration-200 ease-out hover:-translate-y-px hover:shadow-md2",
        className,
      )}
      {...rest}
    />
  );
}

/** Large white rounded panel (sidebar, top bar, columns). */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-panel bg-surface shadow-sm2", className)} {...rest} />;
}
