# ADR-002: Gemini Is the Conversation Plane; JarvisOS Is the Execution Plane

- **Status:** Accepted
- **Date:** 2026-07-23

## Context

The Iris Gemini bot is attractive for realtime conversational flow. JarvisOS
already owns skills, tools, sessions, brains, policy, MCP and audit. Letting
Gemini call tools directly would bypass that authority and recreate Iris's
Hermes bridge risk.

## Decision

Gemini Live handles voice, turn-taking, transcript and intent interpretation. A
Gemini function call becomes a `CapabilityEnvelope` proposal. JarvisOS evaluates
policy, requests approval when needed, executes and emits the authoritative
events. Iris v2 narrates the result back through Gemini or the Jarvis fallback.

## Consequences

Conversation is smooth and replaceable; execution remains auditable and
provider-neutral. The bridge must handle latency, partial transcripts, malformed
function calls, provider outages and context redaction. No Gemini callback may
invoke a raw shell, browser, filesystem or MCP method.

## Phase 3 implementation constraints

The 2026-07-28 implementation uses a disabled-by-default Electron main-process
broker and the pinned Google Gen AI JavaScript SDK. The renderer does not open a
provider WebSocket and never receives the API key or a session-resumption
handle. The provider is configured with exactly one proposal function and no
built-in search, code, URL, MCP or computer-use tool.

A provider function call may produce only a locally validated
`CapabilityEnvelope` in `proposed` state. It receives a bounded
“pending Jarvis policy/approval” response and cannot claim execution. Connecting
that proposal to execution requires a versioned JarvisOS endpoint, policy/audit
evidence and the Phase 3 human checkpoint.

See [the Gemini Live bridge contract](../contracts/gemini-live-bridge.md).

