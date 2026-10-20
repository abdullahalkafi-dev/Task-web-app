import { z } from "zod";
import { noteUpsertSchema } from "../note/note.validation";
import { taskUpsertSchema } from "../task/task.validation";

const op = z.enum(["upsert", "delete"]);

const taskChange = z.object({
  entity: z.literal("task"),
  op,
  doc: taskUpsertSchema,
  clientUpdatedAt: z.iso.datetime().optional(),
});

const noteChange = z.object({
  entity: z.literal("note"),
  op,
  doc: noteUpsertSchema,
  clientUpdatedAt: z.iso.datetime().optional(),
});

export const pushSchema = z.object({
  changes: z.array(z.discriminatedUnion("entity", [taskChange, noteChange])).max(100),
});

export const pullQuerySchema = z.object({
  since: z.iso.datetime().optional(),
});

export type PushBody = z.infer<typeof pushSchema>;
export type PullQuery = z.infer<typeof pullQuerySchema>;
