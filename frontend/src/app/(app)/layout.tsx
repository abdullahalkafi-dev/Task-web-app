"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { DataProvider } from "@/hooks/useData";

function ShellSkeleton() {
  return (
    <div className="min-h-dvh p-4 md:p-6" aria-busy="true">
      <Skeleton className="mx-auto h-[80dvh] max-w-[1840px] rounded-shell" />
    </div>
  );
}

/** Route guard: anonymous visitors go to /login; the cached session opens offline. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  if (status !== "authed" || !user) return <ShellSkeleton />;
  return (
    <DataProvider userId={user.id}>
      <Suspense fallback={<ShellSkeleton />}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </DataProvider>
  );
}
