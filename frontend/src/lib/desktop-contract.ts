/** Version 1: additive changes only; hosted UI must also work without this bridge. */
export interface DesktopState {
  version: 1;
  mode: "compact" | "expanded";
  pinned: boolean;
  startAtLogin: boolean;
  shortcut: string;
  bubbleVisible: boolean;
}

export interface DesktopSession {
  token: string;
  user: { id: string; email: string; name?: string; role: "user" | "superadmin" };
}

export interface DesktopBridge {
  getState(): Promise<DesktopState>;
  expand(): Promise<void>;
  compact(): Promise<void>;
  collapse(): Promise<void>;
  settings(settings: Partial<Pick<DesktopState, "pinned" | "startAtLogin" | "shortcut" | "bubbleVisible">>): Promise<DesktopState>;
  signIn(): Promise<{ code: string }>;
  cancelSignIn(): Promise<void>;
  onState(callback: (state: DesktopState) => void): () => void;
  onSession(callback: (session: DesktopSession) => void): () => void;
  onAuthError(callback: (message: string) => void): () => void;
  onFlush(callback: () => Promise<void>): () => void;
}

declare global {
  interface Window { dayflowDesktop?: DesktopBridge }
}
