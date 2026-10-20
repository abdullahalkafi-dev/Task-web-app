import type { Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { config } from "../../config/env";
import { catchAsync } from "../../utils/catchAsync";
import { AUTH_COOKIE, TOKEN_MAX_AGE_MS } from "./auth.interface";
import * as authService from "./auth.service";
import type { GoogleLoginBody } from "./auth.validation";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.COOKIE_SECURE,
  path: "/",
};

function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, { ...cookieBase, maxAge: TOKEN_MAX_AGE_MS });
}

export const googleLogin = catchAsync<ParamsDictionary, unknown, GoogleLoginBody>(async (req, res) => {
  const { token, user } = await authService.loginWithGoogle(req.body.credential);
  setAuthCookie(res, token);
  res.json({ token, user });
});

export const publicConfig = catchAsync(async (_req, res) => {
  res.json(authService.getPublicConfig());
});

export const logout = catchAsync(async (_req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieBase);
  res.json({ ok: true });
});

export const me = catchAsync(async (req, res) => {
  const { user, auth } = await authService.getMe(req.user.id);
  // Re-sign with the current role so a role change shows up without signing in again.
  setAuthCookie(res, authService.signToken(auth));
  res.json({ user });
});
