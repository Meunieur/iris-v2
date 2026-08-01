import { useMemo, useState } from "react";

import type { SessionSummary } from "@iris/contracts";

import { SessionIcon } from "./icons.js";
import { searchPublicSessions } from "./session-search.js";
import { MAX_LOCAL_SEARCH_QUERY_LENGTH } from "../local-search.js";

type SessionIndexProps = Readonly<{
  sessions: readonly SessionSummary[];
  onOpenReader(): void;
}>;

const DEFAULT_VISIBLE_SESSIONS = 5;

export function SessionIndex({ sessions, onOpenReader }: SessionIndexProps) {
  const [query, setQuery] = useState("");
  const hasQuery = query.trim().length > 0;
  const visibleSessions = useMemo(
    () => hasQuery ? searchPublicSessions(sessions, query) : sessions.slice(0, DEFAULT_VISIBLE_SESSIONS),
    [hasQuery, query, sessions],
  );

  return <article className="deck-panel sessions-card glass-panel elevated">
    <div className="deck-panel-title">
      <span className="instrument-icon"><SessionIcon /></span>
      <div><p className="micro-label">Chỉ mục công khai</p><h2>Phiên gần đây</h2></div>
      <span className="record-count">{sessions.length}</span>
    </div>
    {sessions.length > 0 ? <>
      <div className="session-index-search">
        <label htmlFor="session-index-search">Tìm phiên gần đây</label>
        <input
          id="session-index-search"
          type="search"
          value={query}
          maxLength={MAX_LOCAL_SEARCH_QUERY_LENGTH}
          autoComplete="off"
          spellCheck={false}
          placeholder="Tiêu đề, engine hoặc model…"
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            }
          }}
        />
        {hasQuery ? <output className={visibleSessions.length ? "session-index-status" : "session-index-empty"}>
          {visibleSessions.length ? `${visibleSessions.length}/${sessions.length} phiên` : "Không tìm thấy phiên phù hợp."}
        </output> : null}
      </div>
      {visibleSessions.length > 0 ? <ol className="deck-session-list" aria-label={hasQuery ? "Kết quả tìm phiên" : "Phiên gần đây"}>
        {visibleSessions.map((session) => <li key={session.id}>
          <span><strong>{session.title || "Phiên chưa đặt tên"}</strong><small>{session.engine ?? "engine chưa rõ"} · {session.model ?? "model chưa rõ"}</small></span>
          <em aria-label={`${session.messageCount ?? 0} tin nhắn`}>{session.messageCount ?? 0}</em>
        </li>)}
      </ol> : null}
    </> : <p className="empty-state">Chưa có phiên nào để hiển thị.</p>}
    <button type="button" className="panel-link session-index-reader" data-gesture-action="reader.open.session" onClick={onOpenReader}>Mở thông tin phiên</button>
  </article>;
}
