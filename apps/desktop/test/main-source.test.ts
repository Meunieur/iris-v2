import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Electron main composition source", () => {
  it("contains attached-only composition and no backend lifecycle primitive", async () => {
    const source = await readFile(path.resolve("apps/desktop/src/main/main.ts"), "utf8");

    expect(source).toContain("protocol.registerSchemesAsPrivileged");
    expect(source).toMatch(/supportFetchAPI:\s*true/);
    expect(source).toContain("protocol.handle");
    expect(source).toContain("session.fromPartition(AUTH_PARTITION");
    expect(source).toContain("createAttachedRuntime");
    expect(source).toContain("registerJarvisIpc");
    expect(source).toContain("createHudNativeController");
    expect(source).toContain("globalShortcut.register");
    expect(source).toContain("globalShortcut.unregister");
    expect(source).toContain("screen.getDisplayNearestPoint");
    expect(source).toContain("setIgnoreMouseEvents");
    expect(source).toContain("setPermissionRequestHandler");
    expect(source).not.toMatch(/child_process|\bspawn\b|\bexec(File)?\b|fork\s*\(/);
    expect(source).not.toMatch(/session\.cookies|\.cookies\./);
    expect(source).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  });
});
