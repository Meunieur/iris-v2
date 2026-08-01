import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import type { SessionSummary } from "@iris/contracts";

import { SessionIndex } from "./SessionIndex.js";

const sessions: readonly SessionSummary[] = [
  { id: "session-preview-01", title: "Kiến trúc phát hành Iris v2", engine: "codex", model: "gpt-5", messageCount: 18 },
  { id: "session-preview-02", title: "Rà soát bảo mật và quyền hạn", engine: "codex", model: "gpt-5", messageCount: 12 },
  { id: "session-preview-03", title: "Neural Observatory visual pass", engine: "codex", model: "gpt-5", messageCount: 9 },
  { id: "session-preview-04", title: "Gemini proposal boundary", engine: "gemini", model: "flash", messageCount: 7 },
  { id: "session-preview-05", title: "Windows package verification", engine: "codex", model: "gpt-5", messageCount: 6 },
  { id: "session-preview-06", title: "Operator accessibility review", engine: "codex", model: "gpt-5", messageCount: 4 },
] as const;

function Preview() {
  return <main className="session-preview-page">
    <div className="session-preview-frame">
      <header className="session-preview-meta">
        <div><p>Iris v2 · design verification</p><h1>Session Index</h1></div>
        <span>LOCAL REPRESENTATIVE DATA<br />NO JARVIS DATA COPIED</span>
      </header>
      <SessionIndex sessions={sessions} onOpenReader={() => undefined} />
    </div>
  </main>;
}

const root = document.querySelector("#root");
if (!root) throw new Error("Iris session preview root is missing");
const previewRoot = createRoot(root);
previewRoot.render(<StrictMode><Preview /></StrictMode>);

if (import.meta.hot) {
  import.meta.hot.dispose(() => previewRoot.unmount());
}
