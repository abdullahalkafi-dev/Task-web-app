"use client";

import { useAuth } from "@/hooks/useAuth";
import { displayName } from "@/lib/types";
import { Avatar } from "../ui/Avatar";
import { DatePill } from "./DatePill";
import { SyncPill } from "./SyncPill";

/** Top of the notes sidebar (replaces the old logo slot): sync status, Dhaka date and the user. */
export function SidebarHeader() {
  const { user } = useAuth();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SyncPill />
      <DatePill compact />
      <span className="ml-auto">
        <Avatar name={displayName(user) || "?"} size={36} />
      </span>
    </div>
  );
}
