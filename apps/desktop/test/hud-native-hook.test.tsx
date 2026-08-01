// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HudNativeSnapshot } from "../src/main/hud-native";
import type { IrisRendererApi } from "../src/preload/api.cjs";
import { useHudNative } from "../src/renderer/hud/use-hud-native";

function installApi(initial: HudNativeSnapshot) {
  let listener: ((snapshot: HudNativeSnapshot) => void) | undefined;
  const api = {
    getHudNativeSnapshot: vi.fn(async () => initial),
    setHudMode: vi.fn(async (mode) => ({
      ...initial,
      mode,
      pointerInteractive: mode === "deck",
    })),
    setPointerInteractive: vi.fn(async (pointerInteractive) => ({ ...initial, pointerInteractive })),
    onHudNativeSnapshot: vi.fn((next) => {
      listener = next;
      return vi.fn();
    }),
  } as unknown as IrisRendererApi;
  Object.defineProperty(window, "iris", { configurable: true, value: api });
  return { api, publish: (snapshot: HudNativeSnapshot) => listener?.(snapshot) };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "iris");
});

describe("renderer native HUD synchronization", () => {
  it("loads the authoritative snapshot, subscribes, and switches modes through the bridge", async () => {
    const initial: HudNativeSnapshot = { mode: "hud", pointerInteractive: false, shortcutAvailable: true };
    const { api, publish } = installApi(initial);
    const { result } = renderHook(() => useHudNative());

    await waitFor(() => expect(result.current.snapshot).toEqual(initial));
    await act(async () => { await result.current.setMode("deck"); });
    expect(api.setHudMode).toHaveBeenCalledWith("deck");
    expect(result.current.snapshot.mode).toBe("deck");

    act(() => publish({ mode: "hud", pointerInteractive: false, shortcutAvailable: true }));
    expect(result.current.snapshot.mode).toBe("hud");
  });

  it("makes only explicit HUD hit regions native-interactive", async () => {
    const initial: HudNativeSnapshot = { mode: "hud", pointerInteractive: false, shortcutAvailable: true };
    const { api } = installApi(initial);
    const hit = document.createElement("button");
    hit.className = "hud-hit";
    document.body.append(hit);
    const elementFromPoint = vi.fn<(x: number, y: number) => Element | null>();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: elementFromPoint,
    });
    const { result } = renderHook(() => useHudNative());
    await waitFor(() => expect(result.current.snapshot.mode).toBe("hud"));

    elementFromPoint.mockReturnValue(hit);
    act(() => window.dispatchEvent(new MouseEvent("mousemove", { clientX: 40, clientY: 50 })));
    await waitFor(() => expect(api.setPointerInteractive).toHaveBeenLastCalledWith(true));

    elementFromPoint.mockReturnValue(document.body);
    act(() => window.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 500 })));
    await waitFor(() => expect(api.setPointerInteractive).toHaveBeenLastCalledWith(false));

    hit.remove();
  });
});
