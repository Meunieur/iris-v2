import { z } from "zod";

export const rawHealthSchema = z.object({
  status: z.string(),
  claude_cli: z.string(),
  claude_cli_available: z.boolean(),
  cwd: z.string(),
}).passthrough();

export const rawAuthStatusSchema = z.object({
  needs_setup: z.boolean(),
  auth_required: z.boolean(),
  require_login: z.boolean(),
  authed: z.boolean(),
  username: z.string(),
}).passthrough();

export const rawVersionSchema = z.object({
  current: z.string(),
  latest: z.string().nullable(),
  update_available: z.boolean(),
  mode: z.string(),
  can_self_update: z.boolean(),
  error: z.string().nullable(),
  previous_version: z.string().nullable(),
}).passthrough();

export const rawBrainSchema = z.object({
  name: z.string(),
  path: z.string(),
  notes: z.number().int().nonnegative(),
  is_default: z.boolean(),
}).passthrough();

export const rawBrainsSchema = z.object({
  dir: z.string(),
  brains: z.array(rawBrainSchema),
}).passthrough();

export const rawSessionSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  brain: z.string().nullable(),
  engine: z.string().nullable(),
  model: z.string().nullable(),
  cli_session_id: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  msg_count: z.number().int().nonnegative(),
  preview: z.string().nullable(),
}).passthrough();

export const rawSessionsSchema = z.object({
  sessions: z.array(rawSessionSchema),
}).passthrough();

const optionalSessionId = {
  session_id: z.string().optional(),
};

const rawHelloEventSchema = z.object({
  type: z.literal("hello"),
  stop_tag: z.string(),
}).passthrough();

const rawStatusEventSchema = z.object({
  type: z.literal("status"),
  content: z.string(),
  ...optionalSessionId,
}).passthrough();

const rawToolCallEventSchema = z.object({
  type: z.literal("tool_call"),
  tool: z.string(),
  content: z.string(),
  ...optionalSessionId,
}).passthrough();

const rawToolResultEventSchema = z.object({
  type: z.literal("tool_result"),
  content: z.string(),
  ok: z.boolean().optional(),
  ...optionalSessionId,
}).passthrough();

const rawStreamEventSchema = z.object({
  type: z.literal("stream"),
  content: z.string(),
  tts: z.boolean().optional(),
  ...optionalSessionId,
}).passthrough();

const rawResponseEventSchema = z.object({
  type: z.literal("response"),
  content: z.string(),
  engine: z.string().optional(),
  model: z.string().optional(),
  cli_session_id: z.string().nullable().optional(),
  cost_usd: z.number().nullable().optional(),
  ...optionalSessionId,
}).passthrough();

const rawNoticeEventSchema = z.object({
  type: z.enum(["error", "system"]),
  content: z.string(),
  ...optionalSessionId,
}).passthrough();

const rawTurnDoneEventSchema = z.object({
  type: z.literal("turn_done"),
  cancelled: z.boolean().optional(),
  ...optionalSessionId,
}).passthrough();

const knownEventNames = new Set([
  "hello",
  "status",
  "tool_call",
  "tool_result",
  "stream",
  "response",
  "error",
  "system",
  "turn_done",
]);

const rawUnknownEventSchema = z.object({
  type: z.string().refine((value) => !knownEventNames.has(value), "Known events must match their required legacy shape"),
}).passthrough();

export const rawJarvisEventSchema = z.union([
  rawHelloEventSchema,
  rawStatusEventSchema,
  rawToolCallEventSchema,
  rawToolResultEventSchema,
  rawStreamEventSchema,
  rawResponseEventSchema,
  rawNoticeEventSchema,
  rawTurnDoneEventSchema,
  rawUnknownEventSchema,
]);

export type RawHealth = z.infer<typeof rawHealthSchema>;
export type RawAuthStatus = z.infer<typeof rawAuthStatusSchema>;
export type RawVersion = z.infer<typeof rawVersionSchema>;
export type RawBrain = z.infer<typeof rawBrainSchema>;
export type RawBrains = z.infer<typeof rawBrainsSchema>;
export type RawSession = z.infer<typeof rawSessionSchema>;
export type RawSessions = z.infer<typeof rawSessionsSchema>;
export type RawJarvisEvent = z.infer<typeof rawJarvisEventSchema>;
