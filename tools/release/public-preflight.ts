import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createPublicSurfaceDigest,
  evaluatePublicSurface,
  type PublicSurfaceFile,
  type PublicSurfacePolicy,
} from "./public-surface";

export type PublicPreflightStatus = "ready" | "owner-blocked" | "technical-error";
export type PublicPreflightMode = "full" | "technical-only";

export interface PublicPreflightSummary {
  status: PublicPreflightStatus;
  candidate_count: number;
  digest: string;
  errors: string[];
  owner_blockers: string[];
}

const SUPPORTED_GIT_FILE_MODES = new Set(["100644", "100755"]);

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Public surface policy field must be a string array: ${fieldName}`);
  }
}

export function parsePublicSurfacePolicy(value: unknown): PublicSurfacePolicy {
  if (!value || typeof value !== "object") {
    throw new Error("Public surface policy must be an object");
  }

  const policy = value as Record<string, unknown>;
  if (policy.schema_version !== 1) {
    throw new Error(`Unsupported public surface policy schema: ${String(policy.schema_version)}`);
  }

  assertStringArray(policy.required_paths, "required_paths");
  assertStringArray(policy.public_paths, "public_paths");
  assertStringArray(policy.owner_gated_required_paths, "owner_gated_required_paths");
  assertStringArray(policy.internal_only_paths, "internal_only_paths");
  assertStringArray(policy.approved_binary_paths, "approved_binary_paths");

  return {
    schema_version: 1,
    public_paths: policy.public_paths,
    required_paths: policy.required_paths,
    owner_gated_required_paths: policy.owner_gated_required_paths,
    internal_only_paths: policy.internal_only_paths,
    approved_binary_paths: policy.approved_binary_paths,
  };
}

export function summarizePublicPreflight(
  files: PublicSurfaceFile[],
  policy: PublicSurfacePolicy,
): PublicPreflightSummary {
  const result = evaluatePublicSurface(files, policy);
  const status: PublicPreflightStatus = result.errors.length > 0
    ? "technical-error"
    : result.owner_blockers.length > 0
      ? "owner-blocked"
      : "ready";

  return {
    status,
    candidate_count: result.candidate_paths.length,
    digest: createPublicSurfaceDigest(files, result.candidate_paths),
    errors: result.errors,
    owner_blockers: result.owner_blockers,
  };
}

export function parsePublicPreflightMode(arguments_: string[]): PublicPreflightMode {
  if (arguments_.length === 0) {
    return "full";
  }
  if (arguments_.length === 1 && arguments_[0] === "--technical-only") {
    return "technical-only";
  }

  throw new Error(`Unknown public preflight option: ${arguments_.join(" ")}`);
}

export function getPublicPreflightExitCode(
  summary: PublicPreflightSummary,
  mode: PublicPreflightMode,
): 0 | 1 | 2 {
  if (summary.errors.length > 0) {
    return 1;
  }
  if (mode === "technical-only") {
    return 0;
  }
  return summary.owner_blockers.length > 0 ? 2 : 0;
}

export function formatPublicPreflightSummary(
  summary: PublicPreflightSummary,
  mode: PublicPreflightMode = "full",
): string {
  const lines = [
    `Public release preflight: ${summary.status}`,
    `Candidate files: ${summary.candidate_count}`,
    `Candidate SHA-256: ${summary.digest}`,
    `Technical errors: ${summary.errors.length}`,
    ...summary.errors.map((error) => `- ${error}`),
    `Owner blockers: ${summary.owner_blockers.length}`,
    ...summary.owner_blockers.map((blocker) => `- ${blocker}`),
  ];
  if (mode === "technical-only") {
    lines.push(`Technical-only gate: ${summary.errors.length > 0 ? "fail" : "pass"}`);
  }

  return lines.join("\n");
}

interface RepositoryEntry {
  path: string;
  git_mode?: string;
}

function runGit(repositoryRoot: string, arguments_: string[]): Buffer {
  return execFileSync(
    "git",
    arguments_,
    {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  );
}

function splitNullTerminated(output: Buffer): string[] {
  return output.toString("utf8").split("\0").filter(Boolean);
}

function listRepositoryEntries(repositoryRoot: string): RepositoryEntry[] {
  const entries = new Map<string, RepositoryEntry>();

  for (const record of splitNullTerminated(
    runGit(repositoryRoot, ["ls-files", "--cached", "--stage", "-z"]),
  )) {
    const tabIndex = record.indexOf("\t");
    const metadata = record.slice(0, tabIndex).split(" ");
    const filePath = record.slice(tabIndex + 1);
    const mode = metadata[0] ?? "unknown";
    const stage = metadata[2] ?? "unknown";
    entries.set(filePath, {
      path: filePath,
      git_mode: stage === "0" ? mode : `${mode}:stage-${stage}`,
    });
  }

  for (const filePath of splitNullTerminated(
    runGit(repositoryRoot, ["ls-files", "--others", "--exclude-standard", "-z"]),
  )) {
    entries.set(filePath, { path: filePath });
  }

  return [...entries.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function loadTrackedFiles(repositoryRoot: string): Promise<PublicSurfaceFile[]> {
  const repositoryEntries = listRepositoryEntries(repositoryRoot);
  return Promise.all(
    repositoryEntries.map(async (entry) => {
      const absolutePath = path.join(repositoryRoot, entry.path);
      const fileStats = await lstat(absolutePath);
      const gitMode = !entry.git_mode && fileStats.isSymbolicLink()
        ? "untracked-symlink"
        : entry.git_mode;
      const supportedFile = !gitMode || SUPPORTED_GIT_FILE_MODES.has(gitMode);

      return {
        path: entry.path,
        ...(gitMode ? { git_mode: gitMode } : {}),
        bytes: supportedFile ? await readFile(absolutePath) : new Uint8Array(),
      };
    }),
  );
}

export async function runPublicPreflight(repositoryRoot: string): Promise<PublicPreflightSummary> {
  const policyPath = path.join(repositoryRoot, "tools", "release", "public-surface.json");
  const policy = parsePublicSurfacePolicy(JSON.parse(await readFile(policyPath, "utf8")));
  const files = await loadTrackedFiles(repositoryRoot);
  return summarizePublicPreflight(files, policy);
}

async function main(): Promise<void> {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDirectory, "../..");
  const mode = parsePublicPreflightMode(process.argv.slice(2));
  const summary = await runPublicPreflight(repositoryRoot);
  console.log(formatPublicPreflightSummary(summary, mode));
  process.exitCode = getPublicPreflightExitCode(summary, mode);
}

const invokedScript = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedScript === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
