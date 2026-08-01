const FIXED_GESTURE_ACTIONS = new Set([
  "reader.close",
  "gesture.pause",
]);

export function isGestureActionAllowed(action: string): boolean {
  return FIXED_GESTURE_ACTIONS.has(action) || action.startsWith("reader.open.");
}
