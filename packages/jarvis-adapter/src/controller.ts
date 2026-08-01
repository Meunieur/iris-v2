import type { JarvisReadClient, JarvisReadSnapshot } from "./client.js";

export type Scheduler = {
  set(delayMs: number, task: () => void): unknown;
  clear(handle: unknown): void;
};

type ControllerInput = {
  client: Pick<JarvisReadClient, "endpoint" | "read">;
  scheduler: Scheduler;
  retryMs?: number;
};

type Listener = (snapshot: JarvisReadSnapshot) => void;

const DEFAULT_RETRY_MS = 1_500;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function immutableCopy(snapshot: JarvisReadSnapshot): JarvisReadSnapshot {
  return deepFreeze({
    ...snapshot,
    health: { ...snapshot.health },
    brains: snapshot.brains.map((brain) => ({ ...brain })),
    sessions: snapshot.sessions.map((session) => ({ ...session })),
  });
}

export class JarvisReadController {
  readonly #client: Pick<JarvisReadClient, "endpoint" | "read">;
  readonly #scheduler: Scheduler;
  readonly #retryMs: number;
  readonly #listeners = new Set<Listener>();
  #current: JarvisReadSnapshot;
  #generation = 0;
  #latestSequence = 0;
  #retryHandle: unknown | undefined;
  #running = false;

  constructor(input: ControllerInput) {
    this.#client = input.client;
    this.#scheduler = input.scheduler;
    this.#retryMs = input.retryMs ?? DEFAULT_RETRY_MS;
    this.#current = immutableCopy({
      sequence: 0,
      capturedAt: "1970-01-01T00:00:00.000Z",
      endpoint: input.client.endpoint,
      connection: "connecting",
      health: {
        status: "offline",
        authRequired: true,
        authenticated: false,
      },
      brains: [],
      sessions: [],
    });
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#generation += 1;
    void this.refresh();
  }

  stop(): void {
    this.#running = false;
    this.#generation += 1;
    this.#latestSequence += 1;
    this.#clearRetry();
  }

  async refresh(): Promise<JarvisReadSnapshot> {
    const generation = this.#generation;
    const sequence = ++this.#latestSequence;

    let next: JarvisReadSnapshot;
    try {
      next = await this.#client.read(sequence);
    } catch {
      next = {
        sequence,
        capturedAt: this.#current.capturedAt,
        endpoint: this.#client.endpoint,
        connection: "offline",
        health: this.#current.health,
        brains: [],
        sessions: [],
        errorCode: "invalid_response",
      };
    }

    if (generation !== this.#generation || sequence !== this.#latestSequence) return this.#current;

    const reconnecting = next.connection === "offline"
      ? { ...next, connection: "reconnecting" as const }
      : next;
    this.#publish(reconnecting);

    if (next.connection === "offline" || next.connection === "degraded") this.#scheduleRetry();
    else this.#clearRetry();
    return this.#current;
  }

  current(): JarvisReadSnapshot {
    return this.#current;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #publish(snapshot: JarvisReadSnapshot): void {
    this.#current = immutableCopy(snapshot);
    for (const listener of this.#listeners) listener(this.#current);
  }

  #scheduleRetry(): void {
    if (!this.#running || this.#retryHandle !== undefined) return;
    this.#retryHandle = this.#scheduler.set(this.#retryMs, () => {
      this.#retryHandle = undefined;
      if (this.#running) void this.refresh();
    });
  }

  #clearRetry(): void {
    if (this.#retryHandle === undefined) return;
    this.#scheduler.clear(this.#retryHandle);
    this.#retryHandle = undefined;
  }
}
