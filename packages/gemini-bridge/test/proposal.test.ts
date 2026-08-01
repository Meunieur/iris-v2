import { describe, expect, it, vi } from "vitest";

import {
  createConversationController,
  normalizeProviderMessage,
  type ConversationProviderEvent,
  type ConversationProviderSession,
} from "../src/index";

const FIRST_UUID = "11111111-1111-4111-8111-111111111111";
const SECOND_UUID = "22222222-2222-4222-8222-222222222222";

function providerHarness() {
  let onEvent: ((event: ConversationProviderEvent) => void) | undefined;
  const session: ConversationProviderSession = {
    close: vi.fn(),
    interrupt: vi.fn(),
    sendAudio: vi.fn(),
    sendText: vi.fn(),
    sendToolResponse: vi.fn(),
  };
  const connect = vi.fn(async (input: { onEvent(event: ConversationProviderEvent): void }) => {
    onEvent = input.onEvent;
    return session;
  });
  return { connect, emit: (event: ConversationProviderEvent) => onEvent?.(event), session };
}

function createHarness(context: { brainId: string; sessionId: string; runId: string | null } | null = {
  brainId: "brain_public",
  sessionId: "session_public",
  runId: null,
}) {
  const provider = providerHarness();
  const controller = createConversationController({
    enabled: true,
    hasCredentials: true,
    model: "gemini-3.1-flash-live-preview",
    provider: { connect: provider.connect },
    scheduler: { set: () => 1, clear: () => undefined },
    now: () => new Date("2026-07-28T12:00:00.000Z"),
    randomUuid: (() => {
      const ids = [FIRST_UUID, SECOND_UUID];
      return () => ids.shift() ?? SECOND_UUID;
    })(),
    getContext: () => context === null ? undefined : context,
  });
  return { controller, provider };
}

describe("Gemini proposal boundary", () => {
  it("turns the single proposal function into a validated proposed-only envelope", async () => {
    const { controller, provider } = createHarness();
    await controller.start();

    provider.emit({
      type: "tool_call",
      calls: [{
        id: "call-1",
        name: "propose_capability",
        args: {
          capability: "browser.open",
          arguments: { url: "https://example.com" },
          risk: { level: "R2", reason: "Má»Ÿ trang ngoÃ i" },
        },
      }],
    });

    await vi.waitFor(() => expect(controller.current().proposal).toMatchObject({
      intentId: FIRST_UUID,
      capability: "browser.open",
      risk: "R2",
      approvalRequired: true,
      approvalState: "proposed",
    }));
    expect(provider.session.sendToolResponse).toHaveBeenCalledWith([{
      id: "call-1",
      name: "propose_capability",
      response: { status: "pending_jarvis_policy_and_approval", intentId: FIRST_UUID },
    }]);
    expect(provider.session).not.toHaveProperty("execute");
  });

  it("fails closed for unknown functions, missing Jarvis context and credential-bearing arguments", async () => {
    const unknown = createHarness();
    await unknown.controller.start();
    unknown.provider.emit({ type: "tool_call", calls: [{ id: "x", name: "shell_exec", args: { command: "whoami" } }] });
    await vi.waitFor(() => expect(unknown.controller.current()).toMatchObject({ error: "proposal_rejected" }));
    expect(unknown.provider.session.sendToolResponse).toHaveBeenCalledWith([{
      id: "x",
      name: "shell_exec",
      response: { status: "rejected", reason: "unsupported_function" },
    }]);

    const missingContext = createHarness(null);
    await missingContext.controller.start();
    missingContext.provider.emit({
      type: "tool_call",
      calls: [{ id: "y", name: "propose_capability", args: { capability: "files.read", arguments: {}, risk: { level: "R0", reason: "read" } } }],
    });
    await vi.waitFor(() => expect(missingContext.controller.current()).toMatchObject({ error: "proposal_rejected" }));

    const secret = createHarness();
    await secret.controller.start();
    secret.provider.emit({
      type: "tool_call",
      calls: [{ id: "z", name: "propose_capability", args: { capability: "files.read", arguments: { api_key: "not-real" }, risk: { level: "R0", reason: "read" } } }],
    });
    await vi.waitFor(() => expect(secret.controller.current()).toMatchObject({ error: "proposal_rejected" }));
    expect(JSON.stringify(secret.controller.current())).not.toContain("not-real");
  });

  it("normalizes only documented bounded provider message shapes", () => {
    expect(normalizeProviderMessage({
      serverContent: {
        inputTranscription: { text: "xin chÃ o" },
        turnComplete: false,
      },
    })).toEqual([{ type: "input_transcript", text: "xin chÃ o", final: false }]);

    expect(() => normalizeProviderMessage({
      toolCall: { functionCalls: [{ id: "x", name: "propose_capability", args: { command: "x".repeat(70_000) } }] },
    })).toThrow("Invalid Gemini provider message");
    expect(() => normalizeProviderMessage({ arbitraryExecutable: "shell" })).toThrow("Invalid Gemini provider message");
  });
});
