import type { JarvisTaskInput, JarvisTaskSnapshot } from "@iris/contracts";

import type { Scheduler } from "./controller.js";
import { JarvisReadError } from "./http.js";
import type { JarvisTaskClient, JarvisTaskSubmit } from "./task-client.js";

export type JarvisTaskConnection =
  | "idle"
  | "submitting"
  | "active"
  | "reconnecting"
  | "sign_in_required"
  | "error"
  | "terminal";

export type JarvisTaskControllerSnapshot = Readonly<{
  sequence: number;
  capturedAt: string;
  connection: JarvisTaskConnection;
  task?: JarvisTaskSnapshot | undefined;
  errorCode?: "unauthorized" | "unreachable" | "invalid_response" | "oversized_response" | "timeout" | "conflict" | undefined;
}>;

type TaskClientLike = Pick<JarvisTaskClient, "endpoint" | "submitTurn" | "readTask" | "stopTask">;

type TaskControllerInput = Readonly<{
  client: TaskClientLike;
  scheduler: Scheduler;
  idFactory?: () => string;
  now?: () => Date;
  pollMs?: number;
  retryMs?: number;
}>;

type Listener = (snapshot: JarvisTaskControllerSnapshot) => void;

const DEFAULT_POLL_MS = 1_000;
const DEFAULT_RETRY_MS = 1_500;
const MAX_RENDERER_EVENTS = 100;

function immutableTask(snapshot: JarvisTaskSnapshot): JarvisTaskSnapshot {
  const copy = {
    ...snapshot,
    events: snapshot.events.map((event) => Object.freeze({ ...event })),
    runs: snapshot.runs.map((run) => Object.freeze({ ...run })),
  };
  Object.freeze(copy.events);
  Object.freeze(copy.runs);
  return Object.freeze(copy);
}

export class JarvisTaskController {
  readonly #client: TaskClientLike;
  readonly #scheduler: Scheduler;
  readonly #idFactory: () => string;
  readonly #now: () => Date;
  readonly #pollMs: number;
  readonly #retryMs: number;
  readonly #listeners = new Set<Listener>();
  #current: JarvisTaskControllerSnapshot;
  #generation = 0;
  #sequence = 0;
  #timer: unknown | undefined;
  #pendingSubmit: JarvisTaskSubmit | undefined;

