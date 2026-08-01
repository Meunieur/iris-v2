import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import authStatusFixture from "../../../tests/fixtures/jarvis/auth-status.json";
import brainsFixture from "../../../tests/fixtures/jarvis/brains.json";
import healthFixture from "../../../tests/fixtures/jarvis/health.json";
import sessionsFixture from "../../../tests/fixtures/jarvis/sessions.json";
import versionFixture from "../../../tests/fixtures/jarvis/version.json";
import wsEventsFixture from "../../../tests/fixtures/jarvis/ws-events.json";
import {
  rawAuthStatusSchema,
  rawBrainsSchema,
  rawHealthSchema,
  rawJarvisEventSchema,
  rawSessionsSchema,
  rawVersionSchema,
} from "../src/raw-jarvis";

describe("legacy Jarvis raw schemas", () => {
  it("accepts the sanitized legacy health, auth, version, brain, and session shapes", () => {
    expect(rawHealthSchema.parse(healthFixture).status).toBe("ok");
    expect(rawAuthStatusSchema.parse(authStatusFixture).auth_required).toBe(true);
    expect(rawVersionSchema.parse(versionFixture).current).toBe("0.9.156");
    expect(rawBrainsSchema.parse(brainsFixture).brains).toHaveLength(2);
    expect(rawSessionsSchema.parse(sessionsFixture).sessions).toHaveLength(2);
  });

  it("preserves harmless forward-compatible raw fields", () => {
    const parsed = rawHealthSchema.parse(healthFixture);
    expect(parsed.future_health_field).toBe("retained only at the raw boundary");
  });

  it("accepts nullable titles from legacy Jarvis sessions", () => {
    const parsed = rawSessionsSchema.parse({
      sessions: [{ ...sessionsFixture.sessions[0], title: null }],
    });

    expect(parsed.sessions[0]?.title).toBeNull();
  });

  it("rejects missing fields required by safe projections", () => {
    expect(() => rawHealthSchema.parse({ cwd: "E:\\synthetic" })).toThrow();
    expect(() => rawBrainsSchema.parse({ dir: "E:\\synthetic", brains: [{ name: "missing-path" }] })).toThrow();
    expect(() => rawSessionsSchema.parse({ sessions: [{ title: "missing-id" }] })).toThrow();
    expect(() => rawJarvisEventSchema.parse({ type: "response", session_id: "session-synthetic-001" })).toThrow();
  });

  it("accepts representative known and unknown WebSocket events", () => {
    expect(wsEventsFixture.map((event) => rawJarvisEventSchema.parse(event))).toHaveLength(10);
  });

  it("contains no credential-bearing fixture keys or values", () => {
    const fixtureDirectory = fileURLToPath(new URL("../../../tests/fixtures/jarvis/", import.meta.url));
    const fixtureNames = ["health.json", "auth-status.json", "version.json", "brains.json", "sessions.json", "ws-events.json"];
    const forbiddenKey = /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|cookie|password|secret)"\s*:/i;
    const forbiddenValue = /(?:sk-[A-Za-z0-9]{12,}|AIza[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/i;

    for (const fixtureName of fixtureNames) {
      const contents = readFileSync(`${fixtureDirectory}${fixtureName}`, "utf8");
      expect(contents, fixtureName).not.toMatch(forbiddenKey);
      expect(contents, fixtureName).not.toMatch(forbiddenValue);
    }
  });
});
