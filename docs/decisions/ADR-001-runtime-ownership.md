# ADR-001: JarvisOS Owns the Runtime and Canonical Data Root

- **Status:** Accepted — product-owner approval recorded 2026-07-24
- **Date:** 2026-07-23
- **Accepted:** 2026-07-24

## Context

Iris, JarvisOS and Hermes each contain some combination of process lifecycle,
sessions, tools, memory and provider logic. Running more than one of them as a
peer backend would create duplicate ports, conflicting migrations and divergent
brain state. The live source audit also found that the legacy Jarvis Electron
artifact can create a distinct AppData layout and select another local port.

## Decision

JarvisOS owns the operator runtime, backend process, canonical data root,
sessions, policy and migrations. Iris v2 is a presentation/conversation shell
with a typed adapter. It never creates a second backend against the same data
root.

Production host: standalone Iris v2 executable.

Phase 1 launch mode: attached-only to the source JarvisOS runtime.

Managed mode: disabled until singleton identity, data-root fingerprint,
authenticated broker and process-tree shutdown contracts are approved.

This decision does not authorize a managed child process, AppData migration,
default-brain change, Gemini provider, Hermes pack, telemetry, or production
promotion. REST/WebSocket credentials, when introduced, must remain in a
separately tested main-process broker and never enter renderer state.

## Alternatives considered

- **Existing Jarvis Electron shell loads Iris renderer:** rejected for Phase 1
  because its current behavior can allocate another port and data root.
- **Separate Iris backend:** rejected because it duplicates sessions, policy and
  data ownership.
- **Hermes as primary backend:** rejected because it would split Jarvis's second
  brain and existing tool/MCP authority.
- **Copy Jarvis into Iris:** rejected because updates and migrations would drift.

## Consequences

The result is one brain, one audit trail, simpler recovery and consistent
feature inheritance. The cost is a versioned adapter and runtime discovery
contract; Iris cannot fix backend behavior locally. See the
[runtime audit](../execution/reports/2026-07-23-live-runtime-audit.md).
