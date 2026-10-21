"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/layout/Logo";
import { FormError } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useSyncOnline } from "@/hooks/useOnline";
import { api, ApiError } from "@/lib/api";
import { useDesktop } from "@/hooks/useDesktop";
import { DesktopSignIn } from "@/components/desktop/DesktopSignIn";

const GSI_SRC = "https://accounts.google.com/gsi/client";

interface GoogleId {
  initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup" }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** Loads Google Identity Services once; resolves when `window.google.accounts.id` is ready. */
function loadGsi(): Promise<GoogleId> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts.id) return resolve(window.google.accounts.id);
    const done = (): void => {
      const id = window.google?.accounts.id;
      if (id) resolve(id);
      else reject(new Error("Google script unavailable"));
    };
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => reject(new Error("Google script failed to load")), { once: true });
  });
}

export default function LoginPage() {
  const router = useRouter();
  const { status, loginWithGoogle, expired } = useAuth();
  const desktop = useDesktop();
  const destination = (): string => {
    const id = new URLSearchParams(window.location.search).get("desktopRequest");
    return id && /^[a-f0-9]{48}$/.test(id) ? `/desktop/connect?request=${id}` : "/";
  };
  const online = useSyncOnline();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in with a valid session -> straight to the app.
  useEffect(() => {
    if (status === "authed" && !expired) router.replace(destination());
  }, [status, expired, router]);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    api
      .config()
      .then((c) => {
        if (!cancelled) setClientId(c.googleClientId);
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the server. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [online]);

  useEffect(() => {
    if (window.dayflowDesktop || desktop || !clientId || !buttonRef.current) return;
    let cancelled = false;
    const el = buttonRef.current;
    loadGsi()
      .then((gid) => {
        if (cancelled) return;
        gid.initialize({
          client_id: clientId,
          callback: (r) => {
            setError(null);
            setBusy(true);
            loginWithGoogle(r.credential)
              .then(() => router.replace(destination()))
              .catch((err: unknown) => {
                if (err instanceof ApiError && err.status === 0) setError("Connect to the internet to sign in.");
                else if (err instanceof ApiError && err.status === 429) setError("Too many attempts. Please wait a minute and try again.");
                else setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
              })
              .finally(() => setBusy(false));
          },
        });
        gid.renderButton(el, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 320 });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Google sign-in. Check your connection and refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, loginWithGoogle, router, desktop]);

  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden bg-canvas px-4 py-10">
      <div aria-hidden className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-grad-profile opacity-60 blur-[90px]" />
      <div className="relative w-full max-w-[420px] rounded-panel bg-surface p-7 shadow-lg2 sm:p-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark size={48} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Dayflow</h1>
          <p className="mt-1 text-sm text-ink-2">Calm daily tasks &amp; notes.</p>
        </div>

        <div className="space-y-4">
          {!online && status !== "authed" && <p className="text-center text-[13px] text-ink-2">Connect to the internet to sign in.</p>}
          {expired && <p className="text-center text-[13px] text-ink-2">Your session expired. Sign in again. Your offline changes are kept.</p>}
          {clientId === null && <FormError message="Google sign-in is not set up on this server yet." />}
          {desktop ? <DesktopSignIn /> : clientId && (
            <div className="grid min-h-11 place-items-center" aria-busy={busy}>
              {!ready && <Skeleton className="h-11 w-[320px] max-w-full rounded-full" />}
              <div ref={buttonRef} className={busy ? "pointer-events-none opacity-60" : undefined} />
            </div>
          )}
          <FormError message={error} />
        </div>
        <p className="mt-6 text-center text-xs text-ink-3">Sign in with your Google account. We only see your name and email.</p>
      </div>
    </main>
  );
}
