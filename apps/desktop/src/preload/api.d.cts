import type { JarvisKnowledgeSnapshot, JarvisReadSnapshot, JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";
import type { JarvisTaskInput } from "@iris/contracts";
import type { HudMode, HudNativeSnapshot } from "../main/hud-native.js";
import type { ConversationEvent, ConversationSnapshot, ConversationMicrophoneState } from "@iris/gemini-bridge";

type WrappedSnapshotListener = (event: unknown, snapshot: JarvisReadSnapshot | HudNativeSnapshot) => void;

export const IPC_CHANNELS: Readonly<{
  getSnapshot: "iris:jarvis:get-snapshot";
  refresh: "iris:jarvis:refresh";
  openSignIn: "iris:jarvis:open-sign-in";
  snapshot: "iris:jarvis:snapshot";
  loadKnowledge: "iris:jarvis:load-knowledge";
  getTaskSnapshot: "iris:task:get-snapshot";
  sendTurn: "iris:task:send-turn";
  stopTurn: "iris:task:stop-turn";
  taskSnapshot: "iris:task:snapshot";
  getHudNativeSnapshot: "iris:hud:get-native-snapshot";
  setHudMode: "iris:hud:set-mode";
  setPointerInteractive: "iris:hud:set-pointer-interactive";
  requestGesturePermissionIntent: "iris:hud:request-gesture-permission-intent";
  hudNativeSnapshot: "iris:hud:native-snapshot";
  getConversationSnapshot: "iris:conversation:get-snapshot";
  startConversation: "iris:conversation:start";
  stopConversation: "iris:conversation:stop";
  setMicrophoneState: "iris:conversation:set-microphone-state";
  requestMicrophonePermissionIntent: "iris:conversation:request-microphone-permission-intent";
  sendConversationAudio: "iris:conversation:send-audio";
  sendConversationText: "iris:conversation:send-text";
  interruptConversation: "iris:conversation:interrupt";
  conversationSnapshot: "iris:conversation:snapshot";
  conversationEvent: "iris:conversation:event";
}>;

export type PreloadIpc = {
  invoke(channel: string, value?: unknown): Promise<unknown>;
  on(channel: string, listener: WrappedSnapshotListener): void;
  removeListener(channel: string, listener: WrappedSnapshotListener): void;
};

export type IrisRendererApi = Readonly<{
  getSnapshot(): Promise<JarvisReadSnapshot>;
  refresh(): Promise<JarvisReadSnapshot>;
  openSignIn(): Promise<{ opened: boolean }>;
  loadKnowledge(brainId: `brain_${string}`): Promise<JarvisKnowledgeSnapshot>;
  getTaskSnapshot(): Promise<JarvisTaskControllerSnapshot>;
  sendTurn(input: JarvisTaskInput): Promise<JarvisTaskControllerSnapshot>;
  stopTurn(): Promise<JarvisTaskControllerSnapshot>;
  onTaskSnapshot(listener: (snapshot: JarvisTaskControllerSnapshot) => void): () => void;
  onSnapshot(listener: (snapshot: JarvisReadSnapshot) => void): () => void;
  getHudNativeSnapshot(): Promise<HudNativeSnapshot>;
  setHudMode(mode: HudMode): Promise<HudNativeSnapshot>;
  setPointerInteractive(interactive: boolean): Promise<HudNativeSnapshot>;
  requestGesturePermissionIntent(enabled: boolean): Promise<{ accepted: true }>;
  onHudNativeSnapshot(listener: (snapshot: HudNativeSnapshot) => void): () => void;
  getConversationSnapshot(): Promise<ConversationSnapshot>;
  startConversation(): Promise<ConversationSnapshot>;
  stopConversation(): Promise<ConversationSnapshot>;
  setMicrophoneState(state: ConversationMicrophoneState): Promise<ConversationSnapshot>;
  requestMicrophonePermissionIntent(enabled: boolean): Promise<{ accepted: true }>;
  sendConversationAudio(chunk: Uint8Array): Promise<{ accepted: true }>;
  sendConversationText(text: string): Promise<{ accepted: true }>;
  interruptConversation(): Promise<ConversationSnapshot>;
  onConversationEvent(listener: (event: ConversationEvent) => void): () => void;
}>;

export function createRendererApi(ipc: PreloadIpc): IrisRendererApi;
