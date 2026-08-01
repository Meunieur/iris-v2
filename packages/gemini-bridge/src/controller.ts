import { proposalFromToolCall } from "./proposal.js";
import type {
  ConversationContext,
  ConversationErrorCode,
  ConversationEvent,
  ConversationMicrophoneState,
  ConversationProvider,
  ConversationProviderEvent,
  ConversationProviderSession,
  ConversationScheduler,
  ConversationSnapshot,
  ConversationUsage,
} from "./types.js";

const MAX_AUDIO_CHUNK_BYTES = 32 * 1024;
const MAX_TEXT_BYTES = 8 * 1024;
const MAX_TRANSCRIPT_BYTES = 16 * 1024;
const textEncoder = new TextEncoder();

type ControllerInput = Readonly<{
  enabled: boolean;
  hasCredentials: boolean;
  model: string;
  provider: ConversationProvider;
  scheduler: ConversationScheduler;
  now(): Date;
  randomUuid(): string;
  getContext(): ConversationContext | undefined;
  retryDelaysMs?: readonly number[];
}>;

type MutableSnapshot = {
  sequence: number;
  provider: "gemini";
  model: string;
  state: ConversationSnapshot["state"];
  microphone: ConversationMicrophoneState;
  remoteStreaming: boolean;
  inputTranscript: string;
  outputTranscript: string;
  latencyMs?: number | undefined;
  usage?: ConversationUsage | undefined;
  cost: "unavailable";
  error?: ConversationErrorCode | undefined;
  proposal?: ConversationSnapshot["proposal"] | undefined;
};

function boundedAppend(current: string, next: string): string {
  const combined = `${current}${next}`;
  if (textEncoder.encode(combined).byteLength <= MAX_TRANSCRIPT_BYTES) return combined;
  let end = combined.length;
  while (end > 0 && textEncoder.encode(combined.slice(0, end)).byteLength > MAX_TRANSCRIPT_BYTES) end -= 1;
  return `${combined.slice(0, Math.max(0, end - 1))}â€¦`;
}

function freezeSnapshot(value: MutableSnapshot): ConversationSnapshot {
  return Object.freeze({
    ...value,
    ...(value.usage === undefined ? {} : { usage: Object.freeze({ ...value.usage }) }),
    ...(value.proposal === undefined ? {} : { proposal: Object.freeze({ ...value.proposal }) }),
  });
}

