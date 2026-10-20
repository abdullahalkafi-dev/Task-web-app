// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type PushChange } from "./api";
import { DayflowDB } from "./db";
import { createTask, deleteTask, queueImage, updateTask } from "./repo";
import { SyncEngine } from "./sync";
import type { TaskDoc } from "./types";

type Wire = Omit<TaskDoc, "userId">;

const server = vi.hoisted(() => ({
  pushes: [] as PushChange[][],
  pushImpl: null as null | ((changes: PushChange[]) => unknown),
  pullTasks: [] as unknown[],
  uploads: 0,
  offline: false,
}));

vi.mock("./api", async (orig) => {
  const actual = await orig<typeof import("./api")>();
  return {
    ...actual,
    api: {
      push: async (changes: PushChange[]) => {
        if (server.offline) throw new actual.ApiError(0, "NETWORK", "offline");
        server.pushes.push(changes);
        if (server.pushImpl) return server.pushImpl(changes);
        return {
          results: changes.map((c) => ({ entity: c.entity, id: (c.doc as { id: string }).id, applied: true, winner: c.doc })),
          serverTime: new Date().toISOString(),
        };
      },
      pull: async () => {
        if (server.offline) throw new actual.ApiError(0, "NETWORK", "offline");
        return { tasks: server.pullTasks, notes: [], serverTime: "2026-10-20T10:00:00.000Z" };
      },
      upload: async () => {
        if (server.offline) throw new actual.ApiError(0, "NETWORK", "offline");
        server.uploads++;
        return { url: "/uploads/u1/uploaded.webp", width: 10, height: 10 };
      },
    },
  };
});

let db: DayflowDB;
let engine: SyncEngine;
let n = 0;

beforeEach(() => {
  server.pushes = [];
  server.pushImpl = null;
  server.pullTasks = [];
  server.uploads = 0;
  server.offline = false;
  db = new DayflowDB(`u${++n}_${Date.now()}`);
  engine = new SyncEngine(db, "u1");
});

const input = (title: string) => ({ title, descriptionHtml: "", estimatedMinutes: 30, status: "notStarted" as const });

