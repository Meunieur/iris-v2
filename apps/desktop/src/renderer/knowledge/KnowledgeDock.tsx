import type { BrainSummary } from "@iris/contracts";
import type { JarvisConnectionState, JarvisKnowledgeSnapshot } from "@iris/jarvis-adapter";

import { NeuralObservatory } from "./NeuralObservatory.js";

export type KnowledgeDockState = JarvisKnowledgeSnapshot | Readonly<{ state: "idle" | "loading" }>;

type KnowledgeDockProps = Readonly<{
  brains: readonly BrainSummary[];
  selectedBrainId?: BrainSummary["id"] | undefined;
  state: KnowledgeDockState;
  connection: JarvisConnectionState;
  busy: boolean;
  notice?: string | undefined;
  onSelect(brainId: BrainSummary["id"]): void;
  onLoad(): void;
}>;

function unavailableCopy(state: Extract<JarvisKnowledgeSnapshot, { state: "unavailable" }>): string {
  if (state.errorCode === "oversized_response") return "Galaxy vượt giới hạn an toàn 2 MiB.";
  if (state.errorCode === "unknown_brain") return "Brain đã đổi hoặc không còn trong catalog JarvisOS.";
  if (state.errorCode === "timeout" || state.errorCode === "unreachable") return "JarvisOS chưa trả về Galaxy.";
  return "Không thể tải Galaxy từ contract JarvisOS hiện tại.";
}

export function KnowledgeDock(props: KnowledgeDockProps) {
  const selected = props.brains.find((brain) => brain.id === props.selectedBrainId);
  const requiresSignIn = props.connection === "sign_in_required" || props.state.state === "sign_in_required";
  const canLoad = selected !== undefined
    && !props.busy
    && (props.connection === "ready" || props.connection === "degraded");
  return (
    <section className="knowledge-dock glass-panel" aria-labelledby="knowledge-title">
      <div className="knowledge-heading">
        <div>
          <p className="micro-label violet-copy">JarvisOS · chỉ đọc · nguồn duy nhất</p>
          <h2 id="knowledge-title">Galaxy Second Brain</h2>
        </div>
        {props.state.state === "ready" ? <span className="knowledge-source">đã đồng bộ</span> : null}
      </div>
      <p className="knowledge-policy">Chọn brain chỉ đổi ngữ cảnh hiển thị trong Iris; không đổi brain mặc định của JarvisOS.</p>
      {requiresSignIn ? <p className="knowledge-empty">Đăng nhập JarvisOS để xem Second Brain. Iris không đọc hoặc lưu cookie.</p> : <>
        <div className="knowledge-controls">
          <label htmlFor="knowledge-brain">Brain để xem</label>
          <select
            id="knowledge-brain"
            value={props.selectedBrainId ?? ""}
            onChange={(event) => props.onSelect(event.currentTarget.value as BrainSummary["id"])}
            disabled={props.brains.length === 0 || props.busy}
          >
            {props.brains.length === 0 ? <option value="">Chưa có brain khả dụng</option> : null}
            {props.brains.map((brain) => <option key={brain.id} value={brain.id}>
              {brain.name}{brain.isDefault ? " · mặc định" : ""}
            </option>)}
          </select>
          <button type="button" className="text-button primary" onClick={props.onLoad} disabled={!canLoad}>
            {props.busy || props.state.state === "loading"
              ? "Đang tải Galaxy…"
              : props.state.state === "ready" ? "Làm mới Galaxy" : "Tải Second Brain"}
          </button>
        </div>
        {props.state.state === "idle" ? <p className="knowledge-empty">Galaxy chỉ được quét khi trẫm yêu cầu để tránh tải nền không cần thiết.</p> : null}
        {props.state.state === "loading" ? <output className="knowledge-empty">Đang tải ảnh chụp graph từ JarvisOS…</output> : null}
        {props.state.state === "unavailable" ? <p className="knowledge-empty" role="alert">{unavailableCopy(props.state)}</p> : null}
        {props.state.state === "ready" ? <>
          <div className="knowledge-metrics">
            <span><strong>{props.state.graph.stats.returnedNodes}/{props.state.graph.stats.totalNotes} node</strong></span>
            <span><strong>{props.state.graph.stats.returnedEdges}/{props.state.graph.stats.totalLinks} liên kết</strong></span>
            <span><strong>{props.state.graph.categories.length} nhóm</strong></span>
          </div>
          {props.state.graph.stats.truncated ? <p className="knowledge-limit">Đã giới hạn để giữ HUD mượt; số liệu tổng vẫn do JarvisOS cung cấp.</p> : null}
          {props.state.graph.nodes.length === 0
            ? <p className="knowledge-empty">Brain chưa có node graph để hiển thị.</p>
            : <NeuralObservatory snapshot={props.state} />}
          <div className="knowledge-categories" aria-label="Nhóm tri thức">
            {props.state.graph.categories.slice(0, 8).map((category) => <span key={category.name}>{category.name} · {category.count}</span>)}
          </div>
          <p className="knowledge-provenance">Nguồn: JarvisOS Second Brain · ID opaque · không sao chép database</p>
        </> : null}
      </>}
      {props.notice ? <p className="knowledge-notice" role="alert">{props.notice}</p> : null}
    </section>
  );
}
