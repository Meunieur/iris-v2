# Local Gesture Event Contract

**Owner:** Iris v2 renderer-local gesture runtime  
**Authority:** reversible Phase 2 UI state only  
**Status:** Phase 2 implemented, 2026-07-24

## Privacy and asset boundary

- Camera is off by default and opens only after an explicit operator action.
- `getUserMedia` requests video only: ideal 640x480 at 30 FPS maximum; audio is
  false.
- Frames stay in the renderer and are passed directly to the local MediaPipe
  recognizer. They are not displayed, persisted, logged, uploaded or sent over
  IPC.
- MediaPipe Tasks Vision `0.10.35`, six WASM/loader assets and the Gesture
  Recognizer model are packaged locally. There is no CDN fallback.
- The packaged model SHA-256 is
  `97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482`.
- Pause, stop, error and renderer unload stop every camera track, detach the
  video stream, cancel animation frames, reset the engine and close the
  recognizer.

## Normalized observations

MediaPipe output is reduced to at most two hands with public geometry only:

```ts
type HandObservation = Readonly<{
  timestampMs: number;
  hands: readonly NormalizedHand[];
}>;
```

Each hand contains an ID, handedness, normalized gesture name, gesture and
tracking confidence, CSS-pixel pointer, and palm center. Camera coordinates are
mirrored into the current renderer viewport before policy evaluation. No image
or landmark history crosses the renderer boundary.

## Stabilization defaults

| Rule | Value |
|---|---:|
| Gesture confidence | 0.72 minimum |
| Tracking confidence | 0.65 minimum |
| Stable pose | 160 ms |
| Point dwell | 700 ms |
| Dwell movement tolerance | 24 CSS px |
| Select cooldown | 900 ms |
| Closed-fist hold | 500 ms |
| Tracking stale expiry | 250 ms |
| Two-palm resize hold | 180 ms |
| Scroll dead zone | 12% of reader height |
| Maximum scroll/frame | 28 CSS px |
| Scale output | clamped to 0.7-1.4 |

Changing pose, leaving the target, moving beyond tolerance, losing confidence
or becoming stale resets pending dwell. A selected target must be left before
the same target can select again.

## Semantic output

```ts
type GestureEvent =
  | { type: "pointer"; point: Point; confidence: number; dwellProgress: number; targetId?: string }
  | { type: "select"; point: Point; targetId: string; dwellMs: number }
  | { type: "scroll"; deltaY: number }
  | { type: "scale"; factor: number }
  | { type: "dismiss" }
  | { type: "tracking_lost" };
```

- Point-and-hold emits `select` only for an allow-listed target under the
  reticle.
- One open palm scrolls only the active reader.
- Two open palms resize only the reader between 320 and 420 CSS px.
- A held closed fist dismisses only the active reader.
- `tracking_lost` clears reticle/dwell feedback and never activates a target.

The App reducer consumes semantic events directly. It never calls generic DOM
`click()`, never synthesizes OS input and never treats model output as proof
that an action occurred.

## Phase 2 action policy

Allowed gesture targets are deliberately small:

- `reader.open.runtime`
- `reader.open.brain`
- `reader.open.session`
- `reader.close`
- `gesture.pause`

Authentication, refresh, approval, execution, navigation, quit, filesystem,
shell, browser/computer control and every Jarvis side effect are forbidden.
Mouse and keyboard remain the fallback for all controls, including sign-in and
camera enable/stop.

