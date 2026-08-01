import { fileURLToPath, pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  net,
  protocol,
  screen,
  session,
  type BrowserWindowConstructorOptions,
  type Session,
} from "electron";
import {
  parseAttachedEndpoint,
  type Scheduler,
} from "@iris/jarvis-adapter";

import {
  JarvisAuthSession,
  createSessionTransport,
  type AuthSessionLike,
  type AuthWindowLike,
} from "./auth-session.js";
import { registerJarvisIpc } from "./ipc.js";
import { createHudNativeController, type HudNativeSnapshot } from "./hud-native.js";
import { createAttachedRuntime } from "./runtime.js";
import { createConversationRuntime } from "./conversation-runtime.js";
import {
  AUTH_PARTITION,
  isTrustedAudioPermission,
  isTrustedVideoPermission,
  rendererEntry,
  resolveRendererAsset,
  shellWindowOptions,
} from "./security.js";

protocol.registerSchemesAsPrivileged([{
  scheme: "iris",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    codeCache: true,
  },
}]);

const DEFAULT_JARVIS_ENDPOINT = "http://127.0.0.1:7777";
const scheduler: Scheduler = {
  set: (delayMs, task) => setTimeout(task, delayMs),
  clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

let shellWindow: BrowserWindow | undefined;
let shutdown: (() => void) | undefined;

function denySessionPermissions(target: Session): void {
  target.setPermissionCheckHandler(() => false);
  target.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
}

function hardenShell(
  window: BrowserWindow,
  trustedUrl: string,
  hudNative: ReturnType<typeof createHudNativeController>,
  consumeMicrophonePermissionIntent: () => boolean,
): void {
  window.webContents.session.setPermissionCheckHandler((webContents, permission) => (
    permission === "media"
    && webContents?.id === window.webContents.id
    && webContents.getURL() === trustedUrl
  ));
  window.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const mediaTypes = "mediaTypes" in details ? details.mediaTypes : undefined;
    const permissionInput = {
        webContentsId: webContents.id,
        shellWebContentsId: window.webContents.id,
        currentUrl: webContents.getURL(),
        trustedUrl,
        permission,
        mediaTypes,
      } as const;
    const videoAllowed = isTrustedVideoPermission(permissionInput) && hudNative.consumeCameraPermissionIntent();
    const audioAllowed = isTrustedAudioPermission(permissionInput) && consumeMicrophonePermissionIntent();
    callback(videoAllowed || audioAllowed);
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  const guardNavigation = (event: Electron.Event, url: string) => {
    if (url !== trustedUrl) event.preventDefault();
  };
  window.webContents.on("will-navigate", guardNavigation);
  window.webContents.on("will-redirect", guardNavigation);
}

function authSessionFacade(target: Session): AuthSessionLike {
  return {
    fetch: (input, init) => target.fetch(input, init),
    setPermissionCheckHandler: (handler) => target.setPermissionCheckHandler(handler),
    setPermissionRequestHandler: (handler) => target.setPermissionRequestHandler(
      (webContents, permission, callback) => handler(webContents, permission, callback),
    ),
  };
}

function createAuthWindow(options: BrowserWindowConstructorOptions): AuthWindowLike {
  if (shellWindow === undefined) throw new Error("Iris shell window is unavailable");
  const window = new BrowserWindow({
    ...options,
    parent: shellWindow,
    modal: true,
  });
  return {
    close: () => window.close(),
    focus: () => window.focus(),
    isDestroyed: () => window.isDestroyed(),
    loadURL: (url) => window.loadURL(url),
    on: (_event, listener) => window.on("closed", listener),
    show: () => window.show(),
    webContents: {
      on: (event, listener) => event === "will-navigate"
        ? window.webContents.on("will-navigate", (navigationEvent, url) => listener(navigationEvent, url))
        : window.webContents.on("will-redirect", (navigationEvent, url) => listener(navigationEvent, url)),
      setWindowOpenHandler: (handler) => window.webContents.setWindowOpenHandler(
        (details) => handler({ url: details.url }),
      ),
    },
  };
}

async function installRendererProtocol(rendererRoot: string): Promise<void> {
  await protocol.handle("iris", (request) => {
    const assetPath = resolveRendererAsset(rendererRoot, request.url);
    if (assetPath === undefined) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(assetPath).href);
  });
}

