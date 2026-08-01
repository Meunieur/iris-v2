export type HudMode = "hud" | "deck";

export type HudNativeSnapshot = Readonly<{
  mode: HudMode;
  pointerInteractive: boolean;
  shortcutAvailable: boolean;
}>;

export type HudNativeController = Readonly<{
  current(): HudNativeSnapshot;
  setMode(mode: HudMode): HudNativeSnapshot;
  setPointerInteractive(interactive: boolean): HudNativeSnapshot;
  setShortcutAvailable(available: boolean): HudNativeSnapshot;
  setCameraPermissionIntent(enabled: boolean): void;
  consumeCameraPermissionIntent(): boolean;
  subscribe(listener: (snapshot: HudNativeSnapshot) => void): () => void;
}>;

type HudNativeControllerInput = Readonly<{
  now?: () => number;
  permissionTtlMs?: number;
}>;

function snapshot(
  mode: HudMode,
  pointerInteractive: boolean,
  shortcutAvailable: boolean,
): HudNativeSnapshot {
  return Object.freeze({ mode, pointerInteractive, shortcutAvailable });
}

export function createHudNativeController(
  input: HudNativeControllerInput = {},
): HudNativeController {
  const now = input.now ?? Date.now;
  const permissionTtlMs = input.permissionTtlMs ?? 2_000;
  const listeners = new Set<(value: HudNativeSnapshot) => void>();
  let state = snapshot("deck", true, false);
  let cameraPermissionExpiresAt: number | undefined;

  const publish = (next: HudNativeSnapshot): HudNativeSnapshot => {
    if (
      state.mode === next.mode
      && state.pointerInteractive === next.pointerInteractive
      && state.shortcutAvailable === next.shortcutAvailable
    ) return state;
    state = next;
    for (const listener of listeners) listener(state);
    return state;
  };

  return Object.freeze({
    current: () => state,
    setMode: (mode) => {
      if (mode === "hud" && !state.shortcutAvailable) {
        throw new Error("HUD shortcut is unavailable");
      }
      return publish(snapshot(mode, mode === "deck", state.shortcutAvailable));
    },
    setPointerInteractive: (interactive) => publish(snapshot(
      state.mode,
      state.mode === "deck" ? true : interactive,
      state.shortcutAvailable,
    )),
    setShortcutAvailable: (available) => publish(snapshot(
      available ? state.mode : "deck",
      available ? state.pointerInteractive : true,
      available,
    )),
    setCameraPermissionIntent: (enabled) => {
      cameraPermissionExpiresAt = enabled ? now() + permissionTtlMs : undefined;
    },
    consumeCameraPermissionIntent: () => {
      const expiresAt = cameraPermissionExpiresAt;
      cameraPermissionExpiresAt = undefined;
      return expiresAt !== undefined && now() <= expiresAt;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
