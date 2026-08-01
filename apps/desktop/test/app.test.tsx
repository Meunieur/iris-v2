// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JarvisKnowledgeSnapshot, JarvisReadSnapshot, JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";
import type { HudNativeSnapshot } from "../src/main/hud-native";
import type { ConversationEvent, ConversationSnapshot } from "@iris/gemini-bridge";
import type { IrisRendererApi } from "../src/preload/api.cjs";
import { App } from "../src/renderer/App";

const baseHealth = {
  status: "ok" as const,
  authRequired: true,
  authenticated: true,
  version: "0.9.156",
  mode: "windows" as const,
};

function snapshot(
  connection: JarvisReadSnapshot["connection"],
  overrides: Partial<JarvisReadSnapshot> = {},
): JarvisReadSnapshot {
  return {
    sequence: 1,
    capturedAt: "2026-07-24T07:15:00.000Z",
    endpoint: "http://127.0.0.1:7777/",
    connection,
    health: {
      ...baseHealth,
      status: connection === "offline" ? "offline" : connection === "degraded" ? "degraded" : "ok",
      authenticated: connection === "ready" || connection === "degraded",
    },
    brains: [],
    sessions: [],
    ...overrides,
  };
}

function installApi(
  initial: JarvisReadSnapshot,
  initialNative: HudNativeSnapshot = { mode: "deck", pointerInteractive: true, shortcutAvailable: true },
) {
  let snapshotListener: ((next: JarvisReadSnapshot) => void) | undefined;
  let nativeListener: ((next: HudNativeSnapshot) => void) | undefined;
  let taskListener: ((next: JarvisTaskControllerSnapshot) => void) | undefined;
  const snapshotDispose = vi.fn();
  const nativeDispose = vi.fn();
  let native = initialNative;
  const idleTask: JarvisTaskControllerSnapshot = {
    sequence: 0,
    capturedAt: "1970-01-01T00:00:00.000Z",
    connection: "idle",
  };
  const api: IrisRendererApi = {
    getSnapshot: vi.fn(async () => initial),
    refresh: vi.fn(async () => initial),
    openSignIn: vi.fn(async () => ({ opened: true })),
    loadKnowledge: vi.fn(async () => ({
      state: "unavailable",
      capturedAt: "2026-07-31T03:00:00.000Z",
      errorCode: "catalog_unavailable",
    } satisfies JarvisKnowledgeSnapshot)),
    getTaskSnapshot: vi.fn(async () => idleTask),
    sendTurn: vi.fn(async () => idleTask),
    stopTurn: vi.fn(async () => idleTask),
    onTaskSnapshot: vi.fn((listener) => {
      taskListener = listener;
      return vi.fn();
    }),
    onSnapshot: vi.fn((listener) => {
      snapshotListener = listener;
      return snapshotDispose;
    }),
    getHudNativeSnapshot: vi.fn(async () => native),
    setHudMode: vi.fn(async (mode) => {
      native = { ...native, mode, pointerInteractive: mode === "deck" };
      nativeListener?.(native);
      return native;
    }),
    setPointerInteractive: vi.fn(async (pointerInteractive) => {
      native = { ...native, pointerInteractive };
      nativeListener?.(native);
      return native;
    }),
    requestGesturePermissionIntent: vi.fn(async () => ({ accepted: true as const })),
    onHudNativeSnapshot: vi.fn((listener) => {
      nativeListener = listener;
      return nativeDispose;
    }),
    getConversationSnapshot: vi.fn(async () => ({
      sequence: 0,
      provider: "gemini",
      model: "gemini-3.1-flash-live-preview",
      state: "disabled",
      microphone: "off",
      remoteStreaming: false,
      inputTranscript: "",
      outputTranscript: "",
      cost: "unavailable",
    } satisfies ConversationSnapshot)),
    startConversation: vi.fn(async () => ({
      sequence: 0,
      provider: "gemini",
      model: "gemini-3.1-flash-live-preview",
      state: "disabled",
      microphone: "off",
      remoteStreaming: false,
      inputTranscript: "",
      outputTranscript: "",
      cost: "unavailable",
    } satisfies ConversationSnapshot)),
    stopConversation: vi.fn(async () => ({
      sequence: 0,
      provider: "gemini",
      model: "gemini-3.1-flash-live-preview",
      state: "idle",
      microphone: "off",
      remoteStreaming: false,
      inputTranscript: "",
      outputTranscript: "",
      cost: "unavailable",
    } satisfies ConversationSnapshot)),
    setMicrophoneState: vi.fn(async () => ({
      sequence: 0,
      provider: "gemini",
      model: "gemini-3.1-flash-live-preview",
      state: "disabled",
      microphone: "off",
      remoteStreaming: false,
      inputTranscript: "",
      outputTranscript: "",
      cost: "unavailable",
    } satisfies ConversationSnapshot)),
    requestMicrophonePermissionIntent: vi.fn(async () => ({ accepted: true as const })),
    sendConversationAudio: vi.fn(async () => ({ accepted: true as const })),
    sendConversationText: vi.fn(async () => ({ accepted: true as const })),
    interruptConversation: vi.fn(async () => ({
      sequence: 0,
      provider: "gemini",
      model: "gemini-3.1-flash-live-preview",
      state: "disabled",
      microphone: "off",
      remoteStreaming: false,
      inputTranscript: "",
      outputTranscript: "",
      cost: "unavailable",
    } satisfies ConversationSnapshot)),
    onConversationEvent: vi.fn((_listener: (event: ConversationEvent) => void) => vi.fn()),
  };
  Object.defineProperty(window, "iris", { configurable: true, value: api });
  return {
    api,
    nativeDispose,
    publish: (next: JarvisReadSnapshot) => snapshotListener?.(next),
    publishNative: (next: HudNativeSnapshot) => {
      native = next;
      nativeListener?.(next);
    },
    publishTask: (next: JarvisTaskControllerSnapshot) => taskListener?.(next),
    snapshotDispose,
  };
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "iris");
});

