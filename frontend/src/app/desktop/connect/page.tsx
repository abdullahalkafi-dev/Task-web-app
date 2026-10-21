"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

function Connect() {
  const params = useSearchParams();
  const requestId = params.get("request") ?? "";
  const { status, user, expired } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!/^[a-f0-9]{48}$/.test(requestId)) { setError("Invalid desktop sign-in link. Start again from the desktop app."); return; }
    if (status !== "authed" || expired) return;
    let active = true;
    void api.desktopRequest(requestId).then((value) => { if (active) setCode(value.code); }).catch(() => { if (active) setError("This request expired or was already approved. Start again from the desktop app."); });
    return () => { active = false; };
  }, [requestId, status, expired]);
  const approve = async () => {
    if (!code) return;
    setBusy(true);
    try { await api.approveDesktop(requestId, code); setDone(true); }
    catch { setError("Could not approve this request. Please start again from the desktop app."); }
    finally { setBusy(false); }
  };
  const login = `/login?desktopRequest=${encodeURIComponent(requestId)}`;
  return <main id="main" className="grid min-h-dvh place-items-center bg-canvas p-6"><div className="w-full max-w-md space-y-5 rounded-panel bg-surface p-8 shadow-lg2">
    <h1 className="text-2xl font-bold">Connect Dayflow desktop</h1>
    {done ? <p role="status">You’re connected. Return to the desktop app. You can close this tab.</p> : <>
      <p className="text-sm text-ink-2">Approve only if you just started sign-in from Dayflow on your computer.</p>
      {status !== "loading" && (status !== "authed" || expired) && <a className="inline-block rounded-full bg-ink px-5 py-3 text-surface" href={login}>Sign in with Google</a>}
      {user && !expired && <><p>Continue as <strong>{user.email}</strong></p>{code && <><p>Does this code match your desktop app?</p><p className="text-3xl font-bold tracking-widest">{code}</p><Button loading={busy} onClick={() => void approve()}>Codes match — connect desktop</Button></>}</>}
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div></main>;
}
export default function ConnectPage() { return <Suspense><Connect /></Suspense>; }
