import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../../frontend/src/lib/desktop-contract";
function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, value: T): void => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
const bridge: DesktopBridge = {
  getState: () => ipcRenderer.invoke("desktop:state"),
  expand: () => ipcRenderer.invoke("desktop:expand"),
  compact: () => ipcRenderer.invoke("desktop:compact"),
  collapse: () => ipcRenderer.invoke("desktop:collapse"),
  settings: (value) => ipcRenderer.invoke("desktop:settings", value),
  signIn: () => ipcRenderer.invoke("desktop:signin"),
  cancelSignIn: () => ipcRenderer.invoke("desktop:cancel-signin"),
  onState: (cb) => subscribe("desktop:state", cb),
  onSession: (cb) => subscribe("desktop:session", cb),
  onAuthError: (cb) => subscribe("desktop:auth-error", cb),
  onFlush: (callback) => subscribe<string>("desktop:flush", (id) => {
    void callback().then(() => ipcRenderer.send("desktop:flushed", id, true), () => ipcRenderer.send("desktop:flushed", id, false));
  }),
};
contextBridge.exposeInMainWorld("dayflowDesktop", Object.freeze(bridge));
