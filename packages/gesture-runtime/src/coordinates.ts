import type { Point } from "./types.js";

type CoordinateViewport = Readonly<{
  width: number;
  height: number;
  mirrored: boolean;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stablePixel(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function mapNormalizedPoint(point: Point, viewport: CoordinateViewport): Point {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
    || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error("Invalid gesture viewport");
  }
  const normalizedX = clamp(point.x, 0, 1);
  const normalizedY = clamp(point.y, 0, 1);
  return Object.freeze({
    x: stablePixel((viewport.mirrored ? 1 - normalizedX : normalizedX) * viewport.width),
    y: stablePixel(normalizedY * viewport.height),
  });
}
