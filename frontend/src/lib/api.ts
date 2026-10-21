import type { NoteDoc, TaskDoc, User } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let tokenGetter: () => string | null = () => null;
let unauthorizedHandler: () => void = () => undefined;

export function configureApi(opts: { getToken: () => string | null; onUnauthorized: () => void }): void {
  tokenGetter = opts.getToken;
  unauthorizedHandler = opts.onUnauthorized;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function request<T>(method: string, path: string, body?: unknown, tokenOverride?: string): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenOverride ?? tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "NETWORK", "Network unreachable");
  }
  if (res.status === 401 && path !== "/auth/google") unauthorizedHandler();
  if (!res.ok) {
    let parsed: ErrorBody = {};
    try {
      parsed = (await res.json()) as ErrorBody;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, parsed.error?.code ?? "ERROR", parsed.error?.message ?? res.statusText);
  }
  return (await res.json()) as T;
}

type WireTask = Omit<TaskDoc, "userId">;
type WireNote = Omit<NoteDoc, "userId">;

export interface PushChange {
  entity: "task" | "note";
  op: "upsert" | "delete";
  doc: WireTask | WireNote;
  clientUpdatedAt: string;
}

export interface PushResult {
  entity: "task" | "note";
  id: string;
  applied: boolean;
  winner: WireTask | WireNote | null;
  error?: string;
}

export interface PullResponse {
  tasks: WireTask[];
  notes: WireNote[];
  serverTime: string;
}

/** Numbers only; the server never sends anyone's content. */
export interface UserStatsRow {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  lastLoginAt: string;
  loginCount: number;
  tasks: number;
  notes: number;
  images: number;
  storageBytes: number;
}

export interface UserStats {
  totals: { users: number; activeLast7d: number; tasks: number; notes: number; images: number; storageBytes: number };
  users: UserStatsRow[];
}

export const api = {
  desktopRequest: (requestId: string) => request<{ code: string; expiresAt: string }>("GET", `/auth/desktop/request/${requestId}`),
  approveDesktop: (requestId: string, code: string) => request<{ ok: true }>("POST", "/auth/desktop/approve", { requestId, code }),
  config: () => request<{ googleClientId: string | null }>("GET", "/auth/config"),
  googleLogin: (credential: string) => request<{ token: string; user: User }>("POST", "/auth/google", { credential }),
  logout: () => request<{ ok: boolean }>("POST", "/auth/logout"),
  me: (token?: string) => request<{ user: User }>("GET", "/auth/me", undefined, token),
  userStats: () => request<UserStats>("GET", "/users/stats"),
  push: (changes: PushChange[]) =>
    request<{ results: PushResult[]; serverTime: string }>("POST", "/sync/push", { changes }),
  pull: (since: string | null) =>
    request<PullResponse>("GET", since ? `/sync/pull?since=${encodeURIComponent(since)}` : "/sync/pull"),
  taskDates: (month: string) => request<{ dates: string[] }>("GET", `/tasks/dates?month=${month}`),
  upload: (blob: Blob, filename: string) => {
    const form = new FormData();
    form.append("file", blob, filename);
    return request<{ url: string; width: number; height: number }>("POST", "/uploads", form);
  },
};

export async function openChangeStream(signal: AbortSignal): Promise<Response> {
  const token = tokenGetter();
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Sign in to sync");
  const response = await fetch("/api/sync/events", { headers: { Authorization: `Bearer ${token}` }, credentials: "same-origin", signal, cache: "no-store" });
  if (response.status === 401) unauthorizedHandler();
  if (!response.ok || !response.body) throw new ApiError(response.status, "STREAM", "Live sync unavailable");
  return response;
}
