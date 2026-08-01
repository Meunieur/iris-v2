import { describe, expect, it, vi } from "vitest";

import { IPC_CHANNELS, createRendererApi, type PreloadIpc } from "../src/preload/api.cjs";

describe("conversation preload surface", () => {
  it("exposes fixed conversation methods without generic transport", async () => {
    const ipc: PreloadIpc = {
      invoke: vi.fn(async () => ({ accepted: true })),
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    const api = createRendererApi(ipc);

    expect(api).toHaveProperty("getConversationSnapshot");
    expect(api).toHaveProperty("startConversation");
    expect(api).toHaveProperty("stopConversation");
    expect(api).toHaveProperty("requestMicrophonePermissionIntent");
    expect(api).toHaveProperty("sendConversationAudio");
    expect(api).toHaveProperty("sendConversationText");
    expect(api).toHaveProperty("interruptConversation");
    expect(api).toHaveProperty("onConversationEvent");
    expect(api).not.toHaveProperty("send");
    expect(api).not.toHaveProperty("invoke");

    await api.startConversation();
    await api.requestMicrophonePermissionIntent(true);
    await api.sendConversationAudio(new Uint8Array([0, 1]));
    await api.sendConversationText("xin chÃ o");
    await api.interruptConversation();

    expect(vi.mocked(ipc.invoke).mock.calls).toEqual([
      [IPC_CHANNELS.startConversation],
      [IPC_CHANNELS.requestMicrophonePermissionIntent, true],
      [IPC_CHANNELS.sendConversationAudio, new Uint8Array([0, 1])],
      [IPC_CHANNELS.sendConversationText, "xin chÃ o"],
      [IPC_CHANNELS.interruptConversation],
    ]);
  });
});
