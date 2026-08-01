import { describe, expect, it } from "vitest";

import {
  DEFAULT_GESTURE_CONFIG,
  createGestureEngine,
  type GestureEngineFrame,
  type NormalizedHand,
} from "../src";

const viewport = { width: 1_000, height: 800 } as const;

function hand(overrides: Partial<NormalizedHand> = {}): NormalizedHand {
  return {
    id: "primary",
    handedness: "right",
    gesture: "point",
    gestureConfidence: 0.95,
    trackingConfidence: 0.95,
    pointer: { x: 500, y: 400 },
    palmCenter: { x: 500, y: 400 },
    ...overrides,
  };
}

function frame(
  timestampMs: number,
  hands: readonly NormalizedHand[] = [hand()],
  overrides: Partial<GestureEngineFrame> = {},
): GestureEngineFrame {
  return { timestampMs, viewport, hands, targetId: "reader.open", ...overrides };
}

describe("gesture engine defaults", () => {
  it("exposes the approved safety thresholds", () => {
    expect(DEFAULT_GESTURE_CONFIG).toMatchObject({
      minGestureConfidence: 0.72,
      minTrackingConfidence: 0.65,
      stablePoseMs: 160,
      dwellMs: 700,
      movementTolerancePx: 24,
      selectCooldownMs: 900,
      fistHoldMs: 500,
      staleAfterMs: 250,
      resizeHoldMs: 180,
      scrollDeadZoneRatio: 0.12,
    });
  });
});

describe("point-and-hold selection", () => {
  const config = { stablePoseMs: 100, dwellMs: 300, selectCooldownMs: 500 };

  it("selects a stable allow-listed target after dwell", () => {
    const engine = createGestureEngine(config);

    expect(engine.update(frame(0)).events).toEqual([]);
    expect(engine.update(frame(100)).events).toContainEqual(expect.objectContaining({ type: "pointer" }));
    expect(engine.update(frame(399)).events.some((event) => event.type === "select")).toBe(false);
    expect(engine.update(frame(400)).events).toContainEqual({
      type: "select",
      point: { x: 500, y: 400 },
      targetId: "reader.open",
      dwellMs: 300,
    });
  });

  it("resets dwell when the pointer moves beyond tolerance", () => {
    const engine = createGestureEngine({ ...config, movementTolerancePx: 20 });
    engine.update(frame(0));
    engine.update(frame(100));
    engine.update(frame(250, [hand({ pointer: { x: 550, y: 400 } })]));

    const beforeRestartedDwell = engine.update(frame(500, [hand({ pointer: { x: 550, y: 400 } })]));
    const afterRestartedDwell = engine.update(frame(650, [hand({ pointer: { x: 550, y: 400 } })]));

    expect(beforeRestartedDwell.events).not.toContainEqual(expect.objectContaining({ type: "select" }));
    expect(afterRestartedDwell.events).toContainEqual(expect.objectContaining({ type: "select" }));
  });

  it("requires target exit before the same target can select again", () => {
    const engine = createGestureEngine({ stablePoseMs: 0, dwellMs: 100, selectCooldownMs: 200 });
    engine.update(frame(0));
    expect(engine.update(frame(100)).events.some((event) => event.type === "select")).toBe(true);
    expect(engine.update(frame(500)).events.some((event) => event.type === "select")).toBe(false);

    engine.update(frame(510, [hand()], { targetId: undefined }));
    engine.update(frame(520));
    expect(engine.update(frame(620)).events.some((event) => event.type === "select")).toBe(true);
  });

  it("rejects low-confidence input and cancels stale dwell", () => {
    const engine = createGestureEngine({ stablePoseMs: 0, dwellMs: 100, staleAfterMs: 250 });
    expect(engine.update(frame(0, [hand({ gestureConfidence: 0.5 })])).events).toEqual([]);
    engine.update(frame(100));

    expect(engine.update(frame(400, [])).events).toContainEqual({ type: "tracking_lost" });
    expect(engine.update(frame(410)).events.some((event) => event.type === "select")).toBe(false);
  });
});

describe("palm, resize, and dismiss semantics", () => {
  it("emits clamped palm scroll outside the reader dead zone", () => {
    const engine = createGestureEngine({ stablePoseMs: 0, maxScrollPerFrame: 28 });
    const palm = hand({ gesture: "open_palm", pointer: { x: 500, y: 760 } });

    engine.update(frame(0, [palm], { targetId: undefined, scrollRegion: { top: 100, height: 600 } }));
    const update = engine.update(frame(16, [palm], {
      targetId: undefined,
      scrollRegion: { top: 100, height: 600 },
    }));

    expect(update.events).toContainEqual({ type: "scroll", deltaY: 28 });
  });

  it("uses two stable palms to emit a bounded reader scale", () => {
    const engine = createGestureEngine({ stablePoseMs: 0, resizeHoldMs: 100, minScale: 0.7, maxScale: 1.4 });
    const left = hand({ id: "primary", gesture: "open_palm", palmCenter: { x: 400, y: 400 } });
    const right = hand({ id: "secondary", gesture: "open_palm", palmCenter: { x: 600, y: 400 } });
    engine.update(frame(0, [left, right], { targetId: undefined }));
    engine.update(frame(100, [left, right], { targetId: undefined }));
    const farther = hand({ id: "secondary", gesture: "open_palm", palmCenter: { x: 800, y: 400 } });

    const update = engine.update(frame(116, [left, farther], { targetId: undefined }));

    expect(update.events).toContainEqual({ type: "scale", factor: 1.4 });
  });

  it("emits dismiss only after a stabilized fist hold", () => {
    const engine = createGestureEngine({ stablePoseMs: 100, fistHoldMs: 300 });
    const fist = hand({ gesture: "closed_fist" });
    engine.update(frame(0, [fist], { targetId: undefined }));
    engine.update(frame(100, [fist], { targetId: undefined }));

    const beforeHold = engine.update(frame(399, [fist], { targetId: undefined }));
    const afterHold = engine.update(frame(400, [fist], { targetId: undefined }));

    expect(beforeHold).toMatchObject({ events: [] });
    expect(afterHold).toMatchObject({
      events: [{ type: "dismiss" }],
    });
  });
});
