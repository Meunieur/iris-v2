import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("public snapshot CI contract", () => {
  it("runs the technical-only gate without resolving owner decisions", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const workflow = readFileSync(
      path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
      "utf8",
    );

    expect(packageJson.scripts?.["release:public-preflight:technical"]).toBe(
      "tsx tools/release/public-preflight.ts --technical-only",
    );
    expect(workflow).toContain("name: Enforce the public snapshot technical policy");
    expect(workflow).toContain("run: npm run release:public-preflight:technical");
    expect(workflow).not.toMatch(/^\s*run:\s+npm run release:public-preflight\s*$/mu);
  });
});
