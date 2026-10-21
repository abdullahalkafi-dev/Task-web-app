import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("bubble", Object.freeze({ open: () => ipcRenderer.send("bubble:open"), menu: () => ipcRenderer.send("bubble:menu"), move: (x: number, y: number) => ipcRenderer.send("bubble:move", x, y), snap: () => ipcRenderer.send("bubble:snap") }));
