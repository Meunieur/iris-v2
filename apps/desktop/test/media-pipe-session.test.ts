import { describe, expect, it, vi } from "vitest";

import { createMediaPipeSession } from "../src/renderer/gesture/media-pipe-session";

const result = {
  gestures: [[{ categoryName: "Pointing_Up", score: 0.91 }]],
  handedness: [[{ categoryName: "Right", score: 0.96 }]],
  landmarks: [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }))],
};

describe("bounded local MediaPipe session", () => {
  it("initializes with caller-provided local asset paths and maps observations", async () => {
    const recognizer = {
      recognizeForVideo: vi.fn(() => result),
      close: vi.fn(),
    };
    const createRecognizer = vi.fn(async () => recognizer);
    const session = createMediaPipeSession({
      wasmRoot: "iris://app/mediapipe/wasm",
      modelUrl: "iris://app/mediapipe/models/gesture_recognizer.task",
      createRecognizer,
    });

    await expect(session.process({}, 100, { width: 1_000, height: 800, mirrored: true }))
      .resolves.toMatchObject({ timestampMs: 100, hands: [{ gesture: "point" }] });
    expect(createRecognizer).toHaveBeenCalledWith({
      wasmRoot: "iris://app/mediapipe/wasm",
      modelUrl: "iris://app/mediapipe/models/gesture_recognizer.task",
    });
  });

  it("drops non-monotonic and concurrent inference frames", async () => {
    let release: ((value: typeof result) => void) | undefined;
    const recognizeForVideo = vi.fn(() => new Promise<typeof result>((resolve) => { release = resolve; }));
    const session = createMediaPipeSession({
      wasmRoot: "iris://app/mediapipe/wasm",
      modelUrl: "iris://app/mediapipe/models/gesture_recognizer.task",
      createRecognizer: async () => ({ recognizeForVideo, close: vi.fn() }),
    });

    const first = session.process({}, 100, { width: 1_000, height: 800, mirrored: true });
    await expect(session.process({}, 101, { width: 1_000, height: 800, mirrored: true })).resolves.toBeUndefined();
    release?.(result);
    await first;
    await expect(session.process({}, 100, { width: 1_000, height: 800, mirrored: true })).resolves.toBeUndefined();
    expect(recognizeForVideo).toHaveBeenCalledTimes(1);
  });

  it("closes the recognizer exactly once and rejects later frames", async () => {
    const close = vi.fn();
    const session = createMediaPipeSession({
      wasmRoot: "iris://app/mediapipe/wasm",
      modelUrl: "iris://app/mediapipe/models/gesture_recognizer.task",
      createRecognizer: async () => ({ recognizeForVideo: () => result, close }),
    });
    await session.process({}, 100, { width: 1_000, height: 800, mirrored: true });

    await session.close();
    await session.close();

    expect(close).toHaveBeenCalledTimes(1);
    await expect(session.process({}, 200, { width: 1_000, height: 800, mirrored: true }))
      .rejects.toThrow("MediaPipe session is closed");
  });

  it("contains no remote asset URL in production source", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      "apps/desktop/src/renderer/gesture/media-pipe-session.ts",
      "utf8",
    );

    expect(source).not.toMatch(/https?:\/\/|jsdelivr|unpkg|cdn/i);
  });
});
