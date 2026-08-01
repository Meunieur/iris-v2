# Native Glass HUD Contract

**Owner:** Iris v2 Electron main process

**Consumer:** sandboxed Iris renderer through the fixed preload bridge
**Status:** Phase 2 implemented, 2026-07-24

## Authoritative state

The main process owns one immutable `HudNativeSnapshot`:

```ts
type HudMode = "hud" | "deck";
type HudNativeSnapshot = Readonly<{
  mode: HudMode;
  pointerInteractive: boolean;
  shortcutAvailable: boolean;
}>;
```

- `deck` is always pointer-interactive and focuses the existing window.
- `hud` is click-through by default. The renderer may temporarily request
  pointer interaction only while the pointer is over an explicit `.hud-hit`
  region.
- `hud` cannot be entered unless the recovery shortcut registered
  successfully. Shortcut loss forces `deck` with pointer interaction enabled.
- The renderer treats main-process snapshots as authoritative and subscribes to
  native changes rather than maintaining a second native state machine.

## Window and recovery behavior

- One transparent, frameless, shadowless BrowserWindow covers the selected
  display work area.
- Shell minimum dimensions are clamped to that selected work area so a
  high-DPI display whose DIP work area is smaller than the default minimum is
  never clipped. Short two-column Command Deck viewports become vertically
  scrollable; they do not create a second window or runtime.
- The custom `iris://` scheme is registered as secure/standard and with
  `supportFetchAPI: true`. Renderer CSP permits only same-origin runtime asset
  fetches (`connect-src 'self'`) and the scoped WebAssembly compilation token
  (`script-src 'self' 'wasm-unsafe-eval'`); it contains no HTTP, HTTPS, WS or
  WSS origin. This lets packaged MediaPipe load local WASM/model assets without
  opening remote renderer egress.
- The same BrowserWindow changes between Desktop HUD and Command Deck; mode
  changes do not create a renderer, backend, Jarvis controller or data root.
- The window remains always-on-top. HUD mode skips the taskbar and calls
  `setIgnoreMouseEvents(true, { forward: true })` outside explicit hit regions.
- `CommandOrControl+Shift+Space` toggles the same window between modes.
- Escape closes the reader first; when no reader is open, Escape returns the
  Command Deck to HUD mode.

## Fixed renderer bridge

The preload exposes only these native-HUD methods:

| Method | Fixed IPC channel | Input | Output |
|---|---|---|---|
| `getHudNativeSnapshot()` | `iris:hud:get-native-snapshot` | none | `HudNativeSnapshot` |
| `setHudMode(mode)` | `iris:hud:set-mode` | `"hud"` or `"deck"` | authoritative snapshot |
| `setPointerInteractive(value)` | `iris:hud:set-pointer-interactive` | boolean | authoritative snapshot |
| `requestGesturePermissionIntent(value)` | `iris:hud:request-gesture-permission-intent` | boolean | `{ accepted: true }` |
| `onHudNativeSnapshot(listener)` | `iris:hud:native-snapshot` | listener | disposer |

Every request requires the trusted shell webContents ID, main frame and exact
renderer URL. Invalid arguments, child frames and foreign senders fail closed.
There is no generic IPC invoke, shell, filesystem, network or input-injection
method.

## Camera permission intent

- The renderer must set a one-shot permission intent immediately before
  `getUserMedia`.
- The intent expires after 2,000 ms and is consumed on the first permission
  request, whether that request succeeds or fails.
- Only `media` permission for the trusted renderer's video stream is eligible.
  Audio and all other permission types are denied.
- Pause, stop and errors clear the intent. Expiry remains the final safety net.

## Failure and recovery

- If the shortcut cannot register, Iris stays in the interactive Command Deck
  so the operator cannot be trapped behind a click-through window.
- Native bridge failures are rendered as sanitized HUD notices; private error
  objects are not displayed.
- Renderer reload re-subscribes to the current native snapshot. It does not
  restart or replace JarvisOS.
