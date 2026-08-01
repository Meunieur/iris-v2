import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractFile, listPackage } from "@electron/asar";
import {
  archiveExtractionPath,
  isForbiddenPackagedPath,
  normalizePackagedPath,
} from "./package-policy.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "..", "..", "..");
const packageRoot = path.resolve(process.argv[2] ?? path.join(workspaceRoot, "release", "win-unpacked"));
const resourcesRoot = path.join(packageRoot, "resources");
const asarPath = path.join(resourcesRoot, "app.asar");
const licensePath = path.join(resourcesRoot, "LICENSE");
const projectNoticePath = path.join(resourcesRoot, "NOTICE");
const noticePath = path.join(resourcesRoot, "THIRD_PARTY_NOTICES.md");
const upstreamLicensePath = path.join(resourcesRoot, "LICENSES", "ASHR12-iris-MIT.txt");
const apacheLicensePath = path.join(resourcesRoot, "LICENSES", "Apache-2.0.txt");

await access(path.join(packageRoot, "Iris v2.exe"));
await access(asarPath);
await access(licensePath);
await access(projectNoticePath);
await access(noticePath);
await access(upstreamLicensePath);
await access(apacheLicensePath);

const listedEntries = listPackage(asarPath, { isPack: false });
const extractionPaths = new Map(listedEntries.map((entry) => [
  normalizePackagedPath(entry),
  archiveExtractionPath(entry),
]));
const entries = new Set(extractionPaths.keys());
const required = [
  "dist/electron/main/main.js",
  "dist/electron/main/conversation-runtime.js",
  "dist/electron/main/gemini-provider.js",
  "dist/electron/preload/preload.cjs",
  "dist/renderer/index.html",
  "dist/renderer/mediapipe/models/gesture_recognizer.task",
  "dist/renderer/mediapipe/wasm/vision_wasm_internal.js",
  "dist/renderer/mediapipe/wasm/vision_wasm_internal.wasm",
  "dist/renderer/mediapipe/wasm/vision_wasm_module_internal.js",
  "dist/renderer/mediapipe/wasm/vision_wasm_module_internal.wasm",
  "dist/renderer/mediapipe/wasm/vision_wasm_nosimd_internal.js",
  "dist/renderer/mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
  "node_modules/@google/genai/dist/node/index.mjs",
  "node_modules/@iris/contracts/dist/knowledge.js",
  "node_modules/@iris/gemini-bridge/dist/controller.js",
  "node_modules/@iris/gemini-bridge/dist/index.js",
  "node_modules/@iris/gemini-bridge/dist/normalize.js",
  "node_modules/@iris/gemini-bridge/dist/proposal.js",
  "node_modules/@iris/jarvis-adapter/dist/client.js",
];
for (const entry of required) {
  if (!entries.has(entry)) throw new Error(`Packaged Iris asset is missing: ${entry}`);
}

for (const entry of entries) {
  if (isForbiddenPackagedPath(entry)) {
    throw new Error(`Forbidden source/config path in packaged Iris: ${entry}`);
  }
}

const modelEntry = "dist/renderer/mediapipe/models/gesture_recognizer.task";
const model = extractFile(asarPath, extractionPaths.get(modelEntry));
const modelHash = createHash("sha256").update(model).digest("hex").toUpperCase();
const expectedModelHash = "97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482";
if (modelHash !== expectedModelHash) throw new Error(`Packaged gesture model hash mismatch: ${modelHash}`);

const rendererScripts = [...entries].filter((entry) => /^dist\/renderer\/assets\/.*\.js$/i.test(entry));
for (const entry of rendererScripts) {
  const source = extractFile(asarPath, extractionPaths.get(entry)).toString("utf8");
  if (/jsdelivr|unpkg|cdn\.jsdelivr/i.test(source)) {
    throw new Error(`Remote MediaPipe asset fallback found in package: ${entry}`);
  }
}

const [projectLicense, projectNotice, notices, upstreamLicense, apacheLicense] = await Promise.all([
  readFile(licensePath, "utf8"),
  readFile(projectNoticePath, "utf8"),
  readFile(noticePath, "utf8"),
  readFile(upstreamLicensePath, "utf8"),
  readFile(apacheLicensePath, "utf8"),
]);
if (!/MIT License/i.test(projectLicense) || !/Meunieur and Iris v2 contributors/i.test(projectLicense)) {
  throw new Error("Packaged MIT LICENSE is incomplete");
}
if (!/Iris v2/i.test(projectNotice) || !/MediaPipe/i.test(projectNotice) || !/ASHR12\/iris/i.test(projectNotice)) {
  throw new Error("Packaged NOTICE is incomplete");
}
if (!/MediaPipe Tasks Vision/i.test(notices) || !/Iris/i.test(notices)) {
  throw new Error("THIRD_PARTY_NOTICES.md is incomplete");
}
if (!/MIT License/i.test(upstreamLicense) || !/Ashutosh Shrivastava/i.test(upstreamLicense)) {
  throw new Error("Packaged ASHR12/iris MIT license is incomplete");
}
if (!/Apache License[\s\S]*Version 2\.0/i.test(apacheLicense)) {
  throw new Error("Packaged third-party Apache-2.0 license is incomplete");
}

console.info(`[iris] package_verified files=${entries.size} model_sha256=${modelHash}`);
