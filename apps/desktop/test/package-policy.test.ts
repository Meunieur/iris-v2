import { describe, expect, it } from "vitest";

import {
  archiveExtractionPath,
  isForbiddenPackagedPath,
  normalizePackagedPath,
} from "../scripts/package-policy.mjs";

describe("packaged source policy", () => {
  it("allows dependency-owned implementation files but rejects Iris workspace source", () => {
    expect(isForbiddenPackagedPath("node_modules/zod/src/index.ts")).toBe(false);
    expect(isForbiddenPackagedPath("node_modules/react/cjs/react.production.js")).toBe(false);
    expect(isForbiddenPackagedPath("apps/desktop/src/main/main.ts")).toBe(true);
    expect(isForbiddenPackagedPath("packages/contracts/src/index.ts")).toBe(true);
    expect(isForbiddenPackagedPath("node_modules/@iris/contracts/src/index.ts")).toBe(true);
    expect(isForbiddenPackagedPath("node_modules/@iris/contracts/tsconfig.json")).toBe(true);
    expect(isForbiddenPackagedPath("node_modules/@iris/contracts/dist/index.js")).toBe(false);
    expect(isForbiddenPackagedPath(".env.production")).toBe(true);
  });

  it("normalizes list output without losing the native extraction key", () => {
    const listed = "\\dist\\renderer\\mediapipe\\models\\gesture_recognizer.task";
    expect(normalizePackagedPath(listed)).toBe("dist/renderer/mediapipe/models/gesture_recognizer.task");
    expect(archiveExtractionPath(listed)).toBe("dist\\renderer\\mediapipe\\models\\gesture_recognizer.task");
  });
});
