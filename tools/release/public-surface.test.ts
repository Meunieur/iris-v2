import { describe, expect, it } from "vitest";

import {
  createPublicSurfaceDigest,
  evaluatePublicSurface,
  type PublicSurfaceFile,
  type PublicSurfacePolicy,
} from "./public-surface";

const policy: PublicSurfacePolicy = {
  schema_version: 1,
  public_paths: ["**"],
  required_paths: ["README.md", "docs/guide.md"],
  owner_gated_required_paths: ["LICENSE"],
  internal_only_paths: ["docs/internal/**"],
  approved_binary_paths: ["assets/model.bin"],
};

function text(path: string, content = "safe"): PublicSurfaceFile {
  return { path, bytes: new TextEncoder().encode(content) };
}

describe("public release candidate surface", () => {
  it("default-denies files outside the public allowlist", () => {
    const allowlistPolicy = {
      ...policy,
      public_paths: ["README.md", "docs/guide.md", "LICENSE"],
    };
    const result = evaluatePublicSurface([
      text("README.md"),
      text("docs/guide.md"),
      text("notes/private.md", "private product context"),
    ], allowlistPolicy);

    expect(result.candidate_paths).toEqual(["README.md", "docs/guide.md"]);
    expect(result.errors).toEqual([]);
  });

  it("separates owner-gated files from technical errors", () => {
    const result = evaluatePublicSurface([
      text("README.md", "[Guide](docs/guide.md)"),
      text("docs/guide.md"),
      text("docs/internal/HANDOFF.md", "sk-" + "internalSecretValue123456789"),
      { path: "assets/model.bin", bytes: Uint8Array.from([0, 1, 2]) },
    ], policy);

    expect(result).toEqual({
      candidate_paths: ["README.md", "assets/model.bin", "docs/guide.md"],
      errors: [],
      owner_blockers: ["Missing owner-gated public file: LICENSE"],
    });
  });

  it("rejects a public Markdown link that leaves the candidate", () => {
    const result = evaluatePublicSurface([
      text("README.md", "[Internal handoff](docs/internal/HANDOFF.md)"),
      text("docs/guide.md"),
      text("docs/internal/HANDOFF.md"),
    ], policy);

    expect(result.errors).toContain(
      "Public Markdown link leaves candidate: README.md -> docs/internal/HANDOFF.md",
    );
  });

  it("checks reference-style and embedded HTML links", () => {
    const result = evaluatePublicSurface([
      text(
        "README.md",
        [
          "[Internal handoff][handoff]",
          "[handoff]: docs/internal/HANDOFF.md",
          '<img src="docs/internal/private.svg" alt="private">',
        ].join("\n"),
      ),
      text("docs/guide.md"),
      text("docs/internal/HANDOFF.md"),
      text("docs/internal/private.svg", "<svg />"),
    ], policy);

    expect(result.errors).toContain(
      "Public Markdown link leaves candidate: README.md -> docs/internal/HANDOFF.md",
    );
    expect(result.errors).toContain(
      "Public Markdown link leaves candidate: README.md -> docs/internal/private.svg",
    );
  });

  it("rejects secret-shaped text and personal home paths", () => {
    const googleKey = "AIza" + "PublicCandidateSecret123456789";
    const personalHome = ["C:", "Users", "alice", "Iris"].join("\\");
    const result = evaluatePublicSurface([
      text("README.md"),
      text("docs/guide.md"),
      text("src/config.ts", `const key = "${googleKey}"; const home = "${personalHome}";`),
    ], policy);

    expect(result.errors).toContain("Secret-shaped value in public file: src/config.ts");
    expect(result.errors).toContain("Personal home path in public file: src/config.ts");
  });

  it("rejects secret/config file types and unapproved binary files", () => {
    const result = evaluatePublicSurface([
      text("README.md"),
      text("docs/guide.md"),
      text(".env.production", "KEY=placeholder"),
      { path: "screenshots/private.png", bytes: Uint8Array.from([0, 1, 2]) },
    ], policy);

    expect(result.errors).toContain("Forbidden public file type: .env.production");
    expect(result.errors).toContain("Unapproved binary public file: screenshots/private.png");
  });

  it("rejects Git links and binary extensions even without a zero byte", () => {
    const result = evaluatePublicSurface([
      text("README.md"),
      text("docs/guide.md"),
      { path: "outside-link.md", bytes: new Uint8Array(), git_mode: "120000" },
      { path: "screenshots/private.jpg", bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x10]) },
    ], policy);

    expect(result.errors).toContain(
      "Unsupported public Git entry mode: outside-link.md (120000)",
    );
    expect(result.errors).toContain("Unapproved binary public file: screenshots/private.jpg");
    expect(result.candidate_paths).not.toContain("outside-link.md");
  });

  it("rejects absolute and parent-traversal repository paths", () => {
    const result = evaluatePublicSurface([
      text("README.md"),
      text("docs/guide.md"),
      text("../escape.md"),
      text("C:/absolute.md"),
    ], policy);

    expect(result.errors).toContain("Invalid tracked path: ../escape.md");
    expect(result.errors).toContain("Invalid tracked path: C:/absolute.md");
  });

  it("produces a stable digest independent of input order", () => {
    const files = [
      text("README.md"),
      text("docs/guide.md"),
      text("LICENSE", "license text"),
    ];
    const result = evaluatePublicSurface(files, policy);

    expect(result.errors).toEqual([]);
    expect(result.owner_blockers).toEqual([]);
    expect(createPublicSurfaceDigest(files, result.candidate_paths)).toBe(
      createPublicSurfaceDigest([...files].reverse(), [...result.candidate_paths].reverse()),
    );
    expect(createPublicSurfaceDigest(files, result.candidate_paths)).not.toBe(
      createPublicSurfaceDigest([
        text("README.md", "changed"),
        text("docs/guide.md"),
        text("LICENSE", "license text"),
      ], result.candidate_paths),
    );
  });
});
