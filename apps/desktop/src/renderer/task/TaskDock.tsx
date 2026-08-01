import { useState, type FormEvent } from "react";

import type { BrainSummary, JarvisTaskInput, JarvisTaskStatus } from "@iris/contracts";
import type { JarvisConnectionState, JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";

type TaskDockProps = Readonly<{
  brains: readonly BrainSummary[];
  selectedBrainId?: BrainSummary["id"] | undefined;
  connection: JarvisConnectionState;
  state: JarvisTaskControllerSnapshot;
  busy: boolean;
  notice?: string | undefined;
  onSelect(brainId: BrainSummary["id"]): void;
  onSend(input: JarvisTaskInput): void;
  onStop(): void;
}>;

const statusLabels: Readonly<Record<JarvisTaskStatus, string>> = Object.freeze({
  triage: "Đang tiếp nhận",
  todo: "Đang chờ phụ thuộc",
  ready: "Đang xếp hàng",
  running: "Đang thực thi",
  review: "Cần xem lại",
  blocked: "Đã bị chặn",
  done: "Hoàn thành",
  cancelled: "Đã dừng",
  archived: "Đã lưu trữ",
});

function connectionLabel(state: JarvisTaskControllerSnapshot): string {
  if (state.connection === "submitting") return "Đang gửi";
  if (state.connection === "reconnecting") return "Đang nối lại";
  if (state.connection === "sign_in_required") return "Cần đăng nhập";
  if (state.connection === "error") return "Xung đột replay";
  if (state.task !== undefined) return statusLabels[state.task.status];
  return {
    idle: "Sẵn sàng",
    active: "Đang hoạt động",
    terminal: "Đã kết thúc",
  }[state.connection];
}

export function TaskDock(props: TaskDockProps) {
  const [draft, setDraft] = useState("");
  const selected = props.brains.find((brain) => brain.id === props.selectedBrainId);
  const task = props.state.task;
  const active = task !== undefined && !task.terminal;
  const signedIn = props.connection === "ready" || props.connection === "degraded";
  const acceptsNewTurn = props.state.connection === "idle" || props.state.connection === "terminal";
  const canSend = signedIn && selected !== undefined && !props.busy && !active
    && acceptsNewTurn;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!canSend || message.length === 0 || selected === undefined) return;
    props.onSend({ brainId: selected.id, message });
    setDraft("");
  };

  return (
    <section className="task-dock glass-panel" aria-labelledby="task-title">
      <div className="task-heading">
        <div>
          <p className="micro-label violet-copy">Jarvis task plane · authoritative lifecycle</p>
          <h2 id="task-title">Công việc Jarvis</h2>
        </div>
        <output className={`task-state state-${props.state.connection}`} aria-label="Trạng thái tác vụ Jarvis">
          <i aria-hidden="true" /> {connectionLabel(props.state)}
        </output>
      </div>

      <div className="task-policy">
        <span className="risk-badge risk-r0">R0 · chỉ đọc</span>
        <p>JarvisOS là nguồn trạng thái duy nhất; Iris không suy diễn hoàn thành từ lời model.</p>
      </div>

      <form className="task-composer" onSubmit={submit}>
        <div className="task-brain-field">
          <label htmlFor="task-brain">Brain xử lý</label>
          <select
            id="task-brain"
            value={props.selectedBrainId ?? ""}
            onChange={(event) => props.onSelect(event.currentTarget.value as BrainSummary["id"])}
            disabled={props.brains.length === 0 || active || props.busy}
          >
            {props.brains.length === 0 ? <option value="">Chưa có brain khả dụng</option> : null}
            {props.brains.map((brain) => <option key={brain.id} value={brain.id}>
              {brain.name}{brain.isDefault ? " · mặc định" : ""}
            </option>)}
          </select>
        </div>
        <label htmlFor="task-message">Yêu cầu cho Jarvis</label>
        <textarea
          id="task-message"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          maxLength={4_000}
          rows={3}
          placeholder="Ví dụ: Tóm tắt các quyết định mới nhất trong brain này"
          disabled={!signedIn || active || props.busy}
        />
        <div className="task-actions">
          <button type="submit" className="text-button primary" disabled={!canSend || draft.trim().length === 0}>
            {props.state.connection === "submitting" ? "Đang gửi…" : "Gửi tác vụ R0"}
          </button>
          {task?.can_stop ? <button type="button" className="text-button danger" onClick={props.onStop} disabled={props.busy || !signedIn}>Dừng tác vụ</button> : null}
        </div>
      </form>

      {!signedIn ? <p className="task-empty">Đăng nhập JarvisOS để gửi tác vụ. Cookie chỉ nằm trong phiên Electron riêng và không đi vào giao diện Iris.</p> : null}

      {task !== undefined ? <article className="task-record" aria-live="polite">
        <div className="task-record-head">
          <strong>{statusLabels[task.status]}</strong>
          <span>{task.risk}</span>
        </div>
        <dl>
          <div><dt>Task</dt><dd>{task.task_id}</dd></div>
          <div><dt>Run</dt><dd>{task.current_run_id || task.runs[0]?.run_id || "chưa bắt đầu"}</dd></div>
          <div><dt>Sự kiện</dt><dd>{task.event_cursor}</dd></div>
          <div><dt>Replay</dt><dd>{task.replayed ? "đã khôi phục đúng task" : "không"}</dd></div>
        </dl>
        {task.orphaned ? <p className="task-warning" role="alert">Lease Jarvis đã hết hạn; task đang được đánh dấu mồ côi, không suy diễn kết quả.</p> : null}
        {task.terminal && task.result ? <p className={`task-result outcome-${task.outcome ?? "unknown"}`}>{task.result}</p> : null}
      </article> : <p className="task-empty">Chưa có tác vụ. Mỗi yêu cầu được gắn intent và replay key riêng trong main process.</p>}

      {props.notice ? <p className="task-notice" role="alert">{props.notice}</p> : null}
    </section>
  );
}
