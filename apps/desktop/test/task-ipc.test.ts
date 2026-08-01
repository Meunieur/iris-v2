import { describe, expect, it, vi } from "vitest";

import type { JarvisReadSnapshot, JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";

import { IPC_CHANNELS, registerJarvisIpc, type IpcEventLike } from "../src/main/ipc.js";
import type { HudNativeSnapshot } from "../src/main/hud-native.js";

const taskSnapshot: JarvisTaskControllerSnapshot = Object.freeze({
  sequence: 2,
  capturedAt: "2026-07-31T02:00:00.000Z",
  connection: "active",
  task: Object.freeze({
    version: 1,
    task_id: "t_0123456789ab",
    intent_id: "43fe94df-373f-4ad0-931c-7f6418719b5a",
    brain_id: `brain_${"a".repeat(64)}` as `brain_${string}`,
    session_id: "",
    risk: "R0",
    status: "ready",
    terminal: false,
    outcome: null,
    orphaned: false,
    can_stop: true,
    current_run_id: "",
    result: "",
    replayed: false,
    event_cursor: 1,
    events: Object.freeze([{ id: 1, type: "created" as const, run_id: "", created_at: 1 }]),
    runs: Object.freeze([]),
  }),
});

const readSnapshot = {
  sequence: 1,
  capturedAt: "2026-07-31T02:00:00.000Z",
  endpoint: "http://127.0.0.1:7777/",
  connection: "ready",
  health: { status: "ok", authRequired: true, authenticated: true },
  brains: [],
  sessions: [],
} satisfies JarvisReadSnapshot;

function event(id = 41, url = "iris://app/index.html"): IpcEventLike {
  return { sender: { id }, senderFrame: { url } };
}

function harness() {
  const handlers = new Map<string, (event: IpcEventLike, value?: unknown) => Promise<unknown>>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: IpcEventLike, value?: unknown) => Promise<unknown>) => handlers.set(channel, handler)),
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
  };
  let listener: ((value: JarvisTaskControllerSnapshot) => void) | undefined;
  const unsubscribe = vi.fn();
  const task = {
    current: vi.fn(() => taskSnapshot),
    sendTurn: vi.fn(async () => taskSnapshot),
    stopTurn: vi.fn(async () => taskSnapshot),
    subscribe: vi.fn((next: (value: JarvisTaskControllerSnapshot) => void) => {
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
  const hudSnapshot: HudNativeSnapshot = { mode: "deck", pointerInteractive: true, shortcutAvailable: true };
  const cleanup = registerJarvisIpc({
    ipcMain,
    shellWebContents,
    controller: { current: () => readSnapshot, refresh: async () => readSnapshot, subscribe: () => vi.fn() },
    openSignIn: async () => ({ opened: true }),
    hudNative: {
      current: () => hudSnapshot,
      setMode: () => hudSnapshot,
      setPointerInteractive: () => hudSnapshot,
      setCameraPermissionIntent: vi.fn(),
      subscribe: () => vi.fn(),
    },
    task,
    rendererUrl: "iris://app/index.html",
  });
  return { cleanup, handlers, ipcMain, listener: () => listener, shellWebContents, task, unsubscribe };
}

describe("task IPC", () => {
  it("exposes only current/send/stop and publishes sanitized task snapshots", async () => {
    const { handlers, listener, shellWebContents, task } = harness();
    const input = {
      brainId: taskSnapshot.task?.brain_id,
      message: "Summarize project decisions.",
      sessionId: "iris-session-01",
    };

    await expect(handlers.get(IPC_CHANNELS.getTaskSnapshot)?.(event())).resolves.toBe(taskSnapshot);
    await expect(handlers.get(IPC_CHANNELS.sendTurn)?.(event(), input)).resolves.toBe(taskSnapshot);
    await expect(handlers.get(IPC_CHANNELS.stopTurn)?.(event())).resolves.toBe(taskSnapshot);
    expect(task.sendTurn).toHaveBeenCalledWith(input);

    listener()?.(taskSnapshot);
    expect(shellWebContents.send).toHaveBeenCalledWith(IPC_CHANNELS.taskSnapshot, taskSnapshot);
  });

  it.each([
    { brainId: "E:\\private\\Brain", message: "read" },
    { brainId: `brain_${"a".repeat(64)}`, message: "" },
    { brainId: `brain_${"a".repeat(64)}`, message: "x".repeat(4_001) },
    { brainId: `brain_${"a".repeat(64)}`, message: "read", path: "E:\\private" },
    { brainId: `brain_${"a".repeat(64)}`, message: "read", risk: "R3" },
  ])("rejects untrusted task input %#", async (value) => {
    const { handlers, task } = harness();
    await expect(handlers.get(IPC_CHANNELS.sendTurn)?.(event(), value)).rejects.toThrow("Invalid Iris task IPC argument");
    expect(task.sendTurn).not.toHaveBeenCalled();
  });

  it("rejects foreign senders and a renderer-supplied stop target", async () => {
    const { handlers, task } = harness();
    const valid = { brainId: taskSnapshot.task?.brain_id, message: "read" };

    await expect(handlers.get(IPC_CHANNELS.sendTurn)?.(event(99), valid)).rejects.toThrow("Untrusted Iris IPC sender");
    await expect(handlers.get(IPC_CHANNELS.stopTurn)?.(event(), "t_foreign00000")).rejects.toThrow("Invalid Iris task IPC argument");
    expect(task.stopTurn).not.toHaveBeenCalled();
  });

  it("removes exact task handlers and subscription", () => {
    const { cleanup, ipcMain, unsubscribe } = harness();
    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(ipcMain.removeHandler).toHaveBeenCalledWith(IPC_CHANNELS.getTaskSnapshot);
    expect(ipcMain.removeHandler).toHaveBeenCalledWith(IPC_CHANNELS.sendTurn);
    expect(ipcMain.removeHandler).toHaveBeenCalledWith(IPC_CHANNELS.stopTurn);
  });
});
