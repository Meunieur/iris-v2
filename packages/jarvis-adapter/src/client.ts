import {
  createBrainPathIdLookup,
  projectKnowledgeGraph,
  projectBrainSummaries,
  projectHealthSnapshot,
  projectSessions,
  rawAuthStatusSchema,
  rawBrainsSchema,
  rawKnowledgeGraphSchema,
  rawHealthSchema,
  rawSessionsSchema,
  rawVersionSchema,
  type BrainSummary,
  type HealthSnapshot,
  type PublicKnowledgeGraph,
  type SessionSummary,
} from "@iris/contracts";

import {
  getBoundedJson,
  JarvisReadError,
  type JarvisReadErrorCode,
  type JarvisTransport,
} from "./http.js";

export type { JarvisReadErrorCode, JarvisTransport } from "./http.js";

export const MAX_GRAPH_JSON_BYTES = 2 * 1024 * 1024;

export type JarvisConnectionState =
  | "offline"
  | "connecting"
  | "sign_in_required"
  | "ready"
  | "degraded"
  | "reconnecting";

export type JarvisReadSnapshot = Readonly<{
  sequence: number;
  capturedAt: string;
  endpoint: string;
  connection: JarvisConnectionState;
  health: HealthSnapshot;
  brains: readonly BrainSummary[];
  sessions: readonly SessionSummary[];
  errorCode?: JarvisReadErrorCode;
}>;

export type JarvisKnowledgeErrorCode = JarvisReadErrorCode | "catalog_unavailable" | "unknown_brain";

export type JarvisKnowledgeSnapshot = Readonly<
  | {
    state: "ready";
    capturedAt: string;
    brain: BrainSummary;
    graph: PublicKnowledgeGraph;
  }
  | {
    state: "sign_in_required";
    capturedAt: string;
  }
  | {
    state: "unavailable";
    capturedAt: string;
    errorCode: JarvisKnowledgeErrorCode;
  }
>;

type ReadClientInput = {
  endpoint: URL;
  transport: JarvisTransport;
  now?: () => Date;
};

