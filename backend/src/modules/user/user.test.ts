import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { bearer, clearDb, createSession, noteDoc, taskDoc } from "../../test/helpers";
import { NoteModel } from "../note/note.model";
import { TaskModel } from "../task/task.model";
import { UploadModel } from "../upload/upload.model";
import { UserModel } from "./user.model";

describe("user stats", () => {
  beforeEach(clearDb);

  it("401 without a token, 403 for regular users", async () => {
    expect((await request(app).get("/api/users/stats")).status).toBe(401);
    const user = await createSession("sajib");
    expect((await request(app).get("/api/users/stats").set(bearer(user.token))).status).toBe(403);
  });

  it("the old create and list routes no longer exist", async () => {
    const admin = await createSession("admin", "superadmin");
    expect((await request(app).post("/api/users").set(bearer(admin.token)).send({})).status).toBe(404);
    expect((await request(app).get("/api/users").set(bearer(admin.token))).status).toBe(404);
  });

  it("returns per-user numbers only, ignoring soft-deleted records", async () => {
    const admin = await createSession("admin", "superadmin");
    const alice = await createSession("alice");
    await createSession("bob");
    const now = new Date();
    const task = (userId: string, extra: object = {}) =>
      TaskModel.create({ ...taskDoc(), _id: randomUUID(), userId, serverUpdatedAt: now, ...extra });
    const note = (userId: string, extra: object = {}) =>
      NoteModel.create({ ...noteDoc(), _id: randomUUID(), userId, serverUpdatedAt: now, ...extra });
    const upload = (userId: string, filename: string, size: number) =>
      UploadModel.create({ _id: randomUUID(), userId, filename, mime: "image/webp", size, width: 10, height: 10 });
    await task(alice.user.id);
    await task(alice.user.id);
    await task(alice.user.id, { deletedAt: now });
    await note(alice.user.id);
    await note(alice.user.id, { deletedAt: now });
    await task(admin.user.id);
    await upload(alice.user.id, "a.webp", 1000);
    await upload(alice.user.id, "b.webp", 500);
    await UserModel.updateOne({ googleId: "g-bob" }, { $set: { lastLoginAt: new Date(Date.now() - 30 * 86_400_000) } });

    const res = await request(app).get("/api/users/stats").set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ users: 3, activeLast7d: 2, tasks: 3, notes: 1, images: 2, storageBytes: 1500 });
    const byEmail = Object.fromEntries(res.body.users.map((u: { email: string }) => [u.email, u]));
    expect(byEmail["alice@test.dev"]).toMatchObject({ tasks: 2, notes: 1, images: 2, storageBytes: 1500, role: "user" });
    expect(byEmail["bob@test.dev"]).toMatchObject({ tasks: 0, notes: 0, images: 0, storageBytes: 0 });
    expect(byEmail["admin@test.dev"]).toMatchObject({ tasks: 1, role: "superadmin" });
    expect(typeof byEmail["alice@test.dev"].lastLoginAt).toBe("string");
    expect(JSON.stringify(res.body)).not.toMatch(/googleId|descriptionHtml|Write report/);
  });

  it("applies a role change made in the database without signing in again", async () => {
    const user = await createSession("sajib");
    expect((await request(app).get("/api/users/stats").set(bearer(user.token))).status).toBe(403);
    await UserModel.updateOne({ _id: user.user.id }, { $set: { role: "superadmin" } });
    expect((await request(app).get("/api/users/stats").set(bearer(user.token))).status).toBe(200);
    await UserModel.deleteOne({ _id: user.user.id });
    expect((await request(app).get("/api/users/stats").set(bearer(user.token))).status).toBe(401);
  });
});
