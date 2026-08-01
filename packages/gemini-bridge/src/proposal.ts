import { capabilityEnvelopeSchema, type CapabilityEnvelope } from "@iris/contracts";
import { z } from "zod";

import type {
  ConversationContext,
  ConversationProposalSummary,
  ConversationToolCall,
  ConversationToolResponse,
} from "./types.js";

const proposalDraftSchema = z.object({
  capability: z.string().min(1).max(256),
  arguments: z.unknown(),
  risk: z.object({
    level: z.enum(["R0", "R1", "R2", "R3"]),
    reason: z.string().min(1).max(2_048),
  }).strict(),
}).strict();

type ProposalInput = Readonly<{
  call: ConversationToolCall;
  context: ConversationContext | undefined;
  model: string;
  now: Date;
  randomUuid(): string;
}>;

type ProposalResult = Readonly<{
  response: ConversationToolResponse;
  envelope?: CapabilityEnvelope;
  summary?: ConversationProposalSummary;
}>;

function rejected(call: ConversationToolCall, reason: string): ProposalResult {
  return {
    response: Object.freeze({
      id: call.id,
      name: call.name,
      response: Object.freeze({ status: "rejected", reason }),
    }),
  };
}

export function proposalFromToolCall(input: ProposalInput): ProposalResult {
  if (input.call.name !== "propose_capability") return rejected(input.call, "unsupported_function");
  if (input.context === undefined) return rejected(input.call, "missing_context");

  const draftResult = proposalDraftSchema.safeParse(input.call.args);
  if (!draftResult.success) return rejected(input.call, "invalid_proposal");

  const createdAt = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + 5 * 60 * 1_000).toISOString();
  const intentId = input.randomUuid();
  const candidate = {
    version: "1",
    intent_id: intentId,
    idempotency_key: input.randomUuid(),
    source: {
      kind: "conversation",
      provider: "gemini",
      model: input.model,
    },
    context: {
      brain_id: input.context.brainId,
      session_id: input.context.sessionId,
      run_id: input.context.runId,
    },
    request: {
      capability: draftResult.data.capability,
      arguments: draftResult.data.arguments,
    },
    risk: draftResult.data.risk,
    approval: {
      state: "proposed",
      required: true,
      expires_at: expiresAt,
    },
    provenance: {
      skill_id: null,
      tool_id: null,
      pack_id: null,
      version: null,
    },
    created_at: createdAt,
  };
  const envelopeResult = capabilityEnvelopeSchema.safeParse(candidate);
  if (!envelopeResult.success) return rejected(input.call, "invalid_proposal");

  const summary = Object.freeze({
    intentId: envelopeResult.data.intent_id,
    capability: envelopeResult.data.request.capability,
    arguments: envelopeResult.data.request.arguments,
    risk: envelopeResult.data.risk.level,
    reason: envelopeResult.data.risk.reason,
    approvalRequired: true as const,
    approvalState: "proposed" as const,
    expiresAt: envelopeResult.data.approval.expires_at,
  });
  return Object.freeze({
    envelope: envelopeResult.data,
    summary,
    response: Object.freeze({
      id: input.call.id,
      name: input.call.name,
      response: Object.freeze({
        status: "pending_jarvis_policy_and_approval",
        intentId: envelopeResult.data.intent_id,
      }),
    }),
  });
}
