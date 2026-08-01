import { describe, expect, it } from "vitest";

import { jarvisTaskSnapshotSchema } from "../src/index.js";

const snapshot = {
  version: 1,
  task_id: "t_0123456789ab",
  intent_id: "43fe94df-373f-4ad0-931c-7f6418719b5a",
  brain_id: `brain_${"a".repeat(64)}`,
  session_id: "iris-session-01",
  risk: "R0",
  status: "running",
  terminal: false,
  outcome: null,
  orphaned: false,
  can_stop: true,
  current_run_id: "run_0123456789abcd",
  result: "",
  replayed: false,
  event_cursor: 2,
  events: [
    { id: 1, type: "created", run_id: "", created_at: 1_785_500_000 },
    { id: 2, type: "started", run_id: "run_0123456789abcd", created_at: 1_785_500_001 },
  ],
  runs: [
    {
      run_id: "run_0123456789abcd",
      status: "running",
      started_at: 1_785_500_001,
      finished_at: 0,
      heartbeat_at: 1_785_500_002,
    },
  ],
} as const;

describe("Jarvis task lifecycle contract", () => {
  it("accepts the allowlisted authoritative running snapshot", () => {
    expect(jarvisTaskSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it.each([
    ["raw brain path", { ...snapshot, brain_root: "E:\\private\\Brain" }],
    ["unknown event", { ...snapshot, events: [{ ...snapshot.events[0], type: "tool_secret" }] }],
    ["duplicate event", { ...snapshot, events: [snapshot.events[0], snapshot.events[0]] }],
    ["out-of-order event", { ...snapshot, events: [snapshot.events[1], snapshot.events[0]] }],
    ["model-inferred completion", { ...snapshot, terminal: true, outcome: "succeeded" }],
    ["missing run identity", { ...snapshot, current_run_id: "" }],
  ])("rejects %s", (_name, value) => {
    expect(() => jarvisTaskSnapshotSchema.parse(value)).toThrow();
  });

  it("accepts success only when Jarvis status is terminal done", () => {
    expect(jarvisTaskSnapshotSchema.parse({
      ...snapshot,
      status: "done",
      terminal: true,
      outcome: "succeeded",
      orphaned: false,
      can_stop: false,
      current_run_id: "",
      result: "Finished from Jarvis task store",
    }).outcome).toBe("succeeded");
  });
});
