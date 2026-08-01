// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationSnapshot } from "@iris/gemini-bridge";
import { ConversationDock } from "../src/renderer/conversation/ConversationDock";

function snapshot(overrides: Partial<ConversationSnapshot> = {}): ConversationSnapshot {
  return {
    sequence: 1,
    provider: "gemini",
    model: "gemini-3.1-flash-live-preview",
    state: "disabled",
    microphone: "off",
    remoteStreaming: false,
    inputTranscript: "",
    outputTranscript: "",
    cost: "unavailable",
    ...overrides,
  };
}

function renderDock(state: ConversationSnapshot) {
  const actions = {
    onStart: vi.fn(),
    onStop: vi.fn(),
    onInterrupt: vi.fn(),
    onSendText: vi.fn(),
  };
  render(<ConversationDock state={state} busy={false} {...actions} />);
  return actions;
}

afterEach(cleanup);

describe("ConversationDock", () => {
  it("makes disabled and missing-credential privacy states explicit", () => {
    renderDock(snapshot());
    expect(screen.getByRole("heading", { name: "Hội thoại Gemini" })).toBeTruthy();
    expect(screen.getByText("Đã tắt")).toBeTruthy();
    expect(screen.getAllByText(/không gửi microphone/i).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Gemini chưa được bật" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows live controls, transcript, usage and proposal-only state without approval", async () => {
    const user = userEvent.setup();
    const actions = renderDock(snapshot({
      state: "listening",
      microphone: "active",
      remoteStreaming: true,
      inputTranscript: "Mở tài liệu",
      outputTranscript: "Khanh đã hiểu",
      usage: { totalTokens: 42 },
      proposal: {
        intentId: "intent-public",
        capability: "browser.open",
        arguments: { url: "https://example.com" },
        risk: "R2",
        reason: "Mở trang ngoài",
        approvalRequired: true,
        approvalState: "proposed",
        expiresAt: "2026-07-28T12:05:00.000Z",
      },
    }));

    expect(screen.getByText("Đang nghe")).toBeTruthy();
    expect(screen.getByText("Mở tài liệu")).toBeTruthy();
    expect(screen.getByText("Khanh đã hiểu")).toBeTruthy();
    expect(screen.getByText(/42 token/i)).toBeTruthy();
    expect(screen.getByText("browser.open")).toBeTruthy();
    expect(screen.getByText(/chờ Jarvis phê duyệt/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /phê duyệt|thực thi|chạy/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Ngắt lượt nói" }));
    expect(actions.onInterrupt).toHaveBeenCalledTimes(1);
    await user.type(screen.getByRole("textbox", { name: "Gửi câu chữ" }), "tiếp tục");
    await user.click(screen.getByRole("button", { name: "Gửi" }));
    expect(actions.onSendText).toHaveBeenCalledWith("tiếp tục");
  });
});
