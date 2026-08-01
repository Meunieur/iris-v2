import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

type PackageJson = {
  workspaces?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: {
    files?: string[];
    win?: {
      target?: string[];
    };
  };
};

async function readJson(relativePath: string): Promise<PackageJson> {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(await readFile(absolutePath, "utf8")) as PackageJson;
}

describe("Phase 1 desktop workspace scaffold", () => {
  it("pins the desktop stack and exposes the required root commands", async () => {
    const root = await readJson("package.json");
    const desktop = await readJson("apps/desktop/package.json");

    expect(root.workspaces).toContain("apps/*");
    expect(root.scripts).toMatchObject({
      lint: expect.any(String),
      build: expect.any(String),
      "test:integration": expect.any(String),
      "package:win": expect.any(String),
    });
    expect(desktop.dependencies).toEqual({
      "@google/genai": "2.13.0",
      "@iris/contracts": "0.1.0-alpha.1",
      "@iris/gemini-bridge": "0.1.0-alpha.1",
      "@iris/gesture-runtime": "0.1.0-alpha.1",
      "@iris/jarvis-adapter": "0.1.0-alpha.1",
      "@mediapipe/tasks-vision": "0.10.35",
      react: "19.2.8",
      "react-dom": "19.2.8",
    });
    expect(desktop.devDependencies?.electron).toBe("43.2.0");
    expect(desktop.devDependencies?.esbuild).toBe("0.28.1");
    expect(desktop.devDependencies?.vite).toBe("8.1.5");
    expect(desktop.scripts?.build).toContain("bundle-preload.mjs");
    expect(desktop.scripts?.build).toContain("prepare:mediapipe");
    expect(desktop.scripts?.dev).toContain("bundle-preload.mjs");
    expect(desktop.build?.files).toEqual([
      "dist/**/*",
      "package.json",
      "!node_modules/@iris/*/src{,/**/*}",
      "!node_modules/@iris/*/tsconfig*.json",
    ]);
    expect(desktop.build?.win?.target).toEqual(["dir"]);
  });
});
