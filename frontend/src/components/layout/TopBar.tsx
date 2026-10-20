"use client";

import { StickyNote } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { displayName } from "@/lib/types";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/Button";
import { DatePill } from "./DatePill";
import { LogoMark } from "./Logo";
import { SyncPill } from "./SyncPill";

/** Slim header shown below 1024px only (the sidebar is a drawer there). */
export function TopBar({ onOpenNotes }: { onOpenNotes: () => void }) {
  const { user } = useAuth();
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 rounded-panel bg-surface px-3 shadow-sm2 md:px-4">
      <div className="flex items-center gap-2 md:hidden">
        <LogoMark size={30} />
      </div>

      <IconButton label="Open notes" tone="solid" onClick={onOpenNotes} className="hidden md:grid">
        <StickyNote size={20} strokeWidth={1.75} />
      </IconButton>

      <div className="ml-auto flex items-center gap-2">
        <span className="md:hidden">
          <SyncPill dotOnly />
        </span>
        <span className="hidden md:inline">
          <SyncPill />
        </span>
        <DatePill />
        <span className="hidden md:inline">
          <Avatar name={displayName(user) || "?"} size={36} />
        </span>
      </div>
    </header>
  );
}
