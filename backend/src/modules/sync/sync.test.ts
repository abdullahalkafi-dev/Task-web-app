import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { bearer, clearDb, createUserWithToken, noteDoc, seedAdmin, taskDoc } from "../../test/helpers";

const pushChanges = (token: string, changes: object[]) =>
  request(app).post("/api/sync/push").set(bearer(token)).send({ changes });

describe("sync", () => {
  beforeEach(async () => {
    await clearDb();
    await seedAdmin();
  });

  it("requires authentication and validates the body", async () => {
    expect((await request(app).post("/api/sync/push").send({ changes: [] })).status).toBe(401);
    expect((await request(app).get("/api/sync/pull")).status).toBe(401);
    const { token } = await createUserWithToken("sajib");
    expect((await pushChanges(token, [{ entity: "x", op: "upsert", doc: {} }])).status).toBe(400);
    expect((await request(app).get("/api/sync/pull?since=yesterday").set(bearer(token))).status).toBe(400);
    const tooMany = Array.from({ length: 101 }, () => ({ entity: "task", op: "upsert", doc: taskDoc() }));
    expect((await pushChanges(token, tooMany)).status).toBe(400);
  });

  it("push then pull round-trips tasks and notes", async () => {
    const { token } = await createUserWithToken("sajib");
    const task = taskDoc();
    const note = noteDoc();
    const push = await pushChanges(token, [
      { entity: "task", op: "upsert", doc: task },
      { entity: "note", op: "upsert", doc: note },
    ]);
    expect(push.status).toBe(200);
    expect(push.body.results).toMatchObject([
      { entity: "task", id: task.id, applied: true },
      { entity: "note", id: note.id, applied: true },
    ]);
    const pull = await request(app).get("/api/sync/pull").set(bearer(token));
    expect(pull.body.tasks).toHaveLength(1);
    expect(pull.body.notes).toHaveLength(1);
    expect(typeof pull.body.serverTime).toBe("string");

    const again = await request(app).get(`/api/sync/pull?since=${pull.body.serverTime}`).set(bearer(token));
    expect(again.body.tasks).toHaveLength(0);
  });

  it("last-write-wins: older edit loses and receives the winner", async () => {
    const { token } = await createUserWithToken("sajib");
    const base = Date.now();
    const doc = taskDoc({ title: "v1", updatedAt: new Date(base).toISOString() });
    await pushChanges(token, [{ entity: "task", op: "upsert", doc }]);
    const newer = await pushChanges(token, [
      { entity: "task", op: "upsert", doc: { ...doc, title: "v3", updatedAt: new Date(base + 3000).toISOString() } },
    ]);
    expect(newer.body.results[0].applied).toBe(true);
    const stale = await pushChanges(token, [
      { entity: "task", op: "upsert", doc: { ...doc, title: "v2", updatedAt: new Date(base + 1000).toISOString() } },
    ]);
    expect(stale.body.results[0]).toMatchObject({ applied: false, winner: { title: "v3" } });
  });

  it("delete creates a tombstone that pull returns", async () => {
    const { token } = await createUserWithToken("sajib");
    const doc = taskDoc();
    await pushChanges(token, [{ entity: "task", op: "upsert", doc }]);
    const t = new Date(Date.now() + 2000).toISOString();
    await pushChanges(token, [{ entity: "task", op: "delete", doc: { ...doc, updatedAt: t, deletedAt: t } }]);
    const pull = await request(app).get("/api/sync/pull").set(bearer(token));
    expect(pull.body.tasks[0].deletedAt).toBe(t);
  });

  it("pull picks up offline edits whose updatedAt is older than the last pull", async () => {
    const a = await createUserWithToken("sajib");
    const first = await request(app).get("/api/sync/pull").set(bearer(a.token));
    const oldStamp = new Date(Date.now() - 3_600_000).toISOString();
    await pushChanges(a.token, [{ entity: "task", op: "upsert", doc: taskDoc({ updatedAt: oldStamp, createdAt: oldStamp }) }]);
    const next = await request(app).get(`/api/sync/pull?since=${first.body.serverTime}`).set(bearer(a.token));
    expect(next.body.tasks).toHaveLength(1);
  });

  it("isolates users on pull", async () => {
    const a = await createUserWithToken("alice");
    const b = await createUserWithToken("bob");
    await pushChanges(a.token, [
      { entity: "task", op: "upsert", doc: taskDoc() },
      { entity: "note", op: "upsert", doc: noteDoc() },
    ]);
    const pull = await request(app).get("/api/sync/pull").set(bearer(b.token));
    expect(pull.body.tasks).toHaveLength(0);
    expect(pull.body.notes).toHaveLength(0);
  });
});
