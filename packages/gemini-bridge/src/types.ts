import type { CapabilityEnvelope } from "@iris/contracts";

export type ConversationLifecycle =
  | "disabled"
  | "missing_credentials"
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "reconnecting"
  | "degraded"
  | "error";

export type ConversationMicrophoneState = "off" | "requesting" | "active" | "blocked";

export type ConversationErrorCode =
  | "missing_credentials"
  | "provider_unavailable"
  | "invalid_provider_message"
  | "input_rejected"
  | "proposal_rejected"
  | "reconnect_exhausted";

export type ConversationUsage = Readonly<{
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}>;

export type ConversationProposalSummary = Readonly<{
  intentId: string;
  capability: string;
  arguments: CapabilityEnvelope["request"]["arguments"];
  risk: CapabilityEnvelope["risk"]["level"];
  reason: string;
  approvalRequired: true;
  approvalState: "proposed";
  expiresAt: string;
}>;

export type ConversationSnapshot = Readonly<{
  sequence: number;
  provider: "gemini";
  model: string;
  state: ConversationLifecycle;
  microphone: ConversationMicrophoneState;
  remoteStreaming: boolean;
  inputTranscript: string;
  outputTranscript: string;
  latencyMs?: number | undefined;
  usage?: ConversationUsage | undefined;
  cost: "unavailable";
  error?: ConversationErrorCode | undefined;
  proposal?: ConversationProposalSummary | undefined;
}>;

export type ConversationEvent =
  | Readonly<{ type: "audio_output"; pcm16: Uint8Array; sampleRate: 24_000 }>
  | Readonly<{ type: "interrupted" }>
  | Readonly<{ type: "turn_complete" }>
  | Readonly<{ type: "snapshot"; snapshot: ConversationSnapshot }>;

export type ConversationToolCall = Readonly<{
  id: string;
  name: string;
  args: unknown;
}>;

export type ConversationProviderEvent =
  | Readonly<{ type: "setup_complete" }>
  | Readonly<{ type: "input_transcript"; text: string; final: boolean }>
  | Readonly<{ type: "output_transcript"; text: string; final: boolean }>
  | Readonly<{ type: "audio"; pcm16: Uint8Array }>
  | Readonly<{ type: "interrupted" }>
  | Readonly<{ type: "turn_complete" }>
  | Readonly<{ type: "session_resumption"; resumable: boolean; handle?: string | undefined; lastConsumedClientMessageIndex?: string | undefined }>
  | Readonly<{ type: "go_away"; timeLeftMs?: number | undefined }>
  | Readonly<{ type: "tool_call"; calls: readonly ConversationToolCall[] }>
  | Readonly<{ type: "tool_call_cancelled"; ids: readonly string[] }>
  | Readonly<{ type: "usage"; inputTokens?: number | undefined; outputTokens?: number | undefined; totalTokens?: number | undefined }>;

export type ConversationToolResponse = Readonly<{
  id: string;
  name: string;
  response: Readonly<Record<string, string>>;
}>;

export type ConversationProviderSession = Readonly<{
  close(): void;
  interrupt(): void | Promise<void>;
  sendAudio(chunk: Uint8Array): void | Promise<void>;
  sendText(text: string): void | Promise<void>;
  sendToolResponse(responses: readonly ConversationToolResponse[]): void | Promise<void>;
}>;

export type ConversationProvider = Readonly<{
  connect(input: Readonly<{
    model: string;
    resumeHandle?: string;
    onEvent(event: ConversationProviderEvent): void;
    onClose(): void;
  }>): Promise<ConversationProviderSession>;
}>;

export type ConversationScheduler = Readonly<{
  set(delayMs: number, task: () => void): unknown;
  clear(handle: unknown): void;
}>;

export type ConversationContext = Readonly<{
  brainId: string;
  sessionId: string;
  runId: string | null;
}>;
