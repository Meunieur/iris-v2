import { types as nodeUtilTypes } from "node:util";

import { z } from "zod";

type JsonRecord = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonRecord;
type JsonContainer = JsonValue[] | JsonRecord;

const MAX_ENVELOPE_BYTES = 64 * 1024;
const MAX_ENVELOPE_DEPTH = 8;
const MAX_ENVELOPE_NODES = 512;
const MAX_COLLECTION_ENTRIES = 64;
const MAX_KEY_BYTES = 128;
const MAX_STRING_BYTES = 16 * 1024;
const MAX_PROPOSAL_WINDOW_MS = 15 * 60 * 1000;
const textEncoder = new TextEncoder();

const boundedJsonRecordSchema = () => z.record(
  z.string().max(MAX_KEY_BYTES),
  jsonValueSchema,
).superRefine((value, context) => {
  if (Object.keys(value).length > MAX_COLLECTION_ENTRIES) {
    context.addIssue({ code: "custom", message: "JSON objects may contain at most 64 entries" });
  }
});

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string().max(MAX_STRING_BYTES),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema).max(MAX_COLLECTION_ENTRIES),
  boundedJsonRecordSchema(),
]));

const sourceSchema = z.object({
  kind: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  transcript_ref: z.string().min(1).optional(),
}).strict();

const contextSchema = z.object({
  brain_id: z.string().min(1),
  session_id: z.string().min(1),
  run_id: z.string().min(1).nullable(),
}).strict();

const requestSchema = z.object({
  capability: z.string().min(1),
  arguments: boundedJsonRecordSchema(),
}).strict();

const riskSchema = z.object({
  level: z.enum(["R0", "R1", "R2", "R3"]),
  reason: z.string().min(1),
}).strict();

const approvalSchema = z.object({
  state: z.literal("proposed"),
  required: z.boolean(),
  expires_at: z.string().datetime({ offset: true }),
}).strict();

const provenanceSchema = z.object({
  skill_id: z.string().min(1).nullable(),
  tool_id: z.string().min(1).nullable(),
  pack_id: z.string().min(1).nullable(),
  version: z.string().min(1).nullable(),
}).strict();

const forbiddenCredentialSegments = new Set([
  "authorization",
  "cookie",
  "passphrase",
  "password",
  "secret",
  "token",
]);

const forbiddenCredentialCompacts = [
  "apikey",
  "clientsecret",
  "privatekey",
  "signingkey",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "idtoken",
  "githubtoken",
  "bearertoken",
];

const forbiddenPrototypeKeys = new Set(["__proto__", "constructor", "prototype"]);

function isForbiddenCredentialKey(key: string): boolean {
  const segments = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (segments.some((segment) => forbiddenCredentialSegments.has(segment))) return true;
  const compact = segments.join("");
  return forbiddenCredentialCompacts.some((marker) => compact.includes(marker));
}

type SnapshotTarget =
  | { kind: "root" }
  | { kind: "array"; container: JsonValue[]; index: number }
  | { kind: "object"; container: JsonRecord; key: string };

type PreflightFrame =
  | { kind: "visit"; value: unknown; depth: number; target: SnapshotTarget }
  | { kind: "leave"; value: object; snapshot: JsonContainer };

type PreflightResult =
  | { ok: true; snapshot: JsonValue }
  | { ok: false; issue: string };

function jsonStringBytes(value: string): number {
  return textEncoder.encode(JSON.stringify(value)).byteLength;
}

function assignSnapshotValue(
  target: SnapshotTarget,
  value: JsonValue,
  root: { value?: JsonValue },
): void {
  if (target.kind === "root") {
    root.value = value;
  } else if (target.kind === "array") {
    target.container[target.index] = value;
  } else {
    target.container[target.key] = value;
  }
}

