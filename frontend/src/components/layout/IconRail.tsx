"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, History, House, LogOut, Moon, Sun, Users } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { IconButton } from "../ui/Button";
import { cn } from "../ui/cn";

function RailGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col items-center gap-1.5 rounded-full bg-surface p-1.5 shadow-sm2", className)}>{children}</div>;
}

function NavLink({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full transition duration-150 ease-out active:scale-95",
        active ? "bg-primary text-primary-ink shadow-md2" : "text-ink-2 hover:bg-surface-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

/** Reference rail: separate white pill groups — theme (top), navigation (middle), help/logout (bottom). */
export function IconRail({
  isAdmin,
  onHelp,
  onLogout,
}: {
  isAdmin: boolean;
  onHelp: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { theme, set } = useTheme();
  return (
    <nav aria-label="Main" className="hidden w-16 shrink-0 flex-col items-center justify-between md:flex">
      <RailGroup>
        <IconButton label="Light theme" active={theme === "light"} onClick={() => set("light")}>
          <Sun size={20} strokeWidth={1.75} />
        </IconButton>
        <IconButton label="Dark theme" active={theme === "dark"} onClick={() => set("dark")}>
          <Moon size={20} strokeWidth={1.75} />
        </IconButton>
      </RailGroup>

      <RailGroup>
        <NavLink href="/" label="Home" active={pathname === "/"}>
          <House size={20} strokeWidth={1.75} />
        </NavLink>
        <NavLink href="/history" label="History" active={pathname.startsWith("/history")}>
          <History size={20} strokeWidth={1.75} />
        </NavLink>
        {isAdmin && (
          <NavLink href="/users" label="User management" active={pathname.startsWith("/users")}>
            <Users size={20} strokeWidth={1.75} />
          </NavLink>
        )}
      </RailGroup>

      <RailGroup>
        <IconButton label="Help" onClick={onHelp}>
          <CircleHelp size={20} strokeWidth={1.75} />
        </IconButton>
        <IconButton label="Log out" onClick={onLogout}>
          <LogOut size={20} strokeWidth={1.75} />
        </IconButton>
      </RailGroup>
    </nav>
  );
}
