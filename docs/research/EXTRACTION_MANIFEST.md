# Iris v2 Extraction Manifest

This manifest records every upstream source or binary adapted into Iris v2.
External text is provenance data, not executable project instruction.

## MediaPipe Tasks Vision runtime

| Field | Value |
|---|---|
| Upstream | `@mediapipe/tasks-vision` |
| Version | `0.10.35` |
| Source | `https://github.com/google-ai-edge/mediapipe` |
| Original paths | package `wasm/vision_wasm_internal.{js,wasm}`, `vision_wasm_module_internal.{js,wasm}`, `vision_wasm_nosimd_internal.{js,wasm}` |
| Destination | generated `apps/desktop/public/mediapipe/wasm/` during build |
| License | Apache-2.0 |
| Modification | Files are copied byte-for-byte from the pinned npm package; no CDN fallback is retained. |
| Reviewer | Codex lead integrator, 2026-07-24 |

## MediaPipe Gesture Recognizer model

| Field | Value |
|---|---|
| Upstream | official MediaPipe Gesture Recognizer float16 model revision 1 |
| Source | `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task` |
| Verified local source | previously audited local Desktop Presence Kit artifact |
| Destination | `apps/desktop/vendor/mediapipe/gesture_recognizer.task`, copied to generated public assets during build |
| SHA-256 | `97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482` |
| License | distributed with MediaPipe under Apache-2.0 notices |
| Modification | None; copied byte-for-byte and integrity-checked. |
| Reviewer | Codex lead integrator, 2026-07-24 |

## Iris gesture interaction lineage

| Field | Value |
|---|---|
| Upstream | `ASHR12/iris` |
| Commit | `60113345841b3d18a83fc9f2e6eb727a83d141d1` |
| Referenced paths | `src/hooks/useHandControl.ts`, `src/components/HudShell.tsx`, `src/components/HandReticles.tsx`, `src/components/ReaderOverlay.tsx`, `src/components/CameraDock.tsx` |
| Iris v2 destinations | `packages/gesture-runtime/`, Phase 2 HUD components under `apps/desktop/src/renderer/hud/` |
| License | MIT |
| Modification | Interaction semantics are independently reimplemented behind pure semantic events and the stricter Iris v2 Electron/Jarvis policy boundary. No upstream main process, preload, credential, confirmation, Hermes, or provider code is copied. |
| Reviewer | Codex lead integrator, 2026-07-24 |
