"use client";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";

export function DesktopSignIn() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => window.dayflowDesktop?.onAuthError((message) => { setError(message); setCode(null); setBusy(false); }), []);
  const start = async () => {
    setError(null); setBusy(true);
    try { const value = await window.dayflowDesktop?.signIn(); if (value) setCode(value.code); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not open sign-in"); setBusy(false); }
  };
  return <div className="space-y-4 text-center">
    <p className="text-sm text-ink-2">Continue in your browser, then return to Dayflow.</p>
    {code ? <><p className="text-sm">Check that this code matches your browser:</p><p className="text-3xl font-bold tracking-widest" aria-live="polite">{code}</p><Button variant="soft" onClick={() => { void window.dayflowDesktop?.cancelSignIn(); setCode(null); setBusy(false); }}>Cancel sign-in</Button></> : <Button onClick={() => void start()} loading={busy}>Sign in with your browser</Button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
