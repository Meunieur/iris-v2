import type {
  JarvisReadClient,
  JarvisReadController,
  JarvisReadSnapshot,
  JarvisTaskController,
  JarvisTaskControllerSnapshot,
} from "@iris/jarvis-adapter";
import type {
  HudMode,
  HudNativeController,
  HudNativeSnapshot,
} from "./hud-native.js";
import type {
  ConversationController,
  ConversationEvent,
  ConversationMicrophoneState,
  ConversationSnapshot,
} from "@iris/gemini-bridge";

export const IPC_CHANNELS = Object.freeze({
  getSnapshot: "iris:jarvis:get-snapshot",
  refresh: "iris:jarvis:refresh",
  openSignIn: "iris:jarvis:open-sign-in",
  snapshot: "iris:jarvis:snapshot",
  loadKnowledge: "iris:jarvis:load-knowledge",
  getTaskSnapshot: "iris:task:get-snapshot",
  sendTurn: "iris:task:send-turn",
  stopTurn: "iris:task:stop-turn",
  taskSnapshot: "iris:task:snapshot",
  getHudNativeSnapshot: "iris:hud:get-native-snapshot",
  setHudMode: "iris:hud:set-mode",
  setPointerInteractive: "iris:hud:set-pointer-interactive",
  requestGesturePermissionIntent: "iris:hud:request-gesture-permission-intent",
  hudNativeSnapshot: "iris:hud:native-snapshot",
  getConversationSnapshot: "iris:conversation:get-snapshot",
  startConversation: "iris:conversation:start",
  stopConversation: "iris:conversation:stop",
  setMicrophoneState: "iris:conversation:set-microphone-state",
  requestMicrophonePermissionIntent: "iris:conversation:request-microphone-permission-intent",
  sendConversationAudio: "iris:conversation:send-audio",
  sendConversationText: "iris:conversation:send-text",
  interruptConversation: "iris:conversation:interrupt",
  conversationSnapshot: "iris:conversation:snapshot",
  conversationEvent: "iris:conversation:event",
} as const);

export type IpcEventLike = {
  sender: { id: number };
  senderFrame: { url: string } | null;
};

type IpcMainLike = {
  handle(channel: string, handler: (event: IpcEventLike, value?: unknown) => Promise<unknown>): void;
  removeHandler(channel: string): void;
};

type ShellWebContentsLike = {
  id: number;
  getURL(): string;
  isDestroyed(): boolean;
  send(channel: string, snapshot: JarvisReadSnapshot | JarvisTaskControllerSnapshot | HudNativeSnapshot | ConversationSnapshot | ConversationEvent): void;
};

type ControllerLike = Pick<JarvisReadController, "current" | "refresh" | "subscribe">;

type RegisterJarvisIpcInput = {
  ipcMain: IpcMainLike;
  shellWebContents: ShellWebContentsLike;
  controller: ControllerLike;
  knowledge?: Pick<JarvisReadClient, "readKnowledge">;
  task?: Pick<JarvisTaskController, "current" | "sendTurn" | "stopTurn" | "subscribe">;
  openSignIn(): Promise<{ opened: boolean }>;
  hudNative: Pick<
    HudNativeController,
    "current" | "setMode" | "setPointerInteractive" | "setCameraPermissionIntent" | "subscribe"
  >;
  conversation?: Pick<
    ConversationController,
    "current" | "start" | "stop" | "setMicrophoneState" | "sendAudio" | "sendText" | "interrupt" | "subscribeSnapshot" | "subscribeEvent"
  >;
  requestMicrophonePermissionIntent?(enabled: boolean): void;
  rendererUrl: string;
};

function hudMode(value: unknown): HudMode {
  if (value !== "hud" && value !== "deck") throw new Error("Invalid Iris HUD IPC argument");
  return value;
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid Iris HUD IPC argument");
  return value;
}

function microphoneState(value: unknown): ConversationMicrophoneState {
  if (value !== "off" && value !== "requesting" && value !== "active" && value !== "blocked") {
    throw new Error("Invalid Iris conversation IPC argument");
  }
  return value;
}

function audioChunk(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength === 0 || value.byteLength > 32 * 1024 || value.byteLength % 2 !== 0) {
    throw new Error("Invalid Iris conversation IPC argument");
  }
  return new Uint8Array(value);
}

