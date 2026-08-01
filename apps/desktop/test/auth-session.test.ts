import { describe, expect, it, vi } from "vitest";

import {
  JarvisAuthSession,
  createSessionTransport,
  type AuthWindowLike,
} from "../src/main/auth-session";
import { AUTH_PARTITION } from "../src/main/security";
import type { Scheduler } from "@iris/jarvis-adapter";

class TestScheduler implements Scheduler {
  readonly tasks = new Map<number, () => void>();
  readonly set = vi.fn((_delayMs: number, task: () => void) => {
    const handle = this.tasks.size + 1;
    this.tasks.set(handle, task);
    return handle;
  });
  readonly clear = vi.fn((handle: unknown) => {
    this.tasks.delete(handle as number);
  });

  run(handle: number): void {
    const task = this.tasks.get(handle);
    if (task === undefined) throw new Error(`Missing auth task ${handle}`);
    this.tasks.delete(handle);
    task();
  }
}

function authResponse(authed: boolean): Response {
  return new Response(JSON.stringify({
    needs_setup: false,
    auth_required: true,
    require_login: !authed,
    authed,
    username: authed ? "operator" : "",
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fakeWindow(): AuthWindowLike & {
  closed: () => void;
  navigation: (url: string) => { prevented: boolean };
  windowOpen: (url: string) => { action: "deny" };
} {
  let closedListener: () => void = () => undefined;
  let navigationListener = (_event: { preventDefault(): void }, _url: string) => undefined;
  let openHandler = (_details: { url: string }) => ({ action: "deny" as const });
  let destroyed = false;
  const window = {
    close: vi.fn(() => {
      destroyed = true;
      closedListener();
    }),
    focus: vi.fn(),
    isDestroyed: vi.fn(() => destroyed),
    loadURL: vi.fn(async () => undefined),
    on: vi.fn((_event: "closed", listener: () => void) => {
      closedListener = listener;
    }),
    show: vi.fn(),
    webContents: {
      on: vi.fn((_event: "will-navigate" | "will-redirect", listener: typeof navigationListener) => {
        navigationListener = listener;
      }),
      setWindowOpenHandler: vi.fn((handler: typeof openHandler) => {
        openHandler = handler;
      }),
    },
    closed: () => closedListener(),
    navigation: (url: string) => {
      let prevented = false;
      navigationListener({ preventDefault: () => { prevented = true; } }, url);
      return { prevented };
    },
    windowOpen: (url: string) => openHandler({ url }),
  } satisfies AuthWindowLike & {
    closed: () => void;
    navigation: (url: string) => { prevented: boolean };
    windowOpen: (url: string) => { action: "deny" };
  };
  return window;
}

describe("createSessionTransport", () => {
  it("uses session.fetch with included credentials and never reads cookies", async () => {
    const fetch = vi.fn(async () => authResponse(false));
    const session = {
      fetch,
      get cookies(): never {
        throw new Error("cookies must remain private");
      },
    };
    const transport = createSessionTransport(session);
    const url = new URL("http://127.0.0.1:7777/auth/status");

    await transport.fetch(url, { method: "GET", credentials: "omit" });

    expect(fetch).toHaveBeenCalledWith(url.href, expect.objectContaining({
      method: "GET",
      credentials: "include",
    }));
  });
});

describe("JarvisAuthSession", () => {
  it("denies permissions, popups, and cross-origin navigation", async () => {
    const scheduler = new TestScheduler();
    const window = fakeWindow();
    let permissionCheck = () => true;
    let permissionRequest: (callback: (allowed: boolean) => void) => void = () => undefined;
    const session = {
      fetch: vi.fn(async () => authResponse(false)),
      setPermissionCheckHandler: vi.fn((handler: typeof permissionCheck) => { permissionCheck = handler; }),
      setPermissionRequestHandler: vi.fn((_handler: unknown) => {
        permissionRequest = (callback) => callback(false);
      }),
    };
    const createWindow = vi.fn(() => window);
    const auth = new JarvisAuthSession({
      endpoint: new URL("http://127.0.0.1:7777/"),
      session,
      createWindow,
      scheduler,
      onAuthenticated: vi.fn(),
      pollMs: 1_000,
    });

    await expect(auth.open()).resolves.toEqual({ opened: true });

    expect(createWindow).toHaveBeenCalledWith(expect.objectContaining({
      webPreferences: expect.objectContaining({ partition: AUTH_PARTITION }),
    }));
    expect(window.loadURL).toHaveBeenCalledWith("http://127.0.0.1:7777/");
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.windowOpen("http://example.com")).toEqual({ action: "deny" });
    expect(window.navigation("http://example.com").prevented).toBe(true);
    expect(window.navigation("http://127.0.0.1:7777/auth/login").prevented).toBe(false);
    expect(permissionCheck()).toBe(false);
    let permissionAllowed = true;
    permissionRequest((allowed) => { permissionAllowed = allowed; });
    expect(permissionAllowed).toBe(false);
    expect(scheduler.tasks.size).toBe(1);
  });

  it("reuses one window, closes after authentication, and refreshes once", async () => {
    const scheduler = new TestScheduler();
    const window = fakeWindow();
    const fetch = vi.fn()
      .mockResolvedValueOnce(authResponse(false))
      .mockResolvedValueOnce(authResponse(true));
    const session = {
      fetch,
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
    };
    const refresh = vi.fn(async () => undefined);
    const auth = new JarvisAuthSession({
      endpoint: new URL("http://127.0.0.1:7777/"),
      session,
      createWindow: vi.fn(() => window),
      scheduler,
      onAuthenticated: refresh,
      pollMs: 1_000,
    });

    await expect(auth.open()).resolves.toEqual({ opened: true });
    await expect(auth.open()).resolves.toEqual({ opened: false });
    expect(window.focus).toHaveBeenCalledTimes(1);
    scheduler.run(1);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(window.close).toHaveBeenCalledTimes(1);
    expect(scheduler.tasks.size).toBe(0);
  });

  it("clears polling when the operator closes the window", async () => {
    const scheduler = new TestScheduler();
    const window = fakeWindow();
    const auth = new JarvisAuthSession({
      endpoint: new URL("http://127.0.0.1:7777/"),
      session: {
        fetch: vi.fn(async () => authResponse(false)),
        setPermissionCheckHandler: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
      },
      createWindow: vi.fn(() => window),
      scheduler,
      onAuthenticated: vi.fn(),
      pollMs: 1_000,
    });

    await auth.open();
    window.closed();

    expect(scheduler.clear).toHaveBeenCalledTimes(1);
    expect(scheduler.tasks.size).toBe(0);
  });
});
