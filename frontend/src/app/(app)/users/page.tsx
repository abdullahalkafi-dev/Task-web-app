"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, FileText, Image as ImageIcon, ListChecks, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { useAuth } from "@/hooks/useAuth";
import { useSyncOnline } from "@/hooks/useOnline";
import { api, ApiError, type UserStats } from "@/lib/api";
import { formatDhaka, relativeFromNow } from "@/lib/time";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function Count({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[64px]">
      <div className="text-[15px] font-semibold leading-tight text-ink">{value}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const { user, status } = useAuth();
  const online = useSyncOnline();
  const isAdmin = user?.role === "superadmin";
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The server enforces this too; redirecting just avoids showing a dead page.
  useEffect(() => {
    if (status === "authed" && !isAdmin) router.replace("/");
  }, [status, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin || !online) return;
    let cancelled = false;
    api
      .userStats()
      .then((s) => {
        if (!cancelled) {
          setStats(s);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load users.");
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, online]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-5 md:space-y-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink md:text-4xl">User Management</h1>
        <p className="mt-1.5 text-sm text-ink-2">Who is using Dayflow, and how much. Numbers only, never anyone’s content.</p>
      </header>

      {!online && !stats && <p className="text-sm text-ink-2">Connect to the internet to load user numbers.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {!stats && online && !error ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        stats && (
          <>
            <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatTile icon={<Users size={20} strokeWidth={1.75} />} value={stats.totals.users} label="Users" tone="neutral" />
              <StatTile icon={<CircleCheck size={20} strokeWidth={1.75} />} value={stats.totals.activeLast7d} label="Active in 7 days" tone="green" />
              <StatTile icon={<ListChecks size={20} strokeWidth={1.75} />} value={stats.totals.tasks} label="Tasks" tone="blue" />
              <StatTile icon={<FileText size={20} strokeWidth={1.75} />} value={stats.totals.notes} label="Notes" tone="gray" />
              <StatTile
                icon={<ImageIcon size={20} strokeWidth={1.75} />}
                value={stats.totals.images}
                label={`Images · ${formatBytes(stats.totals.storageBytes)}`}
                tone="orange"
              />
            </section>

            <section aria-label="Users">
              <ul className="divide-y divide-line overflow-hidden rounded-panel bg-surface shadow-sm2">
                {stats.users.map((u) => (
                  <li key={u.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4" data-testid="user-row">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={u.name || u.email} size={40} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                          <span className="truncate">{u.name || u.email}</span>
                          {u.role === "superadmin" && (
                            <span className="shrink-0 rounded-chip bg-st-s-bg px-2 py-0.5 text-[11px] font-medium text-st-s-fg">Super Admin</span>
                          )}
                        </p>
                        {u.name && <p className="truncate text-xs text-ink-2">{u.email}</p>}
                        <p className="mt-0.5 text-xs text-ink-3" title={formatDhaka(u.lastLoginAt)}>
                          Last login {relativeFromNow(u.lastLoginAt)} · {u.loginCount} {u.loginCount === 1 ? "login" : "logins"} · joined {formatDhaka(u.createdAt, "DD MMM YYYY")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 md:shrink-0">
                      <Count label="Tasks" value={u.tasks} />
                      <Count label="Notes" value={u.notes} />
                      <Count label="Images" value={u.images} />
                      <Count label="Storage" value={formatBytes(u.storageBytes)} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )
      )}
    </div>
  );
}
