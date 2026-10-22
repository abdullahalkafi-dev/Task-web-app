import { randomUUID } from "node:crypto";
import request from "supertest";
import dayjs from "dayjs";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { bearer, clearDb, createUserWithToken, seedAdmin, taskDoc } from "../../test/helpers";
import { dhakaDateKey } from "../../utils/dhaka";

const push = (token: string, docs: Record<string, unknown>[]) =>
  request(app)
    .post("/api/sync/push")
    .set(bearer(token))
    .send({ changes: docs.map((doc) => ({ entity: "task", op: "upsert", doc })) });

describe("tasks", () => {
  beforeEach(async () => {
    await clearDb();
    await seedAdmin();
  });

  it("requires authentication", async () => {
    expect((await request(app).get(`/api/tasks?date=${dhakaDateKey()}`)).status).toBe(401);
    expect((await request(app).get("/api/tasks/dates?month=2026-10")).status).toBe(401);
    expect((await request(app).post(`/api/tasks/${randomUUID()}/copy-to-today`)).status).toBe(401);
  });

  it("syncs reminders, preserves omitted fields from older clients, clears explicitly and resets copies", async () => {
    const { token } = await createUserWithToken("reminder");
    const reminderAt = new Date(Date.now() + 3600000).toISOString();
    const doc = taskDoc({ reminderAt });
    expect((await push(token, [doc])).body.results[0].winner.reminderAt).toBe(reminderAt);
    const legacy: Record<string, unknown> = { ...doc, title: "Legacy edit", updatedAt: new Date(Date.parse(doc.updatedAt as string) + 10).toISOString() };
    delete legacy.reminderAt;
    expect((await push(token, [legacy])).body.results[0].winner.reminderAt).toBe(reminderAt);
    const pull = await request(app).get("/api/sync/pull").set(bearer(token));
    expect(pull.body.tasks[0].reminderAt).toBe(reminderAt);
    const copy = await request(app).post(`/api/tasks/${doc.id as string}/copy-to-today`).set(bearer(token));
    expect(copy.body.task.reminderAt).toBeNull();
    const cleared = { ...legacy, reminderAt: null, updatedAt: new Date(Date.parse(legacy.updatedAt as string) + 10).toISOString() };
    expect((await push(token, [cleared])).body.results[0].winner.reminderAt).toBeNull();
    expect((await push(token, [taskDoc({ reminderAt: "not-a-date" })])).status).toBe(400);
  });

  it("returns a day's tasks ordered by orderIndex, and calendar dates", async () => {
    const { token } = await createUserWithToken("sajib");
    const today = dhakaDateKey();
    const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    await push(token, [
      taskDoc({ title: "B", orderIndex: 2048 }),
      taskDoc({ title: "A", orderIndex: 1024 }),
      taskDoc({ title: "Old", taskDate: yesterday }),
    ]);
    const res = await request(app).get(`/api/tasks?date=${today}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.tasks.map((t: { title: string }) => t.title)).toEqual(["A", "B"]);

    const dates = await request(app).get(`/api/tasks/dates?month=${today.slice(0, 7)}`).set(bearer(token));
    expect(dates.body.dates).toContain(today);
  });

  it("validates query params and task payloads", async () => {
    const { token } = await createUserWithToken("sajib");
    expect((await request(app).get("/api/tasks?date=bad").set(bearer(token))).status).toBe(400);
    expect((await request(app).get("/api/tasks/dates?month=2026-13").set(bearer(token))).status).toBe(400);
    expect((await push(token, [taskDoc({ title: "" })])).status).toBe(400);
    expect((await push(token, [taskDoc({ estimatedMinutes: 2000 })])).status).toBe(400);
    expect((await push(token, [taskDoc({ status: "blocked" })])).status).toBe(400);
    const future = dayjs().add(10, "day").format("YYYY-MM-DD");
    expect((await push(token, [taskDoc({ taskDate: future })])).status).toBe(400);
  });

  it("sanitizes descriptions and derives plain text", async () => {
    const { token } = await createUserWithToken("sajib");
    const doc = taskDoc({
      descriptionHtml: '<p onclick="x()">Hi <script>alert(1)</script><b>there</b></p><img src="javascript:alert(1)"><img src="/uploads/u/a.webp">',
    });
    await push(token, [doc]);
    const res = await request(app).get(`/api/tasks?date=${dhakaDateKey()}`).set(bearer(token));
    const task = res.body.tasks[0];
    expect(task.descriptionHtml).not.toContain("script");
    expect(task.descriptionHtml).not.toContain("onclick");
    expect(task.descriptionHtml).not.toContain("javascript:");
    expect(task.descriptionHtml).toContain('src="/uploads/u/a.webp"');
    expect(task.descriptionText).toBe("Hi there");
  });

  it("copies a past task to today without touching the original", async () => {
    const { token } = await createUserWithToken("sajib");
    const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    const original = taskDoc({ taskDate: yesterday, status: "completed", title: "Old job", estimatedMinutes: 45 });
    await push(token, [original, taskDoc({ orderIndex: 4096 })]);

    const res = await request(app).post(`/api/tasks/${original.id as string}/copy-to-today`).set(bearer(token));
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: "Old job",
      estimatedMinutes: 45,
      status: "notStarted",
      taskDate: dhakaDateKey(),
      copiedFromDate: yesterday,
      copiedFromTaskId: original.id,
      orderIndex: 5120,
    });
    const orig = await request(app).get(`/api/tasks?date=${yesterday}`).set(bearer(token));
    expect(orig.body.tasks[0]).toMatchObject({ status: "completed", copiedFromDate: null });
    expect((await request(app).post(`/api/tasks/${randomUUID()}/copy-to-today`).set(bearer(token))).status).toBe(404);
  });

  it("isolates users: B cannot read, copy or overwrite A's tasks", async () => {
    const a = await createUserWithToken("alice");
    const b = await createUserWithToken("bob");
    const doc = taskDoc({ title: "Alice private" });
    await push(a.token, [doc]);

    const bList = await request(app).get(`/api/tasks?date=${dhakaDateKey()}`).set(bearer(b.token));
    expect(bList.body.tasks).toHaveLength(0);
    expect((await request(app).post(`/api/tasks/${doc.id as string}/copy-to-today`).set(bearer(b.token))).status).toBe(404);

    const hijack = await push(b.token, [{ ...doc, title: "Hijacked", updatedAt: new Date(Date.now() + 5000).toISOString() }]);
    expect(hijack.body.results[0]).toMatchObject({ applied: false, error: "FORBIDDEN" });
    const aList = await request(app).get(`/api/tasks?date=${dhakaDateKey()}`).set(bearer(a.token));
    expect(aList.body.tasks[0].title).toBe("Alice private");
  });
});
