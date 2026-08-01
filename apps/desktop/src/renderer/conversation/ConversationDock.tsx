import { useState, type FormEvent } from "react";

import type { ConversationSnapshot } from "@iris/gemini-bridge";

const stateLabels: Readonly<Record<ConversationSnapshot["state"], string>> = Object.freeze({
  disabled: "Đã tắt",
  missing_credentials: "Thiếu thông tin kết nối",
  idle: "Sẵn sàng",
  connecting: "Đang kết nối",
  listening: "Đang nghe",
  speaking: "Đang nói",
  reconnecting: "Đang nối lại",
  degraded: "Suy giảm",
  error: "Lỗi",
});

type ConversationDockProps = Readonly<{
  state: ConversationSnapshot;
  busy: boolean;
  notice?: string | undefined;
  compact?: boolean | undefined;
  onStart(): void;
  onStop(): void;
  onInterrupt(): void;
  onSendText(text: string): void;
}>;

function primaryAction(props: ConversationDockProps) {
  if (props.state.state === "disabled") {
    return <button type="button" className="text-button" disabled>Gemini chưa được bật</button>;
  }
  if (props.state.state === "missing_credentials") {
    return <button type="button" className="text-button" disabled>Chưa có khóa Gemini</button>;
  }
  if (props.state.state === "connecting" || props.state.state === "reconnecting") {
    return <button type="button" className="text-button" disabled>Đang kết nối…</button>;
  }
  if (props.state.state === "listening" || props.state.state === "speaking") {
    return <button type="button" className="text-button danger" onClick={props.onStop} disabled={props.busy}>Dừng hội thoại</button>;
  }
  return <button type="button" className="text-button primary" onClick={props.onStart} disabled={props.busy}>Bắt đầu hội thoại</button>;
}

export function ConversationDock(props: ConversationDockProps) {
  const [draft, setDraft] = useState("");
  const live = props.state.state === "listening" || props.state.state === "speaking";
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text.length === 0) return;
    props.onSendText(text);
    setDraft("");
  };

  return (
    <section className={`conversation-dock glass-panel${props.compact ? " compact" : ""}`} aria-labelledby="conversation-title">
      <div className="conversation-heading">
        <div>
          <p className="micro-label">Conversation plane · proposal only</p>
          <h2 id="conversation-title">Hội thoại Gemini</h2>
        </div>
        <output className={`conversation-state state-${props.state.state}`} aria-label="Trạng thái Gemini">
          <i aria-hidden="true" /> {stateLabels[props.state.state]}
        </output>
      </div>

      <dl className="conversation-metrics">
        <div><dt>Provider</dt><dd>Gemini · {props.state.model}</dd></div>
        <div><dt>Microphone</dt><dd>{props.state.microphone === "active" ? "Đang gửi có chủ đích" : "Không gửi microphone"}</dd></div>
        <div><dt>Chi phí</dt><dd>{props.state.usage?.totalTokens === undefined ? "Chưa có dữ liệu" : `${props.state.usage.totalTokens} token · giá chưa xác định`}</dd></div>
      </dl>

      {props.state.inputTranscript || props.state.outputTranscript ? (
        <div className="conversation-transcript" aria-live="polite">
          {props.state.inputTranscript ? <p><strong>Trẫm</strong><span>{props.state.inputTranscript}</span></p> : null}
          {props.state.outputTranscript ? <p><strong>Iris</strong><span>{props.state.outputTranscript}</span></p> : null}
        </div>
      ) : <p className="conversation-privacy">Microphone tắt mặc định; không gửi microphone khi Gemini bị tắt hoặc thiếu khóa.</p>}

      {props.state.proposal ? (
        <article className="conversation-proposal" aria-label="Đề xuất khả năng">
          <div><span className={`risk-badge risk-${props.state.proposal.risk.toLowerCase()}`}>{props.state.proposal.risk}</span><strong>{props.state.proposal.capability}</strong></div>
          <p>{props.state.proposal.reason}</p>
          <em>Chờ Jarvis phê duyệt · chưa thực thi</em>
        </article>
      ) : null}

      {live ? (
        <form className="conversation-text" onSubmit={onSubmit}>
          <label htmlFor="conversation-text-input">Gửi câu chữ</label>
          <div><input id="conversation-text-input" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={8_192} /><button type="submit" className="text-button">Gửi</button></div>
        </form>
      ) : null}

      <div className="conversation-actions">
        {primaryAction(props)}
        {live ? <button type="button" className="text-button" onClick={props.onInterrupt}>Ngắt lượt nói</button> : null}
      </div>
      {props.notice ? <p className="conversation-notice" role="alert">{props.notice}</p> : null}
    </section>
  );
}
