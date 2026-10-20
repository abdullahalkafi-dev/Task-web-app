import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE } from "../modules/auth/auth.interface";
import { verifyToken } from "../modules/auth/auth.service";
import { AppError } from "../utils/AppError";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

/**
 * Bearer header works for every method. The httpOnly cookie is accepted ONLY on
 * safe GET/HEAD requests, so a cross-site write can never ride on the cookie (CSRF).
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
  const user = verifyToken(token);
  if (!user) {
    next(new AppError(401, "UNAUTHORIZED", "Invalid or expired session"));
    return;
  }
  req.user = user;
  next();
}
