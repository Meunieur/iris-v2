import { createHash } from "node:crypto";

import type {
  RawAuthStatus,
  RawBrains,
  RawHealth,
  RawJarvisEvent,
  RawSessions,
  RawVersion,
} from "./raw-jarvis.js";

export type ConnectionState = "offline" | "discovering" | "connecting" | "ready" | "degraded" | "reconnecting";

export type HealthSnapshot = {
  status: "ok" | "degraded" | "offline";
  version?: string;
  authRequired: boolean;
  authenticated: boolean;
  mode?: "native" | "windows" | "docker" | "unknown";
};

export type BrainSummary = {
  id: `brain_${string}`;
  name: string;
  notes: number;
  isDefault: boolean;
};

export type SessionSummary = {
  id: string;
  title: string;
  brainId?: `brain_${string}`;
  engine?: string;
  model?: string;
  updatedAt?: number;
  messageCount?: number;
};

export type PublicJarvisEvent =
  | { type: "connected" }
  | { type: "status"; sessionId?: string; state: string; detail?: string }
  | { type: "step_started"; sessionId?: string; capability: string }
  | { type: "step_result"; sessionId?: string; ok: boolean; summary?: string }
  | { type: "text_delta"; sessionId?: string; delta: string }
  | { type: "response"; sessionId?: string; text: string; engine?: string; model?: string }
  | { type: "notice"; severity: "info" | "warning" | "error"; message: string }
  | { type: "turn_done"; sessionId?: string; outcome: "unknown" | "cancelled" }
  | { type: "diagnostic"; eventName: string };

type BrainPathIdLookup = ReadonlyMap<string, BrainSummary["id"]>;

const MAX_RENDERER_SOURCE_CODE_UNITS = 16 * 1024;
const MAX_RENDERER_TEXT_BYTES = 16 * 1024;
const MAX_CREDENTIAL_KEY_CODE_UNITS = 129;
const MAX_PEM_LABEL_CODE_UNITS = 96;
const MAX_TRUNCATED_TOKEN_TAIL_CODE_UNITS = 192;
const REDACTION_MARKER = "[REDACTED]";
const RENDERER_SOURCE_TRUNCATION_MARKER = "…[source truncated]";
const RENDERER_TRUNCATION_MARKER = "…[truncated]";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const credentialKeySegments = new Set([
  "authorization",
  "cookie",
  "passphrase",
  "password",
  "secret",
  "token",
]);

const credentialCompactMarkers = [
  "apikey",
  "clientsecret",
  "privatekey",
  "signingkey",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "idtoken",
  "githubtoken",
  "bearertoken",
];

function isCredentialLikeKey(key: string): boolean {
  const segmented = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (segmented.some((segment) => credentialKeySegments.has(segment))) return true;
  const compact = segmented.join("");
  return credentialCompactMarkers.some((marker) => compact.includes(marker));
}

type ParsedKey = {
  end: number;
  kind: "escaped_quoted" | "plain" | "quoted";
  normalized: string;
  raw: string;
};

type ParsedValue = {
  end: number;
  replacement: string;
};

type CredentialAssignment = {
  end: number;
  replacement: string;
};

