import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE } from "../modules/auth/auth.interface";
import { verifyToken } from "../modules/auth/auth.service";
import { API_KEY_PREFIX } from "../modules/apikey/apikey.interface";
import { ApiKeyModel } from "../modules/apikey/apikey.model";
import { hashSecret } from "../modules/apikey/apikey.service";
import { UserModel } from "../modules/user/user.model";
import { AppError } from "../utils/AppError";

const SAFE_METHODS = new Set(["GET", "HEAD"]);
const KEY_READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LAST_USED_INTERVAL_MS = 60_000;

async function authenticateKey(req: Request, secret: string): Promise<void> {
  const key = await ApiKeyModel.findOne({ hash: hashSecret(secret) }).lean();
  if (!key) throw new AppError(401, "UNAUTHORIZED", "Invalid API key");
  const user = await UserModel.findById(key.userId).lean();
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Invalid API key");
  if (!key.write && !KEY_READ_METHODS.has(req.method)) {
    throw new AppError(
      403,
      "KEY_READ_ONLY",
      "This API key is read-only. Turn on 'Allow changes' for this key in Dayflow (profile menu > API keys) and try again.",
    );
  }
  req.user = { id: user._id, email: user.email, role: "user" };
  req.apiKey = { id: key._id, write: key.write };
  const now = Date.now();
  if (!key.lastUsedAt || now - key.lastUsedAt.getTime() >= LAST_USED_INTERVAL_MS) {
    void ApiKeyModel.updateOne({ _id: key._id }, { lastUsedAt: new Date(now) }).catch(() => undefined);
  }
}

/**
 * Bearer header works for every method. The httpOnly cookie is accepted ONLY on
 * safe GET/HEAD requests, so a cross-site write can never ride on the cookie (CSRF).
 * Bearer tokens starting with `dfk_` are personal API keys (never admin).
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let token: string | undefined;
  if (header && header.startsWith("Bearer ")) {
    token = header.slice(7).trim();
  } else if (SAFE_METHODS.has(req.method)) {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    token = cookies?.[AUTH_COOKIE];
  }
  if (!token) {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    return;
  }
  if (token.startsWith(API_KEY_PREFIX)) {
    authenticateKey(req, token).then(() => next(), next);
    return;
  }
  const user = verifyToken(token);
  if (!user) {
    next(new AppError(401, "UNAUTHORIZED", "Invalid or expired session"));
    return;
  }
  req.user = user;
  next();
}

/** Run after authenticate: API keys may not use this route. */
export function rejectApiKey(req: Request, _res: Response, next: NextFunction): void {
  if (req.apiKey) {
    next(new AppError(403, "KEY_NOT_ALLOWED", "API keys cannot use this endpoint"));
    return;
  }
  next();
}

/** Blocks any request bearing an API key, without needing authenticate first. */
export function blockApiKeyHeader(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ") && header.slice(7).trim().startsWith(API_KEY_PREFIX)) {
    next(new AppError(403, "KEY_NOT_ALLOWED", "API keys cannot use this endpoint"));
    return;
  }
  next();
}