export function createConversationController(input: ControllerInput) {
  const retryDelays = input.retryDelaysMs ?? [1_000, 2_000, 5_000];
  const snapshotSubscribers = new Set<(snapshot: ConversationSnapshot) => void>();
  const eventSubscribers = new Set<(event: ConversationEvent) => void>();
  let snapshot = freezeSnapshot({
    sequence: 0,
    provider: "gemini",
    model: input.model,
    state: input.enabled ? (input.hasCredentials ? "idle" : "missing_credentials") : "disabled",
    microphone: "off",
    remoteStreaming: false,
    inputTranscript: "",
    outputTranscript: "",
    cost: "unavailable",
    ...(!input.enabled ? {} : input.hasCredentials ? {} : { error: "missing_credentials" as const }),
  });
  let session: ConversationProviderSession | undefined;
  let resumeHandle: string | undefined;
  let reconnectHandle: unknown;
  let retryIndex = 0;
  let explicitStop = false;
  let connectionGeneration = 0;

  const publish = (change: Partial<MutableSnapshot>) => {
    snapshot = freezeSnapshot({
      ...snapshot,
      ...change,
      sequence: snapshot.sequence + 1,
    });
    for (const subscriber of snapshotSubscribers) subscriber(snapshot);
    const event: ConversationEvent = Object.freeze({ type: "snapshot", snapshot });
    for (const subscriber of eventSubscribers) subscriber(event);
  };

  const emit = (event: ConversationEvent) => {
    for (const subscriber of eventSubscribers) subscriber(event);
  };

  const clearReconnect = () => {
    if (reconnectHandle !== undefined) {
      input.scheduler.clear(reconnectHandle);
      reconnectHandle = undefined;
    }
  };

  const scheduleReconnect = () => {
    if (explicitStop || reconnectHandle !== undefined) return;
    const delay = retryDelays[retryIndex];
    if (delay === undefined) {
      publish({ state: "degraded", remoteStreaming: false, error: "reconnect_exhausted" });
      return;
    }
    retryIndex += 1;
    publish({ state: "reconnecting", remoteStreaming: false, error: undefined });
    reconnectHandle = input.scheduler.set(delay, () => {
      reconnectHandle = undefined;
      void connectProvider();
    });
  };

  const handleToolCalls = async (event: Extract<ConversationProviderEvent, { type: "tool_call" }>) => {
    const responses = [];
    let proposal: ConversationSnapshot["proposal"] | undefined;
    let rejected = false;
    for (const call of event.calls) {
      const result = proposalFromToolCall({
        call,
        context: input.getContext(),
        model: input.model,
        now: input.now(),
        randomUuid: input.randomUuid,
      });
      responses.push(result.response);
      if (result.summary === undefined) rejected = true;
      else proposal = result.summary;
    }
    if (session !== undefined) await session.sendToolResponse(Object.freeze(responses));
    publish({
      ...(proposal === undefined ? {} : { proposal }),
      ...(rejected ? { error: "proposal_rejected" as const } : { error: undefined }),
    });
  };

  const handleProviderEvent = (event: ConversationProviderEvent) => {
    if (event.type === "input_transcript") {
      publish({ inputTranscript: boundedAppend(snapshot.inputTranscript, event.text) });
    } else if (event.type === "output_transcript") {
      publish({ outputTranscript: boundedAppend(snapshot.outputTranscript, event.text), state: "speaking" });
    } else if (event.type === "audio") {
      if (event.pcm16.byteLength === 0 || event.pcm16.byteLength > MAX_AUDIO_CHUNK_BYTES) {
        publish({ state: "error", error: "invalid_provider_message" });
        return;
      }
      publish({ state: "speaking" });
      emit(Object.freeze({ type: "audio_output", pcm16: new Uint8Array(event.pcm16), sampleRate: 24_000 }));
    } else if (event.type === "interrupted") {
      publish({ state: "listening" });
      emit(Object.freeze({ type: "interrupted" }));
    } else if (event.type === "turn_complete") {
      publish({ state: "listening" });
      emit(Object.freeze({ type: "turn_complete" }));
    } else if (event.type === "session_resumption") {
      resumeHandle = event.resumable && event.handle !== undefined ? event.handle : undefined;
    } else if (event.type === "go_away") {
      session?.close();
      session = undefined;
      scheduleReconnect();
    } else if (event.type === "usage") {
      publish({
        usage: Object.freeze({
          ...(event.inputTokens === undefined ? {} : { inputTokens: event.inputTokens }),
          ...(event.outputTokens === undefined ? {} : { outputTokens: event.outputTokens }),
          ...(event.totalTokens === undefined ? {} : { totalTokens: event.totalTokens }),
        }),
      });
    } else if (event.type === "tool_call") {
      void handleToolCalls(event);
    }
  };

  const connectProvider = async () => {
    const generation = ++connectionGeneration;
    publish({ state: retryIndex === 0 ? "connecting" : "reconnecting", error: undefined });
    try {
      const connected = await input.provider.connect({
        model: input.model,
        ...(resumeHandle === undefined ? {} : { resumeHandle }),
        onEvent: handleProviderEvent,
        onClose: () => {
          if (generation !== connectionGeneration || explicitStop) return;
          session = undefined;
          scheduleReconnect();
        },
      });
      if (generation !== connectionGeneration || explicitStop) {
        connected.close();
        return;
      }
      session = connected;
      publish({ state: "listening", remoteStreaming: snapshot.microphone === "active", error: undefined });
    } catch {
      session = undefined;
      if (retryIndex === 0) publish({ state: "degraded", error: "provider_unavailable", remoteStreaming: false });
      scheduleReconnect();
    }
  };

  return Object.freeze({
    current: () => snapshot,
    subscribeSnapshot(listener: (next: ConversationSnapshot) => void) {
      snapshotSubscribers.add(listener);
      return () => snapshotSubscribers.delete(listener);
    },
    subscribeEvent(listener: (event: ConversationEvent) => void) {
      eventSubscribers.add(listener);
      return () => eventSubscribers.delete(listener);
    },
    async start(): Promise<ConversationSnapshot> {
      if (!input.enabled) {
        if (snapshot.state !== "disabled") publish({ state: "disabled", remoteStreaming: false, error: undefined });
        return snapshot;
      }
      if (!input.hasCredentials) {
        publish({ state: "missing_credentials", remoteStreaming: false, error: "missing_credentials" });
        return snapshot;
      }
      if (session !== undefined || snapshot.state === "connecting" || snapshot.state === "reconnecting") return snapshot;
      explicitStop = false;
      retryIndex = 0;
      await connectProvider();
      return snapshot;
    },
    async stop(): Promise<ConversationSnapshot> {
      explicitStop = true;
      connectionGeneration += 1;
      clearReconnect();
      session?.close();
      session = undefined;
      resumeHandle = undefined;
      retryIndex = 0;
      publish({
        state: "idle",
        microphone: "off",
        remoteStreaming: false,
        error: undefined,
        proposal: undefined,
      });
      return snapshot;
    },
    setMicrophoneState(state: ConversationMicrophoneState): ConversationSnapshot {
      publish({ microphone: state, remoteStreaming: state === "active" && session !== undefined });
      return snapshot;
    },
    async sendAudio(chunk: Uint8Array): Promise<{ accepted: true }> {
      if (
        session === undefined
        || snapshot.microphone !== "active"
        || chunk.byteLength === 0
        || chunk.byteLength > MAX_AUDIO_CHUNK_BYTES
        || chunk.byteLength % 2 !== 0
      ) {
        throw new Error("Conversation audio chunk rejected");
      }
      const copy = new Uint8Array(chunk);
      await session.sendAudio(copy);
      if (!snapshot.remoteStreaming || snapshot.state !== "listening") {
        publish({ state: "listening", remoteStreaming: true });
      }
      return { accepted: true };
    },
    async sendText(text: string): Promise<{ accepted: true }> {
      if (session === undefined || text.length === 0 || textEncoder.encode(text).byteLength > MAX_TEXT_BYTES) {
        throw new Error("Conversation text rejected");
      }
      await session.sendText(text);
      return { accepted: true };
    },
    async interrupt(): Promise<ConversationSnapshot> {
      if (session !== undefined) await session.interrupt();
      publish({ state: session === undefined ? snapshot.state : "listening" });
      emit(Object.freeze({ type: "interrupted" }));
      return snapshot;
    },
  });
}

export type ConversationController = ReturnType<typeof createConversationController>;
