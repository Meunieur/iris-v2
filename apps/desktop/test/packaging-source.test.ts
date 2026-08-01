import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Windows packaging source", () => {
  it("packages a deterministic Iris v2 brand icon instead of Electron's default", async () => {
    const desktop = JSON.parse(await readFile(path.resolve("apps/desktop/package.json"), "utf8"));
    const icon = await readFile(path.resolve("apps/desktop/build/icon.svg"), "utf8");

    expect(desktop.build.win.icon).toBe("build/icon.svg");
    expect(icon).toContain('viewBox="0 0 1024 1024"');
    expect(icon).toContain("#080A0F");
    expect(icon).toContain("#56E6F4");
    expect(icon).toContain("#9B8CFF");
    expect(icon).not.toMatch(/<script|(?:href|src)\s*=\s*["'](?:https?:|data:)/i);
  });

  it("prepares and validates the exact Electron distribution before Builder runs", async () => {
    const desktop = JSON.parse(await readFile(path.resolve("apps/desktop/package.json"), "utf8"));
    const root = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
    const script = await readFile(path.resolve("apps/desktop/scripts/prepare-electron-dist.mjs"), "utf8");
    const verifier = await readFile(path.resolve("apps/desktop/scripts/verify-package.mjs"), "utf8");

    expect(desktop.devDependencies.electron).toBe("43.2.0");
    expect(desktop.scripts["build:workspace-deps"]).toContain("@iris/contracts");
    expect(desktop.scripts["build:workspace-deps"]).toContain("@iris/jarvis-adapter");
    expect(desktop.scripts["package:win"]).toContain("build:workspace-deps");
    expect(desktop.scripts["package:win"]).toContain("prepare-electron-dist.mjs");
    expect(desktop.scripts["package:win"]).toContain("verify-package.mjs");
    expect(desktop.build.electronDist).toBe("../../.cache/electron-dist");
    expect(desktop.build.extraResources).toEqual([
      { from: "../../LICENSE", to: "LICENSE" },
      { from: "../../NOTICE", to: "NOTICE" },
      { from: "../../THIRD_PARTY_NOTICES.md", to: "THIRD_PARTY_NOTICES.md" },
      { from: "../../LICENSES/ASHR12-iris-MIT.txt", to: "LICENSES/ASHR12-iris-MIT.txt" },
      { from: "../../LICENSES/Apache-2.0.txt", to: "LICENSES/Apache-2.0.txt" },
    ]);
    expect(root.devDependencies).toMatchObject({
      "@electron/asar": "4.2.1",
      "@electron/get": "5.0.0",
      "@electron-internal/extract-zip": "1.0.4",
    });
    expect(script).toContain("artifactName: \"electron\"");
    expect(script).toContain("platform: \"win32\"");
    expect(script).toContain("arch: \"x64\"");
    expect(script).toContain("electron.exe");
    expect(script).toContain("version");
    expect(verifier).toContain("app.asar");
    expect(verifier).toContain("dist/renderer/mediapipe/models/gesture_recognizer.task");
    expect(verifier).toContain("dist/renderer/mediapipe/wasm/vision_wasm_internal.wasm");
    expect(verifier).toContain("dist/electron/preload/preload.cjs");
    expect(verifier).toContain("dist/electron/main/conversation-runtime.js");
    expect(verifier).toContain("dist/electron/main/gemini-provider.js");
    expect(verifier).toContain("node_modules/@google/genai/dist/node/index.mjs");
    expect(verifier).toContain("node_modules/@iris/gemini-bridge/dist/index.js");
    expect(verifier).toContain("node_modules/@iris/contracts/dist/knowledge.js");
    expect(verifier).toContain("node_modules/@iris/jarvis-adapter/dist/client.js");
    expect(verifier).toContain("THIRD_PARTY_NOTICES.md");
    expect(verifier).toContain('path.join(resourcesRoot, "LICENSE")');
    expect(verifier).toContain('path.join(resourcesRoot, "NOTICE")');
    expect(verifier).toContain('path.join(resourcesRoot, "LICENSES", "ASHR12-iris-MIT.txt")');
    expect(verifier).toContain('path.join(resourcesRoot, "LICENSES", "Apache-2.0.txt")');
    expect(verifier).toContain("isForbiddenPackagedPath");
  });
});
