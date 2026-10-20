import type { UserRole } from "../user/user.interface";

export const AUTH_COOKIE = "dayflow_token";
export const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface IAuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
