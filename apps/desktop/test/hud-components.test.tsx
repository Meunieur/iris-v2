// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JarvisReadSnapshot } from "@iris/jarvis-adapter";
import type { HudNativeSnapshot } from "../src/main/hud-native";
import { CameraDock } from "../src/renderer/hud/CameraDock";
import { CommandDeck } from "../src/renderer/hud/CommandDeck";
import { DesktopHud } from "../src/renderer/hud/DesktopHud";
import { GestureReticle } from "../src/renderer/hud/GestureReticle";
import { ReaderOverlay } from "../src/renderer/hud/ReaderOverlay";
import { isGestureActionAllowed } from "../src/renderer/hud/policy";
import type { GestureViewState, ReaderView } from "../src/renderer/hud/types";

afterEach(cleanup);

const readySnapshot: JarvisReadSnapshot = {
  sequence: 3,
  capturedAt: "2026-07-24T10:00:00.000Z",
  endpoint: "http://127.0.0.1:7777/",
  connection: "ready",
  health: {
    status: "ok",
    authRequired: true,
    authenticated: true,
    version: "0.9.156",
    mode: "windows",
  },
  brains: [{ id: "brain_opaque123", name: "Orca", notes: 42, isDefault: true }],
  sessions: [{ id: "session-1", title: "Rà soát Phase 2", engine: "codex", model: "gpt-5", messageCount: 7 }],
};

const nativeHud: HudNativeSnapshot = {
  mode: "hud",
  pointerInteractive: false,
  shortcutAvailable: true,
};

const gestureOff: GestureViewState = {
  enabled: false,
  camera: "off",
  model: "idle",
  gesture: "unknown",
  tracking: false,
  primaryReticle: undefined,
  secondaryReticle: undefined,
};

const reader: ReaderView = {
  id: "runtime",
  eyebrow: "Nguồn duy nhất",
  title: "Runtime JarvisOS",
  paragraphs: ["Backend đang kết nối ổn định.", "Không có runtime thứ hai."],
  width: 360,
};

describe("gesture-safe HUD policy", () => {
  it("allows only reversible Phase 2 UI actions", () => {
    expect(isGestureActionAllowed("reader.open.runtime")).toBe(true);
    expect(isGestureActionAllowed("reader.close")).toBe(true);
    expect(isGestureActionAllowed("gesture.pause")).toBe(true);
    expect(isGestureActionAllowed("jarvis.sign-in")).toBe(false);
    expect(isGestureActionAllowed("jarvis.refresh")).toBe(false);
    expect(isGestureActionAllowed("approval.approve")).toBe(false);
    expect(isGestureActionAllowed("app.quit")).toBe(false);
  });
});

describe("Desktop HUD", () => {
  it("renders edge instruments from real Jarvis state without fake work", () => {
    render(<DesktopHud
      snapshot={readySnapshot}
      native={nativeHud}
      gesture={gestureOff}
      reader={undefined}
      refreshing={false}
      notice={undefined}
      onOpenReader={vi.fn()}
      onCloseReader={vi.fn()}
      onToggleDeck={vi.fn()}
      onRefresh={vi.fn()}
      onSignIn={vi.fn()}
      onEnableGesture={vi.fn()}
      onPauseGesture={vi.fn()}
      onStopGesture={vi.fn()}
    />);

    expect(screen.getByRole("status", { name: "Trạng thái JarvisOS" }).textContent).toContain("Sẵn sàng");
    expect(screen.getByText("Orca")).toBeTruthy();
    expect(screen.getByText("Rà soát Phase 2")).toBeTruthy();
    expect(screen.queryByText(/demo|tác vụ giả|đang thực thi/i)).toBeNull();
    expect(document.querySelector(".hud-safe-zone")).toBeTruthy();
  });

  it("keeps sign-in and refresh outside gesture-selectable targets", () => {
    render(<DesktopHud
      snapshot={{ ...readySnapshot, connection: "sign_in_required", health: { ...readySnapshot.health!, authenticated: false } }}
      native={nativeHud}
      gesture={gestureOff}
      reader={undefined}
      refreshing={false}
      notice={undefined}
      onOpenReader={vi.fn()}
      onCloseReader={vi.fn()}
      onToggleDeck={vi.fn()}
      onRefresh={vi.fn()}
      onSignIn={vi.fn()}
      onEnableGesture={vi.fn()}
      onPauseGesture={vi.fn()}
      onStopGesture={vi.fn()}
    />);

    expect(screen.getByRole("button", { name: "Đăng nhập JarvisOS" }).hasAttribute("data-gesture-action")).toBe(false);
    expect(screen.getByRole("button", { name: "Làm mới trạng thái" }).hasAttribute("data-gesture-action")).toBe(false);
  });
});

