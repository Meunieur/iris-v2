import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_WASM_FILES = Object.freeze([
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_module_internal.js",
  "vision_wasm_module_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
]);

async function requireFile(filePath, label) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error();
  } catch {
    throw new Error(`Missing MediaPipe asset: ${label}`);
  }
}

export async function copyMediaPipeAssets({ wasmRoot, modelPath, outputRoot }) {
  for (const file of REQUIRED_WASM_FILES) {
    await requireFile(path.join(wasmRoot, file), file);
  }
  await requireFile(modelPath, "gesture_recognizer.task");
  const outputWasm = path.join(outputRoot, "wasm");
  const outputModels = path.join(outputRoot, "models");
  await mkdir(outputWasm, { recursive: true });
  await mkdir(outputModels, { recursive: true });
  await Promise.all(REQUIRED_WASM_FILES.map((file) => (
    copyFile(path.join(wasmRoot, file), path.join(outputWasm, file))
  )));
  await copyFile(modelPath, path.join(outputModels, "gesture_recognizer.task"));
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  const desktopRoot = path.resolve(path.dirname(scriptPath), "..");
  const workspaceRoot = path.resolve(desktopRoot, "../..");
  await copyMediaPipeAssets({
    wasmRoot: path.join(workspaceRoot, "node_modules", "@mediapipe", "tasks-vision", "wasm"),
    modelPath: path.join(desktopRoot, "vendor", "mediapipe", "gesture_recognizer.task"),
    outputRoot: path.join(desktopRoot, "public", "mediapipe"),
  });
}
