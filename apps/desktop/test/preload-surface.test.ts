import { describe, expect, it, vi } from "vitest";

import type { JarvisReadSnapshot } from "@iris/jarvis-adapter";
import type { HudNativeSnapshot } from "../src/main/hud-native";

import {
  IPC_CHANNELS,
  createRendererApi,
  type PreloadIpc,
} from "../src/preload/api.cjs";

const snapshot = {
  sequence: 1,
  capturedAt: "2026-07-24T07:00:00.000Z",
  endpoint: "http://127.0.0.1:7777/",
  connection: "ready",
  health: { status: "ok", authRequired: true, authenticated: true },
  brains: [],
  sessions: [],
} satisfies JarvisReadSnapshot;

function harness() {
  const listeners = new Map<string, (_event: unknown, value: unknown) => void>();
  const hudSnapshot: HudNativeSnapshot = {
    mode: "hud",
    pointerInteractive: false,
    shortcutAvailable: true,
  };
  const ipc: PreloadIpc = {
    invoke: vi.fn(async (channel: string) => {
      if (channel === IPC_CHANNELS.openSignIn) return { opened: true };
      if (channel.startsWith("iris:hud:")) return channel === IPC_CHANNELS.requestGesturePermissionIntent
        ? { accepted: true }
        : hudSnapshot;
      return snapshot;
    }),
    on: vi.fn((channel, listener) => { listeners.set(channel, listener); }),
    removeListener: vi.fn((channel, listener) => {
      if (listeners.get(channel) === listener) listeners.delete(channel);
    }),
  };
  return { api: createRendererApi(ipc), hudSnapshot, ipc, listeners };
}

describe("preload renderer surface", () => {
  it("exposes only fixed Jarvis and native HUD methods with no generic capability", () => {
    const { api } = harness();

    expect(Object.keys(api)).toEqual([
      "getSnapshot",
      "refresh",
      "openSignIn",
      "loadKnowledge",
      "getTaskSnapshot",
      "sendTurn",
      "stopTurn",
      "onTaskSnapshot",
      "onSnapshot",
      "getHudNativeSnapshot",
      "setHudMode",
      "setPointerInteractive",
      "requestGesturePermissionIntent",
      "onHudNativeSnapshot",
      "getConversationSnapshot",
      "startConversation",
      "stopConversation",
      "setMicrophoneState",
      "requestMicrophonePermissionIntent",
      "sendConversationAudio",
      "sendConversationText",
      "interruptConversation",
      "onConversationEvent",
    ]);
    expect(Object.isFrozen(api)).toBe(true);
    expect(api).not.toHaveProperty("send");
    expect(api).not.toHaveProperty("invoke");
    expect(api).not.toHaveProperty("filesystem");
    expect(api).not.toHaveProperty("shell");
    expect(api).not.toHaveProperty("cookies");
    expect(api).not.toHaveProperty("endpoint");
    expect(api).not.toHaveProperty("config");
  });

  it("maps bounded native HUD methods to their exact invoke channels", async () => {
    const { api, hudSnapshot, ipc } = harness();

    await expect(api.getHudNativeSnapshot()).resolves.toBe(hudSnapshot);
    await expect(api.setHudMode("hud")).resolves.toBe(hudSnapshot);
    await expect(api.setPointerInteractive(false)).resolves.toBe(hudSnapshot);
    await expect(api.requestGesturePermissionIntent(true)).resolves.toEqual({ accepted: true });

    expect(vi.mocked(ipc.invoke).mock.calls).toEqual([
      [IPC_CHANNELS.getHudNativeSnapshot],
      [IPC_CHANNELS.setHudMode, "hud"],
      [IPC_CHANNELS.setPointerInteractive, false],
      [IPC_CHANNELS.requestGesturePermissionIntent, true],
    ]);
  });

  it("maps one method to each fixed invoke channel", async () => {
    const { api, ipc } = harness();

    await expect(api.getSnapshot()).resolves.toBe(snapshot);
    await expect(api.refresh()).resolves.toBe(snapshot);
    await expect(api.openSignIn()).resolves.toEqual({ opened: true });

    expect(vi.mocked(ipc.invoke).mock.calls).toEqual([
      [IPC_CHANNELS.getSnapshot],
      [IPC_CHANNELS.refresh],
      [IPC_CHANNELS.openSignIn],
    ]);
  });

  it("drops the Electron event object and disposes the wrapped listener", () => {
    const { api, ipc, listeners } = harness();
    const listener = vi.fn();
    const dispose = api.onSnapshot(listener);
    const wrapped = listeners.get(IPC_CHANNELS.snapshot);

    wrapped?.({ privateElectronEvent: true }, snapshot);

    expect(listener).toHaveBeenCalledWith(snapshot);
    expect(listener.mock.calls[0]).toHaveLength(1);
    dispose();
    expect(ipc.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.snapshot, wrapped);
    expect(listeners.size).toBe(0);
  });

  it("drops the Electron event from native HUD snapshot subscriptions", () => {
    const { api, hudSnapshot, ipc, listeners } = harness();
    const listener = vi.fn();
    const dispose = api.onHudNativeSnapshot(listener);
    const wrapped = listeners.get(IPC_CHANNELS.hudNativeSnapshot);

    wrapped?.({ privateElectronEvent: true }, hudSnapshot);

    expect(listener).toHaveBeenCalledWith(hudSnapshot);
    expect(listener.mock.calls[0]).toHaveLength(1);
    dispose();
    expect(ipc.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.hudNativeSnapshot, wrapped);
  });
});
