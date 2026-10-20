import { z } from "zod";

export const googleLoginSchema = z.object({
  credential: z.string().min(20).max(8192),
});

export const tokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1),
  role: z.enum(["superadmin", "user"]),
});

export type GoogleLoginBody = z.infer<typeof googleLoginSchema>;
