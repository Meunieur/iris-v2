import type { BrainSummary, JarvisTaskInput } from "@iris/contracts";
import type { JarvisKnowledgeSnapshot, JarvisReadSnapshot, JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";
import type { ConversationSnapshot } from "@iris/gemini-bridge";
import type { HudNativeSnapshot } from "../../main/hud-native.js";

export type ReticleView = Readonly<{
  x: number;
  y: number;
  confidence: number;
  dwellProgress: number;
  state: "tracking" | "dwelling" | "stale";
}>;

export type GestureViewState = Readonly<{
  enabled: boolean;
  camera: "off" | "requesting" | "active" | "paused" | "error";
  model: "idle" | "loading" | "ready" | "error";
  gesture: "point" | "open_palm" | "closed_fist" | "unknown";
  tracking: boolean;
  primaryReticle?: ReticleView | undefined;
  secondaryReticle?: ReticleView | undefined;
  fps?: number | undefined;
  latencyMs?: number | undefined;
  error?: string | undefined;
}>;

export type ReaderView = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
  width: number;
}>;

export type HudSurfaceActions = Readonly<{
  onOpenReader(id: string): void;
  onCloseReader(): void;
  onRefresh(): void;
  onSignIn(): void;
  onEnableGesture(): void;
  onPauseGesture(): void;
  onStopGesture(): void;
  onStartConversation?: (() => void) | undefined;
  onStopConversation?: (() => void) | undefined;
  onInterruptConversation?: (() => void) | undefined;
  onSendConversationText?: ((text: string) => void) | undefined;
  onSelectKnowledgeBrain?: ((brainId: BrainSummary["id"]) => void) | undefined;
  onLoadKnowledge?: (() => void) | undefined;
  onSelectTaskBrain?: ((brainId: BrainSummary["id"]) => void) | undefined;
  onSendTask?: ((input: JarvisTaskInput) => void) | undefined;
  onStopTask?: (() => void) | undefined;
}>;

export type HudSurfaceState = Readonly<{
  snapshot: JarvisReadSnapshot;
  native: HudNativeSnapshot;
  gesture: GestureViewState;
  reader?: ReaderView | undefined;
  refreshing: boolean;
  notice?: string | undefined;
  conversation?: ConversationSnapshot | undefined;
  conversationBusy?: boolean | undefined;
  conversationNotice?: string | undefined;
  knowledge?: JarvisKnowledgeSnapshot | Readonly<{ state: "idle" | "loading" }> | undefined;
  selectedKnowledgeBrainId?: BrainSummary["id"] | undefined;
  knowledgeBusy?: boolean | undefined;
  knowledgeNotice?: string | undefined;
  task?: JarvisTaskControllerSnapshot | undefined;
  taskBusy?: boolean | undefined;
  taskNotice?: string | undefined;
}>;
