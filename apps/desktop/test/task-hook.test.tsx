// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";
import type { IrisRendererApi } from "../src/preload/api.cjs";

import { useJarvisTask } from "../src/renderer/task/use-jarvis-task.js";

const idle: JarvisTaskControllerSnapshot = {
  sequence: 0,
  capturedAt: "1970-01-01T00:00:00.000Z",
  connection: "idle",
};

function installApi() {
  let listener: ((snapshot: JarvisTaskControllerSnapshot) => void) | undefined;
  const api = {
    getTaskSnapshot: vi.fn(async () => idle),
    sendTurn: vi.fn(async () => ({ ...idle, sequence: 1, connection: "submitting" as const })),
    stopTurn: vi.fn(async () => ({ ...idle, sequence: 2, connection: "terminal" as const })),
    onTaskSnapshot: vi.fn((next: (snapshot: JarvisTaskControllerSnapshot) => void) => {
      listener = next;
      return vi.fn();
    }),
  } as unknown as IrisRendererApi;
  Object.defineProperty(window, "iris", { configurable: true, value: api });
  return { api, publish: (snapshot: JarvisTaskControllerSnapshot) => listener?.(snapshot) };
}

afterEach(() => Reflect.deleteProperty(window, "iris"));

describe("useJarvisTask", () => {
  it("does not subscribe or hydrate when disabled", () => {
    const installed = installApi();
    const { result } = renderHook(() => useJarvisTask(false));

    expect(result.current.state).toEqual(idle);
    expect(installed.api.onTaskSnapshot).not.toHaveBeenCalled();
    expect(installed.api.getTaskSnapshot).not.toHaveBeenCalled();
  });

  it("hydrates, subscribes and sends only a bounded public task input", async () => {
    const installed = installApi();
    const { result } = renderHook(() => useJarvisTask());
    await waitFor(() => expect(result.current.state.connection).toBe("idle"));
    const input = { brainId: `brain_${"a".repeat(64)}` as const, message: "read" };

    await act(async () => { await result.current.send(input); });

    expect(installed.api.sendTurn).toHaveBeenCalledWith(input);
    expect(result.current.state.connection).toBe("submitting");
    act(() => installed.publish({ ...idle, sequence: 2, connection: "reconnecting" }));
    expect(result.current.state.connection).toBe("reconnecting");
  });
});
