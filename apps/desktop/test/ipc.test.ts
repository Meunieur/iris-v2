import { describe, expect, it, vi } from "vitest";

import type { JarvisReadSnapshot } from "@iris/jarvis-adapter";

import {
  IPC_CHANNELS,
  registerJarvisIpc,
  type IpcEventLike,
} from "../src/main/ipc";
import type { HudMode, HudNativeSnapshot } from "../src/main/hud-native";

const readySnapshot: JarvisReadSnapshot = Object.freeze({
  sequence: 3,
  capturedAt: "2026-07-24T07:00:00.000Z",
  endpoint: "http://127.0.0.1:7777/",
  connection: "ready",
  health: Object.freeze({
    status: "ok",
    authRequired: true,
    authenticated: true,
    version: "0.9.156",
    mode: "windows",
  }),
  brains: Object.freeze([]),
  sessions: Object.freeze([]),
});

function harness() {
  const handlers = new Map<string, (event: IpcEventLike, value?: unknown) => unknown>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: IpcEventLike, value?: unknown) => unknown) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
  };
  let listener: ((snapshot: JarvisReadSnapshot) => void) | undefined;
  const unsubscribe = vi.fn();
  const controller = {
    current: vi.fn(() => readySnapshot),
    refresh: vi.fn(async () => readySnapshot),
    subscribe: vi.fn((next: (snapshot: JarvisReadSnapshot) => void) => {
      listener = next;
      return unsubscribe;
    }),
  };
  const shellWebContents = {
    id: 41,
    getURL: vi.fn(() => "iris://app/index.html"),
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
  };
  const openSignIn = vi.fn(async () => ({ opened: true }));
  const hudSnapshot: HudNativeSnapshot = Object.freeze({
    mode: "deck",
    pointerInteractive: true,
    shortcutAvailable: true,
  });
  let hudListener: ((snapshot: HudNativeSnapshot) => void) | undefined;
  const hudUnsubscribe = vi.fn();
  const hudNative = {
    current: vi.fn(() => hudSnapshot),
    setMode: vi.fn((_mode: HudMode) => hudSnapshot),
    setPointerInteractive: vi.fn((_interactive: boolean) => hudSnapshot),
    setCameraPermissionIntent: vi.fn(),
    subscribe: vi.fn((next: (snapshot: HudNativeSnapshot) => void) => {
      hudListener = next;
      return hudUnsubscribe;
    }),
  };
  const cleanup = registerJarvisIpc({
    ipcMain,
    shellWebContents,
    controller,
    openSignIn,
    hudNative,
    rendererUrl: "iris://app/index.html",
  });
  return {
    cleanup,
    controller,
    handlers,
    ipcMain,
    listener: () => listener,
    openSignIn,
    hudListener: () => hudListener,
    hudNative,
    hudSnapshot,
    hudUnsubscribe,
    shellWebContents,
    unsubscribe,
  };
}

function event(id = 41, url = "iris://app/index.html"): IpcEventLike {
  return { sender: { id }, senderFrame: { url } };
}

