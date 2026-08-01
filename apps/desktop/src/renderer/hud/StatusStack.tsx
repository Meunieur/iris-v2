import type { JarvisReadSnapshot } from "@iris/jarvis-adapter";
import { ActivityIcon, BrainIcon, ChevronIcon, SessionIcon } from "./icons.js";

export function StatusStack({
  snapshot,
  onOpenReader,
}: {
  snapshot: JarvisReadSnapshot;
  onOpenReader(id: string): void;
}) {
  const brain = snapshot.brains.find((item) => item.isDefault) ?? snapshot.brains[0];
  const session = snapshot.sessions[0];
  return (
    <section className="status-stack" aria-label="Tóm tắt hệ thống">
      <button className="instrument-card hud-hit" type="button" data-gesture-action="reader.open.runtime" onClick={() => onOpenReader("runtime")}>
        <span className="instrument-icon"><ActivityIcon /></span>
        <span className="instrument-copy"><small>Nguồn duy nhất</small><strong>Runtime JarvisOS</strong><em>{snapshot.health?.mode ?? "đang kiểm tra"}</em></span>
        <ChevronIcon />
      </button>
      <button className="instrument-card hud-hit violet" type="button" data-gesture-action="reader.open.brain" onClick={() => onOpenReader("brain")}>
        <span className="instrument-icon"><BrainIcon /></span>
        <span className="instrument-copy"><small>Brain mặc định</small><strong>{brain?.name ?? "Chưa công bố"}</strong><em>{brain ? `${brain.notes} ghi chú` : "Không có dữ liệu"}</em></span>
        <ChevronIcon />
      </button>
      <button className="instrument-card hud-hit" type="button" data-gesture-action="reader.open.session" onClick={() => onOpenReader("session")}>
        <span className="instrument-icon"><SessionIcon /></span>
        <span className="instrument-copy"><small>Phiên gần đây</small><strong>{session?.title || "Chưa có phiên"}</strong><em>{session ? `${session.messageCount ?? 0} tin nhắn` : "Chỉ mục trống"}</em></span>
        <ChevronIcon />
      </button>
    </section>
  );
}
