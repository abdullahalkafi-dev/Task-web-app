import { z } from "zod";

const name = z.string().trim().min(1).max(60);
export const createKeySchema = z.object({ name, write: z.boolean().optional() });
export const patchKeySchema = z.object({ name: name.optional(), write: z.boolean().optional() });
