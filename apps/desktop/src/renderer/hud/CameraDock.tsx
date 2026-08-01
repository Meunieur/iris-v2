import { CameraIcon, HandIcon } from "./icons.js";
import { cameraLabels, gestureLabels } from "./labels.js";
import type { GestureViewState } from "./types.js";

export function CameraDock({
  gesture,
  onEnable,
  onPause,
  onStop,
}: {
  gesture: GestureViewState;
  onEnable(): void;
  onPause(): void;
  onStop(): void;
}) {
  return (
    <section className="camera-dock glass-panel hud-hit" aria-label="Điều khiển cử chỉ và quyền riêng tư">
      <div className="camera-heading">
        <span className="instrument-icon"><CameraIcon /></span>
        <span><small>Local vision</small><strong>{cameraLabels[gesture.camera]}</strong></span>
        <span className={`privacy-light camera-${gesture.camera}`} aria-hidden="true" />
      </div>
      <div className="gesture-readout">
        <HandIcon />
        <span><small>Cử chỉ</small><strong>{gestureLabels[gesture.gesture]}</strong></span>
        <em>{gesture.tracking ? "tracking" : gesture.model}</em>
      </div>
      {gesture.error ? <p className="camera-error" role="alert">{gesture.error}</p> : null}
      <div className="camera-actions">
        {!gesture.enabled || gesture.camera === "off" || gesture.camera === "error" ? (
          <button type="button" className="compact-button primary" onClick={onEnable}>Bật điều khiển cử chỉ</button>
        ) : (
          <>
            <button type="button" className="compact-button" data-gesture-action="gesture.pause" onClick={onPause}>Tạm dừng</button>
            <button type="button" className="compact-button" onClick={onStop}>Tắt camera</button>
          </>
        )}
      </div>
      <p className="privacy-copy">Khung hình chỉ được xử lý cục bộ và không hiển thị mặc định.</p>
    </section>
  );
}