function isAsciiLetter(value: string): boolean {
  const code = value.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isCredentialKeyCharacter(value: string): boolean {
  const code = value.charCodeAt(0);
  return isAsciiLetter(value)
    || (code >= 48 && code <= 57)
    || value === "."
    || value === "_"
    || value === "-"
    || value === " ";
}

function isInlineWhitespace(value: string): boolean {
  return value === " " || value === "\t";
}

function isAuthorizationKey(key: string): boolean {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .includes("authorization");
}

function parsePlainKey(input: string, start: number, end: number): ParsedKey | undefined {
  if (!isAsciiLetter(input[start] ?? "")) return undefined;

  let cursor = start + 1;
  const keyLimit = Math.min(end, start + MAX_CREDENTIAL_KEY_CODE_UNITS);
  while (cursor < keyLimit && isCredentialKeyCharacter(input[cursor] ?? "")) cursor += 1;

  return {
    end: cursor,
    kind: "plain",
    normalized: input.slice(start, cursor),
    raw: input.slice(start, cursor),
  };
}

function parseQuotedKey(input: string, start: number, end: number): ParsedKey | undefined {
  const quote = input[start];
  if (quote !== '"' && quote !== "'") return undefined;

  let cursor = start + 1;
  const keyLimit = Math.min(end, cursor + MAX_CREDENTIAL_KEY_CODE_UNITS);
  if (!isAsciiLetter(input[cursor] ?? "")) return undefined;
  while (cursor < keyLimit && isCredentialKeyCharacter(input[cursor] ?? "")) cursor += 1;
  if (input[cursor] !== quote) return undefined;

  return {
    end: cursor + 1,
    kind: "quoted",
    normalized: input.slice(start + 1, cursor),
    raw: input.slice(start, cursor + 1),
  };
}

function parseEscapedQuotedKey(input: string, start: number, end: number): ParsedKey | undefined {
  const quote = input[start + 1];
  if (input[start] !== "\\" || (quote !== '"' && quote !== "'")) return undefined;

  let cursor = start + 2;
  const keyLimit = Math.min(end, cursor + MAX_CREDENTIAL_KEY_CODE_UNITS);
  if (!isAsciiLetter(input[cursor] ?? "")) return undefined;
  while (cursor < keyLimit && isCredentialKeyCharacter(input[cursor] ?? "")) cursor += 1;
  if (input[cursor] !== "\\" || input[cursor + 1] !== quote) return undefined;

  return {
    end: cursor + 2,
    kind: "escaped_quoted",
    normalized: input.slice(start + 2, cursor),
    raw: input.slice(start, cursor + 2),
  };
}

function parseCredentialKey(input: string, start: number, end: number): ParsedKey | undefined {
  return parseEscapedQuotedKey(input, start, end)
    ?? parseQuotedKey(input, start, end)
    ?? parsePlainKey(input, start, end);
}

function parseQuotedValue(input: string, start: number, end: number): ParsedValue | undefined {
  const quote = input[start];
  if (quote !== '"' && quote !== "'") return undefined;

  let cursor = start + 1;
  while (cursor < end) {
    if (input[cursor] === "\\") {
      cursor = Math.min(end, cursor + 2);
      continue;
    }
    if (input[cursor] === quote) {
      return {
        end: cursor + 1,
        replacement: `${quote}${REDACTION_MARKER}${quote}`,
      };
    }
    cursor += 1;
  }

  return {
    end,
    replacement: `${quote}${REDACTION_MARKER}`,
  };
}

function parseEscapedQuotedValue(input: string, start: number, end: number): ParsedValue | undefined {
  const quote = input[start + 1];
  if (input[start] !== "\\" || (quote !== '"' && quote !== "'")) return undefined;

  let cursor = start + 2;
  while (cursor < end) {
    if (input[cursor] !== "\\") {
      cursor += 1;
      continue;
    }

    const runStart = cursor;
    while (cursor < end && input[cursor] === "\\") cursor += 1;
    if (input[cursor] !== quote) continue;

    const runLengthModulo = (cursor - runStart) % 4;
    if (runLengthModulo === 1) {
      return {
        end: cursor + 1,
        replacement: `\\${quote}${REDACTION_MARKER}\\${quote}`,
      };
    }
    if (runLengthModulo === 3) {
      cursor += 1;
      continue;
    }

    return {
      end,
      replacement: `\\${quote}${REDACTION_MARKER}`,
    };
  }

  return {
    end,
    replacement: `\\${quote}${REDACTION_MARKER}`,
  };
}

function asciiCaseInsensitiveMatch(input: string, candidate: string, start: number, end: number): boolean {
  if (start + candidate.length > end) return false;
  for (let offset = 0; offset < candidate.length; offset += 1) {
    if ((input[start + offset] ?? "").toLowerCase() !== candidate[offset]?.toLowerCase()) return false;
  }
  return true;
}

function findAsciiCaseInsensitive(input: string, candidate: string, start: number, end: number): number {
  const finalStart = end - candidate.length;
  for (let cursor = start; cursor <= finalStart; cursor += 1) {
    if (asciiCaseInsensitiveMatch(input, candidate, cursor, end)) return cursor;
  }
  return -1;
}

function scanPemBlockEnd(input: string, start: number, end: number): number | undefined {
  const beginPrefix = "-----BEGIN ";
  if (!asciiCaseInsensitiveMatch(input, beginPrefix, start, end)) return undefined;

  const labelStart = start + beginPrefix.length;
  let labelEnd = labelStart;
  while (labelEnd < end && labelEnd - labelStart <= MAX_PEM_LABEL_CODE_UNITS) {
    if (labelEnd + 5 <= end && input.startsWith("-----", labelEnd)) break;
    const value = input[labelEnd] ?? "";
    if (value === "\r" || value === "\n") return undefined;
    labelEnd += 1;
  }
  if (labelEnd === labelStart
    || labelEnd - labelStart > MAX_PEM_LABEL_CODE_UNITS
    || !input.startsWith("-----", labelEnd)) return undefined;

  const label = input.slice(start + beginPrefix.length, labelEnd);
  const normalizedLabel = label.toUpperCase();
  if (!normalizedLabel.includes("PRIVATE KEY") && !normalizedLabel.includes("SIGNING KEY")) return undefined;

  const endMarker = `-----END ${label}-----`;
  const endMarkerStart = findAsciiCaseInsensitive(input, endMarker, labelEnd + 5, end);
  return endMarkerStart < 0 ? end : endMarkerStart + endMarker.length;
}

function parseAuthorizationValue(input: string, start: number, end: number): ParsedValue | undefined {
  for (const scheme of ["basic", "bearer", "token"]) {
    const schemeEnd = start + scheme.length;
    if (schemeEnd > end || input.slice(start, schemeEnd).toLowerCase() !== scheme) continue;
    if (!isInlineWhitespace(input[schemeEnd] ?? "")) continue;

    let credentialStart = schemeEnd;
    while (credentialStart < end && isInlineWhitespace(input[credentialStart] ?? "")) credentialStart += 1;
    const prefix = input.slice(start, credentialStart);

    const escapedQuoted = parseEscapedQuotedValue(input, credentialStart, end);
    if (escapedQuoted !== undefined) {
      return {
        end: escapedQuoted.end,
        replacement: prefix + escapedQuoted.replacement,
      };
    }
    const quoted = parseQuotedValue(input, credentialStart, end);
    if (quoted !== undefined) {
      return {
        end: quoted.end,
        replacement: prefix + quoted.replacement,
      };
    }

    if (input.startsWith(REDACTION_MARKER, credentialStart)) {
      return {
        end: credentialStart + REDACTION_MARKER.length,
        replacement: prefix + REDACTION_MARKER,
      };
    }

    let credentialEnd = credentialStart;
    while (credentialEnd < end) {
      const value = input[credentialEnd] ?? "";
      if (isInlineWhitespace(value) || value === "\r" || value === "\n" || ",;} ]".includes(value)) break;
      credentialEnd += 1;
    }
    return {
      end: credentialEnd,
      replacement: prefix + REDACTION_MARKER,
    };
  }

  return undefined;
}

function parseLineCredentialValue(input: string, start: number, end: number): ParsedValue {
  let cursor = start;
  while (cursor < end && input[cursor] !== "\r" && input[cursor] !== "\n") cursor += 1;
  return {
    end: cursor,
    replacement: REDACTION_MARKER,
  };
}

function parseGenericCredentialValue(input: string, start: number, end: number): ParsedValue {
  const escapedQuoted = parseEscapedQuotedValue(input, start, end);
  if (escapedQuoted !== undefined) return escapedQuoted;

  const quoted = parseQuotedValue(input, start, end);
  if (quoted !== undefined) return quoted;

  if (input.startsWith(REDACTION_MARKER, start)) {
    return {
      end: start + REDACTION_MARKER.length,
      replacement: REDACTION_MARKER,
    };
  }

  const pemEnd = scanPemBlockEnd(input, start, end);
  if (pemEnd !== undefined) {
    return {
      end: pemEnd,
      replacement: REDACTION_MARKER,
    };
  }

  let cursor = start;
  while (cursor < end) {
    const value = input[cursor] ?? "";
    if (isInlineWhitespace(value)
      || value === ","
      || value === ";"
      || value === "}"
      || value === "]"
      || value === "\r"
      || value === "\n") break;
    cursor += 1;
  }
  return {
    end: cursor,
    replacement: REDACTION_MARKER,
  };
}

function isPlainDrivePathCandidate(input: string, key: ParsedKey, separatorStart: number): boolean {
  if (key.kind !== "plain" || input[separatorStart] !== ":") return false;
  const pathSeparator = input[separatorStart + 1];
  if (pathSeparator !== "\\" && pathSeparator !== "/") return false;
  return /(?:^|[ \t])[A-Za-z]$/.test(key.raw);
}

function isPlainCookieHeaderKey(key: ParsedKey): boolean {
  if (key.kind !== "plain") return false;
  const normalized = key.normalized.trim().toLowerCase();
  return normalized === "cookie" || normalized === "set-cookie";
}

function parseCredentialAssignment(input: string, start: number, end: number): CredentialAssignment | undefined {
  const key = parseCredentialKey(input, start, end);
  if (key === undefined || !isCredentialLikeKey(key.normalized)) return undefined;

  let separatorEnd = key.end;
  while (separatorEnd < end && isInlineWhitespace(input[separatorEnd] ?? "")) separatorEnd += 1;
  if (input[separatorEnd] !== ":" && input[separatorEnd] !== "=") return undefined;
  if (isPlainDrivePathCandidate(input, key, separatorEnd)) return undefined;
  separatorEnd += 1;
  while (separatorEnd < end && isInlineWhitespace(input[separatorEnd] ?? "")) separatorEnd += 1;

  const prefix = key.raw + input.slice(key.end, separatorEnd);
  const value = isAuthorizationKey(key.normalized)
    ? parseAuthorizationValue(input, separatorEnd, end) ?? parseLineCredentialValue(input, separatorEnd, end)
    : isPlainCookieHeaderKey(key)
      ? parseLineCredentialValue(input, separatorEnd, end)
    : parseGenericCredentialValue(input, separatorEnd, end);

  return {
    end: value.end,
    replacement: prefix + value.replacement,
  };
}

function scanRendererCredentials(input: string): string {
  const sourceMarkerStart = input.endsWith(RENDERER_SOURCE_TRUNCATION_MARKER)
    ? input.length - RENDERER_SOURCE_TRUNCATION_MARKER.length
    : input.length;
  const output: string[] = [];
  let copyStart = 0;
  let cursor = 0;

  while (cursor < sourceMarkerStart) {
    const pemEnd = scanPemBlockEnd(input, cursor, sourceMarkerStart);
    if (pemEnd !== undefined) {
      output.push(input.slice(copyStart, cursor), REDACTION_MARKER);
      copyStart = pemEnd;
      cursor = pemEnd;
      continue;
    }

    const assignment = parseCredentialAssignment(input, cursor, sourceMarkerStart);
    if (assignment !== undefined) {
      output.push(input.slice(copyStart, cursor), assignment.replacement);
      copyStart = assignment.end;
      cursor = assignment.end;
      continue;
    }
    cursor += 1;
  }

  output.push(input.slice(copyStart));
  return output.join("");
}

function boundRendererSource(input: string): string {
  if (input.length <= MAX_RENDERER_SOURCE_CODE_UNITS) return input;

  let prefixEnd = MAX_RENDERER_SOURCE_CODE_UNITS - RENDERER_SOURCE_TRUNCATION_MARKER.length;
  const finalCodeUnit = input.charCodeAt(prefixEnd - 1);
  const nextCodeUnit = input.charCodeAt(prefixEnd);
  const cutsSurrogatePair = finalCodeUnit >= 0xd800
    && finalCodeUnit <= 0xdbff
    && nextCodeUnit >= 0xdc00
    && nextCodeUnit <= 0xdfff;
  if (cutsSurrogatePair) prefixEnd -= 1;
  return input.slice(0, prefixEnd) + RENDERER_SOURCE_TRUNCATION_MARKER;
}

function redactTruncatedStandaloneCredentials(input: string): string {
  if (!input.endsWith(RENDERER_SOURCE_TRUNCATION_MARKER)) return input;

  const markerStart = input.length - RENDERER_SOURCE_TRUNCATION_MARKER.length;
  const tailStart = Math.max(0, markerStart - MAX_TRUNCATED_TOKEN_TAIL_CODE_UNITS);
  const redactedTail = input.slice(tailStart, markerStart)
    .replace(/\bsk-[A-Za-z0-9_-]*$/, REDACTION_MARKER)
    .replace(/\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]*$/i, REDACTION_MARKER)
    .replace(/\bgithub_pat_[A-Za-z0-9_]*$/i, REDACTION_MARKER)
    .replace(/\bAIza[A-Za-z0-9_-]*$/, REDACTION_MARKER)
    .replace(/\bbearer[ \t]+[A-Za-z0-9._~+/=-]*$/i, `Bearer ${REDACTION_MARKER}`);
  return input.slice(0, tailStart) + redactedTail + RENDERER_SOURCE_TRUNCATION_MARKER;
}

