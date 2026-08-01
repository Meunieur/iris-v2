# Phase 2 Glass HUD and Local Gesture Runtime Design

**Status:** approved direction; written specification awaiting product-owner review

**Date:** 2026-07-24

**Owner:** Iris v2

**Approved direction:** dual-mode Iris HUD plus Command Deck

## 1. Outcome

Phase 2 replaces the Phase 1 verification dashboard as the primary operator
experience. Iris v2 becomes a transparent desktop HUD that can expand into an
interactive Command Deck without changing JarvisOS runtime ownership.

The shipped slice must provide:

- a transparent, frameless, always-on-top HUD;
- click-through behavior outside deliberate interactive regions;
- a recoverable global shortcut that switches between HUD and Command Deck;
- an Iris-lineage orb, task/status stack, reader, gesture reticle, and camera
  dock built from the project `DESIGN.md` rather than copied wholesale;
- a local MediaPipe gesture runtime with pinned packaged assets;
- point-and-hold select, open-palm scroll, two-palm reader resize, and
  closed-fist dismiss;
- mouse and keyboard equivalents for every gesture;
- explicit camera consent, local-only frame processing, and reliable shutdown;
- no Gemini, Hermes, managed Jarvis lifecycle, side-effecting tools, or gesture
  approval behavior.

Phase 1's read-only Jarvis health, brain, session, refresh, and sign-in surfaces
remain available. Phase 2 changes their presentation and interaction model; it
does not widen their backend authority.

## 2. Chosen product shape

Three product shapes were considered:

1. A glass-skinned full-window dashboard. This preserves the Phase 1 layout but
   does not deliver the unobtrusive desktop presence requested by the product
   owner.
2. A compact HUD only. This delivers desktop presence but makes setup,
   diagnostics, keyboard navigation, and detailed reading unnecessarily hard.
3. A dual-mode surface: compact transparent HUD by default, expanding into an
   interactive Command Deck through a global shortcut. This is the selected
   direction.

The dual-mode design retains the strongest interaction qualities of upstream
Iris while preserving the safer Iris v2 Electron and Jarvis boundaries.

## 3. Window modes

### 3.1 Desktop HUD

The HUD is the default operator surface after startup.

- The Electron window is frameless, transparent, always on top, and sized to
  the active display work area.
- The window ignores mouse input by default and forwards mouse movement where
  the platform supports it so explicit hit regions can become interactive.
- The desktop remains visible and usable through the empty center safe zone.
- The HUD does not take focus during ordinary state updates or gesture
  tracking.
- The task/status stack occupies the upper-right edge.
- The orb and compact controls occupy the lower-right edge.
- The gesture/camera dock occupies the lower-left edge.
- A reader appears along the right edge only when explicitly opened.
- Reticles may move across the display but are visual feedback, not independent
  authority.

The HUD must never become impossible to control. The global shortcut remains
available even if hit-region detection, gesture inference, or renderer state
fails.

### 3.2 Command Deck

The Command Deck is the deliberate interactive mode.

- It uses the same Electron window and renderer state; switching mode must not
  create a second BrowserWindow or Jarvis connection.
- Mouse input is enabled for the whole window and the window may take focus.
- It presents the Phase 1 connection, sign-in, runtime, brain, session, and
  diagnostics data in a cinematic but readable operator layout.
- It exposes gesture enable/pause, privacy state, calibration, and keyboard
  help without showing camera frames by default.
- Escape returns to the HUD unless a focused modal or reader consumes it first.

### 3.3 Global shortcut

The default shortcut is `CommandOrControl+Shift+Space`.

- The main process registers it only after Electron is ready.
- Registration failure is visible in the Command Deck and does not prevent
  startup.
- The shortcut toggles HUD and Command Deck, restores a hidden window, and
  provides the recovery path from click-through mode.
- Registration is removed during shutdown.
- A future configurable shortcut may be added only after collision handling
  and persistence rules are specified.

## 4. Visual system

