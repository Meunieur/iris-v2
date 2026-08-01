import { describe, expect, it, vi } from "vitest";

import {
  createConversationRuntime,
  conversationContextFromJarvisSnapshot,
} from "../src/main/conversation-runtime";

function fakeProviderClient() {
  return {
    live: { connect: vi.fn(async () => ({
      close: vi.fn(),
      sendRealtimeInput: vi.fn(),
      sendClientContent: vi.fn(),
      sendToolResponse: vi.fn(),
    })) },
  };
}

describe("main-process conversation runtime", () => {
  it("keeps Gemini disabled unless the explicit environment gate is 1", () => {
    const createClient = vi.fn(() => fakeProviderClient());
    const runtime = createConversationRuntime({
      env: {},
      createClient,
      getJarvisSnapshot: () => undefined,
      scheduler: { set: () => 1, clear: () => undefined },
    });

    expect(runtime.controller.current()).toMatchObject({ state: "disabled" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not instantiate a provider or expose a key when credentials are missing", () => {
    const createClient = vi.fn(() => fakeProviderClient());
    const runtime = createConversationRuntime({
      env: { IRIS_GEMINI_ENABLED: "1" },
      createClient,
      getJarvisSnapshot: () => undefined,
      scheduler: { set: () => 1, clear: () => undefined },
    });

    expect(runtime.controller.current()).toMatchObject({ state: "missing_credentials" });
    expect(createClient).not.toHaveBeenCalled();
    expect(JSON.stringify(runtime.controller.current())).not.toMatch(/AIza|secret|api[_-]?key/i);
  });

  it("creates the provider only inside main and maps public Jarvis context to opaque IDs", async () => {
    const client = fakeProviderClient();
    const createClient = vi.fn(() => client);
    const runtime = createConversationRuntime({
      env: {
        IRIS_GEMINI_ENABLED: "1",
        GEMINI_API_KEY: "main-only-key",
        IRIS_GEMINI_MODEL: "model-from-main",
      },
      createClient,
      getJarvisSnapshot: () => ({
        connection: "ready",
        health: { authenticated: true },
        brains: [{ id: "brain_public", name: "Orca", notes: 1, isDefault: true }],
        sessions: [{ id: "session_public", title: "Hiá»‡n táº¡i" }],
      }),
      scheduler: { set: () => 1, clear: () => undefined },
    });

    expect(runtime.controller.current()).toMatchObject({ model: "model-from-main", state: "idle" });
    expect(createClient).toHaveBeenCalledWith({ apiKey: "main-only-key" });
    expect(JSON.stringify(runtime.controller.current())).not.toContain("main-only-key");
    await runtime.controller.start();
    expect(client.live.connect).toHaveBeenCalled();
  });

  it("does not invent a proposal context when Jarvis is unauthenticated or empty", () => {
    expect(conversationContextFromJarvisSnapshot(undefined)).toBeUndefined();
    expect(conversationContextFromJarvisSnapshot({
      connection: "sign_in_required",
      health: { authenticated: false },
      brains: [{ id: "brain_public", name: "Orca", notes: 1, isDefault: true }],
      sessions: [{ id: "session_public", title: "Hiá»‡n táº¡i" }],
    })).toBeUndefined();
    expect(conversationContextFromJarvisSnapshot({
      connection: "ready",
      health: { authenticated: true },
      brains: [],
      sessions: [],
    })).toBeUndefined();
  });
});