function conversationText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || new TextEncoder().encode(value).byteLength > 8 * 1024) {
    throw new Error("Invalid Iris conversation IPC argument");
  }
  return value;
}

function brainId(value: unknown): `brain_${string}` {
  if (typeof value !== "string" || !/^brain_[a-f0-9]{64}$/.test(value)) {
    throw new Error("Invalid Iris knowledge IPC argument");
  }
  return value as `brain_${string}`;
}

function taskInput(value: unknown): Readonly<{
  brainId: `brain_${string}`;
  message: string;
  sessionId?: string | undefined;
}> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Iris task IPC argument");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => !["brainId", "message", "sessionId"].includes(key))) {
    throw new Error("Invalid Iris task IPC argument");
  }
  const selectedBrain = record.brainId;
  const message = record.message;
  const sessionId = record.sessionId;
  if (
    typeof selectedBrain !== "string"
    || !/^brain_[a-f0-9]{64}$/.test(selectedBrain)
    || typeof message !== "string"
    || message.trim().length === 0
    || message.length > 4_000
    || (sessionId !== undefined && (typeof sessionId !== "string" || sessionId.length > 96))
  ) {
    throw new Error("Invalid Iris task IPC argument");
  }
  return Object.freeze({
    brainId: selectedBrain as `brain_${string}`,
    message: message.trim(),
    ...(sessionId === undefined ? {} : { sessionId }),
  });
}

function assertTrustedSender(
  event: IpcEventLike,
  shellWebContents: ShellWebContentsLike,
  rendererUrl: string,
): void {
  if (event.sender.id !== shellWebContents.id || event.senderFrame?.url !== rendererUrl) {
    throw new Error("Untrusted Iris IPC sender");
  }
}