The durable source of truth remains `DESIGN.md`. Phase 2 applies it as an Iris
operator cockpit rather than a generic card dashboard.

### 4.1 Composition

- Preserve a large transparent center safe zone.
- Use three depth levels only: desktop/canvas, glass surface, elevated reader.
- Use edge-anchored instruments instead of a central grid.
- Keep the orb, task/status stack, reader, and camera dock independent so one
  failure or animation cannot hide another state.
- Use cyan for active intent/focus/tracking, violet for brain/knowledge context,
  and semantic colors only for success, warning, and danger.

### 4.2 Orb/status anchor

The orb is a functional instrument with one primary state at a time:

- offline;
- connecting/reconnecting;
- sign-in required;
- ready;
- gesture loading/active/paused;
- degraded;
- error.

It may use restrained canvas rings, ticks, and state pulses derived from Iris,
but it must not become a permanently glowing decorative reactor. Reduced-motion
mode replaces rotation and breathing animation with static state transitions.

### 4.3 Task/status stack

Phase 2 does not invent task execution data before Phase 4. The stack may show
only real read-only information available in the current slice:

- Jarvis connection/auth state;
- active/default brain summary;
- recent public sessions;
- gesture/camera state;
- degraded or recovery notices.

The component contract will be reusable for future real task cards, but
production Phase 2 must not display fake running work.

### 4.4 Reader

The reader is a 320-420 px glass panel anchored to the right edge.

- It displays selected runtime, brain, session, status, or help content in
  Phase 2.
- Mouse wheel, keyboard, and open-palm gestures scroll the same content model.
- Keyboard controls and two-palm gestures resize within tested minimum and
  maximum widths.
- Escape, a labeled close button, and a stabilized fist gesture dismiss it.
- Reader focus is restored to the element that opened it when dismissed by
  mouse or keyboard.

### 4.5 Gesture reticle

The primary-hand reticle contains:

- a clear pointer center;
- confidence/stability ring;
- dwell progress ring only over a gesture-enabled target;
- distinct paused, stale, and tracking-lost states.

A secondary-hand reticle appears only when needed for two-hand resize. Reticles
must stay legible over bright and dark desktops without using excessive glow.

### 4.6 Camera dock

The compact dock exposes:

- camera off/requesting/active/paused/error;
- model loading/ready/error;
- current stabilized gesture;
- inference latency or FPS when diagnostic detail is expanded;
- enable, pause, and stop controls.

Camera preview is off by default. If a local preview is later exposed in this
slice, it requires a separate explicit toggle, remains inside Iris, and is
never persisted or transmitted.

## 5. Electron boundary

Phase 2 keeps the Phase 1 security posture: sandboxed renderer, context
isolation, no Node integration, denied navigation/popups, and sender-validated
IPC.

The main process owns native window state and global shortcuts. The renderer
may request only bounded mode changes through a narrow bridge.

Proposed renderer bridge additions:

```ts
type HudMode = "hud" | "deck";

type HudNativeSnapshot = {
  mode: HudMode;
  pointerInteractive: boolean;
  shortcutAvailable: boolean;
};

getHudNativeSnapshot(): Promise<HudNativeSnapshot>;
setHudMode(mode: HudMode): Promise<HudNativeSnapshot>;
setPointerInteractive(interactive: boolean): Promise<HudNativeSnapshot>;
requestGesturePermissionIntent(enabled: boolean): Promise<void>;
onHudNativeSnapshot(listener: (snapshot: HudNativeSnapshot) => void): () => void;
```

Constraints:

- IPC accepts only fixed enums/booleans and validates sender ID, frame, and
  trusted renderer URL.
- `setPointerInteractive` changes native click-through state only; it cannot
  focus arbitrary windows, inject input, or execute actions.
- The renderer reports entry/exit of elements marked as explicit hit regions.
- Deck mode enables window interaction globally. HUD mode returns to
  click-through unless the pointer is inside a hit region.
- Native state is authoritative and is broadcast after every accepted change.
- Shortcut and window events use the same state transition function as IPC so
  renderer and main cannot drift.

