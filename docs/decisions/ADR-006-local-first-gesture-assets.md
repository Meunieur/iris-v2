# ADR-006: Gesture Inference and Assets Are Local-First

- **Status:** Accepted
- **Date:** 2026-07-23
- **Implemented:** 2026-07-24, Phase 2

## Context

The upstream Iris gesture hook references remote MediaPipe WASM/model assets.
Network-dependent startup is brittle and camera data must remain private for an
operator workstation.

## Decision

Pin and package MediaPipe WASM/model assets locally, retain provenance and
integrity metadata, and request camera permission only when gesture mode is
enabled. Inference runs locally; frames are not uploaded or persisted by
default. If assets are unavailable, mouse/keyboard/voice remain usable and the
HUD reports the degraded state.

The implementation pins `@mediapipe/tasks-vision` `0.10.35`, copies its six
required WASM/loader assets during every build and vendors the official float16
Gesture Recognizer model revision 1. The packaged model is integrity-checked
against SHA-256
`97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482`.
Production code contains no CDN fallback.

Camera access is video-only and follows a trusted, one-shot, 2-second
main-process permission intent. Camera frames stay renderer-local. Pause, stop,
error and unload stop all tracks and close the recognizer; mouse and keyboard
remain available after any model or permission failure.

## Consequences

Offline startup and privacy improve at the cost of package size and asset update
work. Model/version changes require a compatibility and performance check.

