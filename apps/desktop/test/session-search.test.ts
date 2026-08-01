import { describe, expect, it } from "vitest";

import type { SessionSummary } from "@iris/contracts";

import { searchPublicSessions } from "../src/renderer/hud/session-search";

function session(index: number, title: string, engine = "codex", model = "gpt-5"): SessionSummary {
  return {
    id: `session-private-${index}`,
    title,
    engine,
    model,
    messageCount: index,
    updatedAt: 1_785_000_000 + index,
  };
}

describe("public session search", () => {
  it("matches Vietnamese titles without requiring diacritics", () => {
    const sessions = [
      session(1, "Kiến trúc phát hành"),
      session(2, "Rà soát bảo mật"),
      session(3, "Operator notes"),
    ];

    expect(searchPublicSessions(sessions, "kien truc").map((item) => item.title)).toEqual(["Kiến trúc phát hành"]);
    expect(searchPublicSessions(sessions, "bao mat").map((item) => item.title)).toEqual(["Rà soát bảo mật"]);
  });

  it("filters only public display fields while preserving recent-session order and bounds", () => {
    const sessions = [
      session(1, "First", "codex", "gpt-5"),
      session(2, "Second", "gemini", "flash"),
      session(3, "Third", "codex", "gpt-5"),
    ];

    expect(searchPublicSessions(sessions, "codex", 1).map((item) => item.title)).toEqual(["First"]);
    expect(searchPublicSessions(sessions, "session-private-2")).toEqual([]);
    expect(searchPublicSessions(sessions, "   ")).toEqual([]);
  });

  it("can match a public term near the end of a long sanitized title", () => {
    const longTitle = session(4, `${"Bản ghi công khai ".repeat(8)}Bảo mật cuối phiên`);

    expect(searchPublicSessions([longTitle], "bao mat")).toEqual([longTitle]);
  });
});