describe("registerJarvisIpc", () => {
  it("registers only fixed Jarvis and native HUD request channels", () => {
    const { handlers } = harness();

    expect([...handlers.keys()]).toEqual([
      IPC_CHANNELS.getSnapshot,
      IPC_CHANNELS.refresh,
      IPC_CHANNELS.openSignIn,
      IPC_CHANNELS.getHudNativeSnapshot,
      IPC_CHANNELS.setHudMode,
      IPC_CHANNELS.setPointerInteractive,
      IPC_CHANNELS.requestGesturePermissionIntent,
    ]);
    expect(Object.values(IPC_CHANNELS)).toEqual([
      "iris:jarvis:get-snapshot",
      "iris:jarvis:refresh",
      "iris:jarvis:open-sign-in",
      "iris:jarvis:snapshot",
      "iris:jarvis:load-knowledge",
      "iris:task:get-snapshot",
      "iris:task:send-turn",
      "iris:task:stop-turn",
      "iris:task:snapshot",
      "iris:hud:get-native-snapshot",
      "iris:hud:set-mode",
      "iris:hud:set-pointer-interactive",
      "iris:hud:request-gesture-permission-intent",
      "iris:hud:native-snapshot",
      "iris:conversation:get-snapshot",
      "iris:conversation:start",
      "iris:conversation:stop",
      "iris:conversation:set-microphone-state",
      "iris:conversation:request-microphone-permission-intent",
      "iris:conversation:send-audio",
      "iris:conversation:send-text",
      "iris:conversation:interrupt",
      "iris:conversation:snapshot",
      "iris:conversation:event",
    ]);
  });

  it("serves current, refresh, and sign-in only to the trusted main frame", async () => {
    const { handlers, controller, openSignIn } = harness();

    await expect(handlers.get(IPC_CHANNELS.getSnapshot)?.(event())).resolves.toBe(readySnapshot);
    await expect(handlers.get(IPC_CHANNELS.refresh)?.(event())).resolves.toBe(readySnapshot);
    await expect(handlers.get(IPC_CHANNELS.openSignIn)?.(event())).resolves.toEqual({ opened: true });
    expect(controller.current).toHaveBeenCalledTimes(1);
    expect(controller.refresh).toHaveBeenCalledTimes(1);
    expect(openSignIn).toHaveBeenCalledTimes(1);
  });

  it("serves bounded HUD state changes only to the trusted main frame", async () => {
    const { handlers, hudNative, hudSnapshot } = harness();

    await expect(handlers.get(IPC_CHANNELS.getHudNativeSnapshot)?.(event())).resolves.toBe(hudSnapshot);
    await expect(handlers.get(IPC_CHANNELS.setHudMode)?.(event(), "hud")).resolves.toBe(hudSnapshot);
    await expect(handlers.get(IPC_CHANNELS.setPointerInteractive)?.(event(), false)).resolves.toBe(hudSnapshot);
    await expect(handlers.get(IPC_CHANNELS.requestGesturePermissionIntent)?.(event(), true)).resolves.toEqual({ accepted: true });

    expect(hudNative.setMode).toHaveBeenCalledWith("hud");
    expect(hudNative.setPointerInteractive).toHaveBeenCalledWith(false);
    expect(hudNative.setCameraPermissionIntent).toHaveBeenCalledWith(true);
  });

  it.each([
    [IPC_CHANNELS.setHudMode, "invalid"],
    [IPC_CHANNELS.setHudMode, true],
    [IPC_CHANNELS.setPointerInteractive, "yes"],
    [IPC_CHANNELS.requestGesturePermissionIntent, 1],
  ])("rejects invalid bounded argument on %s", async (channel, value) => {
    const { handlers } = harness();

    await expect(handlers.get(channel)?.(event(), value)).rejects.toThrow("Invalid Iris HUD IPC argument");
  });

  it.each([
    [99, "iris://app/index.html"],
    [41, "https://attacker.example/"],
    [41, "iris://app/other.html"],
    [41, ""],
  ])("rejects untrusted sender id=%s url=%s", async (id, url) => {
    const { handlers } = harness();

    await expect(handlers.get(IPC_CHANNELS.refresh)?.(event(id, url))).rejects.toThrow("Untrusted Iris IPC sender");
  });

  it("publishes snapshots only while the shell document is trusted", () => {
    const { hudListener, hudSnapshot, listener, shellWebContents } = harness();

    listener()?.(readySnapshot);
    expect(shellWebContents.send).toHaveBeenCalledWith(IPC_CHANNELS.snapshot, readySnapshot);
    hudListener()?.(hudSnapshot);
    expect(shellWebContents.send).toHaveBeenCalledWith(IPC_CHANNELS.hudNativeSnapshot, hudSnapshot);

    shellWebContents.getURL.mockReturnValue("https://attacker.example/");
    listener()?.(readySnapshot);
    hudListener()?.(hudSnapshot);
    shellWebContents.isDestroyed.mockReturnValue(true);
    listener()?.(readySnapshot);
    hudListener()?.(hudSnapshot);
    expect(shellWebContents.send).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes and removes exact handlers during cleanup", () => {
    const { cleanup, handlers, hudUnsubscribe, ipcMain, unsubscribe } = harness();

    cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(hudUnsubscribe).toHaveBeenCalledTimes(1);
    expect(ipcMain.removeHandler.mock.calls.map(([channel]) => channel)).toEqual([
      IPC_CHANNELS.getSnapshot,
      IPC_CHANNELS.refresh,
      IPC_CHANNELS.openSignIn,
      IPC_CHANNELS.getHudNativeSnapshot,
      IPC_CHANNELS.setHudMode,
      IPC_CHANNELS.setPointerInteractive,
      IPC_CHANNELS.requestGesturePermissionIntent,
    ]);
    expect(handlers.size).toBe(0);
  });
});
