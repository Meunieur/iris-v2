import { randomUUID } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import type { ConversationContext, ConversationController, ConversationProvider, ConversationScheduler } from "@iris/gemini-bridge";
import { createConversationController } from "@iris/gemini-bridge";
import type { GeminiSdkClient } from "./gemini-provider.js";
import { createGeminiProvider } from "./gemini-provider.js";

const DEFAULT_MODEL = "gemini-3.1-flash-live-preview";

export type JarvisConversationContextSource = Readonly<{
  connection: string;
  health?: Readonly<{ authenticated?: boolean }>;
  brains: readonly Readonly<{ id: string; isDefault: boolean; name?: string; notes?: number }>[];
  sessions: readonly Readonly<{ id: string; title?: string }>[];
}>;

type RuntimeInput = Readonly<{
  env: Readonly<Record<string, string | undefined>>;
  createClient?: (input: Readonly<{ apiKey: string }>) => GeminiSdkClient;
  getJarvisSnapshot(): JarvisConversationContextSource | undefined;
  scheduler: ConversationScheduler;
}>;

function modelFromEnv(value: string | undefined): string {
  if (value === undefined || value.length === 0 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    return DEFAULT_MODEL;
  }
  return value;
}

export function conversationContextFromJarvisSnapshot(
  snapshot: JarvisConversationContextSource | undefined,
): ConversationContext | undefined {
  if (snapshot === undefined || snapshot.connection !== "ready" || snapshot.health?.authenticated !== true) return undefined;
  const brain = snapshot.brains.find((candidate) => candidate.isDefault) ?? snapshot.brains[0];
  const session = snapshot.sessions[0];
  if (brain === undefined || session === undefined) return undefined;
  return Object.freeze({ brainId: brain.id, sessionId: session.id, runId: null });
}

function inertProvider(): ConversationProvider {
  return Object.freeze({
    connect: async () => {
      throw new Error("Gemini provider is not configured");
    },
  });
}

export function createConversationRuntime(input: RuntimeInput): Readonly<{
  controller: ConversationController;
}> {
  const enabled = input.env.IRIS_GEMINI_ENABLED === "1";
  const apiKey = input.env.GEMINI_API_KEY?.trim();
  const hasCredentials = typeof apiKey === "string" && apiKey.length > 0;
  const model = modelFromEnv(input.env.IRIS_GEMINI_MODEL);
  const provider = enabled && hasCredentials
    ? createGeminiProvider({
      client: input.createClient?.({ apiKey })
        ?? (new GoogleGenAI({ apiKey }) as unknown as GeminiSdkClient),
    })
    : inertProvider();
  const controller = createConversationController({
    enabled,
    hasCredentials,
    model,
    provider,
    scheduler: input.scheduler,
    now: () => new Date(),
    randomUuid: randomUUID,
    getContext: () => conversationContextFromJarvisSnapshot(input.getJarvisSnapshot()),
  });
  return Object.freeze({ controller });
}
