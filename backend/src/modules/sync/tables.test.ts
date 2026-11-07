import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import {
  bearer,
  clearDb,
  createUserWithToken,
  noteDoc,
  taskDoc,
} from "../../test/helpers";

const table =
  "<table><tbody><tr><th>Timeline</th><th>Work</th></tr><tr><td><strong>Month 1</strong></td><td>Design</td></tr></tbody></table>";
describe("table sync and legacy-client protection", () => {
  beforeEach(clearDb);
  for (const entity of ["task", "note"] as const) {
    it(`persists ${entity} tables, blocks legacy flattening, permits capable removal`, async () => {
      const { token } = await createUserWithToken(`table-${entity}`);
      const doc = (entity === "task" ? taskDoc : noteDoc)({
        descriptionHtml: table,
      });
      const push = (html: string, stamp: number, capable = false) =>
        request(app)
          .post("/api/sync/push")
          .set({
            ...bearer(token),
            ...(capable ? { "X-Dayflow-Rich-Content": "tables-v1" } : {}),
          })
          .send({
            changes: [
              {
                entity,
                op: "upsert",
                doc: {
                  ...doc,
                  descriptionHtml: html,
                  updatedAt: new Date(
                    Date.parse(doc.updatedAt as string) + stamp,
                  ).toISOString(),
                },
              },
            ],
          });
      expect((await push(table, 0, true)).status).toBe(200);
      const failed = await push("<p>TimelineWorkMonth 1Design</p>", 10);
      expect(failed.status).toBe(409);
      expect(failed.body.error.code).toBe("EDITOR_UPDATE_REQUIRED");
      const pull = await request(app).get("/api/sync/pull").set(bearer(token));
      const saved = pull.body[entity === "task" ? "tasks" : "notes"][0];
      expect(saved.descriptionHtml).toContain("<table>");
      expect(saved.descriptionText).toBe("Timeline Work Month 1 Design");
      expect((await push(saved.descriptionHtml, 20)).status).toBe(200);
      expect(
        (await push("<p>Intentionally replaced</p>", 30, true)).status,
      ).toBe(200);
    });
  }
});
