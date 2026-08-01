import { describe, expect, it } from "vitest";

import {
  formatPublicPreflightSummary,
  getPublicPreflightExitCode,
  parsePublicSurfacePolicy,
  parsePublicPreflightMode,
  summarizePublicPreflight,
} from "./public-preflight";
import type { PublicSurfaceFile, PublicSurfacePolicy } from "./public-surface";

const basePolicy: PublicSurfacePolicy = {
  schema_version: 1,
  public_paths: ["**"],
  required_paths: ["README.md"],
  owner_gated_required_paths: ["LICENSE"],
  internal_only_paths: [],
  approved_binary_paths: [],
};

function text(path: string, content = "safe"): PublicSurfaceFile {
  return { path, bytes: new TextEncoder().encode(content) };
}

describe("public release preflight reporting", () => {
  it("returns exit code 1 for technical errors", () => {
    const summary = summarizePublicPreflight([text("README.md", "[Missing](missing.md)")], basePolicy);

    expect(summary.status).toBe("technical-error");
    expect(getPublicPreflightExitCode(summary, "full")).toBe(1);
    expect(summary.errors).toEqual([
      "Public Markdown link leaves candidate: README.md -> missing.md",
    ]);
    expect(summary.owner_blockers).toEqual(["Missing owner-gated public file: LICENSE"]);
  });

  it("returns exit code 2 when only owner decisions remain", () => {
    const summary = summarizePublicPreflight([text("README.md")], basePolicy);

    expect(summary.status).toBe("owner-blocked");
    expect(getPublicPreflightExitCode(summary, "full")).toBe(2);
    expect(summary.errors).toEqual([]);
    expect(summary.owner_blockers).toEqual(["Missing owner-gated public file: LICENSE"]);
  });

  it("returns exit code 0 with a deterministic ready report", () => {
    const summary = summarizePublicPreflight(
      [text("LICENSE", "owner-approved license"), text("README.md")],
      basePolicy,
    );

    expect(summary.status).toBe("ready");
    expect(getPublicPreflightExitCode(summary, "full")).toBe(0);
    expect(summary.candidate_count).toBe(2);
    expect(summary.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(formatPublicPreflightSummary(summary)).toBe([
      "Public release preflight: ready",
      "Candidate files: 2",
      `Candidate SHA-256: ${summary.digest}`,
      "Technical errors: 0",
      "Owner blockers: 0",
    ].join("\n"));
  });

  it("fails closed on an unknown policy schema", () => {
    expect(() => parsePublicSurfacePolicy({ ...basePolicy, schema_version: 2 })).toThrow(
      "Unsupported public surface policy schema: 2",
    );
  });

  it("lets CI pass owner blockers but never technical errors", () => {
    const ownerBlocked = summarizePublicPreflight([text("README.md")], basePolicy);
    const technicalError = summarizePublicPreflight(
      [text("README.md", "[Missing](missing.md)")],
      basePolicy,
    );

    expect(getPublicPreflightExitCode(ownerBlocked, "technical-only")).toBe(0);
    expect(getPublicPreflightExitCode(technicalError, "technical-only")).toBe(1);
    expect(formatPublicPreflightSummary(ownerBlocked, "technical-only")).toContain(
      "Technical-only gate: pass",
    );
  });

  it("fails closed on unknown command-line options", () => {
    expect(parsePublicPreflightMode([])).toBe("full");
    expect(parsePublicPreflightMode(["--technical-only"])).toBe("technical-only");
    expect(() => parsePublicPreflightMode(["--unknown"])).toThrow(
      "Unknown public preflight option: --unknown",
    );
  });
});
