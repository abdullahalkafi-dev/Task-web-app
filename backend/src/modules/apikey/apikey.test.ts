import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { bearer, clearDb, createSession, taskDoc } from "../../test/helpers";
import { ApiKeyModel } from "./apikey.model";

async function makeKey(token: string, body: Record<string, unknown> = { name: "bot" }) {
  const res = await request(app).post("/api/keys").set(bearer(token)).send(body);
  expect(res.status).toBe(201);
  return res.body as { key: { id: string; write: boolean; prefix: string }; secret: string };
}

describe("api keys", () => {
  beforeEach(clearDb);

  it("shows the secret once and never lists it", async () => {
    const u = await createSession("alice");
    const { key, secret } = await makeKey(u.token);
    expect(secret).toMatch(/^dfk_[A-Za-z0-9_-]{40}$/);
    expect(key.prefix).toBe(secret.slice(0, 12));
    expect(key.write).toBe(false);
    const stored = await ApiKeyModel.findById(key.id).lean();
    expect(stored?.hash).not.toBe(secret);
    const list = await request(app).get("/api/keys").set(bearer(u.token));
    expect(list.status).toBe(200);
    expect(list.body.keys).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(secret);
    expect(list.body.keys[0].lastUsedAt).toBeNull();
  });

  it("limits keys per user", async () => {
    const u = await createSession("alice");
    for (let i = 0; i < 20; i++) await makeKey(u.token, { name: `k${i}` });
    const res = await request(app).post("/api/keys").set(bearer(u.token)).send({ name: "extra" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("KEY_LIMIT");
  });

  it("reads tasks and teams with a key", async () => {
    const u = await createSession("alice");
    const { secret } = await makeKey(u.token);
    await request(app).post("/api/teams").set(bearer(u.token)).send({ name: "T" }).expect(201);
    const tasks = await request(app).get("/api/tasks").query({ date: "2026-11-10" }).set(bearer(secret));
    expect(tasks.status).toBe(200);
    const teams = await request(app).get("/api/teams").set(bearer(secret));
    expect(teams.status).toBe(200);
    expect(teams.body.teams).toHaveLength(1);
    const list = await request(app).get("/api/keys").set(bearer(u.token));
    expect(list.body.keys[0].lastUsedAt).not.toBeNull();
  });

  it("read-only key cannot write until write is enabled", async () => {
    const u = await createSession("alice");
    const { key, secret } = await makeKey(u.token);
    const body = { id: "11111111-1111-4111-8111-111111111111" };
    const denied = await request(app).post("/api/teams").set(bearer(secret)).send({ name: "X", ...body });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("KEY_READ_ONLY");
    const patched = await request(app).patch(`/api/keys/${key.id}`).set(bearer(u.token)).send({ write: true });
    expect(patched.status).toBe(200);
    expect(patched.body.key.write).toBe(true);
    const ok = await request(app).post("/api/teams").set(bearer(secret)).send({ name: "X" });
    expect(ok.status).toBe(201);
    const sync = await request(app).post("/api/sync").set(bearer(secret)).send({ tasks: [taskDoc()], notes: [] });
    expect(sync.status).not.toBe(403);
  });

  it("rotate invalidates the old secret", async () => {
    const u = await createSession("alice");
    const { key, secret } = await makeKey(u.token);
    const rotated = await request(app).post(`/api/keys/${key.id}/rotate`).set(bearer(u.token));
    expect(rotated.status).toBe(200);
    expect(rotated.body.secret).not.toBe(secret);
    expect((await request(app).get("/api/teams").set(bearer(secret))).status).toBe(401);
    expect((await request(app).get("/api/teams").set(bearer(rotated.body.secret))).status).toBe(200);
  });

  it("delete invalidates the key", async () => {
    const u = await createSession("alice");
    const { key, secret } = await makeKey(u.token);
    await request(app).delete(`/api/keys/${key.id}`).set(bearer(u.token)).expect(204);
    const res = await request(app).get("/api/teams").set(bearer(secret));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid API key");
  });

  it("only the owner can touch a key", async () => {
    const a = await createSession("alice");
    const b = await createSession("bob");
    const { key } = await makeKey(a.token);
    await request(app).patch(`/api/keys/${key.id}`).set(bearer(b.token)).send({ write: true }).expect(404);
    await request(app).post(`/api/keys/${key.id}/rotate`).set(bearer(b.token)).expect(404);
    await request(app).delete(`/api/keys/${key.id}`).set(bearer(b.token)).expect(404);
  });

  it("keys cannot manage keys or call auth routes", async () => {
    const u = await createSession("alice");
    const { secret } = await makeKey(u.token, { name: "bot", write: true });
    for (const [method, path] of [
      ["get", "/api/keys"],
      ["post", "/api/keys"],
    ] as const) {
      const res = await request(app)[method](path).set(bearer(secret)).send({ name: "x" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("KEY_NOT_ALLOWED");
    }
    const me = await request(app).get("/api/auth/me").set(bearer(secret));
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe("KEY_NOT_ALLOWED");
    const post = await request(app).post("/api/auth/logout").set(bearer(secret));
    expect(post.status).toBe(403);
  });

  it("does not leak other users' data", async () => {
    const a = await createSession("alice");
    const b = await createSession("bob");
    const { secret } = await makeKey(a.token);
    await request(app).post("/api/teams").set(bearer(b.token)).send({ name: "Private" }).expect(201);
    const teams = await request(app).get("/api/teams").set(bearer(secret));
    expect(teams.body.teams).toHaveLength(0);
  });

  it("a superadmin key is still a plain user", async () => {
    const admin = await createSession("admin", "superadmin");
    const { secret } = await makeKey(admin.token);
    const res = await request(app).get("/api/users/stats").set(bearer(secret));
    expect(res.status).toBe(403);
  });

  it("agent/me reports auth mode", async () => {
    const u = await createSession("alice");
    const session = await request(app).get("/api/agent/me").set(bearer(u.token));
    expect(session.status).toBe(200);
    expect(session.body.auth).toEqual({ type: "session", mode: "write" });
    expect(session.body.user).toEqual({ id: u.user.id, email: u.user.email, name: "alice" });
    expect(new Date(session.body.serverTime).toString()).not.toBe("Invalid Date");
    const { key, secret } = await makeKey(u.token, { name: "bot" });
    const ro = await request(app).get("/api/agent/me").set(bearer(secret));
    expect(ro.body.auth).toEqual({ type: "api_key", keyName: "bot", mode: "read" });
    await request(app).patch(`/api/keys/${key.id}`).set(bearer(u.token)).send({ write: true }).expect(200);
    const rw = await request(app).get("/api/agent/me").set(bearer(secret));
    expect(rw.body.auth.mode).toBe("write");
    await request(app).get("/api/agent/me").expect(401);
  });

  it("agent/docs is public markdown", async () => {
    const res = await request(app).get("/api/agent/docs");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/markdown");
    expect(res.text.length).toBeGreaterThan(0);
  });
});

describe("agent filtered reads", () => {
  beforeEach(clearDb);

  it("filters personal tasks and notes for the key owner only", async () => {
    const a = await createSession("alice");
    const b = await createSession("bob");
    const { secret } = await makeKey(a.token);
    const push = (token: string, tasks: unknown[]) =>
      request(app).post("/api/sync/push").set(bearer(token)).send({ changes: tasks.map((doc) => ({ entity: "task", op: "upsert", doc })) });
    const t1 = taskDoc({ title: "Old report", taskDate: "2026-01-05" });
    const t2 = taskDoc({ title: "Fresh idea", taskDate: "2026-01-06", status: "completed" });
    expect((await push(a.token, [t1, t2])).status).toBeLessThan(300);
    expect((await push(b.token, [taskDoc({ title: "Bob secret report", taskDate: "2026-01-05" })])).status).toBeLessThan(300);

    const all = await request(app).get("/api/agent/tasks").set(bearer(secret));
    expect(all.status).toBe(200);
    expect(all.body.tasks.map((t: { title: string }) => t.title).sort()).toEqual(["Fresh idea", "Old report"]);
    const overdue = await request(app).get("/api/agent/tasks").query({ overdue: "true" }).set(bearer(secret));
    expect(overdue.body.tasks.map((t: { title: string }) => t.title)).toEqual(["Old report"]);
    const range = await request(app).get("/api/agent/tasks").query({ from: "2026-01-06", to: "2026-01-06" }).set(bearer(secret));
    expect(range.body.tasks).toHaveLength(1);
    const text = await request(app).get("/api/agent/tasks").query({ q: "report" }).set(bearer(secret));
    expect(text.body.tasks).toHaveLength(1);
    expect((await request(app).get("/api/agent/tasks").query({ from: "bad" }).set(bearer(secret))).status).toBe(400);
    expect((await request(app).get("/api/agent/notes").set(bearer(secret))).status).toBe(200);
  });
});
