import { describe, expect, it } from "vitest";

import authStatusFixture from "../../../tests/fixtures/jarvis/auth-status.json";
import brainsFixture from "../../../tests/fixtures/jarvis/brains.json";
import healthFixture from "../../../tests/fixtures/jarvis/health.json";
import sessionsFixture from "../../../tests/fixtures/jarvis/sessions.json";
import versionFixture from "../../../tests/fixtures/jarvis/version.json";
import wsEventsFixture from "../../../tests/fixtures/jarvis/ws-events.json";
import {
  createBrainPathIdLookup,
  projectBrainSummaries,
  projectHealthSnapshot,
  projectJarvisEvent,
  projectSessions,
  sanitizeRendererText,
} from "../src/public-projections";
import type { SessionSummary } from "../src/public-projections";
import {
  rawAuthStatusSchema,
  rawBrainsSchema,
  rawHealthSchema,
  rawJarvisEventSchema,
  rawSessionsSchema,
  rawVersionSchema,
} from "../src/raw-jarvis";

const rawBrains = rawBrainsSchema.parse(brainsFixture);
const rawSessions = rawSessionsSchema.parse(sessionsFixture);
type SessionSummaryHasNoPreview = "preview" extends keyof SessionSummary ? false : true;
const sessionSummaryHasNoPreview: SessionSummaryHasNoPreview = true;

