export type Point = Readonly<{ x: number; y: number }>;

export type GestureName = "point" | "open_palm" | "closed_fist" | "unknown";

export type HandId = "primary" | "secondary";

export type NormalizedHand = Readonly<{
  id: HandId;
  handedness: "left" | "right" | "unknown";
  gesture: GestureName;
  gestureConfidence: number;
  trackingConfidence: number;
  pointer?: Point | undefined;
  palmCenter?: Point | undefined;
}>;

export type HandObservation = Readonly<{
  timestampMs: number;
  hands: readonly NormalizedHand[];
}>;

export type GestureEngineFrame = HandObservation & Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  targetId?: string | undefined;
  scrollRegion?: Readonly<{ top: number; height: number }> | undefined;
}>;

export type GestureEvent =
  | Readonly<{ type: "pointer"; point: Point; confidence: number; dwellProgress: number; targetId?: string | undefined }>
  | Readonly<{ type: "select"; point: Point; targetId: string; dwellMs: number }>
  | Readonly<{ type: "scroll"; deltaY: number }>
  | Readonly<{ type: "scale"; factor: number }>
  | Readonly<{ type: "dismiss" }>
  | Readonly<{ type: "tracking_lost" }>;

export type GestureEngineState = Readonly<{
  gesture: GestureName;
  tracking: boolean;
  primary?: NormalizedHand | undefined;
  secondary?: NormalizedHand | undefined;
}>;

export type GestureEngineUpdate = Readonly<{
  events: readonly GestureEvent[];
  state: GestureEngineState;
}>;

export type GestureConfig = Readonly<{
  minGestureConfidence: number;
  minTrackingConfidence: number;
  stablePoseMs: number;
  dwellMs: number;
  movementTolerancePx: number;
  selectCooldownMs: number;
  fistHoldMs: number;
  staleAfterMs: number;
  resizeHoldMs: number;
  scrollDeadZoneRatio: number;
  maxScrollPerFrame: number;
  minScale: number;
  maxScale: number;
}>;

export type GestureEngine = Readonly<{
  update(frame: GestureEngineFrame): GestureEngineUpdate;
  reset(): void;
}>;