function redactRendererCredentials(input: string): string {
  return redactTruncatedStandaloneCredentials(scanRendererCredentials(input))
    .replace(/\bsk-[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])/g, "[REDACTED]")
    .replace(/\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{8,}(?![A-Za-z0-9_])/gi, "[REDACTED]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{8,}(?![A-Za-z0-9_])/gi, "[REDACTED]")
    .replace(/\bAIza[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])/g, "[REDACTED]")
    .replace(/\bbearer[ \t]+(?:"[^"\r\n]*"|'[^'\r\n]*'|[A-Za-z0-9._~+/=-]{6,})/gi, "Bearer [REDACTED]");
}

function protectedSourceTruncationSuffix(input: string): string {
  const sourceContent = input.slice(0, -RENDERER_SOURCE_TRUNCATION_MARKER.length);
  return sourceContent.match(/[ \t](?:Bearer )?\[REDACTED\]$/)?.[0]
    ?? sourceContent.match(/(?:Bearer )?\[REDACTED\]$/)?.[0]
    ?? "";
}

export function sanitizeRendererText(input: string): string {
  const redacted = redactRendererCredentials(boundRendererSource(input));
  const encoded = textEncoder.encode(redacted);
  if (encoded.byteLength <= MAX_RENDERER_TEXT_BYTES) return redacted;

  const sourceWasTruncated = redacted.endsWith(RENDERER_SOURCE_TRUNCATION_MARKER);
  const protectedSuffix = sourceWasTruncated ? protectedSourceTruncationSuffix(redacted) : "";
  const truncationMarker = sourceWasTruncated ? RENDERER_SOURCE_TRUNCATION_MARKER : RENDERER_TRUNCATION_MARKER;
  const retainedSuffix = protectedSuffix + truncationMarker;
  const truncatable = sourceWasTruncated
    ? redacted.slice(0, -(RENDERER_SOURCE_TRUNCATION_MARKER.length + protectedSuffix.length))
    : redacted;
  const retainedSuffixBytes = textEncoder.encode(retainedSuffix).byteLength;
  const truncatableBytes = textEncoder.encode(truncatable);
  let prefix = textDecoder.decode(truncatableBytes.slice(0, MAX_RENDERER_TEXT_BYTES - retainedSuffixBytes));
  while (textEncoder.encode(prefix + retainedSuffix).byteLength > MAX_RENDERER_TEXT_BYTES) {
    prefix = prefix.slice(0, -1);
  }
  return prefix + retainedSuffix;
}

