import { describe, expect, it, vi } from "vitest";

import type { JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";

import { IPC_CHANNELS, createRendererApi, type PreloadIpc } from "../src/preload/api.cjs";

const snapshot: JarvisTaskControllerSnapshot = Object.freeze({
  sequence: 0,
  capturedAt: "2026-07-31T02:00:00.000Z",
  connection: "idle",
});

describe("task preload surface", () => {
  it("maps fixed task methods without exposing generic IPC", async () => {
    const listeners = new Map<string, (event: unknown, value: unknown) => void>();
    const ipc: PreloadIpc = {
      invoke: vi.fn(async () => snapshot),
      on: vi.fn((channel, listener) => listeners.set(channel, listener)),
      removeListener: vi.fn((channel, listener) => {
        if (listeners.get(channel) === listener) listeners.delete(channel);
      }),
    };
    const api = createRendererApi(ipc);
    const input = { brainId: `brain_${"a".repeat(64)}` as const, message: "read" };

    await expect(api.getTaskSnapshot()).resolves.toBe(snapshot);
    await expect(api.sendTurn(input)).resolves.toBe(snapshot);
    await expect(api.stopTurn()).resolves.toBe(snapshot);
    expect(vi.mocked(ipc.invoke).mock.calls).toEqual([
      [IPC_CHANNELS.getTaskSnapshot],
      [IPC_CHANNELS.sendTurn, input],
      [IPC_CHANNELS.stopTurn],
    ]);
    expect(api).not.toHaveProperty("fetch");
    expect(api).not.toHaveProperty("invoke");
    expect(api).not.toHaveProperty("stopTaskById");

    const listener = vi.fn();
    const dispose = api.onTaskSnapshot(listener);
    listeners.get(IPC_CHANNELS.taskSnapshot)?.({ privateElectronEvent: true }, snapshot);
    expect(listener).toHaveBeenCalledWith(snapshot);
    expect(listener.mock.calls[0]).toHaveLength(1);
    dispose();
    expect(ipc.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.taskSnapshot, expect.any(Function));
  });
});
