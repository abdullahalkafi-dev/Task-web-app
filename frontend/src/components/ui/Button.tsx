import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "ai";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Black-pill style leading "+" in a small white circle (reference: "Add New"). */
  plus?: boolean;
  icon?: ReactNode;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink btn-primary-shadow hover:opacity-90",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-hover shadow-sm2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-muted",
  soft: "bg-surface-muted text-ink hover:bg-surface-hover",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ai: "bg-grad-ai text-white hover:opacity-95 shadow-md2",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", plus, icon, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full font-medium",
        "transition duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        plus && "pl-2",
        className,
      )}
      {...rest}
    >
      {plus && (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-black">
          <Plus size={16} strokeWidth={2.25} />
        </span>
      )}
      {!plus && icon}
      {loading ? "Please wait…" : children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; tone?: "plain" | "solid" }
>(function IconButton({ label, active, tone = "plain", className, children, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full transition duration-150 ease-out active:scale-95",
        active
          ? "bg-primary text-primary-ink shadow-md2"
          : tone === "solid"
            ? "bg-surface-muted text-ink hover:bg-surface-hover"
            : "text-ink-2 hover:bg-surface-muted hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
