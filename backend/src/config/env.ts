import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1).default("mongodb://localhost:27017/dayflow"),
  JWT_SECRET: z.string().min(8).default("dev_only_secret_change_me"),
  /** Comma-separated Google emails that get the superadmin role when they sign in. Not seeded. */
  SUPERADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  /** When unset, the sign-in button is hidden and /auth/google returns 503. */
  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(10),
  UPLOAD_DIR: z.string().default("uploads"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type AppConfig = z.infer<typeof envSchema>;

const parsed = envSchema.parse(process.env);

export const config: AppConfig & { UPLOAD_ROOT: string } = {
  ...parsed,
  UPLOAD_ROOT: path.resolve(parsed.UPLOAD_DIR),
};
