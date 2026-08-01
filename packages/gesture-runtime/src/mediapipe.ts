import { mapNormalizedPoint } from "./coordinates.js";
import type { GestureName, HandObservation, NormalizedHand, Point } from "./types.js";

type CategoryLike = Readonly<{ categoryName?: string | undefined; score?: number | undefined }>;
type LandmarkLike = Readonly<{ x: number; y: number; z?: number | undefined }>;

export type GestureRecognizerResultLike = Readonly<{
  gestures?: readonly (readonly CategoryLike[])[] | undefined;
  handedness?: readonly (readonly CategoryLike[])[] | undefined;
  landmarks?: readonly (readonly LandmarkLike[])[] | undefined;
}>;

type MappingViewport = Readonly<{ width: number; height: number; mirrored: boolean }>;

function category(row: readonly CategoryLike[] | undefined): CategoryLike | undefined {
  return row?.[0];
}

function gestureName(value: string | undefined): GestureName {
  if (value === "Pointing_Up") return "point";
  if (value === "Open_Palm") return "open_palm";
  if (value === "Closed_Fist") return "closed_fist";
  return "unknown";
}

function handedness(value: string | undefined): NormalizedHand["handedness"] {
  const normalized = value?.toLowerCase();
  return normalized === "left" || normalized === "right" ? normalized : "unknown";
}

function mappedLandmark(
  landmarks: readonly LandmarkLike[],
  index: number,
  viewport: MappingViewport,
): Point | undefined {
  const landmark = landmarks[index];
  return landmark === undefined ? undefined : mapNormalizedPoint(landmark, viewport);
}

export function mapGestureResult(
  result: GestureRecognizerResultLike,
  timestampMs: number,
  viewport: MappingViewport,
): HandObservation {
  const rows = Math.min(
    result.gestures?.length ?? 0,
    result.handedness?.length ?? 0,
    result.landmarks?.length ?? 0,
    2,
  );
  const hands: NormalizedHand[] = [];
  for (let index = 0; index < rows; index += 1) {
    const landmarks = result.landmarks?.[index];
    if (landmarks === undefined || landmarks.length < 10) continue;
    const gesture = category(result.gestures?.[index]);
    const side = category(result.handedness?.[index]);
    hands.push(Object.freeze({
      id: index === 0 ? "primary" : "secondary",
      handedness: handedness(side?.categoryName),
      gesture: gestureName(gesture?.categoryName),
      gestureConfidence: gesture?.score ?? 0,
      trackingConfidence: side?.score ?? 0,
      pointer: mappedLandmark(landmarks, 8, viewport),
      palmCenter: mappedLandmark(landmarks, 9, viewport),
    }));
  }
  return Object.freeze({ timestampMs, hands: Object.freeze(hands) });
}
