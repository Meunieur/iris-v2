import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import {
  mapGestureResult,
  type GestureRecognizerResultLike,
  type HandObservation,
} from "@iris/gesture-runtime";

type SessionViewport = Readonly<{ width: number; height: number; mirrored: boolean }>;

type RecognizerLike = Readonly<{
  recognizeForVideo(input: unknown, timestampMs: number): GestureRecognizerResultLike | Promise<GestureRecognizerResultLike>;
  close(): void | Promise<void>;
}>;

type MediaPipeSessionInput = Readonly<{
  wasmRoot: string;
  modelUrl: string;
  createRecognizer?: ((assets: Readonly<{ wasmRoot: string; modelUrl: string }>) => Promise<RecognizerLike>) | undefined;
}>;

export type MediaPipeSession = Readonly<{
  process(input: unknown, timestampMs: number, viewport: SessionViewport): Promise<HandObservation | undefined>;
  close(): Promise<void>;
}>;

async function createLocalRecognizer(
  assets: Readonly<{ wasmRoot: string; modelUrl: string }>,
): Promise<RecognizerLike> {
  const files = await FilesetResolver.forVisionTasks(assets.wasmRoot);
  return await GestureRecognizer.createFromOptions(files, {
    baseOptions: { modelAssetPath: assets.modelUrl },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.65,
    minHandPresenceConfidence: 0.65,
    minTrackingConfidence: 0.65,
    cannedGesturesClassifierOptions: { scoreThreshold: 0.72 },
  }) as unknown as RecognizerLike;
}

export function createMediaPipeSession(input: MediaPipeSessionInput): MediaPipeSession {
  const factory = input.createRecognizer ?? createLocalRecognizer;
  let recognizerPromise: Promise<RecognizerLike> | undefined;
  let busy = false;
  let closed = false;
  let closeComplete = false;
  let lastTimestamp = Number.NEGATIVE_INFINITY;

  const recognizer = () => {
    recognizerPromise ??= factory({ wasmRoot: input.wasmRoot, modelUrl: input.modelUrl });
    return recognizerPromise;
  };

  return Object.freeze({
    process: async (video, timestampMs, viewport) => {
      if (closed) throw new Error("MediaPipe session is closed");
      if (!Number.isFinite(timestampMs) || timestampMs <= lastTimestamp || busy) return undefined;
      busy = true;
      lastTimestamp = timestampMs;
      try {
        const active = await recognizer();
        const result = await active.recognizeForVideo(video, timestampMs);
        return mapGestureResult(result, timestampMs, viewport);
      } finally {
        busy = false;
      }
    },
    close: async () => {
      if (closeComplete) return;
      closed = true;
      closeComplete = true;
      if (recognizerPromise !== undefined) {
        const active = await recognizerPromise;
        await active.close();
      }
    },
  });
}
