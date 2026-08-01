import { describe, expect, it, vi } from "vitest";

import {
  createGeminiProvider,
  type GeminiSdkClient,
  type GeminiSdkSession,
} from "../src/main/gemini-provider";

function sdkHarness() {
  let callbacks: { onmessage(message: unknown): void; onclose(event: unknown): void } | undefined;
  const session: GeminiSdkSession = {
    close: vi.fn(),
    sendRealtimeInput: vi.fn(),
    sendClientContent: vi.fn(),
    sendToolResponse: vi.fn(),
  };
  const client: GeminiSdkClient = {
    live: {
      connect: vi.fn(async (input) => {
        callbacks = input.callbacks;
        return session;
      }),
    },
  };
  return {
    client,
    session,
    emit: (message: unknown) => callbacks?.onmessage(message),
    close: (event: unknown = {}) => callbacks?.onclose(event),
  };
}

describe("Gemini main-process provider adapter", () => {
  it("opens a server-side Live session with only the proposal function", async () => {
    const harness = sdkHarness();
    const provider = createGeminiProvider({ client: harness.client });
    const onEvent = vi.fn();
    const onClose = vi.fn();

    await provider.connect({ model: "gemini-3.1-flash-live-preview", onEvent, onClose });

    const connect = vi.mocked(harness.client.live.connect);
    const request = connect.mock.calls[0]?.[0];
    expect(request?.model).toBe("gemini-3.1-flash-live-preview");
    expect(request?.config?.responseModalities).toEqual(["AUDIO"]);
    expect(request?.config?.inputAudioTranscription).toEqual({});
    expect(request?.config?.outputAudioTranscription).toEqual({});
    expect(request?.config?.sessionResumption).toEqual({ transparent: true });
    expect(request?.config?.contextWindowCompression).toEqual({ slidingWindow: {} });
    expect(request?.config?.tools).toHaveLength(1);
    expect(request?.config?.tools?.[0]).toHaveProperty("functionDeclarations");
    expect(request?.config?.tools?.[0]).not.toHaveProperty("googleSearch");
    expect(request?.config?.tools?.[0]).not.toHaveProperty("codeExecution");
    expect(request?.config?.tools?.[0]).not.toHaveProperty("urlContext");
    expect(request?.config?.tools?.[0]).not.toHaveProperty("mcpServers");
    expect(request?.config?.tools?.[0]?.functionDeclarations).toHaveLength(1);
    expect(request?.config?.tools?.[0]?.functionDeclarations?.[0]?.name).toBe("propose_capability");
  });

  it("forwards bounded audio/text, uses activity start for interruption, and maps tool responses", async () => {
    const harness = sdkHarness();
    const provider = createGeminiProvider({ client: harness.client });
    const session = await provider.connect({ model: "model", onEvent: vi.fn(), onClose: vi.fn() });

    await session.sendAudio(new Uint8Array([0, 1, 2, 3]));
    await session.sendText("Xin chÃ o");
    await session.interrupt();
    await session.sendToolResponse([{
      id: "call-1",
      name: "propose_capability",
      response: { status: "pending_jarvis_policy_and_approval", intentId: "intent-1" },
    }]);

    expect(harness.session.sendRealtimeInput).toHaveBeenNthCalledWith(1, {
      audio: { data: "AAECAw==", mimeType: "audio/pcm;rate=16000" },
    });
    expect(harness.session.sendRealtimeInput).toHaveBeenNthCalledWith(2, { text: "Xin chÃ o" });
    expect(harness.session.sendRealtimeInput).toHaveBeenNthCalledWith(3, { activityStart: {} });
    expect(harness.session.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [{
        id: "call-1",
        name: "propose_capability",
        response: { status: "pending_jarvis_policy_and_approval", intentId: "intent-1" },
      }],
    });
  });

  it("normalizes SDK messages and forwards close without exposing raw payloads", async () => {
    const harness = sdkHarness();
    const provider = createGeminiProvider({ client: harness.client });
    const onEvent = vi.fn();
    const onClose = vi.fn();
    await provider.connect({ model: "model", onEvent, onClose });

    harness.emit({
      serverContent: {
        inputTranscription: { text: "xin chÃ o" },
        outputTranscription: { text: "ChÃ o trẫm" },
        modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAE=" } }] },
        turnComplete: true,
      },
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 },
    });
    harness.close({ reason: "provider-private" });

    expect(onEvent).toHaveBeenCalledWith({ type: "input_transcript", text: "xin chÃ o", final: true });
    expect(onEvent).toHaveBeenCalledWith({ type: "output_transcript", text: "ChÃ o trẫm", final: true });
    expect(onEvent).toHaveBeenCalledWith({ type: "audio", pcm16: new Uint8Array([0, 1]) });
    expect(onEvent).toHaveBeenCalledWith({ type: "usage", inputTokens: 2, outputTokens: 3, totalTokens: 5 });
    expect(onEvent).toHaveBeenCalledWith({ type: "turn_complete" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onEvent.mock.calls)).not.toContain("provider-private");
  });
});
