import { describe, expect, it, vi } from "vitest";

import type { JarvisTaskSnapshot } from "@iris/contracts";

import { JarvisTaskClient, JarvisReadError, type JarvisTransport } from "../src/index.js";

const endpoint = new URL("http://127.0.0.1:7777/");
const snapshot = {
  version: 1,
  task_id: "t_0123456789ab",
  intent_id: "43fe94df-373f-4ad0-931c-7f6418719b5a",
  brain_id: `brain_${"a".repeat(64)}` as `brain_${string}`,
  session_id: "iris-session-01",
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function harness(responses: Response[]) {
  const requests: Array<{ url: URL; init: RequestInit }> = [];
  const transport: JarvisTransport = {
    fetch: vi.fn(async (url, init) => {
      requests.push({ url, init });
      const response = responses.shift();
      if (response === undefined) throw new Error("No response queued");
      return response;
    }),
  };
  return { client: new JarvisTaskClient({ endpoint, transport }), requests };
}

describe("JarvisTaskClient", () => {
  it("submits one strict R0 turn through the authenticated transport", async () => {
    const { client, requests } = harness([jsonResponse(snapshot, 201)]);

    const result = await client.submitTurn({
      intentId: snapshot.intent_id,
      idempotencyKey: "174631e1-d82d-4724-8b7a-0b3d99f2f132",
      brainId: snapshot.brain_id,
      sessionId: snapshot.session_id,
      message: "Summarize the latest project decisions.",
    });

    expect(result).toEqual(snapshot);
    expect(Object.isFrozen(result)).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url.pathname).toBe("/iris/v1/turns");
    expect(requests[0]?.init).toMatchObject({
      method: "POST",
      credentials: "include",
      redirect: "error",
      cache: "no-store",
      headers: { accept: "application/json", "content-type": "application/json" },
    });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      version: 1,
      intent_id: snapshot.intent_id,
      idempotency_key: "174631e1-d82d-4724-8b7a-0b3d99f2f132",
      brain_id: snapshot.brain_id,
      session_id: snapshot.session_id,
      message: "Summarize the latest project decisions.",
    });
  });

  it("polls only the returned task and cursor, then stops that exact task", async () => {
    const cancelled = {
      ...snapshot,
      status: "cancelled",
      terminal: true,
      outcome: "cancelled",
      can_stop: false,
    } satisfies JarvisTaskSnapshot;
    const { client, requests } = harness([jsonResponse(snapshot), jsonResponse(cancelled)]);

    await client.readTask(snapshot.task_id, 41);
    await client.stopTask(snapshot.task_id);

    expect(requests.map(({ url }) => `${url.pathname}${url.search}`)).toEqual([
      `/iris/v1/turns/${snapshot.task_id}?after_event_id=41`,
      `/iris/v1/turns/${snapshot.task_id}/stop`,
    ]);
    expect(requests.map(({ init }) => init.method)).toEqual(["GET", "POST"]);
    expect(requests[1]?.init.body).toBeUndefined();
  });

  it("maps protected auth failure without exposing the response", async () => {
    const { client } = harness([jsonResponse({ detail: "Bearer private" }, 401)]);

    await expect(client.readTask(snapshot.task_id, 0)).rejects.toEqual(
      expect.objectContaining<Partial<JarvisReadError>>({ code: "unauthorized" }),
    );
  });

  it("maps an idempotency conflict as terminal transport evidence", async () => {
    const { client } = harness([jsonResponse({ detail: "idempotency payload mismatch" }, 409)]);

    await expect(client.submitTurn({
      intentId: snapshot.intent_id,
      idempotencyKey: "174631e1-d82d-4724-8b7a-0b3d99f2f132",
      brainId: snapshot.brain_id,
      message: "read",
    })).rejects.toEqual(expect.objectContaining<Partial<JarvisReadError>>({ code: "conflict" }));
  });

  it("sanitizes untrusted terminal result text before it can reach preload", async () => {
    const unsafe = {
      ...snapshot,
      status: "done",
      terminal: true,
      outcome: "succeeded",
      can_stop: false,
      result: "Authorization: Bearer private-result-token",
    } satisfies JarvisTaskSnapshot;
    const { client } = harness([jsonResponse(unsafe)]);

    const result = await client.readTask(snapshot.task_id, 0);

    expect(result.result).not.toContain("private-result-token");
    expect(result.result).toContain("[REDACTED]");
  });
});