describe("Iris Phase 2 Glass HUD", () => {
  it("renders the interactive Command Deck from public Jarvis projections only", async () => {
    const rawLikeBrain = {
      id: "brain_opaque123" as const,
      name: "Orca",
      notes: 12,
      isDefault: true,
      path: "E:\\private\\JarvisOS\\brains\\default",
    };
    const rawLikeSession = {
      id: "session-public",
      title: "Rà soát kiến trúc",
      brainId: "brain_opaque123" as const,
      engine: "codex",
      model: "gpt-test",
      updatedAt: 1784872000,
      messageCount: 4,
      preview: "private preview",
      cli_session_id: "private-cli-id",
    };
    installApi(snapshot("ready", { brains: [rawLikeBrain], sessions: [rawLikeSession] }));

    render(<App />);

    expect((await screen.findByRole("status", { name: "Trạng thái JarvisOS" })).textContent).toContain("Sẵn sàng");
    expect(screen.getByRole("heading", { level: 1, name: "Iris v2" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Runtime JarvisOS" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Brain đang hoạt động" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Phiên gần đây" })).toBeTruthy();
    expect(screen.getByText("Orca")).toBeTruthy();
    expect(screen.getByText("Rà soát kiến trúc")).toBeTruthy();
    expect(screen.queryByText(/E:\\private/)).toBeNull();
    expect(screen.queryByText("private preview")).toBeNull();
    expect(screen.queryByText("private-cli-id")).toBeNull();
    expect(screen.queryByText("brain_opaque123")).toBeNull();
  });

  it("keeps experimental conversation and task surfaces out of the MVP runtime", async () => {
    const installed = installApi(snapshot("ready"));

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: "Iris v2" });
    expect(installed.api.onConversationEvent).not.toHaveBeenCalled();
    expect(installed.api.getConversationSnapshot).not.toHaveBeenCalled();
    expect(installed.api.onTaskSnapshot).not.toHaveBeenCalled();
    expect(installed.api.getTaskSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByText("Hội thoại Gemini")).toBeNull();
    expect(screen.queryByText("Công việc Jarvis")).toBeNull();
  });

  it.each([
    ["offline", "Ngoại tuyến"],
    ["connecting", "Đang kết nối"],
    ["sign_in_required", "Cần đăng nhập"],
    ["ready", "Sẵn sàng"],
    ["degraded", "Hoạt động suy giảm"],
    ["reconnecting", "Đang kết nối lại"],
  ] as const)("renders %s as %s", async (connection, label) => {
    installApi(snapshot(connection));
    render(<App />);
    expect((await screen.findByRole("status", { name: "Trạng thái JarvisOS" })).textContent).toContain(label);
  });

  it("follows authoritative native mode changes and preserves the desktop safe zone", async () => {
    const installed = installApi(snapshot("ready"));
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Iris v2" });

    act(() => installed.publishNative({ mode: "hud", pointerInteractive: false, shortcutAvailable: true }));

    await waitFor(() => expect(document.querySelector("[data-hud-mode='hud']")).toBeTruthy());
    expect(document.querySelector(".hud-safe-zone")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1, name: "Iris v2" })).toBeNull();
  });

  it("keeps mouse and keyboard fallbacks for mode, reader, refresh, and sign-in", async () => {
    const user = userEvent.setup();
    const installed = installApi(snapshot("sign_in_required", {
      health: { ...baseHealth, authenticated: false },
    }));
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Mở thông tin runtime" }));
    expect(screen.getAllByRole("heading", { level: 2, name: "Runtime JarvisOS" })).toHaveLength(2);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 2, name: "Runtime JarvisOS" })).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Đăng nhập JarvisOS" }));
    expect(installed.api.openSignIn).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Làm mới trạng thái" }));
    expect(installed.api.refresh).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Trở về Desktop HUD" }));
    expect(installed.api.setHudMode).toHaveBeenCalledWith("hud");
  });

  it("applies newer Jarvis updates and disposes both subscriptions", async () => {
    const installed = installApi(snapshot("connecting"));
    const view = render(<App />);
    expect((await screen.findByRole("status", { name: "Trạng thái JarvisOS" })).textContent).toContain("Đang kết nối");

    act(() => installed.publish(snapshot("ready", {
      sequence: 2,
      sessions: [{ id: "fresh", title: "Phiên vừa đồng bộ", messageCount: 1 }],
    })));
    expect(await screen.findByText("Phiên vừa đồng bộ")).toBeTruthy();

    view.unmount();
    expect(installed.snapshotDispose).toHaveBeenCalledTimes(1);
    expect(installed.nativeDispose).toHaveBeenCalledTimes(1);
  });

  it("shows empty and sanitized bridge-error states without side-effect controls", async () => {
    const user = userEvent.setup();
    const installed = installApi(snapshot("ready"));
    vi.mocked(installed.api.refresh).mockRejectedValue(new Error("private bridge error"));
    render(<App />);

    expect(await screen.findByText("Chưa có brain nào được công bố.")).toBeTruthy();
    expect(screen.getByText("Chưa có phiên nào để hiển thị.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Làm mới trạng thái" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Không thể làm mới trạng thái JarvisOS.");
    expect(screen.queryByText("private bridge error")).toBeNull();
    expect(screen.queryByRole("button", { name: /tạo phiên|chuyển brain|chạy|thực thi|gửi lệnh/i })).toBeNull();
  });

  it("loads the default Second Brain through the fixed preload method", async () => {
    const user = userEvent.setup();
    const brainId = `brain_${"a".repeat(64)}` as const;
    const installed = installApi(snapshot("ready", {
      brains: [{ id: brainId, name: "Brain Default", notes: 12, isDefault: true }],
    }));
    vi.mocked(installed.api.loadKnowledge).mockResolvedValue({
      state: "ready",
      capturedAt: "2026-07-31T03:00:00.000Z",
      brain: { id: brainId, name: "Brain Default", notes: 12, isDefault: true },
      graph: {
        nodes: [{ id: `node_${"1".repeat(64)}`, label: "Architecture", folder: "wiki", source: "jarvis_brain", links: 0, createdAt: 1_785_000_000 }],
        edges: [],
        categories: [{ name: "wiki", count: 1 }],
        stats: { totalNotes: 1, totalLinks: 0, orphans: 1, hidden: 0, returnedNodes: 1, returnedEdges: 0, truncated: false },
      },
    });
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Tải Second Brain" }));

    expect(installed.api.loadKnowledge).toHaveBeenCalledWith(brainId);
    expect(await screen.findByLabelText("Bản đồ Galaxy của Brain Default")).toBeTruthy();
    expect(screen.getAllByText("Architecture").length).toBeGreaterThan(0);
  });
});
