import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { verifyToken } from "../auth/auth.service";
import { ApiKeyModel } from "../apikey/apikey.model";

// Current deployment has one backend process. Multi-instance hosting needs shared pub/sub.
const events = new EventEmitter();
events.setMaxListeners(0);
export function notifyUser(userId: string): void { events.emit(userId); }
export function subscribeUser(userId: string, callback: () => void): () => void {
  events.on(userId, callback);
  return () => { events.off(userId, callback); };
}
export function streamChanges(req: Request, res: Response): void {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", Connection: "keep-alive" });
  res.flushHeaders();
  const send = (): void => { res.write("event: change\ndata: {}\n\n"); };
  const unsubscribe = subscribeUser(req.user.id, send);
  send(); // Reconnect always triggers a pull, so missed events are harmless.
  const bearer = req.headers.authorization?.slice(7).trim();
  const keyId = req.apiKey?.id;
  const heartbeat = setInterval(() => {
    if (keyId) {
      // API keys do not expire; the stream ends only when the key is deleted or rotated.
      void ApiKeyModel.exists({ _id: keyId }).then(
        (found) => { if (found) res.write(": heartbeat\n\n"); else res.end(); },
        () => undefined,
      );
      return;
    }
    if (!bearer || !verifyToken(bearer)) { res.end(); return; }
    res.write(": heartbeat\n\n");
  }, 20_000);
  const cleanup = (): void => { clearInterval(heartbeat); unsubscribe(); };
  res.on("close", cleanup);
}
