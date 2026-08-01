# ADR-005: Hermes Is an Optional Capability-Package Source

- **Status:** Accepted; individual packs require separate promotion decisions
- **Date:** 2026-07-23

## Context

Hermes offers strong patterns for skill management, tool discovery, delegation,
computer/web/vision tools, permissions, output control and observability. A
wholesale merge would duplicate JarvisOS's brain, policy, provider and session
systems and increase supply-chain risk.

## Decision

Evaluate Hermes features as isolated capability packs. Prioritize provenance and
skill guards, lazy tool search, output/result limits, project/process isolation,
delegation/background jobs, session search/context compression and observability.
Treat computer/web/vision/media/voice as high-risk optional adapters. Every pack
must declare permissions/egress, map to Jarvis policy and be feature-flagged,
audited, killable and reversible.

## Consequences

Iris v2 can gain Hermes's strongest operational ideas without forking its agent
stack. Integration is slower and requires evidence per pack; that cost protects
the single-brain and single-policy architecture.

