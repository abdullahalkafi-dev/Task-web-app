import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import sharp from "sharp";
import type { TeamDetail, TeamTask } from "@dayflow/shared";
import { app } from "../../app";
import {
  clearDb,
  createSession,
  bearer,
  taskDoc,
  noteDoc,
} from "../../test/helpers";
import { TeamInviteModel, TeamMemberModel, TeamTaskModel } from "./team.model";
import { notifyTeam, resolveImage } from "./team.service";
import { subscribeUser } from "../sync/sync.events";

const input = {
  title: "Prepare launch",
  descriptionHtml: "<p>Shared work</p>",
  status: "todo",
  assigneeId: null,
  estimatedDays: 3,
};
async function fixture() {
  const owner = await createSession("owner");
  const member = await createSession("member");
  const outsider = await createSession("outsider");
  const created = await request(app)
    .post("/api/teams")
    .set(bearer(owner.token))
    .send({ name: "Design team" });
  expect(created.status).toBe(201);
  const team = created.body.team as TeamDetail;
  const invited = await request(app)
    .post(`/api/teams/${team.id}/invites`)
    .set(bearer(owner.token))
    .send({ email: member.user.email });
  expect(invited.status).toBe(201);
  const inviteId = invited.body.invite.id as string;
  const accepted = await request(app)
    .post(`/api/teams/invites/${inviteId}/accept`)
    .set(bearer(member.token));
  expect(accepted.status).toBe(200);
  const createdTask = await request(app)
    .post(`/api/teams/${team.id}/tasks`)
    .set(bearer(owner.token))
    .send(input);
  expect(createdTask.status).toBe(201);
  return {
    owner,
    member,
    outsider,
    team,
    task: createdTask.body.task as TeamTask,
    base: `/api/teams/${team.id}`,
  };
}
beforeAll(async () => {
  await TeamMemberModel.init();
  await TeamInviteModel.init();
});
beforeEach(clearDb);
describe("private team lifecycle", () => {
  it("requires sign-in and keeps team content out of personal sync", async () => {
    expect((await request(app).get("/api/teams")).status).toBe(401);
    const { owner, member, outsider, task } = await fixture();
    await request(app)
      .post("/api/sync/push")
      .set(bearer(owner.token))
      .send({
        changes: [
          {
            entity: "task",
            op: "upsert",
            doc: taskDoc({ title: "Private task" }),
          },
          {
            entity: "note",
            op: "upsert",
            doc: noteDoc({ title: "Private note" }),
          },
        ],
      });
    for (const person of [owner, member, outsider]) {
      const response = await request(app)
        .get("/api/sync/pull")
        .set(bearer(person.token));
      expect(
        response.body.tasks.map((t: { id: string }) => t.id),
      ).not.toContain(task.id);
      if (person !== owner) {
        expect(response.body.tasks).toEqual([]);
        expect(response.body.notes).toEqual([]);
      }
    }
  });
  it("never grants membership before acceptance; only the recipient can respond", async () => {
    const owner = await createSession("owner");
    const invited = await createSession("invited");
    const other = await createSession("other");
    const team = (
      await request(app)
        .post("/api/teams")
        .set(bearer(owner.token))
        .send({ name: "Private" })
    ).body.team as TeamDetail;
    const invite = (
      await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set(bearer(owner.token))
        .send({ email: invited.user.email })
    ).body.invite;
    expect(
      (
        await request(app)
          .get(`/api/teams/${team.id}`)
          .set(bearer(invited.token))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/teams/invites/${invite.id}/accept`)
          .set(bearer(other.token))
      ).status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/teams/invites").set(bearer(invited.token)))
        .body.invites,
    ).toHaveLength(1);
    expect(
      (
        await request(app)
          .post(`/api/teams/invites/${invite.id}/decline`)
          .set(bearer(invited.token))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/teams/invites/${invite.id}/accept`)
          .set(bearer(invited.token))
      ).status,
    ).toBe(409);
  });
  it("handles unknown emails, duplicate invites, cancellation and repeat invite cooldown", async () => {
    const { owner, member, outsider, base } = await fixture();
    expect(
      (
        await request(app)
          .post(`${base}/invites`)
          .set(bearer(owner.token))
          .send({ email: "unknown@test.dev" })
      ).body.error.code,
    ).toBe("NO_ACCOUNT");
    expect(
      (
        await request(app)
          .post(`${base}/invites`)
          .set(bearer(owner.token))
          .send({ email: member.user.email })
      ).status,
    ).toBe(409);
    const invite = await request(app)
      .post(`${base}/invites`)
      .set(bearer(member.token))
      .send({ email: outsider.user.email });
    expect(invite.status).toBe(201);
    expect(
      (
        await request(app)
          .post(`${base}/invites`)
          .set(bearer(owner.token))
          .send({ email: outsider.user.email })
      ).body.error.code,
    ).toBe("INVITE_PENDING");
    expect(
      (
        await request(app)
          .delete(`${base}/invites/${invite.body.invite.id}`)
          .set(bearer(member.token))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/teams/invites/${invite.body.invite.id}/accept`)
          .set(bearer(outsider.token))
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`${base}/invites`)
          .set(bearer(owner.token))
          .send({ email: outsider.user.email })
      ).status,
    ).toBe(429);
  });
  it("checks membership on every team endpoint, including cross-team task ids", async () => {
    const { owner, outsider, team, task, base } = await fixture();
    const routes: ["get" | "post" | "patch" | "delete", string, object?][] = [
      ["get", base],
      ["delete", base, { name: team.name }],
      ["post", `${base}/invites`, { email: outsider.user.email }],
      ["delete", `${base}/invites/${randomUUID()}`],
      ["post", `${base}/leave`],
      ["delete", `${base}/members/${owner.user.id}`],
      ["get", `${base}/tasks`],
      ["post", `${base}/tasks`, input],
      ["get", `${base}/tasks/${task.id}`],
      ["patch", `${base}/tasks/${task.id}`, { version: 1, title: "attack" }],
      ["delete", `${base}/tasks/${task.id}`, { version: 1 }],
      ["post", `${base}/tasks/${task.id}/restore`, { version: 1 }],
      ["get", `${base}/history`],
      ["get", `${base}/tasks/${task.id}/events`],
      ["get", `${base}/tasks/${task.id}/messages`],
      [
        "post",
        `${base}/tasks/${task.id}/messages`,
        { id: randomUUID(), bodyText: "attack" },
      ],
      ["post", `${base}/tasks/${task.id}/read`, { messageId: randomUUID() }],
    ];
    for (const [method, url, body] of routes) {
      let call = request(app)[method](url).set(bearer(outsider.token));
      if (body) call = call.send(body);
      expect((await call).status, `${method} ${url}`).toBe(403);
    }
    expect(
      (await request(app).post(`${base}/uploads`).set(bearer(outsider.token)))
        .status,
    ).toBe(403);
    const another = (
      await request(app)
        .post("/api/teams")
        .set(bearer(outsider.token))
        .send({ name: "Other" })
    ).body.team as TeamDetail;
    expect(
      (
        await request(app)
          .get(`/api/teams/${another.id}/tasks/${task.id}`)
          .set(bearer(outsider.token))
      ).status,
    ).toBe(404);
  });
  it("enforces creator-only removal and prevents creator leaving", async () => {
    const { owner, member, team, base } = await fixture();
    expect(
      (await request(app).post(`${base}/leave`).set(bearer(owner.token)))
        .status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .delete(`${base}/members/${owner.user.id}`)
          .set(bearer(member.token))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .delete(base)
          .set(bearer(member.token))
          .send({ name: team.name })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(base)
          .set(bearer(owner.token))
          .send({ name: "wrong" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .delete(`${base}/members/${member.user.id}`)
          .set(bearer(owner.token))
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get(base).set(bearer(member.token))).status,
    ).toBe(403);
  });
});
describe("team tasks, conflicts and history", () => {
  it("lets members edit, assign, reorder and complete; preserves creator and server timestamps", async () => {
    const { owner, member, outsider, task, base } = await fixture();
    const changed = await request(app)
      .patch(`${base}/tasks/${task.id}`)
      .set(bearer(member.token))
      .send({
        version: task.version,
        title: "Updated",
        assigneeId: member.user.id,
        status: "in_progress",
        orderIndex: -1024,
        createdBy: member.user.id,
        createdAt: "1990-01-01",
      });
    expect(changed.status).toBe(200);
    expect(changed.body.task.createdBy).toBe(owner.user.id);
    expect(changed.body.task.startedAt).toBeTruthy();
    expect(changed.body.task.version).toBe(2);
    expect(
      (
        await request(app)
          .patch(`${base}/tasks/${task.id}`)
          .set(bearer(owner.token))
          .send({ version: 2, assigneeId: outsider.user.id })
      ).status,
    ).toBe(400);
    const done = await request(app)
      .patch(`${base}/tasks/${task.id}`)
      .set(bearer(member.token))
      .send({ version: 2, status: "completed" });
    expect(done.body.task.completedBy).toBe(member.user.id);
    const events = (
      await request(app)
        .get(`${base}/tasks/${task.id}/events`)
        .set(bearer(owner.token))
    ).body.events;
    expect(events.map((e: { type: string }) => e.type)).toEqual([
      "created",
      "assigned",
      "status_changed",
      "edited",
      "status_changed",
    ]);
  });
  it("returns the latest task on stale edits and permits only one concurrent version update", async () => {
    const { owner, member, task, base } = await fixture();
    const responses = await Promise.all(
      [owner, member].map((u) =>
        request(app)
          .patch(`${base}/tasks/${task.id}`)
          .set(bearer(u.token))
          .send({ version: 1, title: u.user.name }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const conflict = responses.find((r) => r.status === 409)!;
    expect(conflict.body.error.code).toBe("TASK_CONFLICT");
    expect(conflict.body.details.task.version).toBe(2);
    const saved = await TeamTaskModel.findById(task.id).lean();
    expect(saved?.events).toHaveLength(2);
  });
  it("starts estimates on In progress and resets the start only on To do", async () => {
    const { owner, task, base } = await fixture();
    const patch = (version: number, status: string) =>
      request(app)
        .patch(`${base}/tasks/${task.id}`)
        .set(bearer(owner.token))
        .send({ version, status });
    expect(task.startedAt).toBeNull();
    const first = (await patch(1, "in_progress")).body.task;
    expect(first.startedAt).toBeTruthy();
    const completed = (await patch(2, "completed")).body.task;
    expect(completed.startedAt).toBe(first.startedAt);
    const reopened = (await patch(3, "in_progress")).body.task;
    expect(reopened.startedAt).toBe(first.startedAt);
    expect(reopened.completedAt).toBeNull();
    const todo = (await patch(4, "todo")).body.task;
    expect(todo.startedAt).toBeNull();
  });
  it("lazily archives after 24h, records who completed, and restores to To do", async () => {
    const { owner, member, task, base } = await fixture();
    await request(app)
      .patch(`${base}/tasks/${task.id}`)
      .set(bearer(member.token))
      .send({ version: 1, status: "completed" });
    await TeamTaskModel.updateOne(
      { _id: task.id },
      { completedAt: new Date(Date.now() - 86400000 - 1000) },
    );
    expect(
      (await request(app).get(`${base}/tasks`).set(bearer(owner.token))).body
        .tasks,
    ).toEqual([]);
    const history = await request(app)
      .get(`${base}/history?kind=completed&q=launch`)
      .set(bearer(owner.token));
    const archived = history.body.tasks[0] as TeamTask;
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.completedBy).toBe(member.user.id);
    const restored = await request(app)
      .post(`${base}/tasks/${task.id}/restore`)
      .set(bearer(member.token))
      .send({ version: archived.version });
    expect(restored.status).toBe(200);
    expect(restored.body.task.status).toBe("todo");
    expect(restored.body.task.archivedAt).toBeNull();
  });
  it("soft removes, retains chat and timeline, and lets any member restore", async () => {
    const { owner, member, task, base } = await fixture();
    await request(app)
      .post(`${base}/tasks/${task.id}/messages`)
      .set(bearer(member.token))
      .send({ id: randomUUID(), bodyText: "Keep this discussion" });
    expect(
      (
        await request(app)
          .delete(`${base}/tasks/${task.id}`)
          .set(bearer(member.token))
          .send({ version: 1 })
      ).status,
    ).toBe(200);
    const removed = (
      await request(app)
        .get(`${base}/history?kind=removed`)
        .set(bearer(owner.token))
    ).body.tasks[0] as TeamTask;
    expect(removed.removedBy).toBe(member.user.id);
    expect(removed.messageCount).toBe(1);
    expect(
      (
        await request(app)
          .patch(`${base}/tasks/${task.id}`)
          .set(bearer(owner.token))
          .send({ version: removed.version, title: "No" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`${base}/tasks/${task.id}/restore`)
          .set(bearer(owner.token))
          .send({ version: removed.version })
      ).status,
    ).toBe(200);
    const events = (
      await request(app)
        .get(`${base}/tasks/${task.id}/events`)
        .set(bearer(member.token))
    ).body.events;
    expect(events.map((e: { type: string }) => e.type)).toContain("restored");
  });
  it("unassigns tasks and revokes future team event delivery when a member leaves", async () => {
    const { owner, member, outsider, team, task, base } = await fixture();
    await request(app)
      .patch(`${base}/tasks/${task.id}`)
      .set(bearer(owner.token))
      .send({ version: 1, assigneeId: member.user.id });
    const active = vi.fn();
    const departed = vi.fn();
    const unrelated = vi.fn();
    const cleanups = [
      subscribeUser(owner.user.id, active),
      subscribeUser(member.user.id, departed),
      subscribeUser(outsider.user.id, unrelated),
    ];
    try {
      await request(app).post(`${base}/leave`).set(bearer(member.token));
      departed.mockClear();
      active.mockClear();
      await notifyTeam(team.id);
      expect(active).toHaveBeenCalledOnce();
      expect(departed).not.toHaveBeenCalled();
      expect(unrelated).not.toHaveBeenCalled();
      const tasks = (
        await request(app).get(`${base}/tasks`).set(bearer(owner.token))
      ).body.tasks;
      expect(tasks[0].assigneeId).toBeNull();
      expect(tasks[0].createdBy).toBe(owner.user.id);
      expect(
        (
          await request(app)
            .get(`${base}/tasks/${task.id}/messages`)
            .set(bearer(member.token))
        ).status,
      ).toBe(403);
    } finally {
      cleanups.forEach((cleanup) => cleanup());
    }
  });
});
describe("team images and per-task chat", () => {
  it("sanitizes descriptions, rejects invalid estimates and foreign/private image paths", async () => {
    const { owner, base } = await fixture();
    const clean = await request(app)
      .post(`${base}/tasks`)
      .set(bearer(owner.token))
      .send({
        ...input,
        descriptionHtml: '<p onclick="bad()">Hello<script>bad()</script></p>',
      });
    expect(clean.body.task.descriptionHtml).toBe("<p>Hello</p>");
    for (const estimatedDays of [0, -1, 1.5])
      expect(
        (
          await request(app)
            .post(`${base}/tasks`)
            .set(bearer(owner.token))
            .send({ ...input, estimatedDays })
        ).status,
      ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${base}/tasks`)
          .set(bearer(owner.token))
          .send({
            ...input,
            descriptionHtml: '<img src="/uploads/private/image.webp">',
          })
      ).status,
    ).toBe(400);
  });
  it("checks image membership every time, never caches team files, and deletes only team files", async () => {
    const { owner, member, outsider, team, base } = await fixture();
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const upload = await request(app)
      .post(`${base}/uploads`)
      .set(bearer(member.token))
      .attach("file", image, "image.png");
    expect(upload.status).toBe(201);
    const url = upload.body.url as string;
    const imagePath = await resolveImage(
      team.id,
      owner.user.id,
      url.split("/").pop()!,
    );
    expect(
      (await request(app).get(url).set(bearer(owner.token))).headers[
        "cache-control"
      ],
    ).toContain("no-store");
    expect(
      (await request(app).get(url).set(bearer(outsider.token))).status,
    ).toBe(403);
    await request(app)
      .delete(`${base}/members/${member.user.id}`)
      .set(bearer(owner.token));
    expect((await request(app).get(url).set(bearer(member.token))).status).toBe(
      403,
    );
    await request(app)
      .delete(base)
      .set(bearer(owner.token))
      .send({ name: team.name });
    expect((await request(app).get(url).set(bearer(owner.token))).status).toBe(
      403,
    );
    await expect(fs.access(imagePath)).rejects.toThrow();
    expect(await TeamTaskModel.countDocuments({ teamId: team.id })).toBe(0);
  });
  it("counts chat, preserves text, sanitizes image HTML, makes retries idempotent and tracks read positions", async () => {
    const { owner, member, task, base } = await fixture();
    const id = randomUUID();
    const send = () =>
      request(app)
        .post(`${base}/tasks/${task.id}/messages`)
        .set(bearer(member.token))
        .send({
          id,
          bodyText: "Hello <script>plain text</script>",
          bodyHtml: "<p onclick='x()'>Image details<script>bad()</script></p>",
        });
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
    let board = (
      await request(app).get(`${base}/tasks`).set(bearer(owner.token))
    ).body.tasks as TeamTask[];
    expect(board[0].messageCount).toBe(1);
    expect(board[0].unread).toBe(true);
    const messages = await request(app)
      .get(`${base}/tasks/${task.id}/messages`)
      .set(bearer(owner.token));
    expect(messages.body.messages[0].bodyHtml).not.toContain("script");
    expect(messages.body.messages[0].bodyText).toContain("<script>");
    await request(app)
      .post(`${base}/tasks/${task.id}/read`)
      .set(bearer(owner.token))
      .send({ messageId: id });
    board = (await request(app).get(`${base}/tasks`).set(bearer(owner.token)))
      .body.tasks;
    expect(board[0].unread).toBe(false);
    expect(
      (
        await request(app)
          .post(`${base}/tasks/${task.id}/messages`)
          .set(bearer(owner.token))
          .send({ id: randomUUID(), bodyText: " " })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${base}/tasks/${task.id}/messages`)
          .set(bearer(owner.token))
          .send({ id: randomUUID(), bodyText: "x".repeat(10001) })
      ).status,
    ).toBe(400);
  });
  it("requires Bearer headers for team writes even when a session cookie exists", async () => {
    const { owner, base } = await fixture();
    expect(
      (
        await request(app)
          .post(`${base}/tasks`)
          .set("Cookie", `dayflow_token=${owner.token}`)
          .send(input)
      ).status,
    ).toBe(401);
  });
});
