import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("renderer content security policy", () => {
  it("allows only same-origin runtime asset fetches for local MediaPipe", async () => {
    const html = await readFile(path.resolve("apps/desktop/index.html"), "utf8");
    const policy = html.match(/content="([^"]*default-src[^"]*)"/)?.[1];

    expect(policy).toBeDefined();
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).not.toContain("connect-src 'none'");
    expect(policy).not.toMatch(/(?<!wasm-)unsafe-eval/);
    expect(policy).not.toMatch(/https?:|wss?:/);
  });
});
