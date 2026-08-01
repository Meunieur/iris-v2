import { describe, expect, it, vi } from "vitest";

import type { JarvisKnowledgeSnapshot } from "@iris/jarvis-adapter";

import {
  IPC_CHANNELS,
  createRendererApi,
  type PreloadIpc,
} from "../src/preload/api.cjs";

const brainId = `brain_${"a".repeat(64)}` as const;
const snapshot = {
  state: "sign_in_required",
  capturedAt: "2026-07-31T03:00:00.000Z",
} satisfies JarvisKnowledgeSnapshot;

describe("Second Brain preload boundary", () => {
  it("maps one fixed method to the fixed knowledge channel", async () => {
    const ipc: PreloadIpc = {
      invoke: vi.fn(async () => snapshot),
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    const api = createRendererApi(ipc);

    await expect(api.loadKnowledge(brainId)).resolves.toBe(snapshot);
    expect(ipc.invoke).toHaveBeenCalledWith(IPC_CHANNELS.loadKnowledge, brainId);
    expect(api).not.toHaveProperty("graphPath");
    expect(api).not.toHaveProperty("fetch");
    expect(api).not.toHaveProperty("query");
  });
});
