import type { AuthUser } from "../modules/auth/auth.interface";

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
      /** Set only when the request was authenticated with a personal API key. */
      apiKey?: { id: string; write: boolean };
    }
  }
}

export {};
