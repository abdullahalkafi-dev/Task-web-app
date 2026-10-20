import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { bearer, clearDb, createUserWithToken, noteDoc, seedAdmin } from "../../test/helpers";

const push = (token: string, docs: Record<string, unknown>[], op = "upsert") =>
  request(app)
    .post("/api/sync/push")
    .set(bearer(token))
    .send({ changes: docs.map((doc) => ({ entity: "note", op, doc })) });

describe("notes", () => {
  beforeEach(async () => {
    await clearDb();
    await seedAdmin();
  });

  it("requires authentication", async () => {
    expect((await request(app).get("/api/notes")).status).toBe(401);
  });

  it("stores notes, lists them in order, and hides deleted ones", async () => {
    const { token } = await createUserWithToken("sajib");
    const a = noteDoc({ title: "A", orderIndex: 2048 });
    const b = noteDoc({ title: "B", orderIndex: 1024 });
    expect((await push(token, [a, b])).status).toBe(200);
    let list = await request(app).get("/api/notes").set(bearer(token));
    expect(list.body.notes.map((n: { title: string }) => n.title)).toEqual(["B", "A"]);

    const later = new Date(Date.now() + 1000).toISOString();
    await push(token, [{ ...a, deletedAt: later, updatedAt: later }], "delete");
    list = await request(app).get("/api/notes").set(bearer(token));
    expect(list.body.notes).toHaveLength(1);
  });

  it("validates payloads", async () => {
    const { token } = await createUserWithToken("sajib");
    expect((await push(token, [noteDoc({ id: "not-a-uuid" })])).status).toBe(400);
    expect((await push(token, [noteDoc({ orderIndex: "x" })])).status).toBe(400);
  });

  it("isolates users", async () => {
    const a = await createUserWithToken("alice");
    const b = await createUserWithToken("bob");
    const doc = noteDoc({ title: "Alice note" });
    await push(a.token, [doc]);
    expect((await request(app).get("/api/notes").set(bearer(b.token))).body.notes).toHaveLength(0);
    const hijack = await push(b.token, [{ ...doc, title: "Hijack", updatedAt: new Date(Date.now() + 9000).toISOString() }]);
    expect(hijack.body.results[0].error).toBe("FORBIDDEN");
    expect((await request(app).get("/api/notes").set(bearer(a.token))).body.notes[0].title).toBe("Alice note");
  });
});
