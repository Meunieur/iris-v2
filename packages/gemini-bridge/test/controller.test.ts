import { describe, expect, it, vi } from "vitest";

import {
  createConversationController,
  type ConversationProviderEvent,
  type ConversationProviderSession,
  type ConversationScheduler,
} from "../src/index";

const FIRST_UUID = "11111111-1111-4111-8111-111111111111";
const SECOND_UUID = "22222222-2222-4222-8222-222222222222";

function schedulerHarness() {
  const tasks = new Map<number, () => void>();
  let nextHandle = 1;
  const scheduler: ConversationScheduler = {
    set: vi.fn((_delayMs, task) => {
      const handle = nextHandle++;
      tasks.set(handle, task);
      return handle;
    }),
    clear: vi.fn((handle) => tasks.delete(handle as number)),
  };
  return {
    scheduler,
    runNext: () => {
      const entry = tasks.entries().next().value as [number, () => void] | undefined;
      if (entry === undefined) return false;
      tasks.delete(entry[0]);
      entry[1]();
      return true;
    },
    taskCount: () => tasks.size,
  };
}

function providerHarness() {
  let onEvent: ((event: ConversationProviderEvent) => void) | undefined;
  let onClose: (() => void) | undefined;
  const session: ConversationProviderSession = {
    close: vi.fn(),
    interrupt: vi.fn(),
    sendAudio: vi.fn(),
    sendText: vi.fn(),
    sendToolResponse: vi.fn(),
  };
  const connect = vi.fn(async (input: {
    onEvent(event: ConversationProviderEvent): void;
    onClose(): void;
  }) => {
    onEvent = input.onEvent;
    onClose = input.onClose;
    return session;
  });
  return {
    connect,
    emit: (event: ConversationProviderEvent) => onEvent?.(event),
    closeUnexpectedly: () => onClose?.(),
    session,
  };
}

function controllerHarness(overrides: Partial<Parameters<typeof createConversationController>[0]> = {}) {
  const provider = providerHarness();
  const scheduled = schedulerHarness();
  const ids = [FIRST_UUID, SECOND_UUID];
  const controller = createConversationController({
    enabled: true,
    hasCredentials: true,
    model: "gemini-3.1-flash-live-preview",
    provider: { connect: provider.connect },
    scheduler: scheduled.scheduler,
    now: () => new Date("2026-07-28T12:00:00.000Z"),
    randomUuid: () => ids.shift() ?? SECOND_UUID,
    getContext: () => ({ brainId: "brain_public", sessionId: "session_public", runId: null }),
    retryDelaysMs: [100, 200],
    ...overrides,
  });
  return { controller, provider, scheduled };
}

describe("Gemini conversation controller", () => {
  it("stays disabled without opening a provider connection", async () => {
    const { controller, provider } = controllerHarness({ enabled: false });

    await controller.start();

    expect(controller.current()).toMatchObject({ state: "disabled", remoteStreaming: false });
    expect(provider.connect).not.toHaveBeenCalled();
  });

  it("reports missing credentials without exposing credential detail", async () => {
    const { controller, provider } = controllerHarness({ hasCredentials: false });

    await controller.start();

    expect(controller.current()).toMatchObject({
      state: "missing_credentials",
      error: "missing_credentials",
    });
    expect(JSON.stringify(controller.current())).not.toMatch(/api[_-]?key|secret|not-real/i);
    expect(provider.connect).not.toHaveBeenCalled();
  });

  it("streams bounded text and audio only through the connected provider", async () => {
    const { controller, provider } = controllerHarness();
    await controller.start();
    controller.setMicrophoneState("active");

    await expect(controller.sendText("Xin chÃ o Iris")).resolves.toEqual({ accepted: true });
    await expect(controller.sendAudio(new Uint8Array([1, 2, 3, 4]))).resolves.toEqual({ accepted: true });

    expect(provider.session.sendText).toHaveBeenCalledWith("Xin chÃ o Iris");
    expect(provider.session.sendAudio).toHaveBeenCalledWith(new Uint8Array([1, 2, 3, 4]));
    expect(controller.current()).toMatchObject({ state: "listening", microphone: "active", remoteStreaming: true });
    await expect(controller.sendAudio(new Uint8Array(32_769))).rejects.toThrow("Conversation audio chunk rejected");
    await expect(controller.sendText("x".repeat(8_193))).rejects.toThrow("Conversation text rejected");
  });

  it("normalizes transcripts, usage, audio, interruption and completion events", async () => {
    const { controller, provider } = controllerHarness();
    const events: unknown[] = [];
    controller.subscribeEvent((event) => events.push(event));
    await controller.start();

    provider.emit({ type: "input_transcript", text: "Má»Ÿ", final: false });
    provider.emit({ type: "input_transcript", text: " má»™t tÃ¡c vá»¥", final: true });
    provider.emit({ type: "output_transcript", text: "ÄÃ£ hiá»ƒu", final: true });
    provider.emit({ type: "usage", inputTokens: 12, outputTokens: 8, totalTokens: 20 });
    provider.emit({ type: "audio", pcm16: new Uint8Array([0, 1]) });
    provider.emit({ type: "interrupted" });
    provider.emit({ type: "turn_complete" });

    expect(controller.current()).toMatchObject({
      inputTranscript: "Má»Ÿ má»™t tÃ¡c vá»¥",
      outputTranscript: "ÄÃ£ hiá»ƒu",
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
      cost: "unavailable",
      state: "listening",
    });
    expect(events).toEqual(expect.arrayContaining([
      { type: "audio_output", pcm16: new Uint8Array([0, 1]), sampleRate: 24_000 },
      { type: "interrupted" },
      { type: "turn_complete" },
    ]));
  });

  it("reconnects once with the latest resumable handle and keeps one timer", async () => {
    const { controller, provider, scheduled } = controllerHarness();
    await controller.start();
    provider.emit({ type: "session_resumption", resumable: true, handle: "resume-private" });

    provider.emit({ type: "go_away", timeLeftMs: 500 });
    provider.closeUnexpectedly();

    expect(controller.current().state).toBe("reconnecting");
    expect(scheduled.taskCount()).toBe(1);
    expect(scheduled.runNext()).toBe(true);
    await vi.waitFor(() => expect(provider.connect).toHaveBeenCalledTimes(2));
    expect(provider.connect.mock.calls[1]?.[0]).toMatchObject({ resumeHandle: "resume-private" });
    expect(JSON.stringify(controller.current())).not.toContain("resume-private");
  });

  it("interrupts playback without cancelling Jarvis and cleans up on stop", async () => {
    const { controller, provider, scheduled } = controllerHarness();
    const events: unknown[] = [];
    controller.subscribeEvent((event) => events.push(event));
    await controller.start();

    await controller.interrupt();
    await controller.stop();

    expect(provider.session.interrupt).toHaveBeenCalledTimes(1);
    expect(provider.session.close).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({ type: "interrupted" });
    expect(scheduled.taskCount()).toBe(0);
    expect(controller.current()).toMatchObject({ state: "idle", microphone: "off", remoteStreaming: false });
  });
});
