import { z } from "zod";
export const teamNameSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export const deleteTeamSchema = z.object({ name: z.string().min(1).max(100) });
const taskFields = {
  title: z.string().trim().min(1).max(200),
  descriptionHtml: z.string().max(2_000_000),
  status: z.enum(["todo", "in_progress", "completed"]),
  assigneeId: z.uuid().nullable(),
  estimatedDays: z.number().int().min(1).max(36500).nullable(),
};
export const createTaskSchema = z.object(taskFields);
export const patchTaskSchema = z
  .object(taskFields)
  .partial()
  .extend({
    version: z.number().int().min(1),
    orderIndex: z.number().finite().optional(),
  });
export const versionSchema = z.object({ version: z.number().int().min(1) });
export const messageSchema = z.object({
  id: z.uuid(),
  bodyText: z.string().trim().max(10000).default(""),
  bodyHtml: z.string().max(100000).default(""),
});
export const pageSchema = z.object({
  page: z.coerce.number().int().min(0).max(100000).default(0),
  q: z.string().max(200).default(""),
  kind: z.enum(["completed", "removed"]).default("completed"),
});
export const messageQuerySchema = z.object({ before: z.uuid().optional() });
export const readSchema = z.object({ messageId: z.uuid() });