function normalizeRawPath(rawPath: string): string {
  return rawPath.trim().replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase();
}

function opaqueBrainId(rawPath: string): BrainSummary["id"] {
  const digest = createHash("sha256").update(normalizeRawPath(rawPath), "utf8").digest("hex");
  return `brain_${digest}`;
}

function publicMode(rawMode: string): Exclude<HealthSnapshot["mode"], undefined> {
  return rawMode === "native" || rawMode === "windows" || rawMode === "docker" ? rawMode : "unknown";
}

function publicHealthStatus(rawStatus: string): HealthSnapshot["status"] {
  if (rawStatus === "ok") return "ok";
  if (rawStatus === "degraded") return "degraded";
  return "offline";
}

function withSessionId<T extends object>(value: T, sessionId: string | undefined): T & { sessionId?: string } {
  return sessionId === undefined ? value : { ...value, sessionId };
}

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" ? value : undefined;
}

function requiredString(raw: Record<string, unknown>, key: string): string {
  return optionalString(raw, key) ?? "";
}

function optionalRendererText(raw: Record<string, unknown>, key: string): string | undefined {
  const value = optionalString(raw, key);
  return value === undefined ? undefined : sanitizeRendererText(value);
}

function requiredRendererText(raw: Record<string, unknown>, key: string): string {
  return sanitizeRendererText(requiredString(raw, key));
}

