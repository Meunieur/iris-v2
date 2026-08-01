import { describe, expect, it } from "vitest";

import { mapNormalizedPoint } from "../src/coordinates";

describe("gesture coordinate mapping", () => {
  it("mirrors camera x coordinates into CSS display coordinates", () => {
    expect(mapNormalizedPoint(
      { x: 0.2, y: 0.25 },
      { width: 1_000, height: 800, mirrored: true },
    )).toEqual({ x: 800, y: 200 });
  });

  it("clamps noisy landmarks to the visible display", () => {
    expect(mapNormalizedPoint(
      { x: -0.2, y: 1.4 },
      { width: 1_000, height: 800, mirrored: false },
    )).toEqual({ x: 0, y: 800 });
  });

  it("rejects invalid display dimensions", () => {
    expect(() => mapNormalizedPoint(
      { x: 0.5, y: 0.5 },
      { width: 0, height: 800, mirrored: true },
    )).toThrow("Invalid gesture viewport");
  });
});
