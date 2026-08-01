import { z } from "zod";

export const jarvisTaskStatusSchema = z.enum([
  "triage",
  "todo",
  "ready",
  "running",
  "review",
  "blocked",
  "done",
  "cancelled",
  "archived",
]);

export const jarvisTaskOutcomeSchema = z.enum([
  "succeeded",
  "needs_approval",
  "blocked",
  "cancelled",
  "archived",
]);

export const jarvisTaskEventTypeSchema = z.enum([
  "created",
  "started",
  "completed",
  "blocked",
  "cancelled",
  "retry_scheduled",
  "status",
]);

const taskIdSchema = z.string().regex(/^t_[a-f0-9]{12}$/);
const runIdSchema = z.string().regex(/^run_[a-f0-9]{14}$/);
const optionalRunIdSchema = z.union([z.literal(""), runIdSchema]);
const timestampSchema = z.number().finite().nonnegative();

const jarvisTaskEventSchema = z.object({
  id: z.number().int().positive(),
  type: jarvisTaskEventTypeSchema,
  run_id: optionalRunIdSchema,
  created_at: timestampSchema,
}).strict();

const jarvisTaskRunSchema = z.object({
  run_id: runIdSchema,
  status: z.string().min(1).max(32),
  started_at: timestampSchema,
  finished_at: timestampSchema,
  heartbeat_at: timestampSchema,
}).strict();

const terminalOutcomes = new Map<string, string>([
  ["done", "succeeded"],
  ["review", "needs_approval"],
  ["blocked", "blocked"],
  ["cancelled", "cancelled"],
  ["archived", "archived"],
]);
const liveStatuses = new Set(["triage", "todo", "ready", "running"]);

export const jarvisTaskSnapshotSchema = z.object({
  version: z.literal(1),
  task_id: taskIdSchema,
  intent_id: z.string().uuid(),
  brain_id: z.string().regex(/^brain_[a-f0-9]{64}$/),
  session_id: z.string().max(96),
  risk: z.literal("R0"),
  status: jarvisTaskStatusSchema,
  terminal: z.boolean(),
  outcome: jarvisTaskOutcomeSchema.nullable(),
  orphaned: z.boolean(),
  can_stop: z.boolean(),
  current_run_id: optionalRunIdSchema,
  result: z.string().max(4_000),
  replayed: z.boolean(),
  event_cursor: z.number().int().nonnegative(),
  events: z.array(jarvisTaskEventSchema).max(100),
  runs: z.array(jarvisTaskRunSchema).max(10),
}).strict().superRefine((value, context) => {
  const expectedOutcome = terminalOutcomes.get(value.status) ?? null;
  const expectedTerminal = expectedOutcome !== null;
  if (value.terminal !== expectedTerminal || value.outcome !== expectedOutcome) {
    context.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "Task terminal outcome must come from Jarvis status",
    });
  }
  if (value.can_stop !== liveStatuses.has(value.status)) {
    context.addIssue({ code: "custom", path: ["can_stop"], message: "Invalid stop state" });
  }
  if (value.orphaned && value.status !== "running") {
    context.addIssue({ code: "custom", path: ["orphaned"], message: "Only running tasks can be orphaned" });
  }
  if (value.status === "running" && value.current_run_id.length === 0) {
    context.addIssue({ code: "custom", path: ["current_run_id"], message: "Running task needs a run id" });
  }
  if (value.status !== "running" && value.current_run_id.length !== 0) {
    context.addIssue({ code: "custom", path: ["current_run_id"], message: "Only running task exposes current run id" });
  }
  if (!value.terminal && value.result.length !== 0) {
    context.addIssue({ code: "custom", path: ["result"], message: "Non-terminal task cannot expose a result" });
  }
  let previousEventId = 0;
  value.events.forEach((event, index) => {
    if (event.id <= previousEventId) {
      context.addIssue({
        code: "custom",
        path: ["events", index, "id"],
        message: "Task event ids must be strictly increasing",
      });
    }
    if (event.id > value.event_cursor) {
      context.addIssue({
        code: "custom",
        path: ["event_cursor"],
        message: "Event cursor cannot precede an included event",
      });
    }
    previousEventId = event.id;
  });
  const runIds = new Set<string>();
  value.runs.forEach((run, index) => {
    if (runIds.has(run.run_id)) {
      context.addIssue({
        code: "custom",
        path: ["runs", index, "run_id"],
        message: "Duplicate run id",
      });
    }
    runIds.add(run.run_id);
  });
});

export type JarvisTaskStatus = z.infer<typeof jarvisTaskStatusSchema>;
export type JarvisTaskOutcome = z.infer<typeof jarvisTaskOutcomeSchema>;
type ParsedJarvisTaskSnapshot = z.infer<typeof jarvisTaskSnapshotSchema>;
export type JarvisTaskSnapshot = Readonly<
  Omit<ParsedJarvisTaskSnapshot, "events" | "runs">
  & {
    events: readonly Readonly<ParsedJarvisTaskSnapshot["events"][number]>[];
    runs: readonly Readonly<ParsedJarvisTaskSnapshot["runs"][number]>[];
  }
>;

export type JarvisTaskInput = Readonly<{
  brainId: `brain_${string}`;
  message: string;
  sessionId?: string | undefined;
}>;
