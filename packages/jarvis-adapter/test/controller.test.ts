import { describe, expect, it, vi } from "vitest";

import {
  JarvisReadController,
  type Scheduler,
} from "../src/controller";
import type {
  JarvisReadClient,
  JarvisReadSnapshot,
} from "../src/client";

function snapshot(
  sequence: number,
  connection: JarvisReadSnapshot["connection"],
  title = `session-${sequence}`,
): JarvisReadSnapshot {
  return {
    sequence,
    capturedAt: `2026-07-24T06:4${sequence}:00.000Z`,
    endpoint: "http://127.0.0.1:7777/",
    connection,
    health: {
      status: connection === "offline" ? "offline" : "ok",
      authRequired: true,
      authenticated: connection === "ready",
      version: "0.9.156",
      mode: "windows",
    },
    brains: [],
    sessions: connection === "ready"
      ? [{ id: `id-${sequence}`, title, updatedAt: sequence, messageCount: sequence }]
      : [],
    ...(connection === "offline" ? { errorCode: "unreachable" as const } : {}),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

class TestScheduler implements Scheduler {
  readonly tasks = new Map<number, () => void>();
  readonly set = vi.fn((delayMs: number, task: () => void) => {
    const handle = this.tasks.size + 1;
    expect(delayMs).toBe(1_500);
    this.tasks.set(handle, task);
    return handle;
  });
  readonly clear = vi.fn((handle: unknown) => {
    this.tasks.delete(handle as number);
  });

  run(handle: number): void {
    const task = this.tasks.get(handle);
    if (task === undefined) throw new Error(`Missing scheduled task ${handle}`);
    this.tasks.delete(handle);
    task();
  }
}

function fakeClient(read: JarvisReadClient["read"]): Pick<JarvisReadClient, "endpoint" | "read"> {
  return {
    endpoint: "http://127.0.0.1:7777/",
    read,
  };
}

describe("JarvisReadController", () => {
  it("starts in a frozen connecting state and publishes a successful snapshot", async () => {
    const scheduler = new TestScheduler();
    const read = vi.fn(async (sequence: number) => snapshot(sequence, "ready"));
    const controller = new JarvisReadController({ client: fakeClient(read), scheduler, retryMs: 1_500 });
    const listener = vi.fn();

    controller.subscribe(listener);
    expect(controller.current()).toMatchObject({ sequence: 0, connection: "connecting" });
    expect(Object.isFrozen(controller.current())).toBe(true);

    controller.start();
    await vi.waitFor(() => expect(controller.current().connection).toBe("ready"));

    expect(read).toHaveBeenCalledWith(1);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ connection: "ready" }));
    expect(Object.isFrozen(controller.current().sessions[0])).toBe(true);
    expect(scheduler.set).not.toHaveBeenCalled();
  });

  it("publishes sign-in-required without scheduling retries", async () => {
    const scheduler = new TestScheduler();
    const read = vi.fn(async (sequence: number) => snapshot(sequence, "sign_in_required"));
    const controller = new JarvisReadController({ client: fakeClient(read), scheduler, retryMs: 1_500 });

    controller.start();
    await vi.waitFor(() => expect(controller.current().connection).toBe("sign_in_required"));

    expect(scheduler.set).not.toHaveBeenCalled();
  });

  it("maps offline reads to reconnecting and keeps exactly one retry timer", async () => {
    const scheduler = new TestScheduler();
    const read = vi.fn(async (sequence: number) => snapshot(sequence, "offline"));
    const controller = new JarvisReadController({ client: fakeClient(read), scheduler, retryMs: 1_500 });

    controller.start();
    await vi.waitFor(() => expect(controller.current().connection).toBe("reconnecting"));
    await controller.refresh();

    expect(scheduler.set).toHaveBeenCalledTimes(1);
    expect(scheduler.tasks.size).toBe(1);
    expect(controller.current()).toMatchObject({ errorCode: "unreachable", brains: [], sessions: [] });
  });

  it("reconciles the full snapshot when the retry timer fires", async () => {
    const scheduler = new TestScheduler();
    const read = vi.fn(async (sequence: number) => snapshot(sequence, sequence === 1 ? "offline" : "ready"));
    const controller = new JarvisReadController({ client: fakeClient(read), scheduler, retryMs: 1_500 });

    controller.start();
    await vi.waitFor(() => expect(controller.current().connection).toBe("reconnecting"));
    scheduler.run(1);
    await vi.waitFor(() => expect(controller.current().connection).toBe("ready"));

    expect(read.mock.calls.map(([sequence]) => sequence)).toEqual([1, 2]);
    expect(scheduler.tasks.size).toBe(0);
  });

  it("refreshes stale data and ignores an older request that completes last", async () => {
    const scheduler = new TestScheduler();
    const first = deferred<JarvisReadSnapshot>();
    const second = deferred<JarvisReadSnapshot>();
    const read = vi.fn((sequence: number) => sequence === 1 ? first.promise : second.promise);
    const controller = new JarvisReadController({ client: fakeClient(read), scheduler, retryMs: 1_500 });

    const firstRefresh = controller.refresh();
    const secondRefresh = controller.refresh();
    second.resolve(snapshot(2, "ready", "fresh"));
    await expect(secondRefresh).resolves.toMatchObject({ sequence: 2 });
    first.resolve(snapshot(1, "ready", "stale"));
    await expect(firstRefresh).resolves.toMatchObject({ sequence: 2 });

    expect(controller.current().sessions[0]?.title).toBe("fresh");
    expect(controller.current().sequence).toBe(2);
  });

  it("removes subscriptions without affecting other listeners", async () => {
    const scheduler = new TestScheduler();
    const read = vi.fn(async (sequence: number) => snapshot(sequence, "ready"));
    const controller = new JarvisReadController({ client: fakeClient(read), scheduler, retryMs: 1_500 });
    const removed = vi.fn();
    const active = vi.fn();
    const unsubscribe = controller.subscribe(removed);
    controller.subscribe(active);
    unsubscribe();

    await controller.refresh();

    expect(removed).not.toHaveBeenCalled();
    expect(active).toHaveBeenCalledTimes(1);
  });

  it("stops retries and ignores in-flight completion after shutdown", async () => {
    const scheduler = new TestScheduler();
    const pending = deferred<JarvisReadSnapshot>();
    const read = vi.fn(() => pending.promise);
    const controller = new JarvisReadController({ client: fakeClient(read), scheduler, retryMs: 1_500 });

    controller.start();
    controller.stop();
    pending.resolve(snapshot(1, "ready"));
    await Promise.resolve();

    expect(controller.current()).toMatchObject({ sequence: 0, connection: "connecting" });
    expect(scheduler.tasks.size).toBe(0);
    expect(scheduler.clear).not.toHaveBeenCalled();
  });

  it("clears an existing reconnect timer on stop", async () => {
    const scheduler = new TestScheduler();
    const read = vi.fn(async (sequence: number) => snapshot(sequence, "offline"));
    const controller = new JarvisReadController({ client: fakeClient(read), scheduler, retryMs: 1_500 });

    controller.start();
    await vi.waitFor(() => expect(scheduler.tasks.size).toBe(1));
    controller.stop();

    expect(scheduler.clear).toHaveBeenCalledTimes(1);
    expect(scheduler.tasks.size).toBe(0);
  });
});
