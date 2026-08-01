# ADR-004: Extract Iris UI and Gesture Semantics, Not Its Whole Main Process

- **Status:** Accepted
- **Date:** 2026-07-23
- **Implemented:** 2026-07-24, Phase 2

## Context

Iris provides useful Electron/React HUD, Glass surfaces, task reader and
MediaPipe gesture semantics. Its main/preload layer also mixes Gemini, Hermes,
config and broad IPC responsibilities that conflict with JarvisOS ownership and
the stricter security contract in this project.

## Decision

Reuse/adapt the following lineage:

- HUD layout and Glass interaction language;
- task/reader/camera dock patterns;
- point-and-hold, palm scroll, two-palm resize and fist dismiss semantics;
- Gemini Live conversational ideas, behind the Iris v2 bridge.

Do not wholesale copy Iris's `electron/main.mjs`, preload API, direct Hermes
bridge, unrestricted config exposure or CDN-only model loading. Reimplement the
boundary with narrow preload APIs, local pinned assets and Jarvis adapters.
Retain the upstream MIT copyright/license notice for reused source.

The implemented boundary uses a pure `@iris/gesture-runtime` package and
renderer-local semantic events. The Electron main process owns only native
window/camera-permission state; the renderer owns visual state; JarvisOS remains
the sole runtime, policy and data authority. Gesture output is never translated
to generic DOM clicks, OS input, authentication, approval or Jarvis execution.

## Consequences

The visual result can feel like Iris while the runtime is safer and single-owner.
Some source-level porting work is required, and UI behavior must be covered by
new contract/gesture tests rather than assumed from the upstream app.

The exact upstream commit, referenced paths, adaptations and reviewer are
recorded in `docs/research/EXTRACTION_MANIFEST.md`.

