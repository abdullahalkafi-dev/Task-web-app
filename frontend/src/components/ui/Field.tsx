import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export const inputClass =
  "h-12 w-full rounded-input border border-transparent bg-surface-muted px-4 text-sm text-ink placeholder:text-ink-3 transition focus:border-line-strong focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue/30";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; trailing?: ReactNode }>(
  function Input({ label, hint, trailing, className, id, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <div className="space-y-1.5">
        <label htmlFor={fid} className="block text-[13px] font-medium text-ink-2">
          {label}
        </label>
        <div className="relative">
          <input ref={ref} id={fid} className={cn(inputClass, !!trailing && "pr-12", className)} {...rest} />
          {trailing && <div className="absolute inset-y-0 right-1 grid place-items-center">{trailing}</div>}
        </div>
        {hint && <p className="text-xs text-ink-3">{hint}</p>}
      </div>
    );
  },
);

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-input bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950 dark:text-red-300">
      {message}
    </p>
  );
}
