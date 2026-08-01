import { createHash } from "node:crypto";
import path from "node:path";

export interface PublicSurfaceFile {
  path: string;
  bytes: Uint8Array;
  git_mode?: string;
}

export interface PublicSurfacePolicy {
  schema_version: number;
  public_paths: string[];
  required_paths: string[];
  owner_gated_required_paths: string[];
  internal_only_paths: string[];
  approved_binary_paths: string[];
}

export interface PublicSurfaceResult {
  candidate_paths: string[];
  errors: string[];
  owner_blockers: string[];
}

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/,
  /sk-[0-9A-Za-z]{20,}/,
  /gh[pousr]_[0-9A-Za-z]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];

const PERSONAL_HOME_PATTERNS = [
  /\b[A-Za-z]:[\\/]+Users[\\/]+[^\\/]+/,
  /\/(?:Users|home)\/[^/]+\//,
];

const FORBIDDEN_FILE_EXTENSIONS = new Set([
  ".db",
  ".key",
  ".log",
  ".p12",
  ".pem",
  ".pfx",
  ".sqlite",
  ".sqlite3",
]);

const BINARY_FILE_EXTENSIONS = new Set([
  ".7z",
  ".avi",
  ".bmp",
  ".dll",
  ".docx",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".node",
  ".pdf",
  ".png",
  ".pptx",
  ".rar",
  ".task",
  ".wasm",
  ".webp",
  ".woff",
  ".woff2",
  ".xlsx",
  ".zip",
]);

const PUBLIC_FILE_GIT_MODES = new Set(["100644", "100755"]);

function normalizeRepositoryPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function isInvalidRepositoryPath(value: string): boolean {
  if (!value || value.startsWith("/") || /^[A-Za-z]:\//.test(value)) {
    return true;
  }

  return value.split("/").some((segment) => segment === "..");
}

function matchesPathPattern(filePath: string, pattern: string): boolean {
  const normalizedPattern = normalizeRepositoryPath(pattern);
  if (normalizedPattern === "**") {
    return true;
  }
  if (normalizedPattern.endsWith("/**")) {
    const directory = normalizedPattern.slice(0, -3).replace(/\/$/, "");
    return filePath === directory || filePath.startsWith(`${directory}/`);
  }

  return filePath === normalizedPattern;
}

function isForbiddenFileType(filePath: string): boolean {
  const basename = path.posix.basename(filePath).toLowerCase();
  return (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    FORBIDDEN_FILE_EXTENSIONS.has(path.posix.extname(basename))
  );
}

function isBinary(filePath: string, bytes: Uint8Array): boolean {
  return BINARY_FILE_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase()) || bytes.includes(0);
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function normalizeMarkdownTarget(sourcePath: string, rawTarget: string): string | undefined {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.includes(">")) {
    target = target.slice(1, target.indexOf(">"));
  } else {
    target = target.split(/\s+["']/u, 1)[0] ?? target;
  }

  if (
    !target ||
    target.startsWith("#") ||
    /^(?:https?:|mailto:|data:)/iu.test(target)
  ) {
    return undefined;
  }

  target = target.split("#", 1)[0]?.split("?", 1)[0] ?? target;
  if (!target) {
    return undefined;
  }

  const decodedTarget = (() => {
    try {
      return decodeURIComponent(target);
    } catch {
      return target;
    }
  })();

  return normalizeRepositoryPath(
    path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), decodedTarget)),
  ).replace(/^\.\//, "");
}

function findMarkdownTargets(sourcePath: string, content: string): string[] {
  const targets: string[] = [];
  const addTarget = (rawTarget: string): void => {
    const target = normalizeMarkdownTarget(sourcePath, rawTarget);
    if (target) {
      targets.push(target);
    }
  };

  const inlineLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;
  for (const match of content.matchAll(inlineLinkPattern)) {
    addTarget(match[1] ?? "");
  }

  const referenceDefinitionPattern = /^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gmu;
  for (const match of content.matchAll(referenceDefinitionPattern)) {
    addTarget(match[1] ?? "");
  }

  const htmlAttributePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/giu;
  for (const match of content.matchAll(htmlAttributePattern)) {
    addTarget(match[2] ?? "");
  }

  return targets;
}