## 6. Camera permission boundary

The existing deny-by-default session permission handler remains in place.
Camera access becomes a narrow exception only when all conditions hold:

1. the request originates from the trusted Iris renderer;
2. the operator pressed the explicit gesture-enable control;
3. the main process has a short-lived camera permission intent for that
   renderer;
4. the requested permission is media/video only;
5. no audio capture is implicitly granted by the gesture flow.

The renderer then calls `getUserMedia` for video. Frames remain in renderer
memory and are passed only to local MediaPipe code. No frame, landmark stream,
or gesture event is sent to JarvisOS in Phase 2.

Stopping or pausing gesture mode must:

- cancel the inference loop;
- stop every `MediaStreamTrack`;
- clear video element sources and transient landmarks;
- expire permission intent;
- publish a camera-off or paused state;
- leave mouse and keyboard controls usable.

Window close, renderer unload, device loss, and model failure use the same
cleanup path.

## 7. Gesture runtime architecture

The gesture implementation is split into deterministic layers.

```text
MediaPipe adapter
  -> normalized hand observation
  -> stabilizer and stale-data gate
  -> semantic gesture state machine
  -> HUD interaction policy
  -> React view state / reader commands
```

### 7.1 MediaPipe adapter

The adapter owns MediaPipe Tasks Vision initialization and translation only.

- Pin the exact `@mediapipe/tasks-vision` version.
- Copy the required WASM files and official gesture model into packaged local
  assets during the build.
- Record source URL, package/model version, license, and SHA-256 in the
  extraction manifest and third-party notices.
- Load assets through the trusted local Iris protocol or packaged resource
  path; production startup must not require a CDN.
- Use monotonically increasing timestamps.
- Bound inference frequency and avoid concurrent recognizer calls.
- Close the recognizer on shutdown or reinitialization.

The adapter emits normalized observations and never clicks DOM elements.

### 7.2 Normalized observation

```ts
type Point = { x: number; y: number };

type HandObservation = {
  timestampMs: number;
  frameWidth: number;
  frameHeight: number;
  hands: readonly {
    id: "primary" | "secondary";
    handedness: "left" | "right" | "unknown";
    gesture:
      | "point"
      | "open_palm"
      | "closed_fist"
      | "unknown";
    gestureConfidence: number;
    trackingConfidence: number;
    pointer?: Point;
    palmCenter?: Point;
  }[];
};
```

Coordinates are mirrored deliberately to match the operator's screen-space
expectation, then mapped into the current display work area. Mapping logic is a
pure function covered by recorded landmark fixtures that contain no images.

### 7.3 Semantic events

The pure state machine may emit only semantic events:

```ts
type GestureEvent =
  | { type: "pointer"; point: Point; confidence: number }
  | { type: "select"; point: Point; dwellMs: number }
  | { type: "scroll"; deltaY: number }
  | { type: "scale"; factor: number }
  | { type: "dismiss" }
  | { type: "tracking_lost" };
```

No gesture event contains shell commands, filesystem paths, network targets,
Jarvis capability names, approval decisions, or arbitrary DOM selectors.

### 7.4 Stabilization defaults

Initial defaults, to be tuned with deterministic tests and manual ergonomics:

- minimum gesture confidence: 0.72;
- minimum tracking confidence: 0.65;
- stable pose window: 160 ms;
- point dwell: 700 ms;
- dwell movement tolerance: 24 CSS px at 100% scale, normalized for DPI;
- select cooldown: 900 ms and mandatory target exit before repeat;
- fist dismiss hold: 500 ms;
- stale observation expiry: 250 ms;
- two-palm resize minimum hold: 180 ms;
- scroll dead zone: 12% of reader height;
- scroll and scale output clamped per frame and smoothed over recent samples.

Thresholds are internal configuration, not renderer-controlled policy. They may
be exposed for calibration only within safe documented bounds.

## 8. Interaction policy

Gesture output is interpreted by a HUD policy layer rather than converted to a
generic DOM `click()`.

