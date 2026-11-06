import { request } from "./api";
import type {
  TeamDetail,
  TeamHistory,
  TeamInvite,
  TeamMessage,
  TeamPerson,
  TeamSummary,
  TeamTask,
  TeamTaskEvent,
  TeamTaskInput,
  TeamTaskPatch,
} from "@dayflow/shared";
export type * from "@dayflow/shared/teams";
const root = (id: string): string => `/teams/${encodeURIComponent(id)}`;
const taskPath = (id: string, taskId: string): string =>
  `${root(id)}/tasks/${encodeURIComponent(taskId)}`;
export const teamsApi = {
  list: () => request<{ teams: TeamSummary[] }>("GET", "/teams"),
  invites: () => request<{ invites: TeamInvite[] }>("GET", "/teams/invites"),
  create: (name: string) =>
    request<{ team: TeamDetail }>("POST", "/teams", { name }),
  get: (id: string) => request<{ team: TeamDetail }>("GET", root(id)),
  delete: (id: string, name: string) =>
    request<{ ok: true }>("DELETE", root(id), { name }),
  invite: (id: string, email: string) =>
    request("POST", `${root(id)}/invites`, { email }),
  cancel: (id: string, inviteId: string) =>
    request("DELETE", `${root(id)}/invites/${encodeURIComponent(inviteId)}`),
  respond: (id: string, accept: boolean) =>
    request(
      "POST",
      `/teams/invites/${encodeURIComponent(id)}/${accept ? "accept" : "decline"}`,
    ),
  leave: (id: string) => request("POST", `${root(id)}/leave`),
  removeMember: (id: string, userId: string) =>
    request("DELETE", `${root(id)}/members/${encodeURIComponent(userId)}`),
  tasks: (id: string) =>
    request<{ tasks: TeamTask[] }>("GET", `${root(id)}/tasks`),
  task: (id: string, taskId: string) =>
    request<{ task: TeamTask }>("GET", taskPath(id, taskId)),
  createTask: (id: string, input: TeamTaskInput) =>
    request<{ task: TeamTask }>("POST", `${root(id)}/tasks`, input),
  patch: (id: string, taskId: string, input: TeamTaskPatch) =>
    request<{ task: TeamTask }>("PATCH", taskPath(id, taskId), input),
  removeTask: (id: string, task: TeamTask) =>
    request("DELETE", taskPath(id, task.id), { version: task.version }),
  restore: (id: string, task: TeamTask) =>
    request<{ task: TeamTask }>("POST", `${taskPath(id, task.id)}/restore`, {
      version: task.version,
    }),
  history: (
    id: string,
    kind: "completed" | "removed",
    page: number,
    q: string,
  ) =>
    request<TeamHistory>(
      "GET",
      `${root(id)}/history?${new URLSearchParams({ kind, page: String(page), q })}`,
    ),
  events: (id: string, taskId: string) =>
    request<{ events: TeamTaskEvent[]; people: TeamPerson[] }>(
      "GET",
      `${taskPath(id, taskId)}/events`,
    ),
  messages: (id: string, taskId: string, before?: string) =>
    request<{
      messages: TeamMessage[];
      people: TeamPerson[];
      hasMore: boolean;
    }>(
      "GET",
      `${taskPath(id, taskId)}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    ),
  send: (
    id: string,
    taskId: string,
    input: { id: string; bodyText: string; bodyHtml: string },
  ) => request("POST", `${taskPath(id, taskId)}/messages`, input),
  read: (id: string, taskId: string, messageId: string) =>
    request("POST", `${taskPath(id, taskId)}/read`, { messageId }),
  upload: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>("POST", `${root(id)}/uploads`, form);
  },
};
export function refreshTeams(): void {
  window.dispatchEvent(new Event("dayflow:teams"));
}