export function registerJarvisIpc(input: RegisterJarvisIpcInput): () => void {
  input.ipcMain.handle(IPC_CHANNELS.getSnapshot, async (event) => {
    assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
    return input.controller.current();
  });
  input.ipcMain.handle(IPC_CHANNELS.refresh, async (event) => {
    assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
    return input.controller.refresh();
  });
  input.ipcMain.handle(IPC_CHANNELS.openSignIn, async (event) => {
    assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
    return input.openSignIn();
  });
  const knowledge = input.knowledge;
  if (knowledge !== undefined) {
    input.ipcMain.handle(IPC_CHANNELS.loadKnowledge, async (event, value) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return knowledge.readKnowledge(brainId(value));
    });
  }
  const task = input.task;
  if (task !== undefined) {
    input.ipcMain.handle(IPC_CHANNELS.getTaskSnapshot, async (event) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return task.current();
    });
    input.ipcMain.handle(IPC_CHANNELS.sendTurn, async (event, value) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return task.sendTurn(taskInput(value));
    });
    input.ipcMain.handle(IPC_CHANNELS.stopTurn, async (event, value) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      if (value !== undefined) throw new Error("Invalid Iris task IPC argument");
      return task.stopTurn();
    });
  }
  input.ipcMain.handle(IPC_CHANNELS.getHudNativeSnapshot, async (event) => {
    assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
    return input.hudNative.current();
  });
  input.ipcMain.handle(IPC_CHANNELS.setHudMode, async (event, value) => {
    assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
    return input.hudNative.setMode(hudMode(value));
  });
  input.ipcMain.handle(IPC_CHANNELS.setPointerInteractive, async (event, value) => {
    assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
    return input.hudNative.setPointerInteractive(booleanValue(value));
  });
  input.ipcMain.handle(IPC_CHANNELS.requestGesturePermissionIntent, async (event, value) => {
    assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
    input.hudNative.setCameraPermissionIntent(booleanValue(value));
    return Object.freeze({ accepted: true });
  });
  if (input.conversation !== undefined) {
    const conversation = input.conversation;
    input.ipcMain.handle(IPC_CHANNELS.getConversationSnapshot, async (event) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return conversation.current();
    });
    input.ipcMain.handle(IPC_CHANNELS.startConversation, async (event) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return conversation.start();
    });
    input.ipcMain.handle(IPC_CHANNELS.stopConversation, async (event) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return conversation.stop();
    });
    input.ipcMain.handle(IPC_CHANNELS.setMicrophoneState, async (event, value) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return conversation.setMicrophoneState(microphoneState(value));
    });
    input.ipcMain.handle(IPC_CHANNELS.requestMicrophonePermissionIntent, async (event, value) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      input.requestMicrophonePermissionIntent?.(booleanValue(value));
      return Object.freeze({ accepted: true });
    });
    input.ipcMain.handle(IPC_CHANNELS.sendConversationAudio, async (event, value) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return conversation.sendAudio(audioChunk(value));
    });
    input.ipcMain.handle(IPC_CHANNELS.sendConversationText, async (event, value) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return conversation.sendText(conversationText(value));
    });
    input.ipcMain.handle(IPC_CHANNELS.interruptConversation, async (event) => {
      assertTrustedSender(event, input.shellWebContents, input.rendererUrl);
      return conversation.interrupt();
    });
  }

  const unsubscribe = input.controller.subscribe((snapshot) => {
    if (input.shellWebContents.isDestroyed() || input.shellWebContents.getURL() !== input.rendererUrl) return;
    input.shellWebContents.send(IPC_CHANNELS.snapshot, snapshot);
  });
  const unsubscribeHud = input.hudNative.subscribe((snapshot) => {
    if (input.shellWebContents.isDestroyed() || input.shellWebContents.getURL() !== input.rendererUrl) return;
    input.shellWebContents.send(IPC_CHANNELS.hudNativeSnapshot, snapshot);
  });
  const unsubscribeConversationSnapshot = input.conversation?.subscribeSnapshot((snapshot) => {
    if (input.shellWebContents.isDestroyed() || input.shellWebContents.getURL() !== input.rendererUrl) return;
    input.shellWebContents.send(IPC_CHANNELS.conversationSnapshot, snapshot);
  }) ?? (() => undefined);
  const unsubscribeConversationEvent = input.conversation?.subscribeEvent((event) => {
    if (input.shellWebContents.isDestroyed() || input.shellWebContents.getURL() !== input.rendererUrl) return;
    input.shellWebContents.send(IPC_CHANNELS.conversationEvent, event);
  }) ?? (() => undefined);
  const unsubscribeTask = input.task?.subscribe((snapshot) => {
    if (input.shellWebContents.isDestroyed() || input.shellWebContents.getURL() !== input.rendererUrl) return;
    input.shellWebContents.send(IPC_CHANNELS.taskSnapshot, snapshot);
  }) ?? (() => undefined);

  return () => {
    unsubscribe();
    unsubscribeHud();
    unsubscribeConversationSnapshot();
    unsubscribeConversationEvent();
    unsubscribeTask();
    input.ipcMain.removeHandler(IPC_CHANNELS.getSnapshot);
    input.ipcMain.removeHandler(IPC_CHANNELS.refresh);
    input.ipcMain.removeHandler(IPC_CHANNELS.openSignIn);
    if (input.knowledge !== undefined) input.ipcMain.removeHandler(IPC_CHANNELS.loadKnowledge);
    if (input.task !== undefined) {
      input.ipcMain.removeHandler(IPC_CHANNELS.getTaskSnapshot);
      input.ipcMain.removeHandler(IPC_CHANNELS.sendTurn);
      input.ipcMain.removeHandler(IPC_CHANNELS.stopTurn);
    }
    input.ipcMain.removeHandler(IPC_CHANNELS.getHudNativeSnapshot);
    input.ipcMain.removeHandler(IPC_CHANNELS.setHudMode);
    input.ipcMain.removeHandler(IPC_CHANNELS.setPointerInteractive);
    input.ipcMain.removeHandler(IPC_CHANNELS.requestGesturePermissionIntent);
    if (input.conversation !== undefined) {
      input.ipcMain.removeHandler(IPC_CHANNELS.getConversationSnapshot);
      input.ipcMain.removeHandler(IPC_CHANNELS.startConversation);
      input.ipcMain.removeHandler(IPC_CHANNELS.stopConversation);
      input.ipcMain.removeHandler(IPC_CHANNELS.setMicrophoneState);
      input.ipcMain.removeHandler(IPC_CHANNELS.requestMicrophonePermissionIntent);
      input.ipcMain.removeHandler(IPC_CHANNELS.sendConversationAudio);
      input.ipcMain.removeHandler(IPC_CHANNELS.sendConversationText);
      input.ipcMain.removeHandler(IPC_CHANNELS.interruptConversation);
    }
  };
}
