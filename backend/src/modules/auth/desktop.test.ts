import { createHash, randomBytes } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { clearDb, createSession, bearer } from "../../test/helpers";
import { DesktopRequestModel } from "./desktop.model";

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const start = () => request(app).post("/api/auth/desktop/start").send({ challenge });
describe("desktop handoff", () => {
  beforeEach(clearDb);
  it("requires approval and proof, issues the correct account once, and rejects replay", async () => {
    const user = await createSession("desktop");
    const { body, status } = await start(); expect(status).toBe(201);
    const exchange = (secret = verifier) => request(app).post("/api/auth/desktop/exchange").send({ requestId: body.requestId, verifier: secret });
    expect((await exchange()).status).toBe(202);
    expect((await exchange(randomBytes(32).toString("base64url"))).status).toBe(410);
    expect((await request(app).get(`/api/auth/desktop/request/${body.requestId}`)).status).toBe(401);
    expect((await request(app).get(`/api/auth/desktop/request/${body.requestId}`).set(bearer(user.token))).body.code).toBe(body.code);
    const approve = () => request(app).post("/api/auth/desktop/approve").set(bearer(user.token)).send({ requestId: body.requestId, code: body.code });
    expect((await approve()).status).toBe(200);
    expect((await approve()).status).toBe(410);
    const result = await exchange(); expect(result.status).toBe(200); expect(result.body.user.id).toBe(user.user.id);
    expect(result.body.token).toBeTypeOf("string");
    expect((await exchange()).status).toBe(410);
  });
  it("rejects expired requests, malformed input, unauthenticated approval and cookie-only writes", async () => {
    const { body } = await start();
    const user = await createSession("other");
    const approve = () => request(app).post("/api/auth/desktop/approve").send({ requestId: body.requestId, code: body.code });
    expect((await approve()).status).toBe(401);
    expect((await approve().set("Cookie", `dayflow_token=${user.token}`)).status).toBe(401);
    await DesktopRequestModel.updateOne({ _id: body.requestId }, { $set: { expiresAt: new Date(0) } });
    expect((await request(app).post("/api/auth/desktop/exchange").send({ requestId: body.requestId, verifier })).status).toBe(410);
    expect((await request(app).post("/api/auth/desktop/start").send({ challenge: "bad" })).status).toBe(400);
  });
  it("atomically consumes an approved request during concurrent exchanges", async () => {
    const { body } = await start(); const user = await createSession("race");
    await request(app).post("/api/auth/desktop/approve").set(bearer(user.token)).send({ requestId: body.requestId, code: body.code });
    const results = await Promise.all([1, 2].map(() => request(app).post("/api/auth/desktop/exchange").send({ requestId: body.requestId, verifier })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
  });
});
