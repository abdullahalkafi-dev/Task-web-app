"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "./cn";

export interface MenuItem {
  id?: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  active?: boolean;
}

/** Portal-based dropdown so it is never clipped by scrolling columns or rounded cards. */
export function Menu({
  trigger,
  items,
  align = "right",
  label,
  selection = false,
}: {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    ref: React.RefObject<HTMLButtonElement | null>;
  }) => ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  label: string;
  /** A single-choice menu, with checked state and a consistent selection indicator. */
  selection?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left?: number;
    right?: number;
  }>({ top: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const height = Math.min(items.length * 44 + 12, window.innerHeight * 0.7);
    // Measure without the opening animation's scale so viewport margins stay exact.
    const width = popRef.current?.offsetWidth ?? 168;
    const top = Math.max(
      8,
      Math.min(r.bottom + 6, window.innerHeight - height - 8),
    );
    setPos(
      align === "right"
        ? { top, right: Math.max(8, window.innerWidth - r.right) }
        : {
            top,
            left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
          },
    );
  }, [align, items.length]);

  useLayoutEffect(() => {
    if (open) {
      place();
      const selected = selection
        ? popRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
        : null;
      (
        selected ??
        popRef.current?.querySelector<HTMLElement>(
          '[role="menuitem"], [role="menuitemradio"]',
        )
      )?.focus();
    }
  }, [open, place, selection]);

  useEffect(() => {
    const button = btnRef.current;
    if (!button) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
      }
    };
    button.addEventListener("keydown", onKey);
    return () => button.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    const onDown = (e: PointerEvent): void => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    // Follow the trigger when something scrolls; close only if it scrolled out of view.
    const reposition = (): void => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) close();
      else place();
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, place]);

  return (
    <>
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: btnRef })}
      {open &&
        createPortal(
          <div
            ref={popRef}
            role="menu"
            aria-label={label}
            onKeyDown={(event) => {
              const options = Array.from(
                popRef.current?.querySelectorAll<HTMLElement>(
                  '[role="menuitem"], [role="menuitemradio"]',
                ) ?? [],
              );
              const index = options.indexOf(
                document.activeElement as HTMLElement,
              );
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? options.length - 1
                      : (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          options.length) %
                        options.length;
                options[next]?.focus();
              } else if (event.key === "Tab") {
                setOpen(false);
                btnRef.current?.focus();
              }
            }}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              right: pos.right,
            }}
            className={cn(
              "z-[80] max-h-[70dvh] min-w-[168px] max-w-[calc(100vw-16px)] overflow-y-auto animate-pop-in rounded-2xl border border-line bg-surface p-1.5 shadow-lg2",
              selection && "w-60",
            )}
          >
            {items.map((it) => (
              <button
                key={it.id ?? it.label}
                role={selection ? "menuitemradio" : "menuitem"}
                aria-checked={selection ? !!it.active : undefined}
                title={selection ? it.label : undefined}
                type="button"
                onClick={() => {
                  setOpen(false);
                  btnRef.current?.focus();
                  it.onSelect();
                }}
                className={cn(
                  "flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition hover:bg-surface-muted",
                  it.danger ? "text-red-600" : "text-ink",
                  it.active && "font-semibold",
                  selection && "text-[13px]",
                  selection && it.active && "bg-surface-muted",
                )}
              >
                {it.icon && <span className="shrink-0">{it.icon}</span>}
                <span className={cn(selection && "min-w-0 flex-1 truncate")}>
                  {it.label}
                </span>
                {selection && it.active && (
                  <Check
                    size={15}
                    strokeWidth={1.75}
                    className="ml-auto shrink-0 text-ink-2"
                    aria-hidden
                  />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
