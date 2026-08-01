import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  compareRuntimeIdentity,
  probeAttachedRuntime,
  type RuntimeProbeSnapshot,
} from "../src/index";
import { runCli } from "../src/cli";
import { inspectWindowsListener } from "../src/windows-process-inspector";

const endpoint = new URL("http://127.0.0.1:7777");
const safeCwd = "C:\\safe-fixture\\jarvis";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function healthyFetch(
  authOverrides: Record<string, unknown> = {},
  cwd = safeCwd,
): typeof fetch {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/health")) {
      return jsonResponse({
        status: "ok",
        claude_cli: "C:\\safe-fixture\\claude.exe",
        claude_cli_available: true,
        cwd,
      });
    }
    if (url.endsWith("/auth/status")) {
      return jsonResponse({
        needs_setup: false,
        auth_required: false,
        require_login: false,
        authed: true,
        username: "fixture-user",
        ...authOverrides,
      });
    }
    if (url.endsWith("/version")) {
      return jsonResponse({
        current: "0.9.156",
        latest: null,
        update_available: false,
        mode: "windows",
        can_self_update: false,
        error: null,
        previous_version: null,
      });
    }
    return jsonResponse({ error: "unexpected path" }, 404);
  });
}

function fetchWithHealthResponse(healthResponse: Response): typeof fetch {
  const fallback = healthyFetch();
  return vi.fn<typeof fetch>(async (input, init) => {
    if (String(input).endsWith("/health")) return healthResponse;
    return fallback(input, init);
  });
}

function snapshot(overrides: Partial<RuntimeProbeSnapshot> = {}): RuntimeProbeSnapshot {
  return {
    endpoint: "http://127.0.0.1:7777",
    capturedAt: "2026-07-24T00:00:00.000Z",
    listenerPid: 4242,
    processChain: [{ pid: 4242, parentPid: 111, name: "python.exe" }],
    health: {
      status: "ok",
      version: "0.9.156",
      authRequired: false,
      authenticated: true,
      mode: "windows",
    },
    privateIdentity: {
      cwdFingerprint: "a".repeat(64),
    },
    ...overrides,
  };
}

