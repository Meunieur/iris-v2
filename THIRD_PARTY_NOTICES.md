# Third-Party Notices

## ASHR12/iris

Iris v2 reuses/adapts selected UI and gesture concepts and may include selected
source files from [ASHR12/iris](https://github.com/ASHR12/iris). The upstream
project is distributed under the MIT License. When source is copied or adapted,
retain the upstream copyright and license text in the distribution and record
the exact commit in `docs/research/UPSTREAM_NOTES.md`. The preserved upstream
license is available at [LICENSES/ASHR12-iris-MIT.txt](LICENSES/ASHR12-iris-MIT.txt).

## MediaPipe Tasks Vision

Iris v2 uses `@mediapipe/tasks-vision` version `0.10.35` and the official
Gesture Recognizer float16 model revision 1 for local hand-gesture inference.
MediaPipe is licensed under the Apache License 2.0.

The full Apache License 2.0 text is preserved at
[LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt), and the project attribution
summary is preserved in [NOTICE](NOTICE).

- Source and license: [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe)
- Model source: [official Gesture Recognizer model](https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task)
- Model SHA-256: `97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482`
- Detailed paths and modifications: [extraction manifest](docs/research/EXTRACTION_MANIFEST.md)

The six required WASM/JavaScript runtime assets are copied byte-for-byte from
the pinned npm package into the application build. The model is vendored and
integrity-recorded. Production runtime has no CDN or remote model fallback.
Camera frames remain inside the local renderer inference boundary and are not
persisted or transmitted by this subsystem.

## Gemini and provider SDKs

Record the exact SDK package/version and provider terms in the implementation
lockfile/release notes. Provider credentials and data handling remain subject to
the security contract in `SECURITY.md`.

## Hermes capability packs

No Hermes source or pack is considered adopted merely because it is listed in
the roadmap. Every promoted pack must add its own source commit, license,
provenance, permissions and notices here before the feature flag is enabled.
