import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import type { BrainSummary } from "@iris/contracts";
import type { JarvisKnowledgeSnapshot } from "@iris/jarvis-adapter";

import { KnowledgeDock } from "./KnowledgeDock.js";

type ReadyKnowledge = Extract<JarvisKnowledgeSnapshot, { state: "ready" }>;
type GraphNode = ReadyKnowledge["graph"]["nodes"][number];

const baseNodeSpecs = [
  ["Iris Visual System", "design"],
  ["JarvisOS Runtime", "runtime"],
  ["Second Brain", "knowledge"],
  ["Bảo mật vận hành", "security"],
  ["Human Approval", "security"],
  ["Command Deck", "product"],
  ["Gesture Runtime", "interaction"],
  ["Gemini Proposal Plane", "providers"],
  ["Session Continuity", "memory"],
  ["Repository Memory", "memory"],
  ["Release Pipeline", "delivery"],
  ["Threat Model", "security"],
  ["Provenance", "knowledge"],
  ["Audit Trail", "runtime"],
  ["GitHub Launch", "delivery"],
  ["Product Narrative", "product"],
  ["Observability", "runtime"],
  ["Keyboard Navigation", "interaction"],
  ["Reduced Motion", "accessibility"],
  ["Accessibility", "accessibility"],
  ["Design Tokens", "design"],
  ["Knowledge Contracts", "knowledge"],
  ["Task Lifecycle", "runtime"],
  ["Operator Preferences", "memory"],
] as const;

const previewFolders = ["runtime", "knowledge", "security", "design", "interaction", "memory", "delivery", "product"] as const;
const generatedNodeSpecs: readonly (readonly [string, string])[] = Array.from({ length: 96 }, (_, index) => [
  `Knowledge Fragment ${String(index + 25).padStart(3, "0")}`,
  previewFolders[index % previewFolders.length] ?? "knowledge",
]);
const nodeSpecs: readonly (readonly [string, string])[] = [...baseNodeSpecs, ...generatedNodeSpecs];

const baseEdgePairs = [
  [0, 1], [0, 2], [0, 5], [0, 6], [0, 15], [0, 19], [0, 20],
  [1, 2], [1, 3], [1, 8], [1, 10], [1, 13], [1, 16], [1, 22],
  [2, 8], [2, 9], [2, 12], [2, 13], [2, 21], [2, 23],
  [3, 4], [3, 7], [3, 11], [3, 12], [3, 13], [3, 21], [3, 22],
  [4, 7], [4, 11], [4, 22],
  [5, 6], [5, 15], [5, 17], [5, 20], [5, 22],
  [6, 17], [6, 19], [6, 23],
  [7, 12], [7, 21],
  [8, 9], [8, 13], [8, 23],
  [9, 12], [9, 23],
  [10, 14], [10, 16], [10, 22],
  [11, 13], [11, 16],
  [12, 13], [12, 21],
  [14, 15], [14, 20],
  [17, 18], [17, 19],
  [18, 19], [18, 20],
  [19, 20],
  [21, 22],
] as const;

const generatedHubEdges: readonly (readonly [number, number])[] = Array.from({ length: 96 }, (_, index) => [
  index + baseNodeSpecs.length,
  index % baseNodeSpecs.length,
]);
const generatedChainEdges: readonly (readonly [number, number])[] = Array.from({ length: 95 }, (_, index) => [
  index + baseNodeSpecs.length,
  index + baseNodeSpecs.length + 1,
]);
const edgePairs: readonly (readonly [number, number])[] = [...baseEdgePairs, ...generatedHubEdges, ...generatedChainEdges];

function knowledgeNodeId(index: number): GraphNode["id"] {
  return `node_${String(index + 1).padStart(64, "0")}` as GraphNode["id"];
}

const degree = new Map<number, number>();
for (const [source, target] of edgePairs) {
  degree.set(source, (degree.get(source) ?? 0) + 1);
  degree.set(target, (degree.get(target) ?? 0) + 1);
}

const nodes: ReadyKnowledge["graph"]["nodes"] = nodeSpecs.map(([label, folder], index) => ({
  id: knowledgeNodeId(index),
  label,
  folder,
  source: "jarvis_brain",
  links: degree.get(index) ?? 0,
  createdAt: 1_785_000_000 + index,
}));

const edges: ReadyKnowledge["graph"]["edges"] = edgePairs.map(([source, target]) => ({
  source: knowledgeNodeId(source),
  target: knowledgeNodeId(target),
}));

const categoryCounts = new Map<string, number>();
for (const [, folder] of nodeSpecs) categoryCounts.set(folder, (categoryCounts.get(folder) ?? 0) + 1);
const categories: ReadyKnowledge["graph"]["categories"] = [...categoryCounts].map(([name, count]) => ({ name, count }));

const brain = {
  id: `brain_${"a".repeat(64)}`,
  name: "Brain Default",
  notes: 620,
  isDefault: true,
} as BrainSummary;

const previewSnapshot: ReadyKnowledge = {
  state: "ready",
  capturedAt: "2026-07-31T12:00:00.000Z",
  brain,
  graph: {
    nodes,
    edges,
    categories,
    stats: {
      totalNotes: 620,
      totalLinks: 1_204,
      orphans: 18,
      hidden: 500,
      returnedNodes: nodes.length,
      returnedEdges: edges.length,
      truncated: true,
    },
  },
};

function Preview() {
  return <main className="observatory-preview-page">
    <div className="observatory-preview-frame">
      <header className="observatory-preview-meta">
        <div>
          <p>Iris v2 · design verification</p>
          <h1>Neural Observatory</h1>
        </div>
        <span>LOCAL REPRESENTATIVE DATA<br />NO JARVIS DATA COPIED</span>
      </header>
      <KnowledgeDock
        brains={[brain]}
        selectedBrainId={brain.id}
        state={previewSnapshot}
        connection="ready"
        busy={false}
        onSelect={() => undefined}
        onLoad={() => undefined}
      />
    </div>
  </main>;
}

const root = document.querySelector("#root");
if (!root) throw new Error("Iris preview root is missing");
const previewRoot = createRoot(root);
previewRoot.render(<StrictMode><Preview /></StrictMode>);

if (import.meta.hot) {
  import.meta.hot.dispose(() => previewRoot.unmount());
}