export function projectHealthSnapshot(
  health: RawHealth,
  auth: RawAuthStatus,
  version: RawVersion,
): HealthSnapshot {
  return {
    status: publicHealthStatus(health.status),
    version: sanitizeRendererText(version.current),
    authRequired: auth.auth_required,
    authenticated: auth.authed,
    mode: publicMode(version.mode),
  };
}

export function projectBrainSummaries(raw: RawBrains): BrainSummary[] {
  return raw.brains.map((brain) => ({
    id: opaqueBrainId(brain.path),
    name: sanitizeRendererText(brain.name),
    notes: brain.notes,
    isDefault: brain.is_default,
  }));
}

export function createBrainPathIdLookup(raw: RawBrains): BrainPathIdLookup {
  return new Map(raw.brains.map((brain) => [normalizeRawPath(brain.path), opaqueBrainId(brain.path)]));
}

export function projectSessions(raw: RawSessions, brainPathIds: BrainPathIdLookup): SessionSummary[] {
  return raw.sessions.map((session) => {
    const projected: SessionSummary = {
      id: session.id,
      title: sanitizeRendererText(session.title ?? "Phiên chưa đặt tên"),
      updatedAt: session.updated_at,
      messageCount: session.msg_count,
    };
    const brainId = session.brain === null ? undefined : brainPathIds.get(normalizeRawPath(session.brain));
    if (brainId !== undefined) projected.brainId = brainId;
    if (session.engine !== null) projected.engine = sanitizeRendererText(session.engine);
    if (session.model !== null) projected.model = sanitizeRendererText(session.model);
    return projected;
  });
}

