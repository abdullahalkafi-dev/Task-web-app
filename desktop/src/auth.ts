import { createHash, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { shell } from "electron";
import type { DesktopSession } from "../../frontend/src/lib/desktop-contract";

let active: AbortController | null = null;
export function cancelSignIn(): void { active?.abort(); active = null; }
export async function startSignIn(origin: string, complete: (session: DesktopSession) => void, error: (message: string) => void): Promise<{ code: string }> {
  cancelSignIn();
  const controller = new AbortController();
  active = controller;
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(300_000)]);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const response = await fetch(`${origin}/api/auth/desktop/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge }), signal });
  if (!response.ok) throw new Error("Desktop sign-in is unavailable. Check your connection and that the server has the desktop update.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("requestId" in data) || !("code" in data) || typeof data.requestId !== "string" || typeof data.code !== "string" || !/^[a-f0-9]{48}$/.test(data.requestId)) throw new Error("Invalid sign-in response");
  const { requestId, code } = data;
  await shell.openExternal(`${origin}/desktop/connect?request=${requestId}`);
  void (async () => {
    try {
      while (!signal.aborted) {
        await delay(2000, undefined, { signal });
        const result = await fetch(`${origin}/api/auth/desktop/exchange`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, verifier }), signal });
        if (result.status === 202) continue;
        if (!result.ok) throw new Error("Sign-in expired or was cancelled. Please try again.");
        const session = await result.json() as DesktopSession;
        if (!session.token || !session.user?.id || !session.user.email || !["user", "superadmin"].includes(session.user.role)) throw new Error("Invalid session response");
        if (!signal.aborted) complete(session);
        return;
      }
    } catch (e) {
      if (!controller.signal.aborted) error(e instanceof Error && !signal.aborted ? e.message : "Sign-in timed out. Please try again.");
    } finally { if (active === controller) active = null; }
  })();
  return { code };
}
