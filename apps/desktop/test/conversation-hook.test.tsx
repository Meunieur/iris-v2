// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationEvent, ConversationSnapshot } from "@iris/gemini-bridge";
import type { IrisRendererApi } from "../src/preload/api.cjs";
import { useConversation } from "../src/renderer/conversation/use-conversation";

function snapshot(state: ConversationSnapshot["state"]): ConversationSnapshot {
  return {
    sequence: 1,
    provider: "gemini",
    model: "gemini-3.1-flash-live-preview",
    state,
    microphone: "off",
    remoteStreaming: false,
    inputTranscript: "",
    outputTranscript: "",
    cost: "unavailable",
  };
}

function installApi(initial: ConversationSnapshot) {
  let eventListener: ((event: ConversationEvent) => void) | undefined;
  const api = {
    getConversationSnapshot: vi.fn(async () => initial),
    startConversation: vi.fn(async () => initial),
    stopConversation: vi.fn(async () => snapshot("idle")),
    setMicrophoneState: vi.fn(async () => initial),
    requestMicrophonePermissionIntent: vi.fn(async () => ({ accepted: true as const })),
    sendConversationAudio: vi.fn(async () => ({ accepted: true as const })),
    sendConversationText: vi.fn(async () => ({ accepted: true as const })),
    interruptConversation: vi.fn(async () => initial),
    onConversationEvent: vi.fn((listener: (event: ConversationEvent) => void) => {
      eventListener = listener;
      return vi.fn();
    }),
  } as unknown as IrisRendererApi;
  Object.defineProperty(window, "iris", { configurable: true, value: api });
  return { api, publish: (event: ConversationEvent) => eventListener?.(event) };
}

afterEach(() => Reflect.deleteProperty(window, "iris"));

describe("useConversation", () => {
  it("does not subscribe or touch the provider when disabled", async () => {
    const installed = installApi(snapshot("disabled"));
    const { result } = renderHook(() => useConversation(false));

    expect(result.current.state.state).toBe("disabled");
    expect(installed.api.onConversationEvent).not.toHaveBeenCalled();
    expect(installed.api.getConversationSnapshot).not.toHaveBeenCalled();
  });

  it("loads provider state and keeps disabled start offline without requesting a microphone", async () => {
    const installed = installApi(snapshot("disabled"));
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    const { result } = renderHook(() => useConversation());

    await waitFor(() => expect(result.current.state.state).toBe("disabled"));
    await act(async () => { await result.current.start(); });

    expect(installed.api.startConversation).toHaveBeenCalledTimes(1);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("reconciles provider events and keeps text, interrupt and stop on fixed API methods", async () => {
    const installed = installApi(snapshot("idle"));
    const { result } = renderHook(() => useConversation());
    await waitFor(() => expect(result.current.state.state).toBe("idle"));

    const ready = { ...snapshot("listening"), sequence: 2, inputTranscript: "xin chÃ o" } satisfies ConversationSnapshot;
    act(() => installed.publish({ type: "snapshot", snapshot: ready }));
    await waitFor(() => expect(result.current.state.inputTranscript).toBe("xin chÃ o"));

    await act(async () => { await result.current.sendText("tÃ¬m brain"); });
    await act(async () => { await result.current.interrupt(); });
    await act(async () => { await result.current.stop(); });

    expect(installed.api.sendConversationText).toHaveBeenCalledWith("tÃ¬m brain");
    expect(installed.api.interruptConversation).toHaveBeenCalledTimes(1);
    expect(installed.api.stopConversation).toHaveBeenCalledTimes(1);
  });
});