export function projectJarvisEvent(raw: RawJarvisEvent): PublicJarvisEvent {
  const rawRecord = raw as Record<string, unknown>;
  const eventName = requiredString(rawRecord, "type");
  const sessionId = optionalString(rawRecord, "session_id");

  switch (eventName) {
    case "hello":
      return { type: "connected" };
    case "status":
      return withSessionId({ type: "status", state: requiredRendererText(rawRecord, "content") }, sessionId);
    case "tool_call":
      return withSessionId({ type: "step_started", capability: requiredRendererText(rawRecord, "tool") }, sessionId);
    case "tool_result":
      return { type: "diagnostic", eventName: "tool_result" };
    case "stream":
      return withSessionId({ type: "text_delta", delta: requiredRendererText(rawRecord, "content") }, sessionId);
    case "response": {
      const event = withSessionId({ type: "response", text: requiredRendererText(rawRecord, "content") } as const, sessionId);
      const projected: Extract<PublicJarvisEvent, { type: "response" }> = event;
      const engine = optionalRendererText(rawRecord, "engine");
      const model = optionalRendererText(rawRecord, "model");
      if (engine !== undefined) projected.engine = engine;
      if (model !== undefined) projected.model = model;
      return projected;
    }
    case "error":
      return { type: "notice", severity: "error", message: requiredRendererText(rawRecord, "content") };
    case "system":
      return { type: "notice", severity: "info", message: requiredRendererText(rawRecord, "content") };
    case "turn_done":
      return withSessionId({ type: "turn_done", outcome: rawRecord.cancelled === true ? "cancelled" : "unknown" }, sessionId);
    default:
      return { type: "diagnostic", eventName: "unknown_event" };
  }
}
