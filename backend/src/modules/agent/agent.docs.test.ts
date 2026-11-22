import { describe, expect, it } from "vitest";
import { AGENT_DOCS } from "./agent.docs";

const routes = [
  "GET /api/agent/me",
  "GET /api/tasks?date=",
  "GET /api/tasks/dates?month=",
  "POST /api/tasks/:id/copy-to-today",
  "GET /api/notes",
  "GET /api/sync/pull",
  "POST /api/sync/push",
  "GET /api/sync/events",
  "GET /api/teams",
  "GET /api/teams/:teamId",
  "GET /api/teams/invites",
  "POST /api/teams/:teamId/projects",
  "PATCH /api/teams/:teamId/projects/:projectId",
  "GET /api/teams/:teamId/tasks",
  "POST /api/teams/:teamId/tasks",
  "GET /api/teams/:teamId/tasks/:taskId",
  "PATCH /api/teams/:teamId/tasks/:taskId",
  "DELETE /api/teams/:teamId/tasks/:taskId",
  "POST /api/teams/:teamId/tasks/:taskId/restore",
  "POST /api/teams/:teamId/tasks/:taskId/deliver",
  "POST /api/teams/:teamId/tasks/:taskId/undeliver",
  "GET /api/teams/:teamId/tasks/:taskId/events",
  "GET /api/teams/:teamId/tasks/:taskId/messages",
  "POST /api/teams/:teamId/tasks/:taskId/messages",
  "GET /api/teams/:teamId/history",
  "POST /api/uploads",
  "POST /api/teams/:teamId/uploads",
  "/api/uploads/:userId/:file/versions",
  "/api/teams/:teamId/uploads/:file/versions",
];

describe("agent guide", () => {
  it.each(routes)("documents %s", (route) => {
    expect(AGENT_DOCS).toContain(route);
  });

  it("states the safety rules and key facts", () => {
    for (const text of ["RULES FOR AGENTS", "KEY_READ_ONLY", "KEY_NOT_ALLOWED", "TASK_CONFLICT", "UNAUTHORIZED", "Allow changes", "Authorization: Bearer", "dfk_", "Asia/Dhaka", "overdue", "Overdue", "Delivered"]) {
      expect(AGENT_DOCS).toContain(text);
    }
  });

  it("keeps the enums of the real contracts", () => {
    for (const v of ["notStarted", "started", "completed", "todo", "in_progress", "undelivered", "status_changed"]) {
      expect(AGENT_DOCS).toContain(v);
    }
  });

  it("keeps backticks and template markers intact", () => {
    expect(AGENT_DOCS).toContain("`GET /api/agent/me`");
    expect(AGENT_DOCS).not.toContain(String.fromCharCode(92) + String.fromCharCode(96));
  });
});
