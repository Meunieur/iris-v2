import {
  jarvisTaskSnapshotSchema,
  sanitizeRendererText,
  type JarvisTaskSnapshot,
} from "@iris/contracts";

import {
  getBoundedJson,
  JarvisReadError,
  postBoundedJson,
  type JarvisTransport,
} from "./http.js";

export type JarvisTaskSubmit = Readonly<{
  intentId: string;
  idempotencyKey: string;
  brainId: `brain_${string}`;
  sessionId?: string | undefined;
  message: string;
}>;

type JarvisTaskClientInput = Readonly<{
  endpoint: URL;
  transport: JarvisTransport;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const brainIdPattern = /^brain_[a-f0-9]{64}$/;
const taskIdPattern = /^t_[a-f0-9]{12}$/;

function immutableTask(snapshot: JarvisTaskSnapshot): JarvisTaskSnapshot {
  const copy = {
    ...snapshot,
    result: sanitizeRendererText(snapshot.result),
    events: snapshot.events.map((event) => Object.freeze({ ...event })),
    runs: snapshot.runs.map((run) => Object.freeze({ ...run })),
  };
  Object.freeze(copy.events);
  Object.freeze(copy.runs);
  return Object.freeze(copy);
}

function taskId(value: string): string {
  if (!taskIdPattern.test(value)) throw new JarvisReadError("invalid_response");
  return value;
}

export class JarvisTaskClient {
  readonly #endpoint: URL;
  readonly #transport: JarvisTransport;

  constructor(input: JarvisTaskClientInput) {
    this.#endpoint = new URL(input.endpoint.href);
    this.#transport = input.transport;
  }

  get endpoint(): string {
    return this.#endpoint.href;
  }

  async submitTurn(input: JarvisTaskSubmit): Promise<JarvisTaskSnapshot> {
    const message = input.message.trim();
    const sessionId = input.sessionId ?? "";
    if (
      !uuidPattern.test(input.intentId)
      || !uuidPattern.test(input.idempotencyKey)
      || !brainIdPattern.test(input.brainId)
      || message.length === 0
      || message.length > 4_000
      || sessionId.length > 96
    ) {
      throw new JarvisReadError("invalid_response");
    }
    const snapshot = await postBoundedJson({
      transport: this.#transport,
      url: new URL("iris/v1/turns", this.#endpoint),
      schema: jarvisTaskSnapshotSchema,
      body: {
        version: 1,
        intent_id: input.intentId,
        idempotency_key: input.idempotencyKey,
        brain_id: input.brainId,
        session_id: sessionId,
        message,
      },
    });
    return immutableTask(snapshot);
  }

  async readTask(value: string, afterEventId: number): Promise<JarvisTaskSnapshot> {
    if (!Number.isSafeInteger(afterEventId) || afterEventId < 0) {
      throw new JarvisReadError("invalid_response");
    }
    const url = new URL(`iris/v1/turns/${taskId(value)}`, this.#endpoint);
    url.searchParams.set("after_event_id", String(afterEventId));
    return immutableTask(await getBoundedJson({
      transport: this.#transport,
      url,
      schema: jarvisTaskSnapshotSchema,
    }));
  }

  async stopTask(value: string): Promise<JarvisTaskSnapshot> {
    return immutableTask(await postBoundedJson({
      transport: this.#transport,
      url: new URL(`iris/v1/turns/${taskId(value)}/stop`, this.#endpoint),
      schema: jarvisTaskSnapshotSchema,
    }));
  }
}
