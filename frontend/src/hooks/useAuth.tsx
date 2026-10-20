"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, configureApi } from "@/lib/api";
import { getAppDb, getMeta, setMeta } from "@/lib/db";
import type { Session, User } from "@/lib/types";

type Status = "loading" | "authed" | "anon";

interface AuthValue {
  status: Status;
  user: User | null;
  token: string | null;
  /** The server rejected our token (401). Local data is kept; the user is asked to sign in again. */
  expired: boolean;
  /** Exchanges a Google ID token (from the Sign in with Google button) for a session. */
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    configureApi({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        if (tokenRef.current) setExpired(true);
      },
    });
  }, []);

  const persist = useCallback(async (session: Session) => {
    tokenRef.current = session.token;
    setToken(session.token);
    setUser(session.user);
    await setMeta(getAppDb(), "session", session);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let session: Session | undefined;
      try {
        session = await getMeta<Session>(getAppDb(), "session");
      } catch {
        session = undefined;
      }
      if (cancelled) return;
      if (!session) {
        setStatus("anon");
        return;
      }
      // Offline-first: open straight into the cached session.
      tokenRef.current = session.token;
      setToken(session.token);
      setUser(session.user);
      setStatus("authed");
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        // Refreshes the user profile AND re-sets the httpOnly cookie if it was cleared.
        const res = await api.me(session.token);
        if (!cancelled) await persist({ token: session.token, user: res.user });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && !cancelled) setExpired(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const res = await api.googleLogin(credential);
      await persist({ token: res.token, user: res.user });
      setExpired(false);
      setStatus("authed");
    },
    [persist],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* offline: the cookie will expire on its own; the local session is cleared below */
    }
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setExpired(false);
    try {
      await getAppDb().meta.delete("session");
    } catch {
      /* ignore */
    }
    setStatus("anon");
  }, []);

  const updateUser = useCallback(
    async (next: User) => {
      if (tokenRef.current) await persist({ token: tokenRef.current, user: next });
    },
    [persist],
  );

  const value = useMemo<AuthValue>(
    () => ({ status, user, token, expired, loginWithGoogle, logout, updateUser }),
    [status, user, token, expired, loginWithGoogle, logout, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
