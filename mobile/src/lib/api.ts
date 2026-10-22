import { fetch } from 'expo/fetch';
import type { PullResponse, PushChange, PushResult, Session } from '@dayflow/shared';

export const ORIGIN = __DEV__ && process.env.EXPO_PUBLIC_API_ORIGIN ? process.env.EXPO_PUBLIC_API_ORIGIN : 'https://task-web-app.silverjeanscloth.com';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function request<T>(path: string, token?: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${ORIGIN}/api${path}`, {
    method: body === undefined ? 'GET' : 'POST', signal,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ApiError(response.status, data?.error?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
export const api = {
  config: () => request<{ googleClientId: string | null }>('/auth/config'),
  login: (credential: string) => request<Session>('/auth/google', undefined, { credential }),
  me: (token: string) => request<{ user: Session['user'] }>('/auth/me', token),
  pull: (token: string, since: string | null, signal: AbortSignal) => request<PullResponse>(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`, token, undefined, signal),
  push: (token: string, changes: PushChange[], signal: AbortSignal) => request<{ results: PushResult[]; serverTime: string }>('/sync/push', token, { changes }, signal),
};