describe("probeAttachedRuntime", () => {
  it("reads only the three fixed paths and fingerprints the attached runtime", async () => {
    const fetchImpl = healthyFetch();
    const inspectListener = vi.fn(async () => ({
      listenerPid: 4242,
      processChain: [
        { pid: 4242, parentPid: 111, name: "python.exe" },
        { pid: 111, name: "powershell.exe" },
      ],
    }));

    const result = await probeAttachedRuntime({ endpoint, fetchImpl, inspectListener });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetchImpl).mock.calls.map(([input]) => String(input))).toEqual([
      "http://127.0.0.1:7777/health",
      "http://127.0.0.1:7777/auth/status",
      "http://127.0.0.1:7777/version",
    ]);
    for (const [, init] of vi.mocked(fetchImpl).mock.calls) {
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(inspectListener).toHaveBeenCalledWith(7777);
    expect(result.endpoint).toBe("http://127.0.0.1:7777");
    expect(result.listenerPid).toBe(4242);
    expect(result.health).toEqual({
      status: "ok",
      version: "0.9.156",
      authRequired: false,
      authenticated: true,
      mode: "windows",
    });
    expect(result.privateIdentity.cwdFingerprint).toBe(
      createHash("sha256").update(safeCwd, "utf8").digest("hex"),
    );
  });

  it("returns an offline health snapshot when the selected endpoint cannot be fetched", async () => {
    const result = await probeAttachedRuntime({
      endpoint,
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new TypeError("connection refused");
      }),
      inspectListener: async () => ({ processChain: [] }),
    });

    expect(result.health).toEqual({
      status: "offline",
      authRequired: false,
      authenticated: false,
    });
    expect(result.listenerPid).toBeUndefined();
    expect(result.privateIdentity).toEqual({});
  });

  it("preserves an auth-required state without exposing authentication material", async () => {
    const result = await probeAttachedRuntime({
      endpoint,
      fetchImpl: healthyFetch({ auth_required: true, require_login: true, authed: false }),
      inspectListener: async () => ({
        listenerPid: 4242,
        processChain: [{ pid: 4242, name: "python.exe" }],
      }),
    });

    expect(result.health.authRequired).toBe(true);
    expect(result.health.authenticated).toBe(false);
    expect(JSON.stringify(result.health)).not.toContain("fixture-user");
    expect(JSON.stringify(result.health)).not.toContain("cookie");
  });

  it("trims a valid absolute Windows cwd before fingerprinting", async () => {
    const result = await probeAttachedRuntime({
      endpoint,
      fetchImpl: healthyFetch({}, `  ${safeCwd}  `),
      inspectListener: async () => ({
        listenerPid: 4242,
        processChain: [{ pid: 4242, name: "python.exe" }],
      }),
    });

    expect(result.privateIdentity).toEqual({
      rawCwd: safeCwd,
      cwdFingerprint: createHash("sha256").update(safeCwd, "utf8").digest("hex"),
    });
  });

  it.each(["", "   ", "relative\\jarvis", "\\rooted-without-drive"])(
    "does not fingerprint invalid cwd %j",
    async (cwd) => {
      const result = await probeAttachedRuntime({
        endpoint,
        fetchImpl: healthyFetch({}, cwd),
        inspectListener: async () => ({
          listenerPid: 4242,
          processChain: [{ pid: 4242, name: "python.exe" }],
        }),
      });

      expect(result.health.status).toBe("ok");
      expect(result.privateIdentity).toEqual({});
    },
  );

  it.each([1, 80, 65_535])("accepts semantic loopback port %i at the URL boundary", async (port) => {
    const selectedEndpoint = new URL(`http://localhost:${port}`);
    const inspectListener = vi.fn(async () => ({
      listenerPid: 4242,
      processChain: [{ pid: 4242, name: "python.exe" }],
    }));

    const result = await probeAttachedRuntime({
      endpoint: selectedEndpoint,
      fetchImpl: healthyFetch(),
      inspectListener,
    });

    expect(inspectListener).toHaveBeenCalledWith(port);
    expect(result.health.status).toBe("ok");
  });

  it("rejects a response whose Content-Length exceeds the JSON limit", async () => {
    const oversizedButValidHealth = JSON.stringify({
      status: "ok",
      claude_cli: "C:\\safe-fixture\\claude.exe",
      claude_cli_available: true,
      cwd: safeCwd,
      padding: "x".repeat(70_000),
    });
    const result = await probeAttachedRuntime({
      endpoint,
      fetchImpl: fetchWithHealthResponse(new Response(oversizedButValidHealth, {
        headers: { "content-length": String(oversizedButValidHealth.length) },
      })),
      inspectListener: async () => ({
        listenerPid: 4242,
        processChain: [{ pid: 4242, name: "python.exe" }],
      }),
    });

    expect(result.health.status).toBe("offline");
    expect(result.privateIdentity).toEqual({});
  });

  it("rejects a streamed JSON body that grows beyond the byte limit", async () => {
    const encoded = new TextEncoder().encode(JSON.stringify({
      status: "ok",
      claude_cli: "C:\\safe-fixture\\claude.exe",
      claude_cli_available: true,
      cwd: safeCwd,
      padding: "x".repeat(70_000),
    }));
    const oversizedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 40_000));
        controller.enqueue(encoded.slice(40_000));
        controller.close();
      },
    });
    const result = await probeAttachedRuntime({
      endpoint,
      fetchImpl: fetchWithHealthResponse(new Response(oversizedBody)),
      inspectListener: async () => ({
        listenerPid: 4242,
        processChain: [{ pid: 4242, name: "python.exe" }],
      }),
    });

    expect(result.health.status).toBe("offline");
    expect(result.privateIdentity).toEqual({});
  });

  it.each([
    "https://127.0.0.1:7777",
    "http://192.168.1.10:7777",
    "http://user:pass@127.0.0.1:7777",
    "http://127.0.0.1:7777/health",
    "http://127.0.0.1:7777?port=7778",
    "http://127.0.0.1:7777#fragment",
  ])("rejects unsafe endpoint %s before fetching or inspecting", async (unsafeEndpoint) => {
    const fetchImpl = healthyFetch();
    const inspectListener = vi.fn(async () => ({ processChain: [] }));

    await expect(
      probeAttachedRuntime({ endpoint: new URL(unsafeEndpoint), fetchImpl, inspectListener }),
    ).rejects.toThrow("loopback HTTP origin");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(inspectListener).not.toHaveBeenCalled();
  });

  it("fails closed when listener inspection fails", async () => {
    await expect(
      probeAttachedRuntime({
        endpoint,
        fetchImpl: healthyFetch(),
        inspectListener: async () => {
          throw new Error("sensitive process detail");
        },
      }),
    ).rejects.toThrow("Listener inspection failed");
  });
});