describe("Command Deck and reader", () => {
  it("renders the detailed interactive deck over the same snapshot", async () => {
    const user = userEvent.setup();
    const onToggleHud = vi.fn();
    render(<CommandDeck
      snapshot={readySnapshot}
      native={{ ...nativeHud, mode: "deck", pointerInteractive: true }}
      gesture={gestureOff}
      reader={reader}
      refreshing={false}
      notice={undefined}
      onOpenReader={vi.fn()}
      onCloseReader={vi.fn()}
      onToggleHud={onToggleHud}
      onRefresh={vi.fn()}
      onSignIn={vi.fn()}
      onEnableGesture={vi.fn()}
      onPauseGesture={vi.fn()}
      onStopGesture={vi.fn()}
    />);

    expect(screen.getByRole("heading", { level: 1, name: "Iris v2" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2, name: "Runtime JarvisOS" })).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2, name: "Brain đang hoạt động" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Phiên gần đây" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Trở về Desktop HUD" }));
    expect(onToggleHud).toHaveBeenCalledTimes(1);
  });

  it("filters the public recent-session index without requiring Vietnamese diacritics", async () => {
    const user = userEvent.setup();
    const searchableSnapshot: JarvisReadSnapshot = {
      ...readySnapshot,
      sessions: [
        { id: "session-a", title: "Kiến trúc phát hành", engine: "codex", model: "gpt-5", messageCount: 12 },
        { id: "session-b", title: "Rà soát bảo mật", engine: "codex", model: "gpt-5", messageCount: 8 },
        { id: "session-c", title: "Operator notes", engine: "gemini", model: "flash", messageCount: 3 },
      ],
    };
    render(<CommandDeck
      snapshot={searchableSnapshot}
      native={{ ...nativeHud, mode: "deck", pointerInteractive: true }}
      gesture={gestureOff}
      reader={undefined}
      refreshing={false}
      notice={undefined}
      onOpenReader={vi.fn()}
      onCloseReader={vi.fn()}
      onToggleHud={vi.fn()}
      onRefresh={vi.fn()}
      onSignIn={vi.fn()}
      onEnableGesture={vi.fn()}
      onPauseGesture={vi.fn()}
      onStopGesture={vi.fn()}
    />);

    const search = screen.getByRole("searchbox", { name: "Tìm phiên gần đây" });
    await user.type(search, "kien truc");

    expect(screen.getByText("Kiến trúc phát hành")).toBeTruthy();
    expect(screen.queryByText("Rà soát bảo mật")).toBeNull();
    expect(screen.getByText("1/3 phiên")).toBeTruthy();

    await user.clear(search);
    await user.type(search, "khong ton tai");
    expect(screen.getByText("Không tìm thấy phiên phù hợp.")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Rà soát bảo mật")).toBeTruthy();
  });

  it("closes the reader with Escape and exposes a gesture-safe close target", () => {
    const onClose = vi.fn();
    render(<ReaderOverlay reader={reader} onClose={onClose} />);

    expect(screen.getByRole("button", { name: "Đóng bảng đọc" }).getAttribute("data-gesture-action")).toBe("reader.close");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("gesture feedback and camera privacy", () => {
  it("shows camera off by default with an explicit enable control", () => {
    render(<CameraDock
      gesture={gestureOff}
      onEnable={vi.fn()}
      onPause={vi.fn()}
      onStop={vi.fn()}
    />);

    expect(screen.getByText("Camera đang tắt")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bật điều khiển cử chỉ" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /camera preview/i })).toBeNull();
  });

  it("renders a legible dwell reticle without making it interactive", () => {
    const view = render(<GestureReticle reticle={{ x: 320, y: 240, confidence: 0.9, dwellProgress: 0.6, state: "dwelling" }} />);

    const reticle = view.container.querySelector(".gesture-reticle");
    expect(reticle?.getAttribute("aria-hidden")).toBe("true");
    expect(reticle?.getAttribute("data-state")).toBe("dwelling");
    expect(reticle?.hasAttribute("data-gesture-action")).toBe(false);
  });
});
