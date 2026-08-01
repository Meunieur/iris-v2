import { describe, expect, it, vi } from "vitest";

import {
  IPC_CHANNELS,
  registerJarvisIpc,
  type IpcEventLike,
} from "../src/main/ipc";
import type { JarvisReadSnapshot } from "@iris/jarvis-adapter";
import type { HudNativeSnapshot } from "../src/main/hud-native";
import type { ConversationEvent, ConversationSnapshot } from "@iris/gemini-bridge";

const conversationSnapshot = Object.freeze({
  sequence: 1,
  provider: "gemini",
  model: "gemini-3.1-flash-live-preview",
  state: "idle",
  microphone: "off",
  remoteStreaming: false,
  inputTranscript: "",
  outputTranscript: "",
  cost: "unavailable",
}) satisfies ConversationSnapshot;

function harness() {
  const handlers = new Map<string, (event: IpcEventLike, value?: unknown) => unknown>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: IpcEventLike, value?: unknown) => unknown) => handlers.set(channel, handler)),
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
  };
  const shellWebContents = {
    id: 41,
    getURL: vi.fn(() => "iris://app/index.html"),
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
  };
  let snapshotListener: ((snapshot: ConversationSnapshot) => void) | undefined;
  let eventListener: ((event: ConversationEvent) => void) | undefined;
  const conversation = {
    current: vi.fn(() => conversationSnapshot),
    start: vi.fn(async () => conversationSnapshot),
    stop: vi.fn(async () => conversationSnapshot),
    setMicrophoneState: vi.fn(() => conversationSnapshot),
    sendAudio: vi.fn(async () => ({ accepted: true as const })),
    sendText: vi.fn(async () => ({ accepted: true as const })),
    interrupt: vi.fn(async () => conversationSnapshot),
    subscribeSnapshot: vi.fn((listener: (snapshot: ConversationSnapshot) => void) => {
      snapshotListener = listener;
      return vi.fn();
    }),
    subscribeEvent: vi.fn((listener: (event: ConversationEvent) => void) => {
      eventListener = listener;
      return vi.fn();
    }),
  };
  const jarvisSnapshot = {
    sequence: 0,
    capturedAt: "",
    endpoint: "http://127.0.0.1:7777/",
    connection: "connecting" as const,
    health: { status: "offline" as const, authRequired: true, authenticated: false },
    brains: [],
    sessions: [],
  } satisfies JarvisReadSnapshot;
  const controller = {
    current: vi.fn(() => jarvisSnapshot),
    refresh: vi.fn(async () => jarvisSnapshot),
    subscribe: vi.fn(() => vi.fn()),
  };
  const hudSnapshot = { mode: "hud", pointerInteractive: false, shortcutAvailable: true } satisfies HudNativeSnapshot;
  const hudNative = {
    current: vi.fn(() => hudSnapshot),
    setMode: vi.fn(),
    setPointerInteractive: vi.fn(),
    setCameraPermissionIntent: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  };
  const cleanup = registerJarvisIpc({
    ipcMain,
    shellWebContents,
    controller,
    openSignIn: vi.fn(async () => ({ opened: true })),
    hudNative,
    conversation,
    requestMicrophonePermissionIntent: vi.fn(),
    rendererUrl: "iris://app/index.html",
  });
  return { cleanup, conversation, eventListener: () => eventListener, handlers, ipcMain, shellWebContents, snapshotListener: () => snapshotListener };
}

function event(id = 41, url = "iris://app/index.html"): IpcEventLike {
  return { sender: { id }, senderFrame: { url } };
}

describe("conversation IPC boundary", () => {
  it("registers only fixed conversation channels and publishes allowlisted events", () => {
    const harnessed = harness();

    expect([...harnessed.handlers.keys()]).toEqual([
      IPC_CHANNELS.getSnapshot,
      IPC_CHANNELS.refresh,
      IPC_CHANNELS.openSignIn,
      IPC_CHANNELS.getHudNativeSnapshot,
      IPC_CHANNELS.setHudMode,
      IPC_CHANNELS.setPointerInteractive,
      IPC_CHANNELS.requestGesturePermissionIntent,
      IPC_CHANNELS.getConversationSnapshot,
      IPC_CHANNELS.startConversation,
      IPC_CHANNELS.stopConversation,
      IPC_CHANNELS.setMicrophoneState,
      IPC_CHANNELS.requestMicrophonePermissionIntent,
      IPC_CHANNELS.sendConversationAudio,
      IPC_CHANNELS.sendConversationText,
      IPC_CHANNELS.interruptConversation,
    ]);

    const nextSnapshot = { ...conversationSnapshot, sequence: 2 } satisfies ConversationSnapshot;
    harnessed.snapshotListener()?.(nextSnapshot);
    expect(harnessed.shellWebContents.send).toHaveBeenCalledWith(IPC_CHANNELS.conversationSnapshot, nextSnapshot);
    const event = { type: "interrupted" } as const;
    harnessed.eventListener()?.(event);
    expect(harnessed.shellWebContents.send).toHaveBeenCalledWith(IPC_CHANNELS.conversationEvent, event);
  });

  it("validates sender, mic state, bounded audio and bounded text before delegation", async () => {
    const harnessed = harness();

    await expect(harnessed.handlers.get(IPC_CHANNELS.startConversation)?.(event())).resolves.toBe(conversationSnapshot);
    await expect(harnessed.handlers.get(IPC_CHANNELS.setMicrophoneState)?.(event(), "active")).resolves.toBe(conversationSnapshot);
    await expect(harnessed.handlers.get(IPC_CHANNELS.requestMicrophonePermissionIntent)?.(event(), true)).resolves.toEqual({ accepted: true });
    await expect(harnessed.handlers.get(IPC_CHANNELS.sendConversationAudio)?.(event(), new Uint8Array([0, 1]))).resolves.toEqual({ accepted: true });
    await expect(harnessed.handlers.get(IPC_CHANNELS.sendConversationText)?.(event(), "Xin chÃ o")).resolves.toEqual({ accepted: true });
    await expect(harnessed.handlers.get(IPC_CHANNELS.interruptConversation)?.(event())).resolves.toBe(conversationSnapshot);
    await expect(harnessed.handlers.get(IPC_CHANNELS.setMicrophoneState)?.(event(), "capturing")).rejects.toThrow("Invalid Iris conversation IPC argument");
    await expect(harnessed.handlers.get(IPC_CHANNELS.sendConversationAudio)?.(event(), "AAE=\n")).rejects.toThrow("Invalid Iris conversation IPC argument");
    await expect(harnessed.handlers.get(IPC_CHANNELS.sendConversationAudio)?.(event(), new Uint8Array(32_769))).rejects.toThrow("Invalid Iris conversation IPC argument");
    await expect(harnessed.handlers.get(IPC_CHANNELS.sendConversationText)?.(event(), "x".repeat(8_193))).rejects.toThrow("Invalid Iris conversation IPC argument");
    await expect(harnessed.handlers.get(IPC_CHANNELS.refresh)?.(event(99))).rejects.toThrow("Untrusted Iris IPC sender");
  });

  it("removes conversation handlers and subscriptions during cleanup", () => {
    const harnessed = harness();
    harnessed.cleanup();

    expect(harnessed.ipcMain.removeHandler).toHaveBeenCalledWith(IPC_CHANNELS.startConversation);
    expect(harnessed.ipcMain.removeHandler).toHaveBeenCalledWith(IPC_CHANNELS.sendConversationAudio);
    expect(harnessed.handlers.size).toBe(0);
  });
});
