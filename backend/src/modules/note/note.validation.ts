import { z } from "zod";

export const noteUpsertSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().max(300).default("Untitled note"),
  descriptionHtml: z.string().max(2_000_000).default(""),
  descriptionText: z.string().max(2000).optional(),
  orderIndex: z.number().finite(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable().default(null),
});
