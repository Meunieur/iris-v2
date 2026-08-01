import { describe, expect, it } from "vitest";

import { mapGestureResult } from "../src/mediapipe";

const landmarks = Array.from({ length: 21 }, (_, index) => ({
  x: index === 8 ? 0.2 : index === 9 ? 0.4 : 0.5,
  y: index === 8 ? 0.25 : index === 9 ? 0.55 : 0.5,
  z: 0,
}));

describe("MediaPipe result mapper", () => {
  it.each([
    ["Pointing_Up", "point"],
    ["Open_Palm", "open_palm"],
    ["Closed_Fist", "closed_fist"],
    ["Victory", "unknown"],
  ] as const)("maps %s into normalized %s semantics", (categoryName, expected) => {
    const observation = mapGestureResult({
      gestures: [[{ categoryName, score: 0.91 }]],
      handedness: [[{ categoryName: "Right", score: 0.99 }]],
      landmarks: [landmarks],
    }, 1_000, { width: 1_000, height: 800, mirrored: true });

    expect(observation.hands[0]).toMatchObject({
      id: "primary",
      handedness: "right",
      gesture: expected,
      gestureConfidence: 0.91,
      trackingConfidence: 0.99,
      pointer: { x: 800, y: 200 },
      palmCenter: { x: 600, y: 440 },
    });
  });

  it("maps at most two complete hands and ignores malformed result rows", () => {
    const observation = mapGestureResult({
      gestures: [
        [{ categoryName: "Open_Palm", score: 0.8 }],
        [{ categoryName: "Open_Palm", score: 0.75 }],
        [{ categoryName: "Closed_Fist", score: 0.99 }],
      ],
      handedness: [
        [{ categoryName: "Left", score: 0.8 }],
        [{ categoryName: "Right", score: 0.75 }],
      ],
      landmarks: [landmarks, landmarks, landmarks],
    }, 2_000, { width: 1_000, height: 800, mirrored: true });

    expect(observation.hands).toHaveLength(2);
    expect(observation.hands.map((hand) => hand.id)).toEqual(["primary", "secondary"]);
  });
});
