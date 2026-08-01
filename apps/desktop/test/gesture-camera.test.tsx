// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HandObservation } from "@iris/gesture-runtime";
import {
  useGestureCamera,
  type GestureCameraDependencies,
} from "../src/renderer/gesture/use-gesture-camera";

function harness(observations: Array<HandObservation | undefined> = []) {
  const order: string[] = [];
  const stop = vi.fn();
  const close = vi.fn(async () => undefined);
  const process = vi.fn(async () => observations.shift());
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const video = {
    muted: false,
    playsInline: false,
    readyState: 4,
    srcObject: null,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
  } as unknown as HTMLVideoElement;
  let scheduled: FrameRequestCallback | undefined;
  const dependencies: GestureCameraDependencies = {
    requestPermissionIntent: vi.fn(async (enabled) => {
      order.push(`intent:${enabled}`);
      return { accepted: true as const };
    }),
    getUserMedia: vi.fn(async () => {
      order.push("camera");
      return stream;
    }),
    createVideo: () => video,
    createSession: vi.fn(() => ({ process, close })),
    requestFrame: vi.fn((callback) => {
      scheduled = callback;
      return 7;
    }),
    cancelFrame: vi.fn(),
    viewport: () => ({ width: 1_000, height: 800, mirrored: true }),
    targetAt: () => "reader.close",
    scrollRegion: () => undefined,
  };
  return {
    close,
    dependencies,
    order,
    process,
    runFrame: async (timestampMs: number) => {
      const callback = scheduled;
      if (callback === undefined) throw new Error("No gesture frame was scheduled");
      await act(async () => { await callback(timestampMs); });
    },
    stop,
    video,
  };
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "iris");
});

describe("local gesture camera lifecycle", () => {
  it("starts camera-off and requests one-shot video permission before getUserMedia", async () => {
    const test = harness();
    const { result } = renderHook(() => useGestureCamera({ onEvent: vi.fn() }, test.dependencies));

    expect(result.current.state).toMatchObject({ enabled: false, camera: "off", model: "idle" });
    await act(async () => { await result.current.enable(); });

    expect(test.order).toEqual(["intent:true", "camera"]);
    expect(test.dependencies.getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    expect(result.current.state).toMatchObject({ enabled: true, camera: "active", model: "loading" });
  });

  it("stops every track and closes recognition on pause and unmount", async () => {
    const paused = harness();
    const first = renderHook(() => useGestureCamera({ onEvent: vi.fn() }, paused.dependencies));
    await act(async () => { await first.result.current.enable(); });
    await act(async () => { await first.result.current.pause(); });
    expect(paused.stop).toHaveBeenCalledTimes(1);
    expect(paused.close).toHaveBeenCalledTimes(1);
    expect(paused.video.pause).toHaveBeenCalledTimes(1);
    expect(first.result.current.state).toMatchObject({ enabled: false, camera: "paused", model: "idle" });

    const unmounted = harness();
    const second = renderHook(() => useGestureCamera({ onEvent: vi.fn() }, unmounted.dependencies));
    await act(async () => { await second.result.current.enable(); });
    second.unmount();
    await act(async () => undefined);
    expect(unmounted.stop).toHaveBeenCalledTimes(1);
    expect(unmounted.close).toHaveBeenCalledTimes(1);
  });

  it("emits only semantic gesture events from stabilized local observations", async () => {
    const point = (timestampMs: number): HandObservation => ({
      timestampMs,
      hands: [{
        id: "primary",
        handedness: "right",
        gesture: "point",
        gestureConfidence: 0.95,
        trackingConfidence: 0.94,
        pointer: { x: 400, y: 300 },
        palmCenter: { x: 390, y: 330 },
      }],
    });
    const test = harness([point(0), point(160), point(860)]);
    const onEvent = vi.fn();
    const { result } = renderHook(() => useGestureCamera({ onEvent }, test.dependencies));
    await act(async () => { await result.current.enable(); });

    await test.runFrame(0);
    await test.runFrame(160);
    await test.runFrame(860);

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "select",
      targetId: "reader.close",
    }));
    expect(result.current.state).toMatchObject({ model: "ready", gesture: "point", tracking: true });
  });

  it("releases camera and recognizer when local inference fails", async () => {
    const test = harness();
    vi.mocked(test.dependencies.createSession).mockReturnValue({
      process: vi.fn(async () => { throw new Error("private model failure"); }),
      close: test.close,
    });
    const { result } = renderHook(() => useGestureCamera({ onEvent: vi.fn() }, test.dependencies));
    await act(async () => { await result.current.enable(); });
    await test.runFrame(100);

    expect(test.stop).toHaveBeenCalledTimes(1);
    expect(test.close).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({ enabled: false, camera: "error", model: "error" });
    expect(result.current.state.error).not.toContain("private model failure");
  });
});
