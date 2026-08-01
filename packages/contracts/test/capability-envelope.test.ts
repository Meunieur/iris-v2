import { describe, expect, it } from "vitest";

import { capabilityEnvelopeSchema } from "../src/capability-envelope";

const validProposal = {
  version: "1",
  intent_id: "2acbe8ee-3f4b-4e4b-a88d-50db4f92b811",
  idempotency_key: "d1fc8e52-c16a-4baf-8c8e-475ac84c1060",
  source: {
    kind: "gemini_live",
    provider: "gemini",
    model: "synthetic-model",
    transcript_ref: "local-transcript-ref",
  },
  context: {
    brain_id: "brain_synthetic",
    session_id: "session-synthetic-001",
    run_id: null,
  },
  request: {
    capability: "memory.search",
    arguments: { query: "synthetic architecture decisions" },
  },
  risk: {
    level: "R0",
    reason: "Read-only local synthetic query",
  },
  approval: {
    state: "proposed",
    required: false,
    expires_at: "2026-07-24T12:00:00.000Z",
  },
  provenance: {
    skill_id: null,
    tool_id: "memory.search",
    pack_id: null,
    version: null,
  },
  created_at: "2026-07-24T11:59:30.000Z",
} as const;

describe("Phase 0 capability envelope", () => {
  it("accepts a strict R0 proposal", () => {
    expect(capabilityEnvelopeSchema.parse(validProposal)).toEqual(validProposal);
  });

  it("rejects raw credentials even when nested in arguments", () => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { query: "synthetic", api_key: "not-a-real-key" } },
    })).toThrow();
  });

  it.each([
    "api_key",
    "client_secret",
    "authorization",
    "private_key",
    "token",
    "session_token",
    "id_token",
    "signing_key",
    "cookie",
    "password",
    "passphrase",
    "access_token",
    "refresh_token",
    "secret",
    "Client-Secret",
    "Signing Key",
  ])("rejects normalized credential key %s in deeply nested objects and arrays", (credentialKey) => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: {
        ...validProposal.request,
        arguments: {
          nested: [{ deeper: { [credentialKey]: "synthetic-private-value" } }],
        },
      },
    })).toThrow();
  });

  it.each([
    "openai_api_key",
    "github_token",
    "bearer_token",
    "client_secret_value",
    "password_hint",
    "openaiApiKey",
    "githubToken",
    "client.secret.value",
    "signing key material",
  ])("rejects qualified or mixed credential key %s", (credentialKey) => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: {
        ...validProposal.request,
        arguments: {
          nested: [{ deeper: { [credentialKey]: "synthetic-private-value" } }],
        },
      },
    })).toThrow();
  });

  it("rejects a one MiB payload before recursive parsing", () => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: {
        ...validProposal.request,
        arguments: { payload: "x".repeat(1024 * 1024) },
      },
    })).toThrow();
  });

  it("rejects aggregate UTF-8 JSON payloads above 64 KiB", () => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: {
        ...validProposal.request,
        arguments: { chunks: Array.from({ length: 8 }, () => "x".repeat(9_000)) },
      },
    })).toThrow();
  });

  it("rejects nesting deeper than eight levels", () => {
    let nested: unknown = "leaf";
    for (let index = 0; index < 10; index += 1) nested = { nested };

    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { nested } },
    })).toThrow();
  });

  it("rejects arrays and objects with more than 64 entries", () => {
    const oversizedObject = Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`field_${index}`, index]));
    const oversizedArray = Array.from({ length: 65 }, (_, index) => index);

    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: oversizedObject },
    })).toThrow();
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { oversizedArray } },
    })).toThrow();
  });

  it("rejects an oversized getter-backed object without invoking accessors", () => {
    let getterReads = 0;
    const oversizedObject: Record<string, unknown> = {};
    for (let index = 0; index < 1_000; index += 1) {
      Object.defineProperty(oversizedObject, `field_${index}`, {
        enumerable: true,
        get: () => {
          getterReads += 1;
          return index;
        },
      });
    }

    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: oversizedObject },
    })).toThrow();
    expect(getterReads).toBe(0);
  });

  it("rejects a changing getter instead of letting Zod validate a second value", () => {
    let getterReads = 0;
    let unsafeValue: unknown = { api_key: "synthetic-private-value" };
    for (let depth = 0; depth < 20; depth += 1) unsafeValue = { nested: unsafeValue };

    const changingArguments: Record<string, unknown> = {};
    Object.defineProperty(changingArguments, "payload", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return getterReads === 1 ? "safe" : unsafeValue;
      },
    });

    const result = capabilityEnvelopeSchema.safeParse({
      ...validProposal,
      request: { ...validProposal.request, arguments: changingArguments },
    });

    expect(result.success).toBe(false);
    expect(getterReads).toBe(0);
  });

  it("rejects proxy-wrapped arguments before any observation trap can change their value", () => {
    let descriptorReads = 0;
    let propertyReads = 0;
    let keyReads = 0;
    const changingProxy = new Proxy({ payload: "safe" }, {
      get: (target, property, receiver) => {
        propertyReads += 1;
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor: (_target, _property) => {
        descriptorReads += 1;
        return {
          configurable: true,
          enumerable: true,
          value: descriptorReads === 1 ? { api_key: "synthetic-private-value" } : "safe",
          writable: true,
        } satisfies PropertyDescriptor;
      },
      ownKeys: (target) => {
        keyReads += 1;
        return Reflect.ownKeys(target);
      },
    });

    const result = capabilityEnvelopeSchema.safeParse({
      ...validProposal,
      request: { ...validProposal.request, arguments: changingProxy },
    });

    expect(result.success).toBe(false);
    expect(descriptorReads).toBe(0);
    expect(propertyReads).toBe(0);
    expect(keyReads).toBe(0);
  });

  it("rejects setter-only object properties and accessor array indices without invoking them", () => {
    let setterCalls = 0;
    let arrayGetterReads = 0;
    const setterArguments: Record<string, unknown> = {};
    Object.defineProperty(setterArguments, "payload", {
      enumerable: true,
      set: () => {
        setterCalls += 1;
      },
    });
    const accessorArray: unknown[] = [];
    Object.defineProperty(accessorArray, "0", {
      enumerable: true,
      get: () => {
        arrayGetterReads += 1;
        return "safe";
      },
    });
    accessorArray.length = 1;

    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: setterArguments },
    })).toThrow();
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { accessorArray } },
    })).toThrow();
    expect(setterCalls).toBe(0);
    expect(arrayGetterReads).toBe(0);
  });

  it("accepts null-prototype JSON arguments through the validated snapshot", () => {
    const argumentsWithNullPrototype = Object.create(null) as Record<string, unknown>;
    argumentsWithNullPrototype.query = "synthetic architecture decisions";

    expect(capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: argumentsWithNullPrototype },
    }).request.arguments).toEqual({ query: "synthetic architecture decisions" });
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects prototype-sensitive key %s without polluting object prototypes",
    (unsafeKey) => {
      const argumentsWithUnsafeKey = Object.create(null) as Record<string, unknown>;
      Object.defineProperty(argumentsWithUnsafeKey, unsafeKey, {
        enumerable: true,
        value: { polluted: true },
      });

      expect(() => capabilityEnvelopeSchema.parse({
        ...validProposal,
        request: { ...validProposal.request, arguments: argumentsWithUnsafeKey },
      })).toThrow();
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    },
  );

  it.each([
    ["Date", new Date("2026-07-24T00:00:00.000Z")],
    ["Map", new Map([["safe", "value"]])],
    ["class instance", new (class SyntheticValue { safe = "value"; })()],
  ])("rejects non-plain JSON objects during preflight: %s", (_label, nonPlainValue) => {
    const result = capabilityEnvelopeSchema.safeParse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { value: nonPlainValue } },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "Capability envelope objects must use a plain prototype"))
        .toBe(true);
    }
  });

  it("rejects more than 512 total nodes even when each collection is bounded", () => {
    const manyNodes = Array.from(
      { length: 64 },
      () => Array.from({ length: 8 }, () => 0),
    );

    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { manyNodes } },
    })).toThrow();
  });

  it("rejects cyclic inputs without entering recursive Zod parsing", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { cycle } },
    })).toThrow();
  });

  it("rejects keys and individual strings beyond their resource limits", () => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { ["k".repeat(129)]: "value" } },
    })).toThrow();
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, arguments: { value: "x".repeat((16 * 1024) + 1) } },
    })).toThrow();
  });

  it("rejects expiry at or before creation and beyond the 15 minute proposal window", () => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      approval: { ...validProposal.approval, expires_at: validProposal.created_at },
    })).toThrow();
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      approval: { ...validProposal.approval, expires_at: "2026-07-24T12:14:31.000Z" },
    })).toThrow();
  });

  it("accepts an expiry exactly 15 minutes after creation", () => {
    expect(capabilityEnvelopeSchema.parse({
      ...validProposal,
      approval: { ...validProposal.approval, expires_at: "2026-07-24T12:14:30.000Z" },
    }).approval.expires_at).toBe("2026-07-24T12:14:30.000Z");
  });

  it("rejects client-supplied authoritative approval", () => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      approval: { ...validProposal.approval, approved: true },
    })).toThrow();
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      approval: { ...validProposal.approval, state: "approved" },
    })).toThrow();
  });

  it("rejects unknown risk levels", () => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      risk: { ...validProposal.risk, level: "R4" },
    })).toThrow();
  });

  it("rejects extra executable code and unknown nested fields", () => {
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      request: { ...validProposal.request, executable_code: "run()" },
    })).toThrow();
    expect(() => capabilityEnvelopeSchema.parse({
      ...validProposal,
      source: { ...validProposal.source, endpoint: "https://example.invalid" },
    })).toThrow();
  });
});
