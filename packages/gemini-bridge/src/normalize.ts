import { types as nodeUtilTypes } from "node:util";

import type { ConversationProviderEvent, ConversationToolCall } from "./types.js";

const MAX_PROVIDER_DEPTH = 8;
const MAX_PROVIDER_NODES = 512;
const MAX_PROVIDER_STRING_BYTES = 16 * 1024;
const MAX_PROVIDER_COLLECTION = 64;
const textEncoder = new TextEncoder();

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedProviderValue(input: unknown): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 1 }];
  const active = new WeakSet<object>();
  let nodes = 0;

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    nodes += 1;
    if (nodes > MAX_PROVIDER_NODES || frame.depth > MAX_PROVIDER_DEPTH) {
      throw new Error("Invalid Gemini provider message");
    }
    const value = frame.value;
    if (typeof value === "string") {
      if (textEncoder.encode(value).byteLength > MAX_PROVIDER_STRING_BYTES) {
        throw new Error("Invalid Gemini provider message");
      }
      continue;
    }
    if (value === null || typeof value === "boolean" || typeof value === "undefined") continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Invalid Gemini provider message");
      continue;
    }
    if (typeof value !== "object" || nodeUtilTypes.isProxy(value)) {
      throw new Error("Invalid Gemini provider message");
    }
    if (active.has(value)) throw new Error("Invalid Gemini provider message");
    active.add(value);
    const entries = Array.isArray(value)
      ? value.map((entry, index) => [String(index), entry] as const)
      : Object.entries(value);
    if (entries.length > MAX_PROVIDER_COLLECTION) throw new Error("Invalid Gemini provider message");
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry !== undefined) stack.push({ value: entry[1], depth: frame.depth + 1 });
    }
    active.delete(value);
  }
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

function transcriptEvent(
  value: unknown,
  type: "input_transcript" | "output_transcript",
  final: boolean,
): ConversationProviderEvent | undefined {
  if (!isRecord(value) || typeof value.text !== "string") return undefined;
  return { type, text: value.text, final };
}

function normalizeToolCalls(value: unknown): readonly ConversationToolCall[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.functionCalls) || value.functionCalls.length === 0) return undefined;
  const calls: ConversationToolCall[] = [];
  for (const candidate of value.functionCalls) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.name !== "string") {
      throw new Error("Invalid Gemini provider message");
    }
    calls.push(Object.freeze({ id: candidate.id, name: candidate.name, args: candidate.args }));
  }
  return Object.freeze(calls);
}

export function normalizeProviderMessage(input: unknown): readonly ConversationProviderEvent[] {
  boundedProviderValue(input);
  if (!isRecord(input)) throw new Error("Invalid Gemini provider message");
  const events: ConversationProviderEvent[] = [];

  if (isRecord(input.setupComplete)) events.push({ type: "setup_complete" });

  if (isRecord(input.serverContent)) {
    const server = input.serverContent;
    const final = server.turnComplete === true || server.generationComplete === true;
    const inputTranscript = transcriptEvent(server.inputTranscription, "input_transcript", final);
    if (inputTranscript !== undefined) events.push(inputTranscript);
    const outputTranscript = transcriptEvent(server.outputTranscription, "output_transcript", final);
    if (outputTranscript !== undefined) events.push(outputTranscript);
    if (server.interrupted === true) events.push({ type: "interrupted" });
    if (server.turnComplete === true) events.push({ type: "turn_complete" });
  }

  if (isRecord(input.sessionResumptionUpdate)) {
    const update = input.sessionResumptionUpdate;
    const event: ConversationProviderEvent = {
      type: "session_resumption",
      resumable: update.resumable === true,
      ...(typeof update.newHandle === "string" ? { handle: update.newHandle } : {}),
      ...(typeof update.lastConsumedClientMessageIndex === "string"
        ? { lastConsumedClientMessageIndex: update.lastConsumedClientMessageIndex }
        : {}),
    };
    events.push(event);
  }

  if (isRecord(input.goAway)) {
    const raw = input.goAway.timeLeftMs;
    events.push({
      type: "go_away",
      ...(typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? { timeLeftMs: raw } : {}),
    });
  }

  const calls = normalizeToolCalls(input.toolCall);
  if (calls !== undefined) events.push({ type: "tool_call", calls });

  if (isRecord(input.toolCallCancellation) && Array.isArray(input.toolCallCancellation.ids)) {
    const ids = input.toolCallCancellation.ids;
    if (!ids.every((id) => typeof id === "string")) throw new Error("Invalid Gemini provider message");
    events.push({ type: "tool_call_cancelled", ids: Object.freeze([...ids]) });
  }

  if (isRecord(input.usageMetadata)) {
    const usage = input.usageMetadata;
    const inputTokens = optionalNonNegativeInteger(usage.promptTokenCount);
    const outputTokens = optionalNonNegativeInteger(usage.candidatesTokenCount);
    const totalTokens = optionalNonNegativeInteger(usage.totalTokenCount);
    events.push({
      type: "usage",
      ...(inputTokens === undefined ? {} : { inputTokens }),
      ...(outputTokens === undefined ? {} : { outputTokens }),
      ...(totalTokens === undefined ? {} : { totalTokens }),
    });
  }

  if (events.length === 0) throw new Error("Invalid Gemini provider message");
  return Object.freeze(events);
}
