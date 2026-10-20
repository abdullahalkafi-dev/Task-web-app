"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Left slide-out drawer (250ms) used for the notes sidebar on tablets. */
export function Drawer({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-y-0 left-0 w-[88vw] max-w-[340px] animate-slide-in-left bg-shell p-3 shadow-lg2"
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
}