const unknownHealth: HealthSnapshot = {
  status: "offline",
  authRequired: true,
  authenticated: false,
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function errorCode(error: unknown): JarvisReadErrorCode {
  return error instanceof JarvisReadError ? error.code : "invalid_response";
}

export class JarvisReadClient {
  readonly #endpoint: URL;
  readonly #transport: JarvisTransport;
  readonly #now: () => Date;
  readonly #brainCatalog = new Map<BrainSummary["id"], { path: string; summary: BrainSummary }>();
  #catalogState: "unavailable" | "sign_in_required" | "ready" = "unavailable";
  #catalogVersion = 0;

  constructor(input: ReadClientInput) {
    this.#endpoint = new URL(input.endpoint.href);
    this.#transport = input.transport;
    this.#now = input.now ?? (() => new Date());
  }

  get endpoint(): string {
    return this.#endpoint.href;
  }

  async read(sequence: number): Promise<JarvisReadSnapshot> {
    const capturedAt = this.#now().toISOString();
    let health: HealthSnapshot;
    let auth: ReturnType<typeof rawAuthStatusSchema.parse>;

    try {
      const rawHealth = await this.#get("health", rawHealthSchema);
      auth = await this.#get("auth/status", rawAuthStatusSchema);
      const rawVersion = await this.#get("version", rawVersionSchema);
      health = projectHealthSnapshot(rawHealth, auth, rawVersion);
    } catch (error) {
      this.#clearBrainCatalog("unavailable");
      return this.#snapshot({
        sequence,
        capturedAt,
        connection: "offline",
        health: unknownHealth,
        brains: [],
        sessions: [],
        errorCode: errorCode(error),
      });
    }

    if (auth.auth_required && !auth.authed) {
      this.#clearBrainCatalog("sign_in_required");
      return this.#snapshot({
        sequence,
        capturedAt,
        connection: "sign_in_required",
        health,
        brains: [],
        sessions: [],
      });
    }

    try {
      const rawBrains = await this.#get("brains", rawBrainsSchema);
      const projectedBrains = projectBrainSummaries(rawBrains);
      this.#setBrainCatalog(rawBrains.brains.map((raw, index) => ({
        path: raw.path,
        summary: projectedBrains[index] as BrainSummary,
      })));
      try {
        const rawSessions = await this.#get("sessions?limit=50", rawSessionsSchema);
        return this.#snapshot({
          sequence,
          capturedAt,
          connection: health.status === "ok" ? "ready" : "degraded",
          health,
          brains: projectedBrains,
          sessions: projectSessions(rawSessions, createBrainPathIdLookup(rawBrains)),
        });
      } catch (error) {
        const code = errorCode(error);
        if (code === "unauthorized") {
          this.#clearBrainCatalog("sign_in_required");
          return this.#snapshot({
            sequence,
            capturedAt,
            connection: "sign_in_required",
            health: { ...health, authenticated: false },
            brains: [],
            sessions: [],
            errorCode: code,
          });
        }
        return this.#snapshot({
          sequence,
          capturedAt,
          connection: "degraded",
          health,
          brains: projectedBrains,
          sessions: [],
          errorCode: code,
        });
      }
    } catch (error) {
      const code = errorCode(error);
      this.#clearBrainCatalog(code === "unauthorized" ? "sign_in_required" : "unavailable");
      return this.#snapshot({
        sequence,
        capturedAt,
        connection: code === "unauthorized" ? "sign_in_required" : "degraded",
        health: code === "unauthorized" ? { ...health, authenticated: false } : health,
        brains: [],
        sessions: [],
        errorCode: code,
      });
    }
  }

  async readKnowledge(brainId: BrainSummary["id"]): Promise<JarvisKnowledgeSnapshot> {
    const capturedAt = this.#now().toISOString();
    if (this.#catalogState === "sign_in_required") {
      return deepFreeze({ state: "sign_in_required", capturedAt });
    }
    if (this.#catalogState !== "ready") {
      return deepFreeze({ state: "unavailable", capturedAt, errorCode: "catalog_unavailable" });
    }
    const catalogVersion = this.#catalogVersion;
    const selected = this.#brainCatalog.get(brainId);
    if (selected === undefined) {
      return deepFreeze({ state: "unavailable", capturedAt, errorCode: "unknown_brain" });
    }

    const url = new URL("graph", this.#endpoint);
    url.searchParams.set("path", selected.path);
    url.searchParams.set("orphans", "0");
    try {
      const raw = await getBoundedJson({
        transport: this.#transport,
        url,
        schema: rawKnowledgeGraphSchema,
        maxBytes: MAX_GRAPH_JSON_BYTES,
      });
      if (catalogVersion !== this.#catalogVersion || this.#catalogState !== "ready") {
        return deepFreeze({ state: "unavailable", capturedAt, errorCode: "catalog_unavailable" });
      }
      return deepFreeze({
        state: "ready",
        capturedAt,
        brain: { ...selected.summary },
        graph: projectKnowledgeGraph(raw, selected.summary.id),
      });
    } catch (error) {
      const code = errorCode(error);
      if (code === "unauthorized") {
        this.#clearBrainCatalog("sign_in_required");
        return deepFreeze({ state: "sign_in_required", capturedAt });
      }
      return deepFreeze({ state: "unavailable", capturedAt, errorCode: code });
    }
  }

  async #get<T>(path: string, schema: { parse(value: unknown): T }): Promise<T> {
    return getBoundedJson({
      transport: this.#transport,
      url: new URL(path, this.#endpoint),
      schema,
    });
  }

  #clearBrainCatalog(state: "unavailable" | "sign_in_required"): void {
    this.#brainCatalog.clear();
    this.#catalogState = state;
    this.#catalogVersion += 1;
  }

  #setBrainCatalog(entries: readonly { path: string; summary: BrainSummary }[]): void {
    this.#brainCatalog.clear();
    for (const entry of entries) this.#brainCatalog.set(entry.summary.id, entry);
    this.#catalogState = "ready";
    this.#catalogVersion += 1;
  }

  #snapshot(input: Omit<JarvisReadSnapshot, "endpoint">): JarvisReadSnapshot {
    return deepFreeze({
      ...input,
      endpoint: this.#endpoint.href,
    });
  }
}