function preflightEnvelope(input: unknown): PreflightResult {
  const fail = (issue: string): PreflightResult => ({ ok: false, issue });
  const activeObjects = new WeakSet<object>();
  const rootSnapshot: { value?: JsonValue } = {};
  const stack: PreflightFrame[] = [{ kind: "visit", value: input, depth: 1, target: { kind: "root" } }];
  let nodeCount = 0;
  let jsonBytes = 0;

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    if (frame.kind === "leave") {
      activeObjects.delete(frame.value);
      Object.freeze(frame.snapshot);
      continue;
    }

    nodeCount += 1;
    if (nodeCount > MAX_ENVELOPE_NODES) return fail("Capability envelope exceeds 512 nodes");
    if (frame.depth > MAX_ENVELOPE_DEPTH) return fail("Capability envelope exceeds depth 8");

    const value = frame.value;
    if (typeof value === "string") {
      const stringBytes = textEncoder.encode(value).byteLength;
      if (stringBytes > MAX_STRING_BYTES) return fail("Capability envelope string exceeds 16 KiB");
      jsonBytes += jsonStringBytes(value);
      assignSnapshotValue(frame.target, value, rootSnapshot);
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) return fail("Capability envelope numbers must be finite");
      jsonBytes += String(value).length;
      assignSnapshotValue(frame.target, value, rootSnapshot);
    } else if (typeof value === "boolean") {
      jsonBytes += value ? 4 : 5;
      assignSnapshotValue(frame.target, value, rootSnapshot);
    } else if (value === null) {
      jsonBytes += 4;
      assignSnapshotValue(frame.target, value, rootSnapshot);
    } else if (typeof value === "object") {
      if (nodeUtilTypes.isProxy(value)) return fail("Capability envelope must not contain Proxy objects");
      if (!Array.isArray(value)) {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
          return fail("Capability envelope objects must use a plain prototype");
        }
      }
      if (activeObjects.has(value)) return fail("Capability envelope must not contain cycles");

      if (Array.isArray(value)) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        if (lengthDescriptor === undefined || !Object.hasOwn(lengthDescriptor, "value")) {
          return fail("Capability envelope arrays must use a data length property");
        }
        const arrayLength = lengthDescriptor.value;
        if (!Number.isInteger(arrayLength) || arrayLength < 0 || arrayLength > MAX_COLLECTION_ENTRIES) {
          return fail("Capability envelope arrays may contain at most 64 entries");
        }
        const itemValues: unknown[] = [];
        for (let index = 0; index < arrayLength; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (descriptor === undefined) return fail("Capability envelope arrays must not be sparse");
          if (!Object.hasOwn(descriptor, "value")) {
            return fail("Capability envelope must not contain accessor properties");
          }
          itemValues.push(descriptor.value);
        }

        const snapshot: JsonValue[] = [];
        assignSnapshotValue(frame.target, snapshot, rootSnapshot);
        activeObjects.add(value);
        stack.push({ kind: "leave", value, snapshot });
        jsonBytes += 2 + Math.max(0, arrayLength - 1);
        for (let index = itemValues.length - 1; index >= 0; index -= 1) {
          stack.push({
            kind: "visit",
            value: itemValues[index],
            depth: frame.depth + 1,
            target: { kind: "array", container: snapshot, index },
          });
        }
      } else {
        const entries: Array<[string, unknown]> = [];
        for (const key in value) {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (descriptor === undefined || descriptor.enumerable !== true) continue;
          if (entries.length >= MAX_COLLECTION_ENTRIES) {
            return fail("Capability envelope objects may contain at most 64 entries");
          }
          if (textEncoder.encode(key).byteLength > MAX_KEY_BYTES) {
            return fail("Capability envelope key exceeds 128 bytes");
          }
          if (isForbiddenCredentialKey(key)) {
            return fail("Capability envelope contains a credential-bearing key");
          }
          if (forbiddenPrototypeKeys.has(key.toLowerCase())) {
            return fail("Capability envelope contains a prototype-sensitive key");
          }
          if (!Object.hasOwn(descriptor, "value")) {
            return fail("Capability envelope must not contain accessor properties");
          }
          jsonBytes += jsonStringBytes(key) + 1;
          entries.push([key, descriptor.value]);
        }

        const snapshot = Object.create(null) as JsonRecord;
        assignSnapshotValue(frame.target, snapshot, rootSnapshot);
        activeObjects.add(value);
        stack.push({ kind: "leave", value, snapshot });
        jsonBytes += 2 + Math.max(0, entries.length - 1);
        for (let index = entries.length - 1; index >= 0; index -= 1) {
          const entry = entries[index];
          if (entry === undefined) continue;
          const [key, entryValue] = entry;
          stack.push({
            kind: "visit",
            value: entryValue,
            depth: frame.depth + 1,
            target: { kind: "object", container: snapshot, key },
          });
        }
      }
    } else {
      return fail("Capability envelope contains a non-JSON value");
    }

    if (jsonBytes > MAX_ENVELOPE_BYTES) return fail("Capability envelope exceeds 64 KiB");
  }

  if (!("value" in rootSnapshot)) return fail("Capability envelope contains no JSON value");
  return { ok: true, snapshot: rootSnapshot.value };
}

const envelopeObjectSchema = z.object({
  version: z.literal("1"),
  intent_id: z.string().uuid(),
  idempotency_key: z.string().uuid(),
  source: sourceSchema,
  context: contextSchema,
  request: requestSchema,
  risk: riskSchema,
  approval: approvalSchema,
  provenance: provenanceSchema,
  created_at: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  const createdAt = Date.parse(value.created_at);
  const expiresAt = Date.parse(value.approval.expires_at);
  const lifetime = expiresAt - createdAt;
  if (lifetime <= 0) {
    context.addIssue({
      code: "custom",
      message: "Capability proposal expiry must be after creation",
      path: ["approval", "expires_at"],
    });
  } else if (lifetime > MAX_PROPOSAL_WINDOW_MS) {
    context.addIssue({
      code: "custom",
      message: "Capability proposal expiry must be within 15 minutes",
      path: ["approval", "expires_at"],
    });
  }
});

const envelopePreflightSchema = z.unknown().transform<unknown>((value, context) => {
  const result = preflightEnvelope(value);
  if (!result.ok) {
    context.addIssue({ code: "custom", message: result.issue });
    return z.NEVER;
  }
  return result.snapshot;
});

export const capabilityEnvelopeSchema = envelopePreflightSchema.pipe(envelopeObjectSchema);

export type CapabilityEnvelope = z.infer<typeof capabilityEnvelopeSchema>;