async function bootstrap(): Promise<void> {
  const endpoint = parseAttachedEndpoint(process.env.IRIS_JARVIS_ENDPOINT ?? DEFAULT_JARVIS_ENDPOINT);
  const trustedRendererUrl = rendererEntry(process.argv);
  const rendererRoot = fileURLToPath(new URL("../../renderer/", import.meta.url));
  const preloadPath = fileURLToPath(new URL("../preload/preload.cjs", import.meta.url));

  await installRendererProtocol(rendererRoot);
  const jarvisSession = session.fromPartition(AUTH_PARTITION, { cache: false });
  denySessionPermissions(jarvisSession);
  const runtime = createAttachedRuntime({
    endpoint,
    transport: createSessionTransport(authSessionFacade(jarvisSession)),
    scheduler,
  });
  const conversation = createConversationRuntime({
    env: process.env,
    scheduler,
    getJarvisSnapshot: () => {
      const current = runtime.controller.current();
      return {
        connection: current.connection,
        health: { authenticated: current.health.authenticated },
        brains: current.brains.map((brain) => ({ id: brain.id, isDefault: brain.isDefault })),
        sessions: current.sessions.map((currentSession) => ({ id: currentSession.id })),
      };
    },
  });
  let microphonePermissionIntent = false;
  const hudNative = createHudNativeController();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());

  shellWindow = new BrowserWindow(shellWindowOptions(preloadPath, display.workArea));
  hardenShell(shellWindow, trustedRendererUrl, hudNative, () => {
    const allowed = microphonePermissionIntent;
    microphonePermissionIntent = false;
    return allowed;
  });
  shellWindow.once("ready-to-show", () => shellWindow?.show());

  const applyHudSnapshot = (snapshot: HudNativeSnapshot) => {
    if (shellWindow === undefined || shellWindow.isDestroyed()) return;
    shellWindow.setAlwaysOnTop(true, "floating");
    shellWindow.setSkipTaskbar(snapshot.mode === "hud");
    shellWindow.setIgnoreMouseEvents(!snapshot.pointerInteractive, { forward: true });
    if (snapshot.mode === "deck") {
      shellWindow.show();
      shellWindow.focus();
    }
  };
  const unsubscribeHudWindow = hudNative.subscribe(applyHudSnapshot);
  const shortcutRegistered = globalShortcut.register("CommandOrControl+Shift+Space", () => {
    const current = hudNative.current();
    hudNative.setMode(current.mode === "hud" ? "deck" : "hud");
  });
  hudNative.setShortcutAvailable(shortcutRegistered);
  if (shortcutRegistered) hudNative.setMode("hud");
  applyHudSnapshot(hudNative.current());

  const auth = new JarvisAuthSession({
    endpoint,
    session: authSessionFacade(jarvisSession),
    createWindow: createAuthWindow,
    scheduler,
    onAuthenticated: async () => {
      await Promise.all([
        runtime.controller.refresh(),
        runtime.taskController.reconnect(),
      ]);
    },
  });
  const cleanupIpc = registerJarvisIpc({
    ipcMain: {
      handle: (channel, handler) => ipcMain.handle(channel, (event, value) => handler(event, value)),
      removeHandler: (channel) => ipcMain.removeHandler(channel),
    },
    shellWebContents: shellWindow.webContents,
    controller: runtime.controller,
    knowledge: runtime.client,
    task: runtime.taskController,
    openSignIn: () => auth.open(),
    hudNative,
    conversation: conversation.controller,
    requestMicrophonePermissionIntent: (enabled) => {
      microphonePermissionIntent = enabled;
      conversation.controller.setMicrophoneState(enabled ? "requesting" : "off");
    },
    rendererUrl: trustedRendererUrl,
  });

  runtime.controller.start();
  await shellWindow.loadURL(trustedRendererUrl);
  console.info("[iris] shell_ready", { mode: "attached", endpoint: endpoint.href });

  shutdown = () => {
    cleanupIpc();
    unsubscribeHudWindow();
    globalShortcut.unregister("CommandOrControl+Shift+Space");
    runtime.controller.stop();
    runtime.taskController.dispose();
    void conversation.controller.stop();
    protocol.unhandle("iris");
  };
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (shellWindow?.isMinimized()) shellWindow.restore();
    shellWindow?.focus();
  });
  app.on("before-quit", () => {
    shutdown?.();
    shutdown = undefined;
  });
  app.on("window-all-closed", () => app.quit());
  void app.whenReady()
    .then(bootstrap)
    .catch(() => {
      console.error("[iris] startup_failed");
      app.quit();
    });
}
