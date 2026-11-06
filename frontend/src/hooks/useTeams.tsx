"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api";
import { refreshTeams, teamsApi } from "@/lib/teams-api";
import type { TeamInvite, TeamSummary } from "@dayflow/shared";

export function useTeamResource<T>(
  key: string,
  loader: () => Promise<T>,
  enabled = true,
) {
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: Error;
    loading: boolean;
  }>({ key, loading: enabled });
  const generation = useRef({ value: 0 });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const reload = useCallback(async () => {
    if (!enabled) return;
    const stamp = ++generation.current.value;
    try {
      const data = await loaderRef.current();
      if (stamp === generation.current.value)
        setState({ key, data, loading: false });
    } catch (error) {
      if (stamp === generation.current.value)
        setState((old) => ({
          key,
          data:
            old.key === key &&
            !(
              error instanceof ApiError &&
              [401, 403, 404].includes(error.status)
            )
              ? old.data
              : undefined,
          error:
            error instanceof Error
              ? error
              : new Error("Could not load team data."),
          loading: false,
        }));
    }
  }, [key, enabled]);
  useEffect(() => {
    if (!enabled) return;
    void reload();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 180);
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("dayflow:teams", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    const poll = setInterval(visible, 30000);
    const counter = generation.current;
    return () => {
      counter.value++;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("dayflow:teams", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, reload]);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: state.key !== key || state.loading,
    reload,
  };
}
interface TeamsContextValue {
  teams: TeamSummary[];
  invites: TeamInvite[];
  loading: boolean;
  error?: Error;
  refresh: () => void;
}
const Context = createContext<TeamsContextValue>({
  teams: [],
  invites: [],
  loading: true,
  refresh: refreshTeams,
});
export function TeamsProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const resource = useTeamResource(`teams:${userId}`, async () => {
    const [a, b] = await Promise.all([teamsApi.list(), teamsApi.invites()]);
    return { teams: a.teams, invites: b.invites };
  });
  return (
    <Context.Provider
      value={{
        teams: resource.data?.teams ?? [],
        invites: resource.data?.invites ?? [],
        loading: resource.loading,
        error: resource.error,
        refresh: refreshTeams,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTeams() {
  return useContext(Context);
}
