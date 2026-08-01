import { describe, expect, it } from "vitest";

import {
  pcm16BytesToFloat32,
  resampleFloat32ToPcm16,
} from "../src/renderer/conversation/audio";

describe("conversation PCM helpers", () => {
  it("converts normalized float samples to little-endian PCM16", () => {
    expect([...resampleFloat32ToPcm16(new Float32Array([-1, 0, 1]), 16_000)]).toEqual([0, 128, 0, 0, 255, 127]);
  });

  it("downsamples by averaging source frames without exceeding bounds", () => {
    const output = resampleFloat32ToPcm16(new Float32Array([-1, -1, 1, 1]), 32_000, 16_000);
    expect([...output]).toEqual([0, 128, 255, 127]);
  });

  it("decodes PCM16 output for an AudioBuffer", () => {
    expect([...pcm16BytesToFloat32(new Uint8Array([0, 128, 0, 0, 255, 127]))]).toEqual([-1, 0, 0.999969482421875]);
  });

  it("rejects malformed sample rates and odd PCM bytes", () => {
    expect(() => resampleFloat32ToPcm16(new Float32Array([0]), 0)).toThrow("Invalid conversation sample rate");
    expect(() => pcm16BytesToFloat32(new Uint8Array([0]))).toThrow("Invalid PCM16 buffer");
  });
});