describe("compareRuntimeIdentity", () => {
  it("accepts two samples with the same listener PID and cwd fingerprint", () => {
    expect(compareRuntimeIdentity(snapshot(), snapshot({ capturedAt: "2026-07-24T00:00:01.000Z" }))).toEqual({
      sameRuntime: true,
      reasons: [],
    });
  });

  it("rejects a changed listener PID", () => {
    expect(compareRuntimeIdentity(snapshot(), snapshot({ listenerPid: 5252 }))).toEqual({
      sameRuntime: false,
      reasons: ["listener PID changed"],
    });
  });

  it("rejects a changed cwd fingerprint", () => {
    expect(
      compareRuntimeIdentity(
        snapshot(),
        snapshot({ privateIdentity: { cwdFingerprint: "b".repeat(64) } }),
      ),
    ).toEqual({
      sameRuntime: false,
      reasons: ["cwd fingerprint changed"],
    });
  });

  it("compares normalized endpoint origins", () => {
    expect(
      compareRuntimeIdentity(
        snapshot({ endpoint: "http://LOCALHOST:80/" }),
        snapshot({ endpoint: "http://localhost" }),
      ),
    ).toEqual({ sameRuntime: true, reasons: [] });
  });

  it("rejects a changed normalized endpoint", () => {
    expect(
      compareRuntimeIdentity(snapshot(), snapshot({ endpoint: "http://127.0.0.1:7778" })),
    ).toEqual({
      sameRuntime: false,
      reasons: ["endpoint changed"],
    });
  });

  it("fails closed when a required identity signal is missing", () => {
    const missingListener = snapshot();
    delete missingListener.listenerPid;

    expect(compareRuntimeIdentity(snapshot(), missingListener)).toEqual({
      sameRuntime: false,
      reasons: ["listener PID unavailable"],
    });
  });

  it("fails closed when the cwd fingerprint is missing from either sample", () => {
    expect(compareRuntimeIdentity(snapshot(), snapshot({ privateIdentity: {} }))).toEqual({
      sameRuntime: false,
      reasons: ["cwd fingerprint unavailable"],
    });
  });
});

