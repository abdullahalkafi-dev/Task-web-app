import request from "supertest";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { bearer, clearDb, createUserWithToken, seedAdmin } from "../../test/helpers";

async function pngBuffer(width = 2400, height = 1200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 60 } } })
    .png()
    .toBuffer();
}

describe("uploads", () => {
  beforeEach(async () => {
    await clearDb();
    await seedAdmin();
  });

  it("requires a Bearer token to upload (cookie alone is rejected)", async () => {
    const a = await createUserWithToken("alice");
    const img = await pngBuffer();
    expect((await request(app).post("/api/uploads").attach("file", img, "a.png")).status).toBe(401);
    const cookieOnly = await request(app)
      .post("/api/uploads")
      .set("Cookie", `dayflow_token=${a.token}`)
      .attach("file", img, "a.png");
    expect(cookieOnly.status).toBe(401);
  });

  it("resizes to max 1600px wide and serves the file to its owner via cookie", async () => {
    const a = await createUserWithToken("alice");
    const up = await request(app).post("/api/uploads").set(bearer(a.token)).attach("file", await pngBuffer(), "a.png");
    expect(up.status).toBe(201);
    expect(up.body.width).toBe(1600);
    expect(up.body.url).toMatch(new RegExp(`^/uploads/${a.user.id}/[a-f0-9-]{36}\\.webp$`));

    const res = await request(app).get(up.body.url).set("Cookie", `dayflow_token=${a.token}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/webp");
    expect(res.headers["cache-control"]).toBe("private, max-age=31536000, immutable");
  });

  it("returns 401 logged out and 403 for another user's image", async () => {
    const a = await createUserWithToken("alice");
    const b = await createUserWithToken("bob");
    const up = await request(app).post("/api/uploads").set(bearer(a.token)).attach("file", await pngBuffer(400, 300), "a.png");
    expect((await request(app).get(up.body.url)).status).toBe(401);
    expect((await request(app).get(up.body.url).set("Cookie", `dayflow_token=${b.token}`)).status).toBe(403);
    expect((await request(app).get(up.body.url).set(bearer(b.token))).status).toBe(403);
  });

  it("keeps small images unscaled and gifs as gifs", async () => {
    const a = await createUserWithToken("alice");
    const small = await request(app).post("/api/uploads").set(bearer(a.token)).attach("file", await pngBuffer(300, 200), "s.png");
    expect(small.body.width).toBe(300);
    const gif = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } }).gif().toBuffer();
    const res = await request(app).post("/api/uploads").set(bearer(a.token)).attach("file", gif, "x.gif");
    expect(res.status).toBe(201);
    expect(res.body.url.endsWith(".gif")).toBe(true);
  });

  it("rejects missing, non-image and bad-name requests", async () => {
    const a = await createUserWithToken("alice");
    expect((await request(app).post("/api/uploads").set(bearer(a.token))).status).toBe(400);
    const bad = await request(app).post("/api/uploads").set(bearer(a.token)).attach("file", Buffer.from("hello"), "a.png");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("INVALID_IMAGE");
    expect((await request(app).get(`/uploads/${a.user.id}/..%2Fsecret.txt`).set(bearer(a.token))).status).toBe(400);
    expect((await request(app).get(`/uploads/${a.user.id}/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}.webp`).set(bearer(a.token))).status).toBe(404);
  });
});