describe("sync engine", () => {
  it("pushes the outbox and clears it only after the server acknowledges", async () => {
    const t = await createTask(db, "u1", input("A"));
    expect(await db.outbox.count()).toBe(1);
    await engine.syncOnce();
    expect(server.pushes).toHaveLength(1);
    expect(server.pushes[0][0]).toMatchObject({ entity: "task", op: "upsert", doc: { id: t.id, title: "A" } });
    expect((server.pushes[0][0].doc as Record<string, unknown>).userId).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
    expect(engine.getSnapshot().state).toBe("synced");
  });

  it("keeps everything queued when the network is down (zero data loss), then recovers", async () => {
    await createTask(db, "u1", input("A"));
    server.offline = true;
    await engine.syncOnce();
    expect(await db.outbox.count()).toBe(1);
    expect(await db.tasks.count()).toBe(1);
    expect(engine.getSnapshot().state).toBe("offline");
    server.offline = false;
    await engine.syncOnce();
    expect(await db.outbox.count()).toBe(0);
    expect(engine.getSnapshot()).toMatchObject({ state: "synced", pendingCount: 0 });
  });

  it("coalesces several edits of one task into one change with the latest content", async () => {
    const t = await createTask(db, "u1", input("v1"));
    await updateTask(db, t.id, { title: "v2" });
    await updateTask(db, t.id, { title: "v3" });
    await engine.syncOnce();
    expect(server.pushes[0]).toHaveLength(1);
    expect((server.pushes[0][0].doc as Wire).title).toBe("v3");
  });

  it("sends deletions as tombstones", async () => {
    const t = await createTask(db, "u1", input("A"));
    await engine.syncOnce();
    await deleteTask(db, t.id);
    await engine.syncOnce();
    const change = server.pushes[1][0];
    expect(change.op).toBe("delete");
    expect((change.doc as Wire).deletedAt).not.toBeNull();
  });

  it("applies the server's winner when our edit lost (LWW)", async () => {
    const t = await createTask(db, "u1", input("mine"));
    const winner: Wire = { ...(t as Wire), title: "theirs", updatedAt: new Date(Date.now() + 60_000).toISOString() };
    server.pushImpl = (changes) => ({
      results: changes.map((c) => ({ entity: c.entity, id: t.id, applied: false, winner })),
      serverTime: new Date().toISOString(),
    });
    await engine.syncOnce();
    expect((await db.tasks.get(t.id))?.title).toBe("theirs");
    expect(await db.outbox.count()).toBe(0);
  });

  it("pull merges: newer remote overwrites, older remote never overwrites local", async () => {
    const t = await createTask(db, "u1", input("local"));
    await engine.syncOnce();
    const base = t as Wire;
    server.pullTasks = [{ ...base, title: "stale", updatedAt: new Date(new Date(t.updatedAt).getTime() - 5000).toISOString() }];
    await engine.syncOnce();
    expect((await db.tasks.get(t.id))?.title).toBe("local");
    server.pullTasks = [{ ...base, title: "fresh", updatedAt: new Date(Date.now() + 5000).toISOString() }];
    await engine.syncOnce();
    expect((await db.tasks.get(t.id))?.title).toBe("fresh");
  });

  it("pulls new remote tasks into the local DB and remembers lastPulledAt", async () => {
    const remote: Wire = {
      id: "remote-1", taskDate: "2026-10-20", title: "From phone", descriptionHtml: "", descriptionText: "", estimatedMinutes: 10,
      status: "started", orderIndex: 1024, copiedFromDate: null, copiedFromTaskId: null,
      createdAt: "2026-10-20T01:00:00.000Z", updatedAt: "2026-10-20T01:00:00.000Z", deletedAt: null,
    };
    server.pullTasks = [remote];
    await engine.syncOnce();
    expect(await db.tasks.get("remote-1")).toMatchObject({ title: "From phone", userId: "u1" });
    expect((await db.meta.get("lastPulledAt"))?.value).toBe("2026-10-20T10:00:00.000Z");
  });

  it("uploads queued offline images first, rewrites the HTML, then pushes", async () => {
    const t = await createTask(db, "u1", input("with image"));
    const { localId } = await queueImage(db, "task", t.id, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    await updateTask(db, t.id, { descriptionHtml: `<p>hi</p><img src="blob:xyz" data-local-id="${localId}">` });
    await engine.syncOnce();
    expect(server.uploads).toBe(1);
    const pushedHtml = server.pushes.flat().map((c) => (c.doc as Wire).descriptionHtml).pop() ?? "";
    expect(pushedHtml).toContain('src="/uploads/u1/uploaded.webp"');
    expect(pushedHtml).not.toContain("blob:");
    expect(pushedHtml).not.toContain("data-local-id");
    expect(await db.pendingUploads.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it("never pushes a doc that still references an un-uploaded image", async () => {
    const t = await createTask(db, "u1", input("blocked"));
    const { localId } = await queueImage(db, "task", t.id, new Blob([new Uint8Array([1])], { type: "image/png" }));
    await updateTask(db, t.id, { descriptionHtml: `<img src="blob:abc" data-local-id="${localId}">` });
    server.offline = true; // uploads need the network too
    await engine.syncOnce();
    expect(server.pushes.flat().filter((c) => (c.doc as Wire).descriptionHtml.includes("blob:"))).toHaveLength(0);
    expect(await db.outbox.count()).toBeGreaterThan(0);
    expect(await db.pendingUploads.count()).toBe(1);
  });

  it("a 401 keeps local data and flags the session as expired", async () => {
    await createTask(db, "u1", input("A"));
    server.pushImpl = () => {
      throw new ApiError(401, "UNAUTHORIZED", "expired");
    };
    await engine.syncOnce();
    expect(engine.getSnapshot().unauthorized).toBe(true);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.outbox.count()).toBe(1);
  });
});
