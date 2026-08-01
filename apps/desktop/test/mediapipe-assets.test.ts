import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  REQUIRED_WASM_FILES,
  copyMediaPipeAssets,
} from "../scripts/copy-mediapipe-assets.mjs";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "iris-mediapipe-assets-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local MediaPipe asset preparation", () => {
  it("fails closed when a required pinned asset is absent", async () => {
    const root = await temporaryRoot();
    const wasmRoot = path.join(root, "wasm");
    const modelPath = path.join(root, "gesture_recognizer.task");
    const outputRoot = path.join(root, "public", "mediapipe");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(wasmRoot, { recursive: true });
    await writeFile(modelPath, "model");

    await expect(copyMediaPipeAssets({ wasmRoot, modelPath, outputRoot }))
      .rejects.toThrow(`Missing MediaPipe asset: ${REQUIRED_WASM_FILES[0]}`);
  });

  it("copies only the required local WASM files and pinned model", async () => {
    const root = await temporaryRoot();
    const wasmRoot = path.join(root, "wasm");
    const modelPath = path.join(root, "gesture_recognizer.task");
    const outputRoot = path.join(root, "public", "mediapipe");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(wasmRoot, { recursive: true });
    await Promise.all(REQUIRED_WASM_FILES.map((file) => writeFile(path.join(wasmRoot, file), file)));
    await writeFile(path.join(wasmRoot, "not-required.bin"), "ignore");
    await writeFile(modelPath, "model");

    await copyMediaPipeAssets({ wasmRoot, modelPath, outputRoot });

    await expect(readFile(path.join(outputRoot, "wasm", REQUIRED_WASM_FILES[0]!), "utf8"))
      .resolves.toBe(REQUIRED_WASM_FILES[0]);
    await expect(readFile(path.join(outputRoot, "models", "gesture_recognizer.task"), "utf8"))
      .resolves.toBe("model");
    await expect(readFile(path.join(outputRoot, "wasm", "not-required.bin"), "utf8"))
      .rejects.toThrow();
  });

  it("contains no production CDN or remote model fallback", async () => {
    const source = await readFile(path.resolve("apps/desktop/scripts/copy-mediapipe-assets.mjs"), "utf8");

    expect(source).not.toMatch(/https?:\/\/|jsdelivr|unpkg|cdn/i);
  });
});
