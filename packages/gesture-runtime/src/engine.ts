import type {
  GestureConfig,
  GestureEngine,
  GestureEngineFrame,
  GestureEngineState,
  GestureEngineUpdate,
  GestureEvent,
  GestureName,
  NormalizedHand,
  Point,
} from "./types.js";

export const DEFAULT_GESTURE_CONFIG: GestureConfig = Object.freeze({
  minGestureConfidence: 0.72,
  minTrackingConfidence: 0.65,
  stablePoseMs: 160,
  dwellMs: 700,
  movementTolerancePx: 24,
  selectCooldownMs: 900,
  fistHoldMs: 500,
  staleAfterMs: 250,
  resizeHoldMs: 180,
  scrollDeadZoneRatio: 0.12,
  maxScrollPerFrame: 28,
  minScale: 0.7,
  maxScale: 1.4,
});

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function accepted(hand: NormalizedHand | undefined, config: GestureConfig): hand is NormalizedHand {
  return hand !== undefined
    && hand.gesture !== "unknown"
    && hand.gestureConfidence >= config.minGestureConfidence
    && hand.trackingConfidence >= config.minTrackingConfidence;
}

export function createGestureEngine(overrides: Partial<GestureConfig> = {}): GestureEngine {
  const config: GestureConfig = Object.freeze({ ...DEFAULT_GESTURE_CONFIG, ...overrides });
  let candidateKey: string | undefined;
  let candidateSince = 0;
  let lastTrackingAt: number | undefined;
  let trackingLostPublished = false;
  let dwell: { targetId: string; anchor: Point; startedAt: number } | undefined;
  let blockedTarget: string | undefined;
  let lastSelectAt = Number.NEGATIVE_INFINITY;
  let resize: { startedAt: number; baseline?: number | undefined } | undefined;
  let fistStartedAt: number | undefined;
  let dismissFired = false;

  const resetTransient = () => {
    candidateKey = undefined;
    dwell = undefined;
    resize = undefined;
    fistStartedAt = undefined;
    dismissFired = false;
  };

  const update = (frame: GestureEngineFrame): GestureEngineUpdate => {
    const primary = frame.hands.find((hand) => hand.id === "primary");
    const secondary = frame.hands.find((hand) => hand.id === "secondary");
    const usablePrimary = accepted(primary, config) ? primary : undefined;
    const usableSecondary = accepted(secondary, config) ? secondary : undefined;
    const events: GestureEvent[] = [];

    if (usablePrimary === undefined) {
      if (lastTrackingAt !== undefined
        && frame.timestampMs - lastTrackingAt >= config.staleAfterMs
        && !trackingLostPublished) {
        events.push(Object.freeze({ type: "tracking_lost" }));
        trackingLostPublished = true;
      }
      resetTransient();
      return Object.freeze({
        events: Object.freeze(events),
        state: Object.freeze({ gesture: "unknown", tracking: false }),
      });
    }

    lastTrackingAt = frame.timestampMs;
    trackingLostPublished = false;
    const twoPalms = usablePrimary.gesture === "open_palm"
      && usableSecondary?.gesture === "open_palm"
      && usablePrimary.palmCenter !== undefined
      && usableSecondary.palmCenter !== undefined;
    const key = twoPalms ? "open_palm:2" : usablePrimary.gesture;
    if (candidateKey !== key) {
      candidateKey = key;
      candidateSince = frame.timestampMs;
      dwell = undefined;
      resize = undefined;
      fistStartedAt = undefined;
      dismissFired = false;
    }
    const stable = frame.timestampMs - candidateSince >= config.stablePoseMs;

    if (frame.targetId !== blockedTarget && blockedTarget !== undefined) blockedTarget = undefined;

    if (stable && usablePrimary.gesture === "point" && usablePrimary.pointer !== undefined) {
      const targetId = frame.targetId;
      if (targetId === undefined || targetId === blockedTarget) {
        dwell = undefined;
      } else if (dwell?.targetId !== targetId) {
        dwell = { targetId, anchor: usablePrimary.pointer, startedAt: frame.timestampMs };
      } else if (distance(dwell.anchor, usablePrimary.pointer) > config.movementTolerancePx) {
        dwell = { targetId, anchor: usablePrimary.pointer, startedAt: frame.timestampMs };
      }
      const dwellProgress = dwell === undefined
        ? 0
        : clamp((frame.timestampMs - dwell.startedAt) / config.dwellMs, 0, 1);
      events.push(Object.freeze({
        type: "pointer",
        point: usablePrimary.pointer,
        confidence: Math.min(usablePrimary.gestureConfidence, usablePrimary.trackingConfidence),
        dwellProgress,
        targetId,
      }));
      if (dwell !== undefined
        && dwellProgress >= 1
        && frame.timestampMs - lastSelectAt >= config.selectCooldownMs) {
        events.push(Object.freeze({
          type: "select",
          point: usablePrimary.pointer,
          targetId: dwell.targetId,
          dwellMs: config.dwellMs,
        }));
        lastSelectAt = frame.timestampMs;
        blockedTarget = dwell.targetId;
        dwell = undefined;
      }
    } else {
      dwell = undefined;
    }

    if (stable && twoPalms && usablePrimary.palmCenter !== undefined && usableSecondary?.palmCenter !== undefined) {
      const palmDistance = distance(usablePrimary.palmCenter, usableSecondary.palmCenter);
      resize ??= { startedAt: frame.timestampMs };
      if (frame.timestampMs - resize.startedAt >= config.resizeHoldMs) {
        resize.baseline ??= palmDistance;
        if (resize.baseline > 0) {
          events.push(Object.freeze({
            type: "scale",
            factor: clamp(palmDistance / resize.baseline, config.minScale, config.maxScale),
          }));
        }
      }
    } else {
      resize = undefined;
    }

    if (stable && !twoPalms && usablePrimary.gesture === "open_palm"
      && usablePrimary.pointer !== undefined && frame.scrollRegion !== undefined) {
      const region = frame.scrollRegion;
      const center = region.top + region.height / 2;
      const deadZone = region.height * config.scrollDeadZoneRatio;
      const offset = usablePrimary.pointer.y - center;
      if (Math.abs(offset) > deadZone) {
        const reach = Math.max(1, region.height / 2 - deadZone);
        const normalized = clamp(
          (offset - Math.sign(offset) * deadZone) / reach,
          -1,
          1,
        );
        events.push(Object.freeze({
          type: "scroll",
          deltaY: Math.round(normalized * config.maxScrollPerFrame),
        }));
      }
    }

    if (stable && usablePrimary.gesture === "closed_fist") {
      fistStartedAt ??= frame.timestampMs;
      if (!dismissFired && frame.timestampMs - fistStartedAt >= config.fistHoldMs) {
        events.push(Object.freeze({ type: "dismiss" }));
        dismissFired = true;
      }
    } else {
      fistStartedAt = undefined;
      dismissFired = false;
    }

    const state: GestureEngineState = Object.freeze({
      gesture: key === "open_palm:2" ? "open_palm" : key as GestureName,
      tracking: true,
      primary: usablePrimary,
      secondary: usableSecondary,
    });
    return Object.freeze({ events: Object.freeze(events), state });
  };

  return Object.freeze({
    update,
    reset: () => {
      lastTrackingAt = undefined;
      trackingLostPublished = false;
      blockedTarget = undefined;
      lastSelectAt = Number.NEGATIVE_INFINITY;
      resetTransient();
    },
  });
}
