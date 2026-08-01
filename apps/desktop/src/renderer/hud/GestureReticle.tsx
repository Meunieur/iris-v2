import type { CSSProperties } from "react";
import type { ReticleView } from "./types.js";

export function GestureReticle({ reticle, secondary = false }: { reticle: ReticleView; secondary?: boolean }) {
  const style = {
    "--reticle-x": `${reticle.x}px`,
    "--reticle-y": `${reticle.y}px`,
    "--dwell": `${Math.round(reticle.dwellProgress * 360)}deg`,
    "--confidence": reticle.confidence,
  } as CSSProperties;
  return (
    <span className={`gesture-reticle ${secondary ? "secondary" : "primary"}`} data-state={reticle.state} style={style} aria-hidden="true">
      <i className="reticle-bracket" />
      <i className="reticle-center" />
    </span>
  );
}
