import { request } from "./api";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  write: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

const path = (id: string): string => `/keys/${encodeURIComponent(id)}`;

export const keysApi = {
  list: () => request<{ keys: ApiKey[] }>("GET", "/keys"),
  create: (name: string, write = false) =>
    request<{ key: ApiKey; secret: string }>("POST", "/keys", { name, write }),
  patch: (id: string, input: { name?: string; write?: boolean }) =>
    request<{ key: ApiKey }>("PATCH", path(id), input),
  rotate: (id: string) =>
    request<{ key: ApiKey; secret: string }>("POST", `${path(id)}/rotate`),
  remove: (id: string) => request<void>("DELETE", path(id)),
};