describe("renderer-safe Jarvis projections", () => {
  it("aggregates health without exposing runtime paths or CLI identity", () => {
    const projected = projectHealthSnapshot(
      rawHealthSchema.parse(healthFixture),
      rawAuthStatusSchema.parse(authStatusFixture),
      rawVersionSchema.parse(versionFixture),
    );

    expect(projected).toEqual({
      status: "ok",
      version: "0.9.156",
      authRequired: true,
      authenticated: false,
      mode: "windows",
    });
    expect(JSON.stringify(projected)).not.toContain("synthetic");
    expect(JSON.stringify(projected)).not.toContain("claude_cli");
  });

  it("creates deterministic opaque brain IDs and explicitly allowlists fields", () => {
    const first = projectBrainSummaries(rawBrains);
    const equivalentPath = rawBrainsSchema.parse({
      dir: "E:/synthetic/JarvisOS/brains",
      brains: [{ name: "default", path: "e:/SYNTHETIC/JarvisOS/brains/default/", notes: 12, is_default: true }],
    });
    const second = projectBrainSummaries(equivalentPath);
    const serialized = JSON.stringify(first);

    expect(first[0]?.id).toMatch(/^brain_[a-f0-9]{64}$/);
    expect(first[0]?.id).toBe("brain_dd5847153fc5179fffb5daa475ba7ec9db727b2c7d8242ac983b5d83b4eb7209");
    expect(second[0]?.id).toBe(first[0]?.id);
    expect(first[0]).toEqual({ id: first[0]?.id, name: "default", notes: 12, isDefault: true });
    expect(serialized).not.toContain("E:\\\\synthetic");
    expect(serialized).not.toContain("path");
    expect(serialized).not.toContain("dir");
    expect(serialized).not.toContain("private_future_field");
  });

  it("projects sessions through a private brain path lookup", () => {
    const lookup = createBrainPathIdLookup(rawBrains);
    const projected = projectSessions(rawSessions, lookup);
    const serialized = JSON.stringify(projected);

    expect(projected[0]).toEqual({
      id: "session-synthetic-001",
      title: "Synthetic architecture review",
      brainId: projectBrainSummaries(rawBrains)[0]?.id,
      engine: "codex",
      model: "synthetic-model",
      updatedAt: 1784764800,
      messageCount: 6,
    });
    expect(projected[0]).not.toHaveProperty("preview");
    expect(serialized).not.toContain("E:\\\\synthetic");
    expect(serialized).not.toContain("cli_session_id");
    expect(serialized).not.toContain("private_future_field");
    expect(serialized).not.toContain('"brain"');
  });

  it("projects nullable legacy session titles to a fixed safe label", () => {
    const sessions = rawSessionsSchema.parse({
      sessions: [{ ...sessionsFixture.sessions[0], title: null }],
    });

    const projected = projectSessions(sessions, createBrainPathIdLookup(rawBrains));

    expect(projected[0]?.title).toBe("Phiên chưa đặt tên");
  });

  it("omits credential-bearing session previews until a renderer content policy exists", () => {
    const sessions = rawSessionsSchema.parse({
      sessions: [{
        ...sessionsFixture.sessions[0],
        preview: "api_key=preview-secret-must-not-cross",
      }],
    });
    const projected = projectSessions(sessions, createBrainPathIdLookup(rawBrains));

    expect(projected[0]).not.toHaveProperty("preview");
    expect(JSON.stringify(projected)).not.toContain("preview-secret-must-not-cross");
    expect(sessionSummaryHasNoPreview).toBe(true);
  });

  it("redacts credentials from every emitted renderer free-text class", () => {
    const googleKeyFixture = ["AIza", "ModelSecret1234567890"].join("");
    const openAiKeyFixture = ["sk-", "modelSecret1234567890"].join("");
    const brains = rawBrainsSchema.parse({
      dir: "E:\\synthetic\\brains",
      brains: [{
        name: "Brain api_key=brain-secret-value",
        path: "E:\\synthetic\\brains\\safe",
        notes: 1,
        is_default: true,
      }],
    });
    const sessions = rawSessionsSchema.parse({
      sessions: [{
        ...sessionsFixture.sessions[0],
        brain: "E:\\synthetic\\brains\\safe",
        title: "Review password=title-secret-value",
        engine: "github_token=ghp_engineSecret123456",
        model: googleKeyFixture,
        preview: "client_secret=preview-secret-value",
      }],
    });
    const projectedEvents = [
      projectJarvisEvent(rawJarvisEventSchema.parse({
        type: "status",
        content: "password=state-secret-value",
      })),
      projectJarvisEvent(rawJarvisEventSchema.parse({
        type: "tool_call",
        tool: "client_secret=capability-secret-value",
        content: "ignored",
      })),
      projectJarvisEvent(rawJarvisEventSchema.parse({
        type: "stream",
        content: "Bearer delta-secret-token-123456",
      })),
      projectJarvisEvent(rawJarvisEventSchema.parse({
        type: "response",
        content: "Authorization: Bearer response-secret-token-123456 at E:\\deliberate\\report.txt",
        engine: "access_token=engine-secret-value",
        model: openAiKeyFixture,
      })),
      projectJarvisEvent(rawJarvisEventSchema.parse({
        type: "system",
        content: "private_key=notice-secret-value",
      })),
    ];
    const serialized = JSON.stringify({
      brains: projectBrainSummaries(brains),
      sessions: projectSessions(sessions, createBrainPathIdLookup(brains)),
      events: projectedEvents,
    });

    for (const secret of [
      "brain-secret-value",
      "title-secret-value",
      "ghp_engineSecret123456",
      googleKeyFixture,
      "preview-secret-value",
      "state-secret-value",
      "capability-secret-value",
      "delta-secret-token-123456",
      "response-secret-token-123456",
      "engine-secret-value",
      openAiKeyFixture,
      "notice-secret-value",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).toContain("E:\\\\deliberate\\\\report.txt");
  });

  it("bounds renderer text to 16 KiB with a visible truncation marker", () => {
    const sanitized = sanitizeRendererText("🙂".repeat(5_000));

    expect(new TextEncoder().encode(sanitized).byteLength).toBeLessThanOrEqual(16 * 1024);
    expect(sanitized.endsWith("…[truncated]")).toBe(true);
  });

  it("keeps deliberate filesystem paths displayable in response text", () => {
    const event = projectJarvisEvent(rawJarvisEventSchema.parse({
      type: "response",
      content: "Open E:\\projects\\Iris v2\\README.md for review",
    }));

    expect(event).toEqual({
      type: "response",
      text: "Open E:\\projects\\Iris v2\\README.md for review",
    });
  });

  it("redacts quoted JSON-style credential pairs from session titles, notices, and responses", () => {
    const sessions = rawSessionsSchema.parse({
      sessions: [{
        ...sessionsFixture.sessions[0],
        title: 'Review {"Client.Secret":"title-quoted-secret"}',
      }],
    });
    const title = projectSessions(sessions, createBrainPathIdLookup(rawBrains))[0]?.title;
    const notice = projectJarvisEvent(rawJarvisEventSchema.parse({
      type: "system",
      content: "Payload {'OpenAI_API_Key':'notice-quoted-secret'}",
    }));
    const response = projectJarvisEvent(rawJarvisEventSchema.parse({
      type: "response",
      content: 'Result {"GitHub.Token":response-unquoted-secret} at E:\\deliberate\\artifact.json',
    }));
    const serialized = JSON.stringify({ title, notice, response });

    expect(serialized).not.toContain("title-quoted-secret");
    expect(serialized).not.toContain("notice-quoted-secret");
    expect(serialized).not.toContain("response-unquoted-secret");
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).toContain("E:\\\\deliberate\\\\artifact.json");
  });

  it.each([
    ['{"client_secret":"double-quoted-secret"}', "double-quoted-secret"],
    ["{'api_key':'single-quoted-secret'}", "single-quoted-secret"],
    ['{"OpenAI.ApiKey":unquoted-secret}', "unquoted-secret"],
  ])("redacts quoted credential syntax without parsing or executing it: %s", (input, secret) => {
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).not.toContain(secret);
    expect(sanitized).toContain("[REDACTED]");
  });

  it("redacts JSON-style credential values containing escaped quotes", () => {
    const sanitized = sanitizeRendererText('{"client_secret":"escaped-head-\\"escaped-tail"}');

    expect(sanitized).not.toContain("escaped-head");
    expect(sanitized).not.toContain("escaped-tail");
    expect(sanitized).toContain("[REDACTED]");
  });

  it.each([
    [
      '{"client_secret" : "double-secret","safe":"ok"}',
      '{"client_secret" : "[REDACTED]","safe":"ok"}',
    ],
    [
      "{'api_key'='single-secret','safe':'ok'}",
      "{'api_key'='[REDACTED]','safe':'ok'}",
    ],
    [
      '{"OpenAI.ApiKey":unquoted-secret,"safe":"ok"}',
      '{"OpenAI.ApiKey":[REDACTED],"safe":"ok"}',
    ],
    [
      '{"client_secret":"escaped-head-\\"escaped-tail"}',
      '{"client_secret":"[REDACTED]"}',
    ],
  ])("preserves quoted-pair punctuation and value style: %s", (input, expected) => {
    expect(sanitizeRendererText(input)).toBe(expected);
  });

  it.each([
    '{"client_secret":"value","safe":"ok"}',
    "{'api_key':'value','safe':'ok'}",
    '{"OpenAI.ApiKey":unquoted-secret}',
    '{"client_secret":"unterminated-secret',
    "Open E:\\projects\\Iris v2\\README.md for review",
    "Authorization: Bearer stable-secret-token-123456",
  ])("is idempotent for redacted or deliberate renderer text: %s", (input) => {
    const once = sanitizeRendererText(input);
    const twice = sanitizeRendererText(once);

    expect(twice).toBe(once);
  });

  it("keeps bounded truncation idempotent", () => {
    const once = sanitizeRendererText("🙂".repeat(5_000));
    const twice = sanitizeRendererText(once);

    expect(twice).toBe(once);
    expect(new TextEncoder().encode(twice).byteLength).toBeLessThanOrEqual(16 * 1024);
  });

  it.each([
    [
      "Authorization: Basic basic-secret-value\r\nOpen E:\\deliberate\\basic.txt",
      "Authorization: Basic [REDACTED]\r\nOpen E:\\deliberate\\basic.txt",
    ],
    [
      "Authorization = Token token-secret-value trailing text",
      "Authorization = Token [REDACTED] trailing text",
    ],
    [
      "Authorization: Bearer bearer-secret-value next",
      "Authorization: Bearer [REDACTED] next",
    ],
  ])("redacts complete authorization credentials while preserving following text: %s", (input, expected) => {
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe(expected);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it.each(["Basic", "Bearer", "Token"])(
    "redacts escaped-quoted %s authorization values without leaking embedded escaped quotes",
    (scheme) => {
      const input = String.raw`Authorization: ${scheme} \"head-\\\"tail\" trailing E:\safe\auth.txt`;
      const expected = String.raw`Authorization: ${scheme} \"[REDACTED]\" trailing E:\safe\auth.txt`;
      const sanitized = sanitizeRendererText(input);

      expect(sanitized).toBe(expected);
      expect(sanitizeRendererText(sanitized)).toBe(sanitized);
    },
  );

  it("fails closed for an unknown authorization scheme", () => {
    const input = "Authorization: Digest synthetic-digest trailing";
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe("Authorization: [REDACTED]");
    expect(sanitized).not.toContain("synthetic-digest");
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it.each([
    [
      "Cookie: session=alpha; csrf=bravo\r\nSafe: visible",
      "Cookie: [REDACTED]\r\nSafe: visible",
    ],
    [
      "Set-Cookie: session=alpha; Path=/; HttpOnly\r\nSafe: visible",
      "Set-Cookie: [REDACTED]\r\nSafe: visible",
    ],
    [
      "Cookie: [REDACTED]; csrf=bravo\r\nSafe: visible",
      "Cookie: [REDACTED]\r\nSafe: visible",
    ],
  ])("redacts complete cookie header lines while preserving the next line: %s", (input, expected) => {
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe(expected);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("keeps standalone Bearer redaction on one line while accepting tab separation", () => {
    const nextLinePath = ["Bearer", String.raw`OpenSafe E:\safe\next-line.txt`].join("\n");
    const tabSeparated = "Bearer\tstandalone-secret-token";

    expect(sanitizeRendererText(nextLinePath)).toBe(nextLinePath);
    expect(sanitizeRendererText(tabSeparated)).toBe("Bearer [REDACTED]");
    expect(sanitizeRendererText(sanitizeRendererText(nextLinePath))).toBe(nextLinePath);
    expect(sanitizeRendererText(sanitizeRendererText(tabSeparated))).toBe("Bearer [REDACTED]");
  });

  it("redacts a standalone Bearer token without treating a following drive path as an assignment", () => {
    const input = String.raw`Bearer   standalone-secret-token trailing E:\safe\same-line.txt`;
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe(String.raw`Bearer [REDACTED] trailing E:\safe\same-line.txt`);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("keeps sentence drive paths while still redacting credential values that are drive paths", () => {
    const sentence = String.raw`The secret stays near E:\safe\file.txt`;
    const credential = String.raw`client_secret=C:\synthetic\secret.txt`;

    expect(sanitizeRendererText(sentence)).toBe(sentence);
    expect(sanitizeRendererText(credential)).toBe("client_secret=[REDACTED]");
    expect(sanitizeRendererText(sanitizeRendererText(sentence))).toBe(sentence);
    expect(sanitizeRendererText(sanitizeRendererText(credential))).toBe("client_secret=[REDACTED]");
  });

  it("redacts only a generic unquoted credential token and preserves following path text", () => {
    const input = String.raw`client_secret=value tail E:\safe\plain.txt`;
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe(String.raw`client_secret=[REDACTED] tail E:\safe\plain.txt`);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("redacts multiline quoted credential values with escapes", () => {
    const input = '{"client_secret":"line-one\\"quoted\nline-two","safe":"ok"}';
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe('{"client_secret":"[REDACTED]","safe":"ok"}');
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("redacts unquoted and quoted multiline PEM key values through their END blocks", () => {
    const unquoted = [
      "private_key=-----BEGIN PRIVATE KEY-----",
      "pem-unquoted-secret",
      "-----END PRIVATE KEY-----",
      "Open E:\\deliberate\\after-pem.txt",
    ].join("\n");
    const quoted = [
      'signing_key="-----BEGIN SIGNING KEY-----',
      "pem-quoted-secret",
      '-----END SIGNING KEY-----"',
      "tail=visible",
    ].join("\n");

    expect(sanitizeRendererText(unquoted)).toBe([
      "private_key=[REDACTED]",
      "Open E:\\deliberate\\after-pem.txt",
    ].join("\n"));
    expect(sanitizeRendererText(quoted)).toBe([
      'signing_key="[REDACTED]"',
      "tail=visible",
    ].join("\n"));
  });

  it("redacts bare and unterminated PEM key blocks", () => {
    const rsaPrivateKeyHeader = ["-----BEGIN RSA", " PRIVATE KEY-----"].join("");
    const complete = [
      rsaPrivateKeyHeader,
      "bare-pem-secret",
      "-----END RSA PRIVATE KEY-----",
      "visible tail",
    ].join("\n");
    const unterminated = [
      "-----BEGIN SIGNING KEY-----",
      "unterminated-pem-secret",
    ].join("\n");

    expect(sanitizeRendererText(complete)).toBe("[REDACTED]\nvisible tail");
    expect(sanitizeRendererText(unterminated)).toBe("[REDACTED]");
  });

  it("redacts escaped outer JSON credential assignments", () => {
    const input = String.raw`{\"OpenAI.ApiKey\":\"escaped-json-secret\",\"safe\":\"ok\"}`;
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe(String.raw`{\"OpenAI.ApiKey\":\"[REDACTED]\",\"safe\":\"ok\"}`);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("redacts embedded escaped quotes while preserving a trailing escaped JSON field", () => {
    const input = String.raw`{\"api_key\":\"head-\\\"tail\",\"safe\":\"ok\"}`;
    const expected = String.raw`{\"api_key\":\"[REDACTED]\",\"safe\":\"ok\"}`;
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe(expected);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("recognizes a five-backslash escaped closing quote after a literal backslash", () => {
    const input = String.raw`{\"api_key\":\"ends-with-backslash` + "\\".repeat(5) + String.raw`",\"safe\":\"ok\"}`;
    const expected = String.raw`{\"api_key\":\"[REDACTED]\",\"safe\":\"ok\"}`;
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe(expected);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("fails closed on an even backslash run before an escaped quote", () => {
    const input = String.raw`{\"api_key\":\"head` + "\\".repeat(2)
      + String.raw`"must-not-leak\",\"safe\":\"also-not-leak\"}`;
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).not.toContain("must-not-leak");
    expect(sanitized).not.toContain("also-not-leak");
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it.each([
    [
      '{"cookie":"session=alpha; csrf=bravo","safe":"ok"}',
      '{"cookie":"[REDACTED]","safe":"ok"}',
    ],
    [
      String.raw`{\"cookie\":\"session=alpha; csrf=bravo\",\"safe\":\"ok\"}`,
      String.raw`{\"cookie\":\"[REDACTED]\",\"safe\":\"ok\"}`,
    ],
  ])("redacts quoted cookie fields without consuming a safe JSON field: %s", (input, expected) => {
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe(expected);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("redacts a credential cut by the source boundary and retains the source marker", () => {
    const input = `${"x".repeat((16 * 1024) - 48)}api_key=boundary-secret-${"z".repeat(256)}`;
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).not.toContain("boundary-secret");
    expect(sanitized).toContain("…[source truncated]");
    expect(new TextEncoder().encode(sanitized).byteLength).toBeLessThanOrEqual(16 * 1024);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it.each([
    ["sk-ab", "[REDACTED]"],
    ["ghp_ab", "[REDACTED]"],
    ["github_pat_ab", "[REDACTED]"],
    ["AIzaab", "[REDACTED]"],
    ["Bearer ab", "Bearer [REDACTED]"],
  ])("redacts a recognizable standalone token cut by the source boundary: %s", (fragment, replacement) => {
    const sourceMarker = "…[source truncated]";
    const sourceContentBudget = (16 * 1024) - sourceMarker.length;
    const visibleSource = `${"x".repeat(sourceContentBudget - fragment.length - 1)} ${fragment}`;
    const sanitized = sanitizeRendererText(visibleSource + "discarded-secret-suffix".repeat(32));

    expect(sanitized.endsWith(` ${replacement}${sourceMarker}`)).toBe(true);
    expect(sanitized).not.toContain(fragment);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("redacts a long standalone token whose non-word suffix is cut at the source boundary", () => {
    const sourceMarker = "…[source truncated]";
    const sourceContentBudget = (16 * 1024) - sourceMarker.length;
    const fragment = `sk-${"A".repeat(300)}-`;
    const visibleSource = `${"x".repeat(sourceContentBudget - fragment.length - 1)} ${fragment}`;
    const sanitized = sanitizeRendererText(visibleSource + "discarded-secret-suffix".repeat(32));

    expect(sanitized.endsWith(`[REDACTED]${sourceMarker}`)).toBe(true);
    expect(sanitized).not.toContain(fragment);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("pre-bounds a one MiB raw renderer string before scanning", () => {
    const input = `client_secret=${"q".repeat(1024 * 1024)}`;
    const sanitized = sanitizeRendererText(input);

    expect(sanitized).toBe("client_secret=[REDACTED]…[source truncated]");
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("retains the source marker when the final UTF-8 cap also truncates", () => {
    const sanitized = sanitizeRendererText("🙂".repeat(1024 * 1024));

    expect(sanitized.endsWith("…[source truncated]")).toBe(true);
    expect(new TextEncoder().encode(sanitized).byteLength).toBeLessThanOrEqual(16 * 1024);
    expect(sanitizeRendererText(sanitized)).toBe(sanitized);
  });

  it("does not expose hello stop tags or private response metadata", () => {
    const hello = projectJarvisEvent(rawJarvisEventSchema.parse(wsEventsFixture[0]));
    const response = projectJarvisEvent(rawJarvisEventSchema.parse(wsEventsFixture[5]));

    expect(hello).toEqual({ type: "connected" });
    expect(JSON.stringify(hello)).not.toContain("stop_tag");
    expect(response).toEqual({
      type: "response",
      sessionId: "session-synthetic-001",
      text: "Synthetic final text",
      engine: "codex",
      model: "synthetic-model",
    });
    expect(JSON.stringify(response)).not.toContain("cli_session_id");
    expect(JSON.stringify(response)).not.toContain("cost_usd");
  });

  it("preserves legacy status text without inventing a stronger lifecycle state", () => {
    const status = projectJarvisEvent(rawJarvisEventSchema.parse(wsEventsFixture[1]));

    expect(status).toEqual({
      type: "status",
      sessionId: "session-synthetic-001",
      state: "Synthetic runtime is working",
    });
  });

  it("maps unknown events to a fixed diagnostic name without leaking type or payload", () => {
    const event = projectJarvisEvent(rawJarvisEventSchema.parse(wsEventsFixture[9]));
    expect(event).toEqual({ type: "diagnostic", eventName: "unknown_event" });
    expect(JSON.stringify(event)).not.toContain("synthetic");
    expect(JSON.stringify(event)).not.toContain("path");
  });

  it.each([
    "E:\\synthetic\\private\\event",
    "authorization=Bearer synthetic-credential",
  ])("never copies a path-shaped or credential-shaped event type to the renderer: %s", (eventType) => {
    const event = projectJarvisEvent(rawJarvisEventSchema.parse({ type: eventType }));

    expect(event).toEqual({ type: "diagnostic", eventName: "unknown_event" });
    expect(JSON.stringify(event)).not.toContain(eventType);
  });

  it("never treats a response as turn completion", () => {
    const response = projectJarvisEvent(rawJarvisEventSchema.parse(wsEventsFixture[5]));
    expect(response.type).toBe("response");
    expect(response.type).not.toBe("turn_done");
    expect(response).not.toHaveProperty("outcome");
  });

  it("keeps every unversioned legacy tool result diagnostic-only", () => {
    const legacyResult = projectJarvisEvent(rawJarvisEventSchema.parse(wsEventsFixture[3]));
    const forwardFalse = projectJarvisEvent(rawJarvisEventSchema.parse({
      type: "tool_result",
      content: "Synthetic forward false field",
      ok: false,
      session_id: "session-synthetic-001",
    }));
    const forwardTrue = projectJarvisEvent(rawJarvisEventSchema.parse({
      type: "tool_result",
      content: "Synthetic forward true field",
      ok: true,
      session_id: "session-synthetic-001",
    }));

    expect(legacyResult).toEqual({ type: "diagnostic", eventName: "tool_result" });
    expect(forwardFalse).toEqual({ type: "diagnostic", eventName: "tool_result" });
    expect(forwardTrue).toEqual({ type: "diagnostic", eventName: "tool_result" });
  });

  it("projects legacy turn completion as unknown unless cancellation is explicit", () => {
    const unknown = projectJarvisEvent(rawJarvisEventSchema.parse(wsEventsFixture[8]));
    const cancelled = projectJarvisEvent(rawJarvisEventSchema.parse({
      type: "turn_done",
      session_id: "session-synthetic-001",
      cancelled: true,
    }));

    expect(unknown).toEqual({ type: "turn_done", sessionId: "session-synthetic-001", outcome: "unknown" });
    expect(cancelled).toEqual({ type: "turn_done", sessionId: "session-synthetic-001", outcome: "cancelled" });
    expect(JSON.stringify([unknown, cancelled])).not.toContain("completed");
  });
});