### Point-and-hold select

- A target must declare a stable `data-gesture-action` identifier.
- Only explicitly allow-listed Phase 2 actions are eligible: open/close reader,
  expand/collapse a status card, switch reader tabs, pause gesture mode, and
  other reversible R0 UI state.
- Refresh and sign-in remain mouse/keyboard controls in Phase 2 unless a later
  contract explicitly declares them gesture-safe.
- Approval, destructive, authentication submission, external navigation, and
  future side-effect controls are never gesture targets.
- Moving outside tolerance resets dwell progress.
- A stale or lost hand cancels dwell immediately.

### Open-palm scroll

- Scroll applies only to the currently open reader or the explicitly focused
  scroll region.
- The nearest eligible region wins; gestures never scroll the desktop or other
  applications.
- A center dead zone prevents drift.

### Two-palm resize

- Resize applies only to the open reader.
- The initial palm distance becomes the baseline after stabilization.
- Width is clamped to the design minimum/maximum and display work area.
- Losing either hand ends the resize without committing an out-of-range value.

### Closed-fist dismiss

- Dismiss closes only the topmost reversible Iris overlay: reader first, then a
  non-critical help/settings surface.
- It never quits Iris, stops JarvisOS, signs out, approves, rejects, cancels a
  backend task, or dismisses a critical approval sheet.
- No eligible overlay means no action.

## 9. State and data flow

Jarvis read state, native HUD state, and gesture state remain separate.

```text
Jarvis controller snapshot ----> operator view model ----> HUD / Command Deck
Native window state -----------> operator view model ----> mode indicators
Local gesture state -----------> interaction policy -----> reversible UI state
```

Rules:

- Gesture state cannot mutate a Jarvis snapshot.
- Native HUD mode cannot promote Jarvis connection or auth state.
- Renderer refresh/reload reconstructs its view from authoritative Jarvis and
  native snapshots.
- Phase 2 production UI uses real snapshots and explicit empty/degraded states,
  never fake success or task activity.

## 10. Failure and recovery behavior

### Shortcut registration failure

The app starts in an interactive recoverable mode, displays the failure, and
keeps an on-screen HUD/Deck toggle. It must not start click-through with no
recovery route.

### MediaPipe asset failure

Gesture mode enters `model_error`; camera tracks stop; mouse and keyboard remain
available. The app does not fall back to remote assets.

### Camera denial or device loss

The dock reports the exact bounded state, stops partial resources, and offers a
retry initiated by the operator. It does not repeatedly prompt.

### Renderer reload

The main process preserves native mode, reapplies click-through state after the
trusted renderer is ready, and does not create a second Jarvis controller,
shortcut registration, camera stream, or MediaPipe recognizer.

### Gesture tracking loss

Reticles enter stale/lost state, pending dwell and resize operations cancel,
and no delayed action fires when tracking resumes.

## 11. Accessibility and reduced motion

- Every gesture has a visible mouse control and documented keyboard equivalent.
- Focus order is deterministic in Command Deck and reader mode.
- HUD click-through must not trap keyboard focus.
- Visible focus styles meet the existing cyan focus treatment.
- Critical state is communicated with text/icon shape as well as color.
- Vietnamese labels remain readable at Windows 100%, 125%, 150%, and 200%
  scaling.
- `prefers-reduced-motion` and Quiet HUD disable continuous orb rotation,
  reticle easing, breathing pulses, and non-essential transitions.
- Reticle and camera status use polite announcements only for meaningful state
  changes, not per-frame updates.

## 12. Package boundaries

Phase 2 introduces boundaries only when tests require them:

- `packages/gesture-runtime`: pure observations, coordinate mapping,
  stabilization, semantic state machine, and MediaPipe adapter boundary;
- `packages/hud-ui`: reusable presentational components and view contracts;
- `apps/desktop`: native window/shortcut/permission ownership, preload bridge,
  camera hook, integration, and product composition.

