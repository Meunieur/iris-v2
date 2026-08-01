import { contextBridge, ipcRenderer } from "electron";

import { createRendererApi } from "./api.cjs";

contextBridge.exposeInMainWorld("iris", createRendererApi(ipcRenderer));
