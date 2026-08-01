import type {
  ConversationProvider,
  ConversationProviderEvent,
  ConversationToolResponse,
} from "@iris/gemini-bridge";
import { normalizeProviderMessage } from "@iris/gemini-bridge";

const MAX_AUDIO_BYTES = 32 * 1024;
const AUDIO_INPUT_MIME = "audio/pcm;rate=16000";

type GeminiFunctionDeclaration = Readonly<{
  name: "propose_capability";
  description: string;
  parametersJsonSchema: Readonly<Record<string, unknown>>;
}>;

type GeminiTool = Readonly<{
  functionDeclarations: readonly GeminiFunctionDeclaration[];
}>;

type GeminiLiveRequest = Readonly<{
  model: string;
  config: Readonly<{
    responseModalities: readonly ["AUDIO"];
    inputAudioTranscription: Readonly<Record<string, never>>;
    outputAudioTranscription: Readonly<Record<string, never>>;
    sessionResumption: Readonly<{ transparent: true; handle?: string }>;
    contextWindowCompression: Readonly<{ slidingWindow: Readonly<Record<string, never>> }>;
    systemInstruction: Readonly<{ role: "user"; parts: readonly [{ text: string }] }>;
    tools: readonly [GeminiTool];
  }>;
  callbacks: Readonly<{
    onmessage(message: unknown): void;
    onclose(event: unknown): void;
    onerror?(event: unknown): void;
  }>;
}>;

export type GeminiSdkSession = Readonly<{
  close(): void;
  sendRealtimeInput(input: Readonly<Record<string, unknown>>): void;
  sendClientContent(input: Readonly<Record<string, unknown>>): void;
  sendToolResponse(input: Readonly<Record<string, unknown>>): void;
}>;

export type GeminiSdkClient = Readonly<{
  live: Readonly<{
    connect(input: GeminiLiveRequest): Promise<GeminiSdkSession>;
  }>;
}>;

type ProviderInput = Readonly<{ client: GeminiSdkClient }>;

function decodeAudio(data: unknown): Uint8Array | undefined {
  if (typeof data !== "string" || data.length === 0) return undefined;
  const bytes = Buffer.from(data, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AUDIO_BYTES || bytes.byteLength % 2 !== 0) return undefined;
  return new Uint8Array(bytes);
}

function parseTimeLeft(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)$/.exec(value.trim());
  if (match === null) return undefined;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m" ? 60_000 : unit === "s" ? 1_000 : 1;
  const result = Math.round(amount * multiplier);
  return Number.isSafeInteger(result) && result >= 0 ? result : undefined;
}

function proposalFunction(): GeminiFunctionDeclaration {
  return Object.freeze({
    name: "propose_capability",
    description: "提出一个需要 JarvisOS 重新校验和审批的能力建议；绝不直接执行操作。",
    parametersJsonSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: ["capability", "arguments", "risk"],
      properties: {
        capability: { type: "string", minLength: 1, maxLength: 256 },
        arguments: { type: "object" },
        risk: {
          type: "object",
          additionalProperties: false,
          required: ["level", "reason"],
          properties: {
            level: { type: "string", enum: ["R0", "R1", "R2", "R3"] },
            reason: { type: "string", minLength: 1, maxLength: 2_048 },
          },
        },
      },
    }),
  });
}

function rawMessageForNormalization(message: unknown): Record<string, unknown> {
  if (typeof message !== "object" || message === null) throw new Error("Invalid Gemini provider message");
  const value = message as Record<string, unknown>;
  const serverContent = value.serverContent;
  const goAway = value.goAway;
  return {
    ...(value.setupComplete === undefined ? {} : { setupComplete: value.setupComplete }),
    ...(serverContent === undefined ? {} : { serverContent }),
    ...(value.toolCall === undefined ? {} : { toolCall: value.toolCall }),
    ...(value.toolCallCancellation === undefined ? {} : { toolCallCancellation: value.toolCallCancellation }),
    ...(value.usageMetadata === undefined ? {} : { usageMetadata: value.usageMetadata }),
    ...(goAway === undefined ? {} : {
      goAway: {
        timeLeftMs: parseTimeLeft((goAway as Record<string, unknown>).timeLeft),
      },
    }),
    ...(value.sessionResumptionUpdate === undefined ? {} : { sessionResumptionUpdate: value.sessionResumptionUpdate }),
  };
}