The pure gesture engine must not import Electron, React, browser DOM APIs, or
Jarvis adapters. The HUD UI must not import MediaPipe directly. The renderer
camera hook may connect the local adapter to the pure engine but cannot expose
frames through IPC.

## 13. Test strategy

Implementation follows contract-first and test-first development.

### Deterministic unit tests

- mirrored coordinate mapping at multiple display sizes and DPI scales;
- gesture confidence and stable-pose windows;
- dwell start, movement reset, stale reset, cooldown, and re-entry;
- palm scroll dead zone, direction, smoothing, and clamp;
- two-palm resize baseline, scale clamp, and hand loss;
- fist hold, eligible-overlay policy, and no-op behavior;
- camera lifecycle cleanup helpers;
- reduced-motion view states.

Fixtures contain landmarks and classifier results only, never camera frames.

### Electron contract/security tests

- transparent/frameless/always-on-top window options;
- fixed global shortcut registration and cleanup;
- sender/frame/URL validation for every new IPC method;
- click-through transitions for HUD, hit-region, and Deck modes;
- recovery behavior when shortcut registration fails;
- camera permission denied by default and allowed only after trusted explicit
  intent;
- audio permission remains denied;
- navigation, popup, Node, arbitrary IPC, and unrestricted permission defenses
  remain intact.

### React interaction tests

- HUD and Command Deck render the same real Jarvis snapshot appropriately;
- keyboard toggle, Escape behavior, focus restore, and screen-reader labels;
- gesture semantic events affect only allow-listed reversible UI state;
- stale gestures do not fire delayed actions;
- camera/model/error/privacy states are visible;
- no fake tasks or success states appear in production fixtures.

### Runtime and packaged verification

- offline launch after dependency/assets installation with outbound network
  unavailable;
- packaged transparent HUD at target Windows scale;
- click-through over a known desktop target and interaction inside a HUD hit
  region;
- global shortcut HUD/Deck toggle and recovery;
- camera remains off until enabled, activates locally, pauses, and releases the
  device on stop/close;
- point-and-hold, palm scroll, two-palm resize, fist dismiss, keyboard and mouse
  fallbacks;
- 100%, 125%, 150%, and 200% DPI checks;
- primary and secondary monitor checks;
- reduced-motion check;
- renderer reload and shutdown preserve the one existing Jarvis runtime.

Manual camera verification records behavior and performance only. Screenshots
and logs must not contain camera frames, credentials, or private Jarvis data.

## 14. Documentation and provenance

Before adapting upstream source or assets, add an extraction manifest entry
containing source repository/URL, exact commit/version, original path,
destination, license, modifications, and reviewer.

Update during implementation:

- `docs/contracts/` for native HUD and gesture event contracts;
- ADR-004 if the concrete extraction boundary changes;
- ADR-006 with exact MediaPipe version, asset location, and integrity data;
- `THIRD_PARTY_NOTICES.md` and packaged notices;
- `ROADMAP.md`, execution status, handoff, and the Phase 2 verification report.

## 15. Definition of done

Phase 2 is complete only when:

1. HUD and Command Deck modes work through one secure Electron window.
2. Transparent, always-on-top, click-through behavior and global shortcut are
   proven in the packaged Windows application.
3. All MediaPipe assets are pinned, local, licensed, integrity-recorded, and
   usable without network access.
4. Camera is off by default and all stop/error/close paths release it.
5. All four gestures pass deterministic tests and real local ergonomic checks.
6. Gesture actions are limited to explicit reversible UI state and cannot touch
   approval, authentication submission, external side effects, or Jarvis
   authority.
7. Mouse, keyboard, DPI, multi-monitor, and reduced-motion fallbacks are
   verified.
8. Phase 1 Jarvis ownership, security, reconnect, and read-only behavior do not
   regress.
9. The visual result is reviewed at target scale against `DESIGN.md` and the
   selected Iris dual-mode direction.
10. Contracts, ADRs, notices, roadmap, status, handoff, and verification evidence
    are current.

Phase 3 Gemini work must not begin until the Phase 2 slice satisfies this
definition and its review findings are resolved.
