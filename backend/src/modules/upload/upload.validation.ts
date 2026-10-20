import { z } from "zod";

export const fileParamsSchema = z.object({
  userId: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
  file: z.string().regex(/^[a-f0-9-]{36}\.(webp|gif)$/),
});

export type FileParams = z.infer<typeof fileParamsSchema>;