describe("runCli", () => {
  it("emits sanitized JSON for two matching samples", async () => {
    const outputs: string[] = [];
    const probe = vi
      .fn()
      .mockResolvedValueOnce(
        snapshot({ privateIdentity: { rawCwd: "C:\\private\\jarvis", cwdFingerprint: "a".repeat(64) } }),
      )
      .mockResolvedValueOnce(
        snapshot({ privateIdentity: { rawCwd: "C:\\private\\jarvis", cwdFingerprint: "a".repeat(64) } }),
      );

    const exitCode = await runCli(
      ["--endpoint", "http://localhost:7777", "--repeat", "2"],
      { probe, writeOutput: (output) => outputs.push(output) },
    );

    expect(exitCode).toBe(0);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(outputs).toHaveLength(1);
    const output = outputs[0] ?? "";
    expect(output).not.toContain("rawCwd");
    expect(output).not.toContain("C:\\\\private");
    expect(JSON.parse(output)).toMatchObject({
      samples: [
        { privateIdentity: { cwdFingerprint: "a".repeat(64) } },
        { privateIdentity: { cwdFingerprint: "a".repeat(64) } },
      ],
      comparison: { sameRuntime: true, reasons: [] },
    });
  });

  it("exits non-zero when a sample has no healthy listener", async () => {
    const outputs: string[] = [];
    const unhealthy = snapshot({
      health: {
        status: "offline",
        authRequired: false,
        authenticated: false,
      },
    });
    delete unhealthy.listenerPid;

    const exitCode = await runCli([], {
      probe: vi.fn().mockResolvedValue(unhealthy),
      writeOutput: (output) => outputs.push(output),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(outputs[0] ?? "{}")).toMatchObject({ samples: [{ health: { status: "offline" } }] });
  });

  it("exits non-zero when repeat samples change identity", async () => {
    const outputs: string[] = [];
    const probe = vi
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot({ listenerPid: 5252 }));

    const exitCode = await runCli(["--repeat", "2"], {
      probe,
      writeOutput: (output) => outputs.push(output),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(outputs[0] ?? "{}").comparison).toEqual({
      sameRuntime: false,
      reasons: ["listener PID changed"],
    });
  });

  it("rejects endpoint text outside the exact loopback origin forms", async () => {
    const outputs: string[] = [];
    const probe = vi.fn().mockResolvedValue(snapshot());

    const exitCode = await runCli(["--endpoint", "http://localhost:7777/."], {
      probe,
      writeOutput: (output) => outputs.push(output),
    });

    expect(exitCode).toBe(1);
    expect(probe).not.toHaveBeenCalled();
    expect(outputs).toEqual([JSON.stringify({ error: "runtime_probe_failed" })]);
  });

  it("requires an explicit port in raw CLI endpoint text even for HTTP port 80", async () => {
    const probe = vi.fn().mockResolvedValue(snapshot());

    const exitCode = await runCli(["--endpoint", "http://localhost"], {
      probe,
      writeOutput: () => undefined,
    });

    expect(exitCode).toBe(1);
    expect(probe).not.toHaveBeenCalled();
  });

  it.each([1, 80, 65_535])("accepts explicit raw CLI port %i", async (port) => {
    const probe = vi.fn().mockResolvedValue(snapshot());

    const exitCode = await runCli(["--endpoint", `http://localhost:${port}`], {
      probe,
      writeOutput: () => undefined,
    });

    expect(exitCode).toBe(0);
    const probeInput = probe.mock.calls[0]?.[0] as { endpoint: URL } | undefined;
    expect(probeInput?.endpoint.hostname).toBe("localhost");
    expect(probeInput?.endpoint.port || "80").toBe(String(port));
  });

  it("treats a missing cwd fingerprint as unhealthy", async () => {
    const missingFingerprint = snapshot({ privateIdentity: {} });

    const exitCode = await runCli([], {
      probe: vi.fn().mockResolvedValue(missingFingerprint),
      writeOutput: () => undefined,
    });

    expect(exitCode).toBe(1);
  });
});

describe("inspectWindowsListener", () => {
  it("uses powershell.exe with a fixed read-only script and returns an allowlisted process chain", async () => {
    const runner = vi.fn(async (_executable: string, _args: readonly string[]) => ({
      stdout: JSON.stringify({
        bindings: [{ localAddress: "127.0.0.1", pid: 4242 }],
        processChain: [
          { pid: 4242, parentPid: 111, name: "python.exe", commandLine: "must-not-leak" },
          { pid: 111, name: "powershell.exe", executablePath: "must-not-leak" },
        ],
      }),
    }));

    const result = await inspectWindowsListener(7777, runner);

    expect(runner).toHaveBeenCalledTimes(1);
    const [file, args] = runner.mock.calls[0] ?? [];
    expect(file).toBe("powershell.exe");
    expect(args).toContain("-NoProfile");
    expect(args?.at(-1)).toContain("Get-NetTCPConnection");
    expect(args?.at(-1)).toContain("Get-CimInstance Win32_Process");
    expect(args?.at(-1)).toContain("LocalAddress");
    expect(args?.at(-1)).not.toContain("Where-Object");
    expect(args?.at(-1)).toContain("7777");
    expect(result).toEqual({
      listenerPid: 4242,
      processChain: [
        { pid: 4242, parentPid: 111, name: "python.exe" },
        { pid: 111, name: "powershell.exe" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("localAddress");
    expect(JSON.stringify(result)).not.toContain("127.0.0.1");
  });

  it("accepts an IPv6 loopback listener", async () => {
    const runner = vi.fn(async () => ({
      stdout: JSON.stringify({
        bindings: [{ localAddress: "::1", pid: 4242 }],
        processChain: [{ pid: 4242, name: "python.exe" }],
      }),
    }));

    await expect(inspectWindowsListener(7777, runner)).resolves.toEqual({
      listenerPid: 4242,
      processChain: [{ pid: 4242, name: "python.exe" }],
    });
  });

  it("deduplicates repeated IPv4 and IPv6 loopback bindings owned by one PID", async () => {
    const runner = vi.fn(async () => ({
      stdout: JSON.stringify({
        bindings: [
          { localAddress: "127.0.0.1", pid: 4242 },
          { localAddress: "127.0.0.1", pid: 4242 },
          { localAddress: "::1", pid: 4242 },
        ],
        processChain: [{ pid: 4242, name: "python.exe" }],
      }),
    }));

    await expect(inspectWindowsListener(7777, runner)).resolves.toEqual({
      listenerPid: 4242,
      processChain: [{ pid: 4242, name: "python.exe" }],
    });
  });

  it("returns an empty chain only when there is no listener", async () => {
    const runner = vi.fn(async () => ({
      stdout: JSON.stringify({ bindings: [], processChain: [] }),
    }));

    await expect(inspectWindowsListener(7777, runner)).resolves.toEqual({ processChain: [] });
  });

  it.each([
    {
      name: "IPv4 wildcard only",
      bindings: [{ localAddress: "0.0.0.0", pid: 4242 }],
      processChain: [{ pid: 4242, name: "python.exe" }],
    },
    {
      name: "IPv6 wildcard only",
      bindings: [{ localAddress: "::", pid: 4242 }],
      processChain: [{ pid: 4242, name: "python.exe" }],
    },
    {
      name: "mixed loopback and wildcard for one owner",
      bindings: [
        { localAddress: "127.0.0.1", pid: 4242 },
        { localAddress: "0.0.0.0", pid: 4242 },
      ],
      processChain: [{ pid: 4242, name: "python.exe" }],
    },
    {
      name: "non-loopback address",
      bindings: [{ localAddress: "192.168.1.20", pid: 4242 }],
      processChain: [{ pid: 4242, name: "python.exe" }],
    },
    {
      name: "multiple loopback owners",
      bindings: [
        { localAddress: "127.0.0.1", pid: 4242 },
        { localAddress: "::1", pid: 5252 },
      ],
      processChain: [],
    },
    {
      name: "control character in address",
      bindings: [{ localAddress: "127.0.0.1\nprivate", pid: 4242 }],
      processChain: [{ pid: 4242, name: "python.exe" }],
    },
    {
      name: "path-bearing address",
      bindings: [{ localAddress: "C:\\private\\listener", pid: 4242 }],
      processChain: [{ pid: 4242, name: "python.exe" }],
    },
    {
      name: "non-string address",
      bindings: [{ localAddress: 127, pid: 4242 }],
      processChain: [{ pid: 4242, name: "python.exe" }],
    },
  ])("rejects unsafe listener bindings: $name", async ({ bindings, processChain }) => {
    const runner = vi.fn(async () => ({
      stdout: JSON.stringify({ bindings, processChain }),
    }));

    await expect(inspectWindowsListener(7777, runner)).rejects.toThrow(
      "Windows listener inspection returned invalid data",
    );
  });

  it.each([
    {
      name: "no listener with a process chain",
      data: { bindings: [], processChain: [{ pid: 4242, name: "python.exe" }] },
    },
    {
      name: "listener with an empty chain",
      data: { bindings: [{ localAddress: "127.0.0.1", pid: 4242 }], processChain: [] },
    },
    {
      name: "chain starting at another PID",
      data: {
        bindings: [{ localAddress: "127.0.0.1", pid: 4242 }],
        processChain: [{ pid: 5252, name: "python.exe" }],
      },
    },
    {
      name: "duplicate process PID",
      data: {
        bindings: [{ localAddress: "127.0.0.1", pid: 4242 }],
        processChain: [
          { pid: 4242, parentPid: 4242, name: "python.exe" },
          { pid: 4242, name: "python.exe" },
        ],
      },
    },
    {
      name: "unlinked parent PID",
      data: {
        bindings: [{ localAddress: "127.0.0.1", pid: 4242 }],
        processChain: [
          { pid: 4242, parentPid: 9999, name: "python.exe" },
          { pid: 111, name: "cmd.exe" },
        ],
      },
    },
    {
      name: "path-bearing executable name",
      data: {
        bindings: [{ localAddress: "127.0.0.1", pid: 4242 }],
        processChain: [{ pid: 4242, name: "C:\\private\\python.exe" }],
      },
    },
    {
      name: "drive-relative executable name",
      data: {
        bindings: [{ localAddress: "127.0.0.1", pid: 4242 }],
        processChain: [{ pid: 4242, name: "C:python.exe" }],
      },
    },
    {
      name: "control character in executable name",
      data: {
        bindings: [{ localAddress: "127.0.0.1", pid: 4242 }],
        processChain: [{ pid: 4242, name: "python\n.exe" }],
      },
    },
    {
      name: "overlong executable name",
      data: {
        bindings: [{ localAddress: "127.0.0.1", pid: 4242 }],
        processChain: [{ pid: 4242, name: "x".repeat(256) }],
      },
    },
  ])("rejects contradictory or unsafe inspector data: $name", async ({ data }) => {
    const runner = vi.fn(async () => ({ stdout: JSON.stringify(data) }));

    await expect(inspectWindowsListener(7777, runner)).rejects.toThrow(
      "Windows listener inspection returned invalid data",
    );
  });

  it("bounds an injected runner that never resolves", async () => {
    const runner = vi.fn(() => new Promise<{ stdout: string }>(() => undefined));

    await expect(inspectWindowsListener(7777, runner, 5)).rejects.toThrow(
      "Windows listener inspection timed out",
    );
  });

  it.each([0, -1, 65536, 7777.5, Number.NaN])("rejects invalid port %s before starting PowerShell", async (port) => {
    const runner = vi.fn(async () => ({ stdout: "{}" }));

    await expect(inspectWindowsListener(port, runner)).rejects.toThrow("valid TCP port");
    expect(runner).not.toHaveBeenCalled();
  });
});
