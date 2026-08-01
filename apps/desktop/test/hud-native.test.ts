import { describe, expect, it, vi } from "vitest";

import { createHudNativeController } from "../src/main/hud-native";

describe("native HUD state controller", () => {
  it("starts in recoverable interactive deck mode until a shortcut is available", () => {
    const hud = createHudNativeController();

    expect(hud.current()).toEqual({
      mode: "deck",
      pointerInteractive: true,
      shortcutAvailable: false,
    });
  });

  it("enters click-through HUD only after shortcut registration", () => {
    const hud = createHudNativeController();

    expect(() => hud.setMode("hud")).toThrow("HUD shortcut is unavailable");
    hud.setShortcutAvailable(true);

    expect(hud.setMode("hud")).toEqual({
      mode: "hud",
      pointerInteractive: false,
      shortcutAvailable: true,
    });
  });

  it("makes an explicit HUD hit region interactive without leaving HUD mode", () => {
    const hud = createHudNativeController();
    hud.setShortcutAvailable(true);
    hud.setMode("hud");

    expect(hud.setPointerInteractive(true)).toEqual({
      mode: "hud",
      pointerInteractive: true,
      shortcutAvailable: true,
    });
    expect(hud.setPointerInteractive(false).pointerInteractive).toBe(false);
  });

  it("keeps deck mode interactive even if a renderer asks for click-through", () => {
    const hud = createHudNativeController();

    expect(hud.setPointerInteractive(false).pointerInteractive).toBe(true);
  });

  it("broadcasts immutable snapshots only when native state changes", () => {
    const hud = createHudNativeController();
    const listener = vi.fn();
    const dispose = hud.subscribe(listener);

    hud.setShortcutAvailable(true);
    hud.setShortcutAvailable(true);
    dispose();
    hud.setMode("hud");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(listener.mock.calls[0]?.[0])).toBe(true);
  });

  it("consumes short-lived camera permission intent exactly once", () => {
    let now = 1_000;
    const hud = createHudNativeController({ now: () => now, permissionTtlMs: 750 });

    hud.setCameraPermissionIntent(true);
    now = 1_500;
    expect(hud.consumeCameraPermissionIntent()).toBe(true);
    expect(hud.consumeCameraPermissionIntent()).toBe(false);

    hud.setCameraPermissionIntent(true);
    now = 2_251;
    expect(hud.consumeCameraPermissionIntent()).toBe(false);
  });

  it("clears camera permission intent when gesture enable is cancelled", () => {
    const hud = createHudNativeController();

    hud.setCameraPermissionIntent(true);
    hud.setCameraPermissionIntent(false);

    expect(hud.consumeCameraPermissionIntent()).toBe(false);
  });
});
