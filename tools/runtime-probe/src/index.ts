import { createHash } from "node:crypto";

import {
  projectHealthSnapshot,
  rawAuthStatusSchema,
  rawHealthSchema,
  rawVersionSchema,
  type HealthSnapshot,
} from "@iris/contracts";

import { inspectWindowsListener } from "./windows-process-inspector";

const FETCH_TIMEOUT_MS = 5_000;
const MAX_JSON_BYTES = 64 * 1024;

export type RuntimeProbeSnapshot = {
  endpoint: string;
  capturedAt: string;
  listenerPid?: number;
  processChain: Array<{ pid: number; parentPid?: number; name: string }>;
  health: HealthSnapshot;
  privateIdentity: {
    rawCwd?: string;
    cwdFingerprint?: string;
  };
};

export type ListenerInspection = {
  listenerPid?: number;
  processChain: RuntimeProbeSnapshot["processChain"];
};

function validateLoopbackEndpoint(endpoint: URL): { origin: string; port: number } {
  const isLoopbackHost = endpoint.hostname === "127.0.0.1" || endpoint.hostname === "localhost";
  const port = endpoint.port === "" ? 80 : Number(endpoint.port);
  const isValidPort = Number.isInteger(port) && port >= 1 && port <= 65_535;
  const isOriginOnly = endpoint.pathname === "/" && endpoint.search === "" && endpoint.hash === "";
  const hasNoCredentials = endpoint.username === "" && endpoint.password === "";

  if (
    endpoint.protocol !== "http:" ||
    !isLoopbackHost ||
    !isValidPort ||
    !isOriginOnly ||
    !hasNoCredentials
  ) {
    throw new Error("Endpoint must be a loopback HTTP origin with a valid port");
  }

  return { origin: endpoint.origin, port };
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchImpl(url, {
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Selected endpoint returned an unhealthy response");

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null) {
    if (!/^\d+$/.test(contentLengthHeader)) {
      throw new Error("Selected endpoint returned an invalid JSON length");
    }
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength > MAX_JSON_BYTES) {
      throw new Error("Selected endpoint returned an oversized JSON response");
    }
  }

  if (response.body === null) {
    throw new Error("Selected endpoint returned an empty JSON response");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new Error("Selected endpoint returned an oversized JSON response");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text) as unknown;
}

function normalizedWindowsCwd(rawCwd: string): string | undefined {
  const cwd = rawCwd.trim();
  const driveAbsolute = /^[A-Za-z]:[\\/]/.test(cwd);
  const uncAbsolute = /^\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/.test(cwd);
  return cwd !== "" && (driveAbsolute || uncAbsolute) ? cwd : undefined;
}

function normalizedEndpointOrigin(endpoint: string): string | undefined {
  try {
    const url = new URL(endpoint);
    const { origin } = validateLoopbackEndpoint(url);
    return origin;
  } catch {
    return undefined;
  }
}

function offlineHealth(): HealthSnapshot {
  return {
    status: "offline",
    authRequired: false,
    authenticated: false,
  };
}

function createSnapshotBase(
  origin: string,
  inspection: ListenerInspection,
): Pick<RuntimeProbeSnapshot, "endpoint" | "capturedAt" | "listenerPid" | "processChain"> {
  const base: Pick<RuntimeProbeSnapshot, "endpoint" | "capturedAt" | "listenerPid" | "processChain"> = {
    endpoint: origin,
    capturedAt: new Date().toISOString(),
    processChain: inspection.processChain,
  };
  if (inspection.listenerPid !== undefined) base.listenerPid = inspection.listenerPid;
  return base;
}

export async function probeAttachedRuntime(input: {
  endpoint: URL;
  fetchImpl?: typeof fetch;
  inspectListener?: (port: number) => Promise<ListenerInspection>;
}): Promise<RuntimeProbeSnapshot> {
  const { origin, port } = validateLoopbackEndpoint(input.endpoint);
  const inspectListener = input.inspectListener ?? inspectWindowsListener;

  let inspection: ListenerInspection;
  try {
    inspection = await inspectListener(port);
  } catch {
    throw new Error("Listener inspection failed");
  }

  const base = createSnapshotBase(origin, inspection);
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const [rawHealth, rawAuth, rawVersion] = await Promise.all([
      fetchJson(fetchImpl, `${origin}/health`),
      fetchJson(fetchImpl, `${origin}/auth/status`),
      fetchJson(fetchImpl, `${origin}/version`),
    ]);
    const health = rawHealthSchema.parse(rawHealth);
    const auth = rawAuthStatusSchema.parse(rawAuth);
    const version = rawVersionSchema.parse(rawVersion);
    const cwd = normalizedWindowsCwd(health.cwd);
    const privateIdentity: RuntimeProbeSnapshot["privateIdentity"] = {};
    if (cwd !== undefined) {
      privateIdentity.rawCwd = cwd;
      privateIdentity.cwdFingerprint = createHash("sha256").update(cwd, "utf8").digest("hex");
    }

    return {
      ...base,
      health: projectHealthSnapshot(health, auth, version),
      privateIdentity,
    };
  } catch {
    return {
      ...base,
      health: offlineHealth(),
      privateIdentity: {},
    };
  }
}

export function compareRuntimeIdentity(
  first: RuntimeProbeSnapshot,
  second: RuntimeProbeSnapshot,
): { sameRuntime: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const firstEndpoint = normalizedEndpointOrigin(first.endpoint);
  const secondEndpoint = normalizedEndpointOrigin(second.endpoint);
  if (firstEndpoint === undefined || secondEndpoint === undefined || firstEndpoint !== secondEndpoint) {
    reasons.push("endpoint changed");
  }

  if (first.listenerPid === undefined || second.listenerPid === undefined) {
    reasons.push("listener PID unavailable");
  } else if (first.listenerPid !== second.listenerPid) {
    reasons.push("listener PID changed");
  }

  const firstFingerprint = first.privateIdentity.cwdFingerprint;
  const secondFingerprint = second.privateIdentity.cwdFingerprint;
  if (firstFingerprint === undefined || secondFingerprint === undefined) {
    reasons.push("cwd fingerprint unavailable");
  } else if (firstFingerprint !== secondFingerprint) {
    reasons.push("cwd fingerprint changed");
  }

  return { sameRuntime: reasons.length === 0, reasons };
}
