# Iris v2 Privacy Notice

**Status:** developer preview; last reviewed 2026-07-31.

Iris v2 is designed as a local Windows operator surface attached to a
user-controlled JarvisOS runtime. This document describes the intended default
data flows in the current repository. It is not a promise about an unreviewed
fork, optional provider or future capability pack.

## Default data handling

| Data | Default behavior |
|---|---|
| Jarvis health, brain, session, graph and task state | Read from the exact loopback Jarvis endpoint through the main process; renderer receives a bounded public projection |
| Jarvis authentication | Held in a dedicated in-memory Electron session; credentials and cookies are not exposed to renderer state |
| Camera frames | Processed locally only after the operator enables gesture mode; not persisted or uploaded by default |
| Gesture landmarks/events | Converted locally into bounded semantic events; test fixtures contain landmarks, not camera frames |
| Gemini audio/transcripts | Provider integration is disabled without an explicit credential; when enabled, selected audio/text is sent to the configured remote provider |
| Logs | Intended to contain state and protocol diagnostics without credentials, cookies or raw private backend paths |
| Telemetry and crash reporting | Telemetry is off; automatic remote crash reporting is not enabled in the current developer preview |
| Hermes packs | Disabled unless a specific pack is reviewed, feature-flagged and approved |

## Local authority and storage

JarvisOS remains the canonical owner of brains, memory, vault data, sessions,
tools, workflows, policy and audit. Iris v2 does not copy that data into a
second brain or migrate the Jarvis data root in the current attached-only mode.
Renderer state is intentionally insufficient to reconstruct credentials or raw
private paths.

## Optional remote providers

Gemini Live is an optional conversational provider, not the execution
authority. Enabling it may transmit microphone audio, transcript text and the
minimum approved context to the configured provider under that provider's
terms. The HUD must visibly show the provider and recording/streaming state.
Disabling Gemini leaves the local Jarvis text path available.

No web, computer-use, media or other external provider is enabled merely by
being present in a catalog. Each requires its declared policy and, where
applicable, fresh operator approval.

## Camera controls

The camera remains off until gesture mode is enabled. Iris provides visible
pause/stop state and must release the camera on pause, close or shutdown. Frames
are not used for biometric identification. Any future upload, persistence or
analytics behavior would require a separately reviewed privacy and consent
change.

## Security and deletion

Iris does not provide a separate delete operation for canonical Jarvis data.
Data lifecycle and deletion remain JarvisOS responsibilities. See
[SECURITY.md](SECURITY.md) for threat boundaries and confidential vulnerability
reporting.

## Developer-preview limitations

The project has not completed its release privacy review, public support
channel, signed distribution or full live-provider/physical acceptance gates.
Do not use this build with production secrets or sensitive workloads unless
you understand and accept the recorded verification debt.
