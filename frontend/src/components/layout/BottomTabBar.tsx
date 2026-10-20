"use client";

import { History, House, Plus, StickyNote, User } from "lucide-react";
import { cn } from "../ui/cn";

export type MobileTab = "today" | "notes" | "history" | "me";

function Tab({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      {children}
      {label}
    </button>
  );
}

/** Mobile bottom tab bar: Today · Notes · (+) · History · Me. Respects the safe-area inset. */
export function BottomTabBar({
  active,
  onSelect,
  onAdd,
}: {
  active: MobileTab;
  onSelect: (t: MobileTab) => void;
  onAdd: () => void;
}) {
  return (
    <nav aria-label="Primary" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
      <div className="relative mx-auto flex max-w-lg items-stretch">
        <Tab label="Today" active={active === "today"} onClick={() => onSelect("today")}>
          <House size={22} strokeWidth={1.75} />
        </Tab>
        <Tab label="Notes" active={active === "notes"} onClick={() => onSelect("notes")}>
          <StickyNote size={22} strokeWidth={1.75} />
        </Tab>
        <div className="flex w-[72px] shrink-0 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add task"
            className="btn-primary-shadow absolute -top-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-ink ring-4 ring-[var(--bg-shell)] transition active:scale-95"
          >
            <Plus size={26} strokeWidth={2} />
          </button>
        </div>
        <Tab label="History" active={active === "history"} onClick={() => onSelect("history")}>
          <History size={22} strokeWidth={1.75} />
        </Tab>
        <Tab label="Me" active={active === "me"} onClick={() => onSelect("me")}>
          <User size={22} strokeWidth={1.75} />
        </Tab>
      </div>
    </nav>
  );
}