export function evaluatePublicSurface(
  files: PublicSurfaceFile[],
  policy: PublicSurfacePolicy,
): PublicSurfaceResult {
  const errors: string[] = [];
  const ownerBlockers: string[] = [];
  const normalizedFiles = files.map((file) => ({
    ...file,
    path: normalizeRepositoryPath(file.path),
  }));

  const validFiles = normalizedFiles.filter((file) => {
    if (!isInvalidRepositoryPath(file.path)) {
      return true;
    }

    errors.push(`Invalid tracked path: ${file.path}`);
    return false;
  });

  const allowlistedFiles = validFiles.filter((file) =>
    policy.public_paths.some((pattern) => matchesPathPattern(file.path, pattern)),
  );
  const publicFiles = allowlistedFiles.filter(
    (file) => !policy.internal_only_paths.some((pattern) => matchesPathPattern(file.path, pattern)),
  );
  const candidateFiles = publicFiles.filter((file) => {
    if (!file.git_mode || PUBLIC_FILE_GIT_MODES.has(file.git_mode)) {
      return true;
    }

    errors.push(`Unsupported public Git entry mode: ${file.path} (${file.git_mode})`);
    return false;
  });
  const candidatePaths = [...new Set(candidateFiles.map((file) => file.path))].sort();
  const candidatePathSet = new Set(candidatePaths);
  const approvedBinaryPaths = new Set(policy.approved_binary_paths.map(normalizeRepositoryPath));

  for (const requiredPath of policy.required_paths.map(normalizeRepositoryPath)) {
    if (!candidatePathSet.has(requiredPath)) {
      errors.push(`Missing required public file: ${requiredPath}`);
    }
  }

  for (const requiredPath of policy.owner_gated_required_paths.map(normalizeRepositoryPath)) {
    if (!candidatePathSet.has(requiredPath)) {
      ownerBlockers.push(`Missing owner-gated public file: ${requiredPath}`);
    }
  }

  for (const file of candidateFiles) {
    if (isForbiddenFileType(file.path)) {
      errors.push(`Forbidden public file type: ${file.path}`);
    }

    const binary = isBinary(file.path, file.bytes);
    if (binary && !approvedBinaryPaths.has(file.path)) {
      errors.push(`Unapproved binary public file: ${file.path}`);
      continue;
    }

    if (binary) {
      continue;
    }

    const content = decodeText(file.bytes);
    if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
      errors.push(`Secret-shaped value in public file: ${file.path}`);
    }
    if (PERSONAL_HOME_PATTERNS.some((pattern) => pattern.test(content))) {
      errors.push(`Personal home path in public file: ${file.path}`);
    }

    if (path.posix.extname(file.path).toLowerCase() === ".md") {
      for (const target of findMarkdownTargets(file.path, content)) {
        if (!candidatePathSet.has(target)) {
          errors.push(`Public Markdown link leaves candidate: ${file.path} -> ${target}`);
        }
      }
    }
  }

  return {
    candidate_paths: candidatePaths,
    errors: [...new Set(errors)].sort(),
    owner_blockers: [...new Set(ownerBlockers)].sort(),
  };
}

export function createPublicSurfaceDigest(
  files: PublicSurfaceFile[],
  candidatePaths: string[],
): string {
  const filesByPath = new Map(
    files.map((file) => [normalizeRepositoryPath(file.path), file.bytes] as const),
  );
  const hash = createHash("sha256");

  for (const candidatePath of [...candidatePaths].map(normalizeRepositoryPath).sort()) {
    const bytes = filesByPath.get(candidatePath);
    if (!bytes) {
      throw new Error(`Cannot hash missing public candidate file: ${candidatePath}`);
    }

    hash.update(candidatePath, "utf8");
    hash.update(Uint8Array.of(0));
    hash.update(bytes);
    hash.update(Uint8Array.of(0));
  }

  return hash.digest("hex");
}
