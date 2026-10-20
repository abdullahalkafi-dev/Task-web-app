import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app";
import { bearer, clearDb, createSession } from "../../test/helpers";
import { UserModel } from "../user/user.model";
import { verifyGoogleCredential } from "./google.verifier";

vi.mock("./google.verifier", () => ({ verifyGoogleCredential: vi.fn() }));
const verify = vi.mocked(verifyGoogleCredential);

const CREDENTIAL = "x".repeat(40);
const googleLogin = () => request(app).post("/api/auth/google").send({ credential: CREDENTIAL });

describe("auth (Google)", () => {
  beforeEach(async () => {
    await clearDb();
    verify.mockReset();
  });

  it("exposes the client id publicly", async () => {
    const res = await request(app).get("/api/auth/config");
    expect(res.body.googleClientId).toBe("test-client.apps.googleusercontent.com");
  });

  it("creates the account on first sign-in, returns token + user and sets an httpOnly cookie", async () => {
    verify.mockResolvedValue({ sub: "g1", email: "Sajib@Gmail.com", emailVerified: true, name: "Sajib" });
    const res = await googleLogin();
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({ email: "sajib@gmail.com", name: "Sajib", role: "user" });
    const cookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookie).toContain("dayflow_token=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("records last login and login count on every sign-in without duplicating the user", async () => {
    verify.mockResolvedValue({ sub: "g1", email: "a@gmail.com", emailVerified: true });
    const first = await googleLogin();
    const before = await UserModel.findById(first.body.user.id).lean();
    await new Promise((r) => setTimeout(r, 15));
    const second = await googleLogin();
    expect(second.body.user.id).toBe(first.body.user.id);
    const after = await UserModel.findById(first.body.user.id).lean();
    expect(await UserModel.countDocuments()).toBe(1);
    expect(after?.loginCount).toBe(2);
    expect(after!.lastLoginAt.getTime()).toBeGreaterThan(before!.lastLoginAt.getTime());
  });

  it("promotes listed emails to superadmin (case-insensitive) and nobody else", async () => {
    verify.mockResolvedValueOnce({ sub: "boss", email: "boss@test.dev", emailVerified: true });
    expect((await googleLogin()).body.user.role).toBe("superadmin");
    verify.mockResolvedValueOnce({ sub: "rando", email: "rando@gmail.com", emailVerified: true });
    expect((await googleLogin()).body.user.role).toBe("user");
  });

  it("rejects invalid tokens, unverified emails and malformed bodies", async () => {
    verify.mockResolvedValueOnce(null);
    const bad = await googleLogin();
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe("INVALID_GOOGLE_TOKEN");
    verify.mockResolvedValueOnce({ sub: "g2", email: "b@gmail.com", emailVerified: false });
    expect((await googleLogin()).status).toBe(403);
    expect((await request(app).post("/api/auth/google").send({})).status).toBe(400);
  });

  it("the password endpoints are gone", async () => {
    expect((await request(app).post("/api/auth/login").send({ username: "a", password: "b" })).status).toBe(404);
    expect((await request(app).post("/api/auth/change-password").send({})).status).toBe(404);
  });

  it("GET /auth/me works with Bearer and with the cookie, and refreshes the cookie", async () => {
    const { token } = await createSession("sajib");
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    const viaBearer = await request(app).get("/api/auth/me").set(bearer(token));
    expect(viaBearer.status).toBe(200);
    expect((viaBearer.headers["set-cookie"] as unknown as string[]).join(";")).toContain("dayflow_token=");
    const viaCookie = await request(app).get("/api/auth/me").set("Cookie", `dayflow_token=${token}`);
    expect(viaCookie.status).toBe(200);
    expect(viaCookie.body.user.email).toBe("sajib@test.dev");
  });

  it("CSRF: a cookie alone cannot perform a write", async () => {
    const { token } = await createSession("sajib");
    const res = await request(app).post("/api/sync/push").set("Cookie", `dayflow_token=${token}`).send({ changes: [] });
    expect(res.status).toBe(401);
  });

  it("logout clears the cookie", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect((res.headers["set-cookie"] as unknown as string[]).join(";")).toMatch(/dayflow_token=;/);
  });
});
