import { z } from "zod";
import { isAcceptableTaskDate, isValidDateKey, isValidMonthKey } from "../../utils/dhaka";

export const taskUpsertSchema = z.object({
  id: z.uuid(),
  taskDate: z.string().refine((v) => isAcceptableTaskDate(v), "Invalid or future taskDate"),
  title: z.string().trim().min(1).max(200),
  descriptionHtml: z.string().max(2_000_000).default(""),
  descriptionText: z.string().max(2000).optional(),
  estimatedMinutes: z.number().int().min(0).max(1439),
  status: z.enum(["notStarted", "started", "completed"]),
  orderIndex: z.number().finite(),
  copiedFromDate: z.string().refine(isValidDateKey).nullable().default(null),
  copiedFromTaskId: z.string().nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable().default(null),
});

export const dateQuerySchema = z.object({
  date: z.string().refine(isValidDateKey, "date must be YYYY-MM-DD"),
});

export const monthQuerySchema = z.object({
  month: z.string().refine(isValidMonthKey, "month must be YYYY-MM"),
});

export const idParamSchema = z.object({ id: z.string().min(1).max(64) });

export type DateQuery = z.infer<typeof dateQuerySchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
export type IdParams = z.infer<typeof idParamSchema>;
