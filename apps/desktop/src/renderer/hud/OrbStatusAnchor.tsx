import type { JarvisReadSnapshot } from "@iris/jarvis-adapter";
import { connectionLabels } from "./labels.js";

export function OrbStatusAnchor({ snapshot }: { snapshot: JarvisReadSnapshot }) {
  const label = connectionLabels[snapshot.connection];
  return (
    <div className="orb-cluster hud-hit">
      <output className="orb-caption glass-chip" aria-label="Trạng thái JarvisOS">
        <span className={`signal-dot state-${snapshot.connection}`} aria-hidden="true" />
        <span><strong>{label}</strong><small>JarvisOS {snapshot.health?.version ?? "chưa rõ"}</small></span>
      </output>
      <div className="orb-instrument" data-state={snapshot.connection} aria-hidden="true">
        <span className="orb-halo" />
        <span className="orb-ticks" />
        <span className="orb-ring orb-ring-outer" />
        <span className="orb-ring orb-ring-inner" />
        <span className="orb-core"><i /></span>
      </div>
    </div>
  );
}
