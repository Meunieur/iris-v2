# ADR-003: JarvisOS Owns the Second Brain and Knowledge Graph

- **Status:** Accepted
- **Date:** 2026-07-23

## Context

Iris v2 needs second-brain learning, memory and galaxy knowledge view. JarvisOS
already has the brain/memory/vault/session/graph systems and their migrations.
A second Iris database would make recall inconsistent and make backups unsafe.

## Decision

JarvisOS remains the only writer and source of truth for brains, memory, vault,
sessions and graph data. Iris v2 uses opaque IDs and read/write APIs exposed by
Jarvis policy, then renders an operator-friendly view. No local shadow index or
dual-write queue is allowed without a future ADR.

## Consequences

Iris v2 inherits the newest JarvisOS cognition automatically when the adapter is
updated. Graph rendering must handle backend schema/version drift and large
datasets. Cross-client consistency tests are mandatory.

## Initial Iris adapter slice

The 2026-07-31 implementation slice is deliberately read-only and may be
sequenced before Phase 4 by product-owner direction. Iris resolves a selected
opaque brain ID only through the most recent authenticated `/brains` catalog,
keeps the corresponding legacy path inside the main-process adapter, and loads
one bounded `/graph` snapshot. Raw paths, `fullpath`, provider objects and file
contents never cross preload.

Selecting a brain in this view does not change the JarvisOS default brain or
write any canonical state. The legacy `/memory/stats` endpoint is not part of
this slice because it can create missing memory scaffolding while servicing a
GET. Graph WebSocket updates, memory/file detail, search and every mutation
remain later contracts.

## Authenticated legacy-session compatibility

The first authenticated live reconciliation on 2026-07-31 exposed a legitimate
legacy shape that sanitized fixtures had missed: a session title may be `null`.
Iris accepts that raw value but publishes only the fixed label
`Phiên chưa đặt tên`. Protected reconciliation is deliberately split after a
successful `/brains` read: a non-authentication `/sessions` failure degrades the
session list without deleting the valid private brain catalog, while any 401
still clears the catalog and requires sign-in. This keeps Second Brain
availability independent from unrelated legacy session drift without weakening
authentication or path isolation.

