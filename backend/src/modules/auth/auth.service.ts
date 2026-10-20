import jwt from "jsonwebtoken";
import { config } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { verifyGoogleCredential } from "./google.verifier";
import type { IUserPublic } from "../user/user.interface";
import * as userService from "../user/user.service";
import type { AuthUser, IAuthTokenPayload } from "./auth.interface";
import { tokenPayloadSchema } from "./auth.validation";

export function signToken(user: AuthUser): string {
  const payload: IAuthTokenPayload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, config.JWT_SECRET, { algorithm: "HS256", expiresIn: "30d" });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded: unknown = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] });
    const parsed = tokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) return null;
    return { id: parsed.data.sub, email: parsed.data.email, role: parsed.data.role };
  } catch {
    return null;
  }
}

export function getPublicConfig(): { googleClientId: string | null } {
  return { googleClientId: config.GOOGLE_CLIENT_ID ?? null };
}

/** Sign in, or create the account on first use, with a Google ID token. */
export async function loginWithGoogle(credential: string): Promise<{ token: string; user: IUserPublic }> {
  if (!config.GOOGLE_CLIENT_ID) throw new AppError(503, "GOOGLE_NOT_CONFIGURED", "Google sign-in is not enabled on this server");
  const identity = await verifyGoogleCredential(credential);
  if (!identity) throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Google sign-in failed. Try again.");
  if (!identity.emailVerified) throw new AppError(403, "EMAIL_NOT_VERIFIED", "Your Google email address is not verified");
  const email = identity.email.toLowerCase();
  const user = await userService.recordGoogleLogin({
    googleId: identity.sub,
    email,
    ...(identity.name ? { name: identity.name } : {}),
    promote: config.SUPERADMIN_EMAILS.includes(email),
  });
  const token = signToken({ id: user._id, email: user.email, role: user.role });
  return { token, user: userService.toPublicUser(user) };
}

/** Reads the account from the database; `auth` carries the fresh role for re-signing the token. */
export async function getMe(userId: string): Promise<{ user: IUserPublic; auth: AuthUser }> {
  const user = await userService.findById(userId);
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Account no longer exists");
  return { user: userService.toPublicUser(user), auth: { id: user._id, email: user.email, role: user.role } };
}
