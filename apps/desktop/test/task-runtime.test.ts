import { describe, expect, it, vi } from "vitest";

import type { JarvisTransport, Scheduler } from "@iris/jarvis-adapter";

import { createAttachedRuntime } from "../src/main/runtime.js";

describe("attached task runtime", () => {
  it("creates the task client and controller over the same authenticated transport", () => {
    const transport: JarvisTransport = { fetch: vi.fn() };
    const scheduler: Scheduler = { set: vi.fn(), clear: vi.fn() };

    const runtime = createAttachedRuntime({
      endpoint: new URL("http://127.0.0.1:7777/"),
      transport,
      scheduler,
    });

    expect(runtime.taskClient.endpoint).toBe("http://127.0.0.1:7777/");
    expect(runtime.taskController.current()).toEqual({
      sequence: 0,
      capturedAt: "1970-01-01T00:00:00.000Z",
      connection: "idle",
    });
  });
});
