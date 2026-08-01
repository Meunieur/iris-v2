import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseAttachedEndpoint, type JarvisTransport, type Scheduler } from "../src/index";
import { createAttachedRuntime } from "../../../apps/desktop/src/main/runtime";

type ServerMode = "normal" | "redirect" | "delay";

const requests: Array<{ method: string; url: string }> = [];
let mode: ServerMode = "normal";
let endpoint: URL;
let closeServer: () => Promise<void>;

const health = {
  status: "ok",
  claude_cli: "C:\\private\\claude.exe",
  claude_cli_available: true,
  cwd: "E:\\private\\JarvisOS",
};
const version = {
  current: "0.9.156",
  latest: null,
  update_available: false,
  mode: "windows",
  can_self_update: false,
  error: null,
  previous_version: null,
};
const brains = {
  dir: "E:\\private\\JarvisOS\\brains",
  brains: [{ name: "default", path: "E:\\private\\JarvisOS\\brains\\default", notes: 2, is_default: true }],
};
const sessions = {
  sessions: [{
    id: "session-public",
    title: "Local integration",
    brain: "E:\\private\\JarvisOS\\brains\\default",
    engine: "codex",
    model: "gpt-test",
    cli_session_id: "private-cli-id",
    created_at: 1784871000,
    updated_at: 1784872000,
    msg_count: 2,
    preview: "private preview",
  }],
};
const graph = {
  nodes: [{
    id: "private-node-id",
    label: "Architecture",
    folder: "wiki",
    color: "#9b8cff",
    path: "default/wiki/Architecture.md",
    fullpath: "E:\\private\\JarvisOS\\brains\\default\\wiki\\Architecture.md",
    links: 0,
    t: 1_784_872_000,
  }],
  edges: [],
  categories: [{ name: "wiki", count: 1 }],
  stats: { total_notes: 1, total_links: 0, orphans: 1, hidden: 0 },
};

function sendJson(response: ServerResponse, body: unknown, status = 200): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function isAuthenticated(request: IncomingMessage): boolean {
  return request.headers.cookie === "javis_session=synthetic-session";
}

