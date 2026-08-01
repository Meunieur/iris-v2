# Contract — Gemini Live conversation bridge v1

**Status:** Phase 3 implementation contract. Deterministic implementation is
authorized; the provider remains disabled by default and no live credentialed
smoke test is authorized by this document.

**Owner:** Iris v2 owns conversation transport and short-lived presentation
state. JarvisOS remains the only owner of sessions, policy, approval, execution,
memory and audit.

## Provider and process boundary

The Gemini connection exists only in the Electron main process through a
dedicated broker. The renderer never receives an API key, provider WebSocket,
SDK object, resumption handle or raw provider message.

- `IRIS_GEMINI_ENABLED=1` is required before the broker may connect.
- `GEMINI_API_KEY` is read only by the main process. Missing or disabled
  configuration yields a public `disabled` or `missing_credentials` state.
- The JavaScript SDK is pinned to `@google/genai@2.13.0` and loaded only inside
  the provider adapter.
- The initial model is `gemini-3.1-flash-live-preview`, matching the current
  official Live API examples. A main-process-only configuration may override it;
  the renderer can display the selected public model name but cannot change it.
- The connection is server-to-server from the main process. Standard API keys
  are never used in client-side renderer code.

The current Google contract is a stateful WebSocket. Audio input is raw 16-bit
PCM, 16 kHz, little-endian; audio output is raw 16-bit PCM, 24 kHz,
little-endian. Live sessions support barge-in, input/output transcription,
session resumption and a `GoAway` warning before a connection reset.

Official references:

- <https://ai.google.dev/gemini-api/docs/live-api>
- <https://ai.google.dev/gemini-api/docs/live-api/session-management>
- <https://ai.google.dev/gemini-api/docs/live-api/tools>
- <https://googleapis.github.io/js-genai/release_docs/classes/live.Live.html>

## Public renderer surface

The preload exposes only fixed conversation operations:

```ts
type ConversationRendererApi = {
  getConversationSnapshot(): Promise<ConversationSnapshot>;
  startConversation(): Promise<ConversationSnapshot>;
  stopConversation(): Promise<ConversationSnapshot>;
  requestMicrophonePermissionIntent(enabled: boolean): Promise<{ accepted: true }>;
  sendConversationAudio(chunk: Uint8Array): Promise<{ accepted: true }>;
  sendConversationText(text: string): Promise<{ accepted: true }>;
  interruptConversation(): Promise<ConversationSnapshot>;
  onConversationEvent(listener: (event: ConversationEvent) => void): () => void;
};
```

There is no generic `send`, provider URL, tool executor, filesystem, shell,
browser, cookie, token or arbitrary configuration method. IPC validates the
trusted sender ID and exact main-frame URL. Audio chunks and text are bounded
before observation by the provider adapter.

## Public conversation state

The renderer receives a frozen, allowlisted snapshot containing:

- provider and public model label;
- lifecycle state: `disabled`, `missing_credentials`, `idle`, `connecting`,
  `listening`, `speaking`, `reconnecting`, `degraded`, `error`;
- explicit microphone/remote-streaming state;
- bounded input and output transcript text;
- latency when measured;
- provider usage token counts when supplied;
- `cost: "unavailable"` until an approved, versioned pricing source exists;
- a sanitized public error code; and
- at most one validated, proposal-only capability envelope.

Raw SDK exceptions, close reasons, credentials, resumption handles and provider
payloads are never projected.

## Microphone and audio lifecycle

Microphone access is off by default. A deliberate user action first sets a
single-use main-process permission intent, then the trusted renderer may request
audio-only media access. Camera permission remains a separate single-use intent.

The renderer resamples local microphone data to bounded PCM16/16 kHz chunks and
sends only those chunks through the fixed IPC method while the broker is in a
listening-capable state. Provider audio returns as bounded PCM16/24 kHz events.
Stopping, renderer unmount, provider loss and app shutdown must stop tracks,
disconnect audio nodes, close playback resources and close the provider session.

No audio is stored by Iris v2. Transcript display is short-lived renderer state;
durable conversation history remains a future JarvisOS-owned contract.

## Function-call and proposal boundary

The provider receives exactly one declared function:
`propose_capability`. Built-in Google Search, code execution, URL context, MCP,
browser and arbitrary function declarations are not configured.

The function accepts a bounded proposal draft. The bridge, not Gemini, adds
UUIDs, timestamps, source identity and current opaque Jarvis context, then
validates the complete value with `capabilityEnvelopeSchema`.

- Unknown function names fail closed.
- Missing Jarvis brain/session context fails closed.
- Credential-bearing keys, executable code, prototype tricks, oversized input
  and malformed risk/approval data fail closed through the existing envelope
  preflight.
- A valid call creates only `approval.state = "proposed"` and visible
  `approval.required = true`.
- The bridge never calls a Jarvis tool, shell, filesystem, browser or capability
  endpoint. It returns a bounded provider response that the proposal is pending
  Jarvis policy/approval, never that execution succeeded.

Connecting execution requires a separately approved, versioned JarvisOS
capability endpoint and the Phase 3 human checkpoint.

## Recovery and failure behavior

- Provider `GoAway` or an unexpected close preserves the Jarvis snapshot and
  enters bounded exponential reconnect with at most one timer.
- A resumable handle is retained in main-process memory only and used on the
  next connection. It is discarded on explicit stop.
- Input sent after the last server-consumed index may be buffered only within a
  strict byte/count budget; overflow drops the buffer and enters degraded mode.
- Interruption stops local playback immediately and signals the live session;
  it does not cancel or mutate the Jarvis session.
- Malformed provider messages, unknown tool calls, oversized audio/text and
  repeated reconnect failure produce sanitized error/degraded states.
- If Gemini is unavailable, Jarvis remains connected and usable. Phase 3 exposes
  the degraded state; Jarvis text/TTS transport remains a later versioned
  adapter operation because no write/turn endpoint exists in the characterized
  Jarvis contract.

## Deterministic verification

Unit and contract tests must cover disabled/missing credentials, connect,
transcript normalization, audio bounds, interruption, `GoAway`, resumption,
single-timer reconnect, explicit stop, malformed messages, unknown functions,
prompt-injection drafts requesting filesystem/shell/browser access, proposal
validation, cleanup and secret-free public snapshots. Tests must not contact a
remote provider.

The live provider smoke test, natural Vietnamese conversation quality and
privacy-state review remain explicit human/provider evidence at the Phase 3
checkpoint.
