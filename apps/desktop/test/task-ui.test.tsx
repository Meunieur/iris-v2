// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BrainSummary } from "@iris/contracts";
import type { JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";

import { TaskDock } from "../src/renderer/task/TaskDock.js";

afterEach(() => cleanup());

const brain = {
  id: `brain_${"a".repeat(64)}` as `brain_${string}`,
  name: "Brain Default",
  notes: 42,
  isDefault: true,
} satisfies BrainSummary;

const idle: JarvisTaskControllerSnapshot = {
  sequence: 0,
  capturedAt: "1970-01-01T00:00:00.000Z",
  connection: "idle",
};

function renderDock(state: JarvisTaskControllerSnapshot, connection: "ready" | "sign_in_required" = "ready") {
  const actions = { onSelect: vi.fn(), onSend: vi.fn(), onStop: vi.fn() };
  render(<TaskDock
    brains={[brain]}
    selectedBrainId={brain.id}
    connection={connection}
    state={state}
    busy={false}
    {...actions}
  />);
  return actions;
}

describe("TaskDock", () => {
  it("submits an explicit R0 read task for the selected opaque brain", () => {
    const actions = renderDock(idle);
    fireEvent.change(screen.getByLabelText("Yêu cầu cho Jarvis"), { target: { value: "Tóm tắt các quyết định mới nhất" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi tác vụ R0" }));

    expect(actions.onSend).toHaveBeenCalledWith({
      brainId: brain.id,
      message: "Tóm tắt các quyết định mới nhất",
    });
    expect(screen.getByText(/R0 · chỉ đọc/i)).toBeTruthy();
    expect(screen.getByText(/JarvisOS là nguồn trạng thái duy nhất/i)).toBeTruthy();
  });

  it("does not claim success from non-terminal model text", () => {
    renderDock({
      sequence: 2,
      capturedAt: "2026-07-31T02:00:00.000Z",
      connection: "active",
      task: {
        version: 1,
        task_id: "t_0123456789ab",
        intent_id: "43fe94df-373f-4ad0-931c-7f6418719b5a",
        brain_id: brain.id,
        session_id: "",
        risk: "R0",
        status: "running",
        terminal: false,
        outcome: null,
        orphaned: false,
        can_stop: true,
        current_run_id: "run_0123456789abcd",
        result: "I think I am done",
        replayed: false,
        event_cursor: 2,
        events: [],
        runs: [],
      },
    });

    expect(screen.getAllByText("Đang thực thi")).toHaveLength(2);
    expect(screen.queryByText("Hoàn thành")).toBeNull();
    expect(screen.queryByText("I think I am done")).toBeNull();
    expect(screen.getByRole("button", { name: "Dừng tác vụ" })).toBeTruthy();
  });

  it("does not offer a stop mutation while the Jarvis session is signed out", () => {
    renderDock({
      sequence: 2,
      capturedAt: "2026-07-31T02:00:00.000Z",
      connection: "sign_in_required",
      task: {
        version: 1,
        task_id: "t_0123456789ab",
        intent_id: "43fe94df-373f-4ad0-931c-7f6418719b5a",
        brain_id: brain.id,
        session_id: "",
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
        events: [],
        runs: [],
      },
    }, "sign_in_required");

    expect((document.querySelector(".text-button.danger") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Trạng thái tác vụ Jarvis").textContent).toContain("Cần đăng nhập");
  });

  it("does not offer a replacement turn while an unknown submit is reconnecting", () => {
    renderDock({
      sequence: 2,
      capturedAt: "2026-07-31T02:00:00.000Z",
      connection: "reconnecting",
      errorCode: "unreachable",
    });

    const composer = document.querySelector("#task-message") as HTMLTextAreaElement;
    const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.change(composer, { target: { value: "Do not replace the pending intent" } });

    expect(submit.disabled).toBe(true);
  });

  it("shows success only from authoritative done outcome and disables submit while signed out", () => {
    renderDock({
      sequence: 3,
      capturedAt: "2026-07-31T02:00:03.000Z",
      connection: "terminal",
      task: {
        version: 1,
        task_id: "t_0123456789ab",
        intent_id: "43fe94df-373f-4ad0-931c-7f6418719b5a",
        brain_id: brain.id,
        session_id: "",
        risk: "R0",
        status: "done",
        terminal: true,
        outcome: "succeeded",
        orphaned: false,
        can_stop: false,
        current_run_id: "",
        result: "Đã hoàn thành từ Jarvis task store",
        replayed: false,
        event_cursor: 3,
        events: [],
        runs: [],
      },
    });
    expect(screen.getAllByText("Hoàn thành")).toHaveLength(2);
    expect(screen.getByText("Đã hoàn thành từ Jarvis task store")).toBeTruthy();

    cleanup();
    renderDock(idle, "sign_in_required");
    expect(screen.getByRole("button", { name: "Gửi tác vụ R0" }).hasAttribute("disabled")).toBe(true);
  });
});