function audioEvents(message: unknown): readonly ConversationProviderEvent[] {
  if (typeof message !== "object" || message === null) return [];
  const serverContent = (message as Record<string, unknown>).serverContent;
  if (typeof serverContent !== "object" || serverContent === null) return [];
  const modelTurn = (serverContent as Record<string, unknown>).modelTurn;
  if (typeof modelTurn !== "object" || modelTurn === null) return [];
  const parts = (modelTurn as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) return [];
  const events: ConversationProviderEvent[] = [];
  for (const part of parts) {
    if (typeof part !== "object" || part === null) continue;
    const inline = (part as Record<string, unknown>).inlineData;
    if (typeof inline !== "object" || inline === null) continue;
    const inlineRecord = inline as Record<string, unknown>;
    const mimeType = inlineRecord.mimeType;
    if (typeof mimeType !== "string" || !mimeType.toLowerCase().startsWith("audio/pcm")) continue;
    const pcm16 = decodeAudio(inlineRecord.data);
    if (pcm16 !== undefined) events.push({ type: "audio", pcm16 });
  }
  return Object.freeze(events);
}

export function createGeminiProvider(input: ProviderInput): ConversationProvider {
  return Object.freeze({
    connect: async (connection) => {
      const session = await input.client.live.connect({
        model: connection.model,
        config: Object.freeze({
          responseModalities: ["AUDIO"],
          inputAudioTranscription: Object.freeze({}),
          outputAudioTranscription: Object.freeze({}),
          sessionResumption: Object.freeze({
            transparent: true,
            ...(connection.resumeHandle === undefined ? {} : { handle: connection.resumeHandle }),
          }),
          contextWindowCompression: Object.freeze({ slidingWindow: Object.freeze({}) }),
          systemInstruction: Object.freeze({
            role: "user",
            parts: [{
              text: "RESPOND IN VIETNAMESE WHEN POSSIBLE. You are the conversation plane. Never execute tools directly. Use propose_capability only to submit a bounded proposal for JarvisOS policy and approval.",
            }] as const,
          }),
          tools: [Object.freeze({ functionDeclarations: [proposalFunction()] })],
        }),
        callbacks: {
          onmessage: (message) => {
            try {
              for (const event of audioEvents(message)) connection.onEvent(event);
              for (const event of normalizeProviderMessage(rawMessageForNormalization(message))) connection.onEvent(event);
            } catch {
              connection.onClose();
            }
          },
          onclose: () => connection.onClose(),
          onerror: () => connection.onClose(),
        },
      });

      return Object.freeze({
        close: () => session.close(),
        sendAudio: (chunk: Uint8Array) => {
          if (chunk.byteLength === 0 || chunk.byteLength > MAX_AUDIO_BYTES || chunk.byteLength % 2 !== 0) {
            throw new Error("Conversation audio chunk rejected");
          }
          session.sendRealtimeInput({
            audio: {
              data: Buffer.from(chunk).toString("base64"),
              mimeType: AUDIO_INPUT_MIME,
            },
          });
        },
        sendText: (text: string) => session.sendRealtimeInput({ text }),
        interrupt: () => session.sendRealtimeInput({ activityStart: {} }),
        sendToolResponse: (responses: readonly ConversationToolResponse[]) => session.sendToolResponse({
          functionResponses: responses.map((response) => ({
            id: response.id,
            name: response.name,
            response: response.response,
          })),
        }),
      });
    },
  });
}