beforeAll(async () => {
  const server = createServer((request, response) => {
    requests.push({ method: request.method ?? "", url: request.url ?? "" });
    if (request.url === "/health") {
      if (mode === "redirect") {
        response.writeHead(302, { location: "http://example.com/" });
        response.end();
        return;
      }
      if (mode === "delay") {
        setTimeout(() => sendJson(response, health), 120);
        return;
      }
      sendJson(response, health);
      return;
    }
    if (request.url === "/auth/status") {
      const authed = isAuthenticated(request);
      sendJson(response, {
        needs_setup: false,
        auth_required: true,
        require_login: !authed,
        authed,
        username: authed ? "operator" : "",
      });
      return;
    }
    if (request.url === "/version") {
      sendJson(response, version);
      return;
    }
    if (request.url === "/brains") {
      sendJson(response, isAuthenticated(request) ? brains : { detail: "sign in" }, isAuthenticated(request) ? 200 : 401);
      return;
    }
    if (request.url === "/sessions?limit=50") {
      sendJson(response, isAuthenticated(request) ? sessions : { detail: "sign in" }, isAuthenticated(request) ? 200 : 401);
      return;
    }
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/graph") {
      const validPath = requestUrl.searchParams.get("path") === brains.brains[0]?.path;
      const validOrphans = requestUrl.searchParams.get("orphans") === "0";
      const accepted = isAuthenticated(request) && validPath && validOrphans;
      sendJson(response, accepted ? graph : { detail: "sign in or invalid catalog path" }, accepted ? 200 : 401);
      return;
    }
    sendJson(response, { detail: "not found" }, 404);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Integration server did not bind TCP");
  endpoint = parseAttachedEndpoint(`http://127.0.0.1:${address.port}`);
  closeServer = () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

afterAll(async () => closeServer());

const noRetryScheduler: Scheduler = {
  set: () => 1,
  clear: () => undefined,
};

function transport(cookie?: string, timeoutMs?: number): JarvisTransport {
  return {
    fetch: (url, init) => {
      const headers = new Headers(init.headers);
      if (cookie !== undefined) headers.set("cookie", cookie);
      const signal = timeoutMs === undefined
        ? init.signal
        : AbortSignal.any([init.signal ?? AbortSignal.timeout(5_000), AbortSignal.timeout(timeoutMs)]);
      const requestInit: RequestInit = signal === undefined
        ? { ...init, headers }
        : { ...init, headers, signal };
      return fetch(url, requestInit);
    },
  };
}

describe("attached runtime local HTTP integration", () => {
  it("stays public-only until the main-process session is authenticated", async () => {
    mode = "normal";
    requests.length = 0;
    const runtime = createAttachedRuntime({ endpoint, transport: transport(), scheduler: noRetryScheduler });

    const locked = await runtime.controller.refresh();

    expect(locked.connection).toBe("sign_in_required");
    expect(requests).toEqual([
      { method: "GET", url: "/health" },
      { method: "GET", url: "/auth/status" },
      { method: "GET", url: "/version" },
    ]);
  });

  it("reads public projections after the session supplies its private cookie", async () => {
    mode = "normal";
    requests.length = 0;
    const runtime = createAttachedRuntime({
      endpoint,
      transport: transport("javis_session=synthetic-session"),
      scheduler: noRetryScheduler,
    });

    const ready = await runtime.controller.refresh();
    const knowledge = await runtime.client.readKnowledge(ready.brains[0]?.id ?? "brain_missing");
    const serialized = JSON.stringify(ready);
    const knowledgeSerialized = JSON.stringify(knowledge);

    expect(ready.connection).toBe("ready");
    expect(ready.brains[0]).toMatchObject({ name: "default", notes: 2, isDefault: true });
    expect(ready.sessions[0]).toMatchObject({ id: "session-public", title: "Local integration", messageCount: 2 });
    expect(knowledge).toMatchObject({
      state: "ready",
      brain: { name: "default" },
      graph: { nodes: [{ label: "Architecture" }], stats: { returnedNodes: 1 } },
    });
    expect(requests.map(({ url }) => new URL(url, "http://127.0.0.1").pathname)).toEqual([
      "/health",
      "/auth/status",
      "/version",
      "/brains",
      "/sessions",
      "/graph",
    ]);
    expect(requests.every(({ method }) => method === "GET")).toBe(true);
    expect(serialized).not.toContain("E:\\\\private");
    expect(serialized).not.toContain("private-cli-id");
    expect(serialized).not.toContain("private preview");
    expect(serialized).not.toContain("synthetic-session");
    expect(knowledgeSerialized).not.toContain("E:\\\\private");
    expect(knowledgeSerialized).not.toContain("private-node-id");
    expect(knowledgeSerialized).not.toContain("fullpath");
  });

  it("denies redirects at the transport boundary", async () => {
    mode = "redirect";
    requests.length = 0;
    const runtime = createAttachedRuntime({ endpoint, transport: transport(), scheduler: noRetryScheduler });

    await expect(runtime.controller.refresh()).resolves.toMatchObject({
      connection: "reconnecting",
      errorCode: "unreachable",
    });
    expect(requests).toEqual([{ method: "GET", url: "/health" }]);
  });

  it("maps a delayed local response to timeout without issuing mutation", async () => {
    mode = "delay";
    requests.length = 0;
    const runtime = createAttachedRuntime({ endpoint, transport: transport(undefined, 25), scheduler: noRetryScheduler });

    await expect(runtime.controller.refresh()).resolves.toMatchObject({
      connection: "reconnecting",
      errorCode: "timeout",
    });
    expect(requests).toEqual([{ method: "GET", url: "/health" }]);
  });
});
