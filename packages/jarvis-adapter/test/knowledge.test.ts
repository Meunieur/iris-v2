import { describe, expect, it, vi } from "vitest";

import { JarvisReadClient, type JarvisTransport } from "../src/index";

const endpoint = new URL("http://127.0.0.1:7777/");
const now = () => new Date("2026-07-31T03:00:00.000Z");
const privateBrainPath = "E:\\private\\JarvisOS\\brains\\Brain Default";

const health = {
  status: "ok",
  claude_cli: "C:\\private\\claude.exe",
  claude_cli_available: true,
  cwd: "E:\\private\\JarvisOS",
};
const version = {
  current: "0.9.270",
  latest: "0.9.274",
  update_available: true,
  mode: "windows",
  can_self_update: true,
  error: null,
  previous_version: "0.9.269",
};
const authenticated = {
  needs_setup: false,
  auth_required: true,
  require_login: false,
  authed: true,
  username: "operator",
};
const locked = { ...authenticated, require_login: true, authed: false, username: "" };
const brains = {
  dir: "E:\\private\\JarvisOS\\brains",
  brains: [{ name: "Brain Default", path: privateBrainPath, notes: 8, is_default: true }],
};
const sessions = { sessions: [] };
const graph = {
  nodes: [{
    id: "private-raw-node",
    label: "Architecture",
    folder: "wiki",
    color: "#9b8cff",
    path: "Brain Default/wiki/Architecture.md",
    fullpath: `${privateBrainPath}\\wiki\\Architecture.md`,
    links: 0,
    t: 1_785_000_000,
  }],
  edges: [],
  categories: [{ name: "wiki", count: 1 }],
  stats: { total_notes: 1, total_links: 0, orphans: 1, hidden: 0 },
};

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

type RouteTable = Record<string, Response | (() => Response | Promise<Response>)>;

function routeTransport(routes: RouteTable) {
  const requests: Array<{ init: RequestInit; url: URL }> = [];
  const transport: JarvisTransport = {
    fetch: vi.fn(async (url, init) => {
      requests.push({ url: new URL(url.href), init });
      const route = routes[`${url.pathname}${url.search}`];
      if (route === undefined) throw new Error(`Unexpected route: ${url.pathname}${url.search}`);
      return typeof route === "function" ? route() : route.clone();
    }),
  };
  return { requests, transport };
}

function baseRoutes(graphResponse: Response = jsonResponse(graph)): RouteTable {
  const graphRequest = new URL("graph", endpoint);
  graphRequest.searchParams.set("path", privateBrainPath);
  graphRequest.searchParams.set("orphans", "0");
  const graphUrl = `${graphRequest.pathname}${graphRequest.search}`;
  return {
    "/health": jsonResponse(health),
    "/auth/status": jsonResponse(authenticated),
    "/version": jsonResponse(version),
    "/brains": jsonResponse(brains),
    "/sessions?limit=50": jsonResponse(sessions),
    [graphUrl]: graphResponse,
  };
}

describe("JarvisReadClient Second Brain bridge", () => {
  it("loads a public graph only through the latest authenticated brain catalog", async () => {
    const { requests, transport } = routeTransport(baseRoutes());
    const client = new JarvisReadClient({ endpoint, transport, now });
    const base = await client.read(1);
    const brainId = base.brains[0]?.id;
    expect(brainId).toBeDefined();

    const knowledge = await client.readKnowledge(brainId as `brain_${string}`);
    const serialized = JSON.stringify(knowledge);
    const graphRequest = requests.at(-1);

    expect(knowledge).toMatchObject({
      state: "ready",
      capturedAt: "2026-07-31T03:00:00.000Z",
      brain: { id: brainId, name: "Brain Default", notes: 8, isDefault: true },
      graph: { stats: { returnedNodes: 1, returnedEdges: 0, truncated: false } },
    });
    expect(graphRequest?.url.pathname).toBe("/graph");
    expect(graphRequest?.url.searchParams.get("path")).toBe(privateBrainPath);
    expect(graphRequest?.url.searchParams.get("orphans")).toBe("0");
    expect(graphRequest?.init.method).toBe("GET");
    expect(serialized).not.toContain("E:\\\\private");
    expect(serialized).not.toContain("private-raw-node");
    expect(serialized).not.toContain("fullpath");
    expect(Object.isFrozen(knowledge)).toBe(true);
  });

  it("keeps the Second Brain catalog available when only the session list is malformed", async () => {
    const routes = baseRoutes();
    routes["/sessions?limit=50"] = jsonResponse({ sessions: [{ id: "legacy-invalid-session" }] });
    const { transport } = routeTransport(routes);
    const client = new JarvisReadClient({ endpoint, transport, now });

    const degraded = await client.read(1);
    const brainId = degraded.brains[0]?.id as `brain_${string}`;

    expect(degraded).toMatchObject({
      connection: "degraded",
      errorCode: "invalid_response",
      brains: [{ name: "Brain Default" }],
      sessions: [],
    });
    await expect(client.readKnowledge(brainId)).resolves.toMatchObject({ state: "ready" });
  });

  it("fails closed for unknown brain IDs without making a graph request", async () => {
    const { requests, transport } = routeTransport(baseRoutes());
    const client = new JarvisReadClient({ endpoint, transport, now });
    await client.read(1);
    const requestCount = requests.length;

    await expect(client.readKnowledge(`brain_${"f".repeat(64)}`)).resolves.toMatchObject({
      state: "unavailable",
      errorCode: "unknown_brain",
    });
    expect(requests).toHaveLength(requestCount);
  });

  it("clears the private catalog when authentication is lost", async () => {
    let authed = true;
    const routes = baseRoutes();
    routes["/auth/status"] = () => jsonResponse(authed ? authenticated : locked);
    const { requests, transport } = routeTransport(routes);
    const client = new JarvisReadClient({ endpoint, transport, now });
    const ready = await client.read(1);
    const brainId = ready.brains[0]?.id as `brain_${string}`;

    authed = false;
    await client.read(2);
    const requestCount = requests.length;

    await expect(client.readKnowledge(brainId)).resolves.toMatchObject({ state: "sign_in_required" });
    expect(requests).toHaveLength(requestCount);
  });

  it("accepts a bounded graph body above the base 64 KiB read limit", async () => {
    const largeGraph = { ...graph, forward_padding: "x".repeat(70_000) };
    const { transport } = routeTransport(baseRoutes(jsonResponse(largeGraph)));
    const client = new JarvisReadClient({ endpoint, transport, now });
    const ready = await client.read(1);

    await expect(client.readKnowledge(ready.brains[0]?.id as `brain_${string}`)).resolves.toMatchObject({
      state: "ready",
    });
  });

  it("rejects a graph declared above 2 MiB without parsing its body", async () => {
    const tooLarge = new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-length": String((2 * 1024 * 1024) + 1),
      },
    });
    const { transport } = routeTransport(baseRoutes(tooLarge));
    const client = new JarvisReadClient({ endpoint, transport, now });
    const ready = await client.read(1);

    await expect(client.readKnowledge(ready.brains[0]?.id as `brain_${string}`)).resolves.toMatchObject({
      state: "unavailable",
      errorCode: "oversized_response",
    });
  });
});