  constructor(input: TaskControllerInput) {
    this.#client = input.client;
    this.#scheduler = input.scheduler;
    this.#idFactory = input.idFactory ?? (() => crypto.randomUUID());
    this.#now = input.now ?? (() => new Date());
    this.#pollMs = input.pollMs ?? DEFAULT_POLL_MS;
    this.#retryMs = input.retryMs ?? DEFAULT_RETRY_MS;
    this.#current = Object.freeze({
      sequence: 0,
      capturedAt: "1970-01-01T00:00:00.000Z",
      connection: "idle",
    });
  }

  current(): JarvisTaskControllerSnapshot {
    return this.#current;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async sendTurn(input: JarvisTaskInput): Promise<JarvisTaskControllerSnapshot> {
    if (
      this.#pendingSubmit !== undefined
      || this.#current.connection === "submitting"
      || (this.#current.task !== undefined && !this.#current.task.terminal)
    ) {
      throw new Error("An Iris task is already active");
    }
    this.#clearTimer();
    const generation = ++this.#generation;
    this.#pendingSubmit = {
      intentId: this.#idFactory(),
      idempotencyKey: this.#idFactory(),
      brainId: input.brainId,
      sessionId: input.sessionId,
      message: input.message,
    };
    this.#publish("submitting");
    await this.#submit(generation);
    return this.#current;
  }

  async stopTurn(): Promise<JarvisTaskControllerSnapshot> {
    const task = this.#current.task;
    if (task === undefined || !task.can_stop || task.terminal) return this.#current;
    this.#clearTimer();
    this.#pendingSubmit = undefined;
    const generation = ++this.#generation;
    try {
      const stopped = await this.#client.stopTask(task.task_id);
      if (generation !== this.#generation) return this.#current;
      if (
        stopped.task_id !== task.task_id
        || stopped.intent_id !== task.intent_id
        || stopped.brain_id !== task.brain_id
        || stopped.event_cursor < task.event_cursor
      ) {
        throw new JarvisReadError("invalid_response");
      }
      this.#publish(stopped.terminal ? "terminal" : "active", stopped);
      if (!stopped.terminal) this.#schedulePoll(generation, this.#pollMs);
    } catch (error) {
      if (generation !== this.#generation) return this.#current;
      this.#publishFailure(error, task);
      if (!this.#nonRetryable(error)) {
        this.#schedulePoll(generation, this.#retryMs);
      }
    }
    return this.#current;
  }

  async reconnect(): Promise<JarvisTaskControllerSnapshot> {
    this.#clearTimer();
    const generation = ++this.#generation;
    if (this.#pendingSubmit !== undefined) {
      this.#publish("submitting");
      await this.#submit(generation);
      return this.#current;
    }
    const task = this.#current.task;
    if (task === undefined || task.terminal) return this.#current;
    this.#publish("reconnecting", task);
    await this.#poll(generation);
    return this.#current;
  }

  dispose(): void {
    this.#generation += 1;
    this.#pendingSubmit = undefined;
    this.#clearTimer();
    this.#listeners.clear();
  }

  async #submit(generation: number): Promise<void> {
    const pending = this.#pendingSubmit;
    if (pending === undefined) return;
    try {
      const task = await this.#client.submitTurn(pending);
      if (generation !== this.#generation || pending !== this.#pendingSubmit) return;
      this.#pendingSubmit = undefined;
      this.#publish(task.terminal ? "terminal" : "active", task);
      if (!task.terminal) this.#schedulePoll(generation, this.#pollMs);
    } catch (error) {
      if (generation !== this.#generation || pending !== this.#pendingSubmit) return;
      this.#publishFailure(error);
      if (!this.#nonRetryable(error)) {
        this.#scheduleSubmit(generation);
      }
    }
  }

  async #poll(generation: number): Promise<void> {
    const task = this.#current.task;
    if (task === undefined || task.terminal) return;
    try {
      const next = await this.#client.readTask(task.task_id, task.event_cursor);
      if (generation !== this.#generation) return;
      const merged = this.#mergeTask(task, next);
      this.#publish(merged.terminal ? "terminal" : "active", merged);
      if (!merged.terminal) this.#schedulePoll(generation, this.#pollMs);
    } catch (error) {
      if (generation !== this.#generation) return;
      this.#publishFailure(error, task);
      if (!this.#nonRetryable(error)) {
        this.#schedulePoll(generation, this.#retryMs);
      }
    }
  }

  #mergeTask(previous: JarvisTaskSnapshot, next: JarvisTaskSnapshot): JarvisTaskSnapshot {
    if (
      next.task_id !== previous.task_id
      || next.intent_id !== previous.intent_id
      || next.brain_id !== previous.brain_id
      || next.event_cursor < previous.event_cursor
      || next.events.some((event) => event.id <= previous.event_cursor)
    ) {
      throw new JarvisReadError("invalid_response");
    }
    return immutableTask({
      ...next,
      replayed: previous.replayed || next.replayed,
      events: [...previous.events, ...next.events].slice(-MAX_RENDERER_EVENTS),
    });
  }

  #scheduleSubmit(generation: number): void {
    if (this.#timer !== undefined) return;
    this.#timer = this.#scheduler.set(this.#retryMs, () => {
      this.#timer = undefined;
      if (generation === this.#generation) void this.#submit(generation);
    });
  }

  #schedulePoll(generation: number, delayMs: number): void {
    if (this.#timer !== undefined) return;
    this.#timer = this.#scheduler.set(delayMs, () => {
      this.#timer = undefined;
      if (generation === this.#generation) void this.#poll(generation);
    });
  }

  #clearTimer(): void {
    if (this.#timer === undefined) return;
    this.#scheduler.clear(this.#timer);
    this.#timer = undefined;
  }

  #publishFailure(error: unknown, task?: JarvisTaskSnapshot): void {
    const code = error instanceof JarvisReadError ? error.code : "invalid_response";
    const connection = code === "unauthorized"
      ? "sign_in_required"
      : code === "conflict" ? "error" : "reconnecting";
    this.#publish(connection, task, code);
  }

  #nonRetryable(error: unknown): boolean {
    return error instanceof JarvisReadError
      && (error.code === "unauthorized" || error.code === "conflict");
  }

  #publish(
    connection: JarvisTaskConnection,
    task?: JarvisTaskSnapshot,
    errorCode?: JarvisTaskControllerSnapshot["errorCode"],
  ): void {
    const snapshot: JarvisTaskControllerSnapshot = Object.freeze({
      sequence: ++this.#sequence,
      capturedAt: this.#now().toISOString(),
      connection,
      ...(task === undefined ? {} : { task: immutableTask(task) }),
      ...(errorCode === undefined ? {} : { errorCode }),
    });
    this.#current = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
  }
}
