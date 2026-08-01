import { describe, expect, it, vi } from "vitest";

import type { JarvisTaskSnapshot } from "@iris/contracts";

import { JarvisReadError, JarvisTaskController, type JarvisTaskSubmit, type Scheduler } from "../src/index.js";

const brainId = `brain_${"a".repeat(64)}` as const;
const ready = {
  version: 1,
  task_id: "t_0123456789ab",
  intent_id: "43fe94df-373f-4ad0-931c-7f6418719b5a",
  brain_id: brainId,
  session_id: "",
  risk: "R0",
  status: "ready",
  terminal: false,
  outcome: null,
  orphaned: false,
  can_stop: true,
  current_run_id: "",
  result: "",
  replayed: false,
  event_cursor: 1,
  events: [{ id: 1, type: "created", run_id: "", created_at: 1_785_500_000 }],
  runs: [],
} satisfies JarvisTaskSnapshot;

class ManualScheduler implements Scheduler {
  readonly pending: Array<{ handle: object; task: () => void }> = [];

  set(_delayMs: number, task: () => void): object {
    const handle = {};
    this.pending.push({ handle, task });
    return handle;
  }

  clear(handle: unknown): void {
    const index = this.pending.findIndex((entry) => entry.handle === handle);
    if (index >= 0) this.pending.splice(index, 1);
  }

  runNext(): void {
    const next = this.pending.shift();
    if (next === undefined) throw new Error("No scheduled task");
    next.task();
  }
}

function input(): Omit<JarvisTaskSubmit, "intentId" | "idempotencyKey"> {
  return { brainId, message: "Summarize the latest project decisions." };
}

