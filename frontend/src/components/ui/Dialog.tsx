"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { IconButton } from "./Button";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

/**
 * Responsive dialog: centered card on desktop, full-screen bottom sheet on mobile.
 * Esc closes, focus is trapped and restored, body scroll is locked.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-[720px]",
  hideTitle,
  headerContent,
  dismissOnBackdrop = true,
}: {
  /** Visual header (e.g. chips); `title` stays as the accessible name. */
  headerContent?: ReactNode;
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  hideTitle?: boolean;
  dismissOnBackdrop?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const a = items[0];
      const b = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={dismissOnBackdrop ? onClose : undefined} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[100dvh] w-full flex-col bg-surface shadow-lg2",
          "h-[100dvh] animate-slide-in-up rounded-none md:h-auto md:max-h-[88dvh] md:animate-pop-in md:rounded-panel",
          maxWidth,
        )}
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-4 md:px-6 md:pt-5">
          {headerContent && <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{headerContent}</div>}
          <h2 id={titleId} className={cn("flex-1 truncate text-lg font-semibold text-ink", (hideTitle || !!headerContent) && "sr-only")}>
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={20} strokeWidth={1.75} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 md:px-6">{children}</div>
        {footer && (
          <div className="safe-bottom flex items-center justify-end gap-2 border-t border-line px-5 py-3 md:px-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
