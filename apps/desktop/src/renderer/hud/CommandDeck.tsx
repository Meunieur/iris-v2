import { CameraDock } from "./CameraDock.js";
import { ActivityIcon, BrainIcon, CommandIcon, RefreshIcon } from "./icons.js";
import { connectionLabels } from "./labels.js";
import { OrbStatusAnchor } from "./OrbStatusAnchor.js";
import { ReaderOverlay } from "./ReaderOverlay.js";
import { SessionIndex } from "./SessionIndex.js";
import type { HudSurfaceActions, HudSurfaceState } from "./types.js";
import { ConversationDock } from "../conversation/ConversationDock.js";
import { KnowledgeDock } from "../knowledge/KnowledgeDock.js";
import { TaskDock } from "../task/TaskDock.js";

type CommandDeckProps = HudSurfaceState & HudSurfaceActions & Readonly<{ onToggleHud(): void }>;

export function CommandDeck(props: CommandDeckProps) {
  const brain = props.snapshot.brains.find((item) => item.isDefault) ?? props.snapshot.brains[0];
  const conversation = props.conversation;
  return (
    <main className="command-deck" data-hud-mode="deck">
      <div className="deck-grid" aria-hidden="true" />
      <header className="deck-header">
        <div><p className="micro-label">Operator Glass · Attached</p><h1>Iris v2</h1></div>
        <div className="deck-header-actions">
          <span className={`connection-pill state-${props.snapshot.connection}`}><i />{connectionLabels[props.snapshot.connection]}</span>
          <button type="button" className="icon-button" aria-label="Làm mới trạng thái" onClick={props.onRefresh} disabled={props.refreshing}><RefreshIcon /></button>
          {props.snapshot.connection === "sign_in_required" ? <button type="button" className="text-button primary" onClick={props.onSignIn}>Đăng nhập JarvisOS</button> : null}
          <button type="button" className="text-button" onClick={props.onToggleHud}><CommandIcon /> Trở về Desktop HUD</button>
        </div>
      </header>
      <section className="deck-layout">
        <article className="deck-panel runtime-card glass-panel">
          <div className="deck-panel-title"><span className="instrument-icon"><ActivityIcon /></span><div><p className="micro-label">Nguồn duy nhất</p><h2>Runtime JarvisOS</h2></div></div>
          <dl className="deck-metrics">
            <div><dt>Health</dt><dd>{props.snapshot.health?.status ?? "đang kiểm tra"}</dd></div>
            <div><dt>Phiên bản</dt><dd>{props.snapshot.health?.version ?? "chưa rõ"}</dd></div>
            <div><dt>Chế độ</dt><dd>{props.snapshot.health?.mode ?? "chưa rõ"}</dd></div>
            <div><dt>Xác thực</dt><dd>{props.snapshot.health?.authenticated ? "Đã đăng nhập" : "Chưa đăng nhập"}</dd></div>
          </dl>
          <button type="button" className="panel-link" data-gesture-action="reader.open.runtime" onClick={() => props.onOpenReader("runtime")}>Mở thông tin runtime</button>
        </article>
        <article className="deck-panel brain-card glass-panel">
          <div className="deck-panel-title"><span className="instrument-icon violet"><BrainIcon /></span><div><p className="micro-label violet-copy">Ngữ cảnh nhận thức</p><h2>Brain đang hoạt động</h2></div></div>
          {brain ? <div className="primary-record"><strong>{brain.name}</strong><span>{brain.notes} ghi chú</span><em>{brain.isDefault ? "Mặc định" : "Khả dụng"}</em></div> : <p className="empty-state">Chưa có brain nào được công bố.</p>}
          <button type="button" className="panel-link" data-gesture-action="reader.open.brain" onClick={() => props.onOpenReader("brain")}>Mở thông tin brain</button>
        </article>
        <SessionIndex sessions={props.snapshot.sessions} onOpenReader={() => props.onOpenReader("session")} />
        <div className="deck-gesture"><CameraDock gesture={props.gesture} onEnable={props.onEnableGesture} onPause={props.onPauseGesture} onStop={props.onStopGesture} /></div>
        <div className="deck-orb"><OrbStatusAnchor snapshot={props.snapshot} /></div>
        {conversation ? <div className="deck-conversation"><ConversationDock state={conversation} busy={props.conversationBusy ?? false} notice={props.conversationNotice} onStart={props.onStartConversation ?? (() => undefined)} onStop={props.onStopConversation ?? (() => undefined)} onInterrupt={props.onInterruptConversation ?? (() => undefined)} onSendText={props.onSendConversationText ?? (() => undefined)} /></div> : null}
        {props.knowledge ? <div className="deck-knowledge"><KnowledgeDock
          brains={props.snapshot.brains}
          selectedBrainId={props.selectedKnowledgeBrainId}
          state={props.knowledge}
          connection={props.snapshot.connection}
          busy={props.knowledgeBusy ?? false}
          notice={props.knowledgeNotice}
          onSelect={props.onSelectKnowledgeBrain ?? (() => undefined)}
          onLoad={props.onLoadKnowledge ?? (() => undefined)}
        /></div> : null}
        {props.task ? <div className="deck-task"><TaskDock
          brains={props.snapshot.brains}
          selectedBrainId={props.selectedKnowledgeBrainId}
          connection={props.snapshot.connection}
          state={props.task}
          busy={props.taskBusy ?? false}
          notice={props.taskNotice}
          onSelect={props.onSelectTaskBrain ?? (() => undefined)}
          onSend={props.onSendTask ?? (() => undefined)}
          onStop={props.onStopTask ?? (() => undefined)}
        /></div> : null}
      </section>
      <footer className="deck-footer"><span>IRIS V2 · MVP CORE</span><span>HUD + Gesture + Second Brain by JarvisOS · no mutation · no database copy</span></footer>
      {props.notice ? <div className="deck-notice" role="alert">{props.notice}</div> : null}
      {props.reader ? <ReaderOverlay reader={props.reader} onClose={props.onCloseReader} /> : null}
    </main>
  );
}