describe("JarvisTaskController", () => {
  it("replays a lost submit response with the exact same intent and key", async () => {
    const scheduler = new ManualScheduler();
    const submitTurn = vi.fn()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(ready);
    const client = { endpoint: "http://127.0.0.1:7777/", submitTurn, readTask: vi.fn(), stopTask: vi.fn() };
    const ids = [ready.intent_id, "174631e1-d82d-4724-8b7a-0b3d99f2f132"];
    const controller = new JarvisTaskController({
      client,
      scheduler,
      idFactory: () => ids.shift() as string,
      now: () => new Date("2026-07-31T02:00:00.000Z"),
    });

    await controller.sendTurn(input());
    expect(controller.current().connection).toBe("reconnecting");
    expect(scheduler.pending).toHaveLength(1);
    scheduler.runNext();
    await vi.waitFor(() => expect(controller.current().connection).toBe("active"));

    expect(submitTurn).toHaveBeenCalledTimes(2);
    expect(submitTurn.mock.calls[0]?.[0]).toEqual(submitTurn.mock.calls[1]?.[0]);
    expect(submitTurn.mock.calls[0]?.[0]).toMatchObject({
      intentId: ready.intent_id,
      idempotencyKey: "174631e1-d82d-4724-8b7a-0b3d99f2f132",
    });
  });

  it("does not let a new turn overwrite a submit that is waiting to replay", async () => {
    const scheduler = new ManualScheduler();
    const submitTurn = vi.fn(async () => { throw new Error("response lost"); });
    const client = { endpoint: "http://127.0.0.1:7777/", submitTurn, readTask: vi.fn(), stopTask: vi.fn() };
    const ids = [
      ready.intent_id,
      "174631e1-d82d-4724-8b7a-0b3d99f2f132",
      "b8ddb12d-096a-43a2-8e08-1441826a8496",
      "677db7d5-034a-4f2a-823e-620856e8d8ea",
    ];
    const controller = new JarvisTaskController({ client, scheduler, idFactory: () => ids.shift() as string });

    await controller.sendTurn(input());

    await expect(controller.sendTurn({ ...input(), message: "Replace the pending turn" }))
      .rejects.toThrow("already active");
    expect(submitTurn).toHaveBeenCalledTimes(1);
    expect(scheduler.pending).toHaveLength(1);
  });

  it("polls by task id and cursor, publishes terminal outcome, then stops polling", async () => {
    const scheduler = new ManualScheduler();
    const done = {
      ...ready,
      status: "done",
      terminal: true,
      outcome: "succeeded",
      can_stop: false,
      result: "Finished from Jarvis task store",
      event_cursor: 3,
      events: [{ id: 3, type: "completed", run_id: "run_0123456789abcd", created_at: 1_785_500_003 }],
    } satisfies JarvisTaskSnapshot;
    const client = {
      endpoint: "http://127.0.0.1:7777/",
      submitTurn: vi.fn(async () => ready),
      readTask: vi.fn(async () => done),
      stopTask: vi.fn(),
    };
    const ids = [ready.intent_id, "174631e1-d82d-4724-8b7a-0b3d99f2f132"];
    const controller = new JarvisTaskController({ client, scheduler, idFactory: () => ids.shift() as string });

    await controller.sendTurn(input());
    expect(scheduler.pending).toHaveLength(1);
    scheduler.runNext();
    await vi.waitFor(() => expect(controller.current().connection).toBe("terminal"));

    expect(client.readTask).toHaveBeenCalledWith(ready.task_id, 1);
    expect(controller.current().task?.events.map((event) => event.id)).toEqual([1, 3]);
    expect(controller.current().task?.outcome).toBe("succeeded");
    expect(scheduler.pending).toHaveLength(0);
  });

  it("preserves replay provenance after later cursor polls", async () => {
    const scheduler = new ManualScheduler();
    const replayed = { ...ready, replayed: true } satisfies JarvisTaskSnapshot;
    const done = {
      ...ready,
      status: "done",
      terminal: true,
      outcome: "succeeded",
      can_stop: false,
      event_cursor: 2,
      events: [{ id: 2, type: "completed", run_id: "run_0123456789abcd", created_at: 2 }],
    } satisfies JarvisTaskSnapshot;
    const client = {
      endpoint: "http://127.0.0.1:7777/",
      submitTurn: vi.fn(async () => replayed),
      readTask: vi.fn(async () => done),
      stopTask: vi.fn(),
    };
    const ids = [ready.intent_id, "174631e1-d82d-4724-8b7a-0b3d99f2f132"];
    const controller = new JarvisTaskController({ client, scheduler, idFactory: () => ids.shift() as string });

    await controller.sendTurn(input());
    scheduler.runNext();
    await vi.waitFor(() => expect(controller.current().connection).toBe("terminal"));

    expect(controller.current().task?.replayed).toBe(true);
  });

  it("keeps the renderer event window bounded across long polling sessions", async () => {
    const scheduler = new ManualScheduler();
    const initial = {
      ...ready,
      event_cursor: 100,
      events: Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        type: "status" as const,
        run_id: "",
        created_at: index + 1,
      })),
    } satisfies JarvisTaskSnapshot;
    const next = {
      ...ready,
      event_cursor: 101,
      events: [{ id: 101, type: "status", run_id: "", created_at: 101 }],
    } satisfies JarvisTaskSnapshot;
    const client = {
      endpoint: "http://127.0.0.1:7777/",
      submitTurn: vi.fn(async () => initial),
      readTask: vi.fn(async () => next),
      stopTask: vi.fn(),
    };
    const ids = [ready.intent_id, "174631e1-d82d-4724-8b7a-0b3d99f2f132"];
    const controller = new JarvisTaskController({ client, scheduler, idFactory: () => ids.shift() as string });

    await controller.sendTurn(input());
    scheduler.runNext();
    await vi.waitFor(() => expect(controller.current().task?.event_cursor).toBe(101));

    expect(controller.current().task?.events).toHaveLength(100);
    expect(controller.current().task?.events[0]?.id).toBe(2);
    expect(controller.current().task?.events.at(-1)?.id).toBe(101);
  });

  it("stops only the authoritative current task", async () => {
    const scheduler = new ManualScheduler();
    const cancelled = {
      ...ready,
      status: "cancelled",
      terminal: true,
      outcome: "cancelled",
      can_stop: false,
    } satisfies JarvisTaskSnapshot;
    const client = {
      endpoint: "http://127.0.0.1:7777/",
      submitTurn: vi.fn(async () => ready),
      readTask: vi.fn(),
      stopTask: vi.fn(async () => cancelled),
    };
    const ids = [ready.intent_id, "174631e1-d82d-4724-8b7a-0b3d99f2f132"];
    const controller = new JarvisTaskController({ client, scheduler, idFactory: () => ids.shift() as string });

    await controller.sendTurn(input());
    await controller.stopTurn();

    expect(client.stopTask).toHaveBeenCalledWith(ready.task_id);
    expect(controller.current().connection).toBe("terminal");
    expect(controller.current().task?.outcome).toBe("cancelled");
    expect(scheduler.pending).toHaveLength(0);
  });

  it("fails closed without an infinite retry on idempotency conflict", async () => {
    const scheduler = new ManualScheduler();
    const client = {
      endpoint: "http://127.0.0.1:7777/",
      submitTurn: vi.fn(async () => { throw new JarvisReadError("conflict"); }),
      readTask: vi.fn(),
      stopTask: vi.fn(),
    };
    const ids = [ready.intent_id, "174631e1-d82d-4724-8b7a-0b3d99f2f132"];
    const controller = new JarvisTaskController({ client, scheduler, idFactory: () => ids.shift() as string });

    await controller.sendTurn(input());

    expect(controller.current()).toMatchObject({ connection: "error", errorCode: "conflict" });
    expect(scheduler.pending).toHaveLength(0);
  });

  it("resumes the same known task after the operator signs in again", async () => {
    const scheduler = new ManualScheduler();
    const done = {
      ...ready,
      status: "done",
      terminal: true,
      outcome: "succeeded",
      can_stop: false,
      result: "Recovered after sign-in",
      event_cursor: 2,
      events: [{ id: 2, type: "completed", run_id: "run_0123456789abcd", created_at: 2 }],
    } satisfies JarvisTaskSnapshot;
    const readTask = vi.fn()
      .mockRejectedValueOnce(new JarvisReadError("unauthorized"))
      .mockResolvedValueOnce(done);
    const client = {
      endpoint: "http://127.0.0.1:7777/",
      submitTurn: vi.fn(async () => ready),
      readTask,
      stopTask: vi.fn(),
    };
    const ids = [ready.intent_id, "174631e1-d82d-4724-8b7a-0b3d99f2f132"];
    const controller = new JarvisTaskController({ client, scheduler, idFactory: () => ids.shift() as string });

    await controller.sendTurn(input());
    scheduler.runNext();
    await vi.waitFor(() => expect(controller.current().connection).toBe("sign_in_required"));
    await controller.reconnect();

    expect(readTask).toHaveBeenNthCalledWith(2, ready.task_id, ready.event_cursor);
    expect(controller.current()).toMatchObject({ connection: "terminal", task: { outcome: "succeeded" } });
  });
});
