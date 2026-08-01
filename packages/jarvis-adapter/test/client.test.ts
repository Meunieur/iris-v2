import { describe, expect, it, vi } from "vitest";

import { parseAttachedEndpoint } from "../src/endpoint";
import { JarvisReadClient, type JarvisTransport } from "../src/client";

const endpoint = parseAttachedEndpoint("http://127.0.0.1:7777");
const now = () => new Date("2026-07-24T06:30:00.000Z");

const health = {
  status: "ok",
  claude_cli: "C:\\private\\claude.exe",
  claude_cli_available: true,
  cwd: "E:\\private\\JarvisOS",
  api_key: "raw-health-secret",
};

const lockedAuth = {
  needs_setup: false,
  auth_required: true,
  require_login: true,
  authed: false,
  username: "",
};

const authenticated = {
  ...lockedAuth,
  authed: true,
  username: "operator",
  cookie: "raw-auth-cookie",
};

const version = {
  current: "0.9.156",
  latest: null,
  update_available: false,
  mode: "windows",
  can_self_update: true,
  error: null,
  previous_version: null,
};

const brains = {
  dir: "E:\\private\\JarvisOS\\brains",
  brains: [
    {
      name: "default",
      path: "E:\\private\\JarvisOS\\brains\\default",
      notes: 12,
      is_default: true,
      secret: "raw-brain-secret",
    },
  ],
};

const sessions = {
  sessions: [
    {
      id: "session-public-id",
      title: "Architecture review",
      brain: "E:\\private\\JarvisOS\\brains\\default",
      engine: "codex",
      model: "gpt-test",
      cli_session_id: "private-cli-session",
      created_at: 1784871000,
      updated_at: 1784872000,
      msg_count: 4,
      preview: "private session preview",
      access_token: "raw-session-secret",
    },
  ],
};

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function routeTransport(routes: Record<string, Response | (() => Response | Promise<Response>)>) {
  const requests: Array<{ init: RequestInit; url: URL }> = [];
  const transport: JarvisTransport = {
    fetch: vi.fn(async (url, init) => {
      requests.push({ url, init });
      const route = routes[`${url.pathname}${url.search}`];
      if (route === undefined) throw new Error(`Unexpected route: ${url.pathname}${url.search}`);
      return typeof route === "function" ? route() : route.clone();
    }),
  };
  return { requests, transport };
}

describe("JarvisReadClient", () => {
  it("reads only public state while sign-in is required", async () => {
    const { requests, transport } = routeTransport({
      "/health": jsonResponse(health),
      "/auth/status": jsonResponse(lockedAuth),
      "/version": jsonResponse(version),
    });
    const client = new JarvisReadClient({ endpoint, transport, now });

    const snapshot = await client.read(7);

    expect(requests.map(({ url }) => `${url.pathname}${url.search}`)).toEqual([
      "/health",
      "/auth/status",
      "/version",
    ]);
    expect(requests.every(({ init }) => init.method === "GET")).toBe(true);
    expect(requests.every(({ init }) => init.redirect === "error")).toBe(true);
    expect(requests.every(({ init }) => init.credentials === "include")).toBe(true);
    expect(snapshot).toEqual({
      sequence: 7,
      capturedAt: "2026-07-24T06:30:00.000Z",
      endpoint: "http://127.0.0.1:7777/",
      connection: "sign_in_required",
      health: {
        status: "ok",
        version: "0.9.156",
        authRequired: true,
        authenticated: false,
        mode: "windows",
      },
      brains: [],
      sessions: [],
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.health)).toBe(true);
    expect(Object.isFrozen(snapshot.brains)).toBe(true);
  });

  it("reads protected state after authentication and emits public projections only", async () => {
    const { requests, transport } = routeTransport({
      "/health": jsonResponse(health),
      "/auth/status": jsonResponse(authenticated),
      "/version": jsonResponse(version),
      "/brains": jsonResponse(brains),
      "/sessions?limit=50": jsonResponse(sessions),
    });
    const client = new JarvisReadClient({ endpoint, transport, now });

    const snapshot = await client.read(8);
    const serialized = JSON.stringify(snapshot);

    expect(requests.map(({ url }) => `${url.pathname}${url.search}`)).toEqual([
      "/health",
      "/auth/status",
      "/version",
      "/brains",
      "/sessions?limit=50",
    ]);
    expect(snapshot.connection).toBe("ready");
    expect(snapshot.brains).toEqual([
      expect.objectContaining({ name: "default", notes: 12, isDefault: true }),
    ]);
    expect(snapshot.sessions).toEqual([
      expect.objectContaining({
        id: "session-public-id",
        title: "Architecture review",
        engine: "codex",
        model: "gpt-test",
        messageCount: 4,
      }),
    ]);
    expect(serialized).not.toContain("E:\\\\private");
    expect(serialized).not.toContain("cli_session_id");
    expect(serialized).not.toContain("private-cli-session");
    expect(serialized).not.toContain("preview");
    expect(serialized).not.toContain("private session preview");
    expect(serialized).not.toContain("raw-");
    expect(Object.isFrozen(snapshot.sessions[0])).toBe(true);
  });

  it("treats a stale protected-session 401 as sign-in required", async () => {
    const { transport } = routeTransport({
      "/health": jsonResponse(health),
      "/auth/status": jsonResponse(authenticated),
      "/version": jsonResponse(version),
      "/brains": jsonResponse({ detail: "sign in" }, 401),
    });
    const client = new JarvisReadClient({ endpoint, transport, now });

    await expect(client.read(9)).resolves.toMatchObject({
      connection: "sign_in_required",
      brains: [],
      sessions: [],
      errorCode: "unauthorized",
    });
  });

  it.each([
    {
      name: "redirect",
      expected: "invalid_response",
      response: new Response(null, { status: 302, headers: { location: "http://example.com" } }),
    },
    {
      name: "wrong content type",
      expected: "invalid_response",
      response: new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } }),
    },
    {
      name: "malformed JSON",
      expected: "invalid_response",
      response: new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
    },
    {
      name: "oversized content length",
      expected: "oversized_response",
      response: new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "65537" },
      }),
    },
    {
      name: "oversized streamed body",
      expected: "oversized_response",
      response: new Response(JSON.stringify({ padding: "x".repeat(70_000) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    },
  ])("fails closed for $name", async ({ expected, response }) => {
    const { transport } = routeTransport({ "/health": response });
    const client = new JarvisReadClient({ endpoint, transport, now });

    const snapshot = await client.read(10);

    expect(snapshot).toMatchObject({
      connection: "offline",
      errorCode: expected,
      brains: [],
      sessions: [],
    });
    expect(JSON.stringify(snapshot)).not.toContain("not-json");
  });

  it("maps timeout failures without exposing exception text", async () => {
    const secretMessage = "Bearer private-timeout-token";
    const transport: JarvisTransport = {
      fetch: vi.fn(async () => {
        throw new DOMException(secretMessage, "TimeoutError");
      }),
    };
    const client = new JarvisReadClient({ endpoint, transport, now });

    const snapshot = await client.read(11);

    expect(snapshot).toMatchObject({ connection: "offline", errorCode: "timeout" });
    expect(JSON.stringify(snapshot)).not.toContain(secretMessage);
  });
});
