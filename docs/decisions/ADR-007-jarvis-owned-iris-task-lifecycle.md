# ADR-007: JarvisOS Owns the Iris Task Lifecycle

- **Status:** Accepted for the bounded Phase 4 R0 slice
- **Date:** 2026-07-31

## Context

Iris needs to submit work, show trustworthy progress, stop work and recover
after renderer or transport interruption. The legacy Jarvis chat WebSocket is
not an execution authority: its `turn_done` event has no success/failure
outcome, its model response can arrive before tools finish, and a reconnect
cannot prove whether a side effect already happened.

JarvisOS already owns a durable SQLite task queue with task IDs, run IDs,
leases, events, terminal states and brain-scoped idempotency. Reusing that
authority avoids a second scheduler or an Iris-owned execution database.

## Decision

JarvisOS is the sole authority for every Iris task lifecycle. The initial Phase
4 contract adds a dedicated authenticated `/iris/v1/turns` surface backed by
the Jarvis task store. Iris may submit only an internal `iris-read` capability:

- risk is fixed to `R0`;
- mode is forced to `suggest`;
- local tools are limited to `Read`, `Glob`, `Grep` and `LS`;
- MCP connectors are filtered through Jarvis' read-only policy;
- `Write`, `Edit`, shell, browser fetch/search and subtask tools are denied;
- the selected brain is resolved by Jarvis from an opaque catalog ID; and
- the client cannot select a route, engine, capability, risk, approval state,
  tool list, raw path or policy mode.

The server binds a UUID intent and payload SHA-256 to a UUID idempotency key.
An exact replay returns the existing task. Reusing the key with different
content fails with a conflict. Task status, run identity, terminal outcome,
orphan indication and stop behavior come only from Jarvis records.

Iris main owns retry/poll coordination and exposes only fixed task methods and
sanitized task snapshots through preload. The renderer never receives the
Jarvis endpoint, auth cookie, raw brain path, task metadata, generic fetch or
generic IPC.

The HTTP request is strict rather than permissive: fields outside the R0
allowlist are rejected. Jarvis removes the selected brain root from terminal
text before projection, Iris applies the shared credential redactor before
preload, and main retains only a bounded recent event window.

## Consequences

This slice can prove the Phase 4 lifecycle without opening Phase 6 approvals or
side effects. A model sentence, transcript, tool-shaped payload or Gemini
proposal cannot mark a task successful. Lost submit responses are recovered by
replaying the same key; later polling uses the returned task ID and event
cursor, so reconnect never creates a second task.

The first contract uses bounded polling rather than the legacy chat WebSocket.
Polling is an implementation detail behind the main-process subscription and
may later become a versioned Jarvis event stream without changing renderer
authority.

R1/R2/R3 actions, mutation tools, approval prompts, capability discovery and
rollback remain closed until the Phase 6 Jarvis policy contract is designed,
approved and verified. This ADR does not authorize them.
