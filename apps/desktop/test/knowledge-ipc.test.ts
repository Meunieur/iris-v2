import { describe, expect, it, vi } from "vitest";

import type { JarvisKnowledgeSnapshot, JarvisReadSnapshot } from "@iris/jarvis-adapter";

import {
  IPC_CHANNELS,
  registerJarvisIpc,
  type IpcEventLike,
} from "../src/main/ipc";
import type { HudNativeSnapshot } from "../src/main/hud-native";

const brainId = `brain_${"a".repeat(64)}` as const;
const knowledgeSnapshot: JarvisKnowledgeSnapshot = Object.freeze({
  state: "ready",
  capturedAt: "2026-07-31T03:00:00.000Z",
  brain: Object.freeze({ id: brainId, name: "Brain Default", notes: 8, isDefault: true }),
  graph: Object.freeze({
    nodes: Object.freeze([]),
    edges: Object.freeze([]),
    categories: Object.freeze([]),
    stats: Object.freeze({
      totalNotes: 0,
      totalLinks: 0,
      orphans: 0,
      hidden: 0,
      returnedNodes: 0,
      returnedEdges: 0,
      truncated: false,
    }),
  }),
});

function event(id = 41, url = "iris://app/index.html"): IpcEventLike {
  return { sender: { id }, senderFrame: { url } };
}

function harness() {
  const handlers = new Map<string, (event: IpcEventLike, value?: unknown) => unknown>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: IpcEventLike, value?: unknown) => unknown) => handlers.set(channel, handler)),
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
  };
  const jarvisSnapshot = {
    sequence: 1,
    capturedAt: "",
    endpoint: "http://127.0.0.1:7777/",
    connection: "ready",
    health: { status: "ok", authRequired: true, authenticated: true },
    brains: [],
    sessions: [],
  } satisfies JarvisReadSnapshot;
  const controller = {
    current: vi.fn(() => jarvisSnapshot),
    refresh: vi.fn(async () => jarvisSnapshot),
    subscribe: vi.fn(() => vi.fn()),
  };
  const hudSnapshot = { mode: "deck", pointerInteractive: true, shortcutAvailable: true } satisfies HudNativeSnapshot;
  const hudNative = {
    current: vi.fn(() => hudSnapshot),
    setMode: vi.fn(() => hudSnapshot),
    setPointerInteractive: vi.fn(() => hudSnapshot),
    setCameraPermissionIntent: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  };
  const knowledge = { readKnowledge: vi.fn(async () => knowledgeSnapshot) };
  const cleanup = registerJarvisIpc({
    ipcMain,
    shellWebContents: {
      id: 41,
      getURL: vi.fn(() => "iris://app/index.html"),
      isDestroyed: vi.fn(() => false),
      send: vi.fn(),
    },
    controller,
    knowledge,
    openSignIn: vi.fn(async () => ({ opened: true })),
    hudNative,
    rendererUrl: "iris://app/index.html",
  });
  return { cleanup, handlers, ipcMain, knowledge };
}

describe("Second Brain IPC boundary", () => {
  it("delegates one fixed opaque-ID request from the trusted main frame", async () => {
    const { handlers, knowledge } = harness();

    await expect(handlers.get(IPC_CHANNELS.loadKnowledge)?.(event(), brainId)).resolves.toBe(knowledgeSnapshot);
    expect(knowledge.readKnowledge).toHaveBeenCalledWith(brainId);
  });

  it.each([
    "brain_short",
    `brain_${"A".repeat(64)}`,
    `brain_${"a".repeat(63)}`,
    "E:\\private\\brain",
    { id: brainId },
  ])("rejects invalid or path-shaped brain input: %j", async (value) => {
    const { handlers, knowledge } = harness();

    await expect(handlers.get(IPC_CHANNELS.loadKnowledge)?.(event(), value)).rejects.toThrow("Invalid Iris knowledge IPC argument");
    expect(knowledge.readKnowledge).not.toHaveBeenCalled();
  });

  it("rejects an untrusted frame and removes the exact handler on cleanup", async () => {
    const { cleanup, handlers, ipcMain, knowledge } = harness();

    await expect(handlers.get(IPC_CHANNELS.loadKnowledge)?.(event(99), brainId)).rejects.toThrow("Untrusted Iris IPC sender");
    expect(knowledge.readKnowledge).not.toHaveBeenCalled();
    cleanup();
    expect(ipcMain.removeHandler).toHaveBeenCalledWith(IPC_CHANNELS.loadKnowledge);
    expect(handlers.size).toBe(0);
  });
});
