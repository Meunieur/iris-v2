import { useMemo, useState } from "react";

import type { KnowledgeGraphNode } from "@iris/contracts";
import type { JarvisKnowledgeSnapshot } from "@iris/jarvis-adapter";

import { searchKnowledgeNodes } from "./knowledge-search.js";
import { buildObservatoryLayout, type ObservatoryNode } from "./observatory-layout.js";

type ReadyKnowledge = Extract<JarvisKnowledgeSnapshot, { state: "ready" }>;
type ObservatoryDensity = 36 | 72 | 96;

const OBSERVATORY_DENSITIES: readonly Readonly<{ value: ObservatoryDensity; label: string }>[] = [
  { value: 36, label: "Gọn · 36" },
  { value: 72, label: "Chuẩn · 72" },
  { value: 96, label: "Dày · 96" },
];

function nodeLabel(node: Pick<KnowledgeGraphNode, "label">): string {
  return node.label || "Ghi chú chưa đặt tên";
}

export function NeuralObservatory({ snapshot }: Readonly<{ snapshot: ReadyKnowledge }>) {
  const [requestedFocusId, setRequestedFocusId] = useState<ReadyKnowledge["graph"]["nodes"][number]["id"] | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [density, setDensity] = useState<ObservatoryDensity>(72);
  const baseLayout = useMemo(() => buildObservatoryLayout(snapshot.graph, { maxNodes: density }), [density, snapshot.graph]);
  const requestedFocusIsVisible = requestedFocusId === undefined || baseLayout.nodes.some((node) => node.id === requestedFocusId);
  const layout = useMemo(
    () => requestedFocusIsVisible
      ? baseLayout
      : buildObservatoryLayout(snapshot.graph, {
        maxNodes: density,
        preferredNodeIds: requestedFocusId ? [requestedFocusId] : [],
      }),
    [baseLayout, density, requestedFocusId, requestedFocusIsVisible, snapshot.graph],
  );
  const prominent = useMemo(
    () => [...layout.nodes].sort((left, right) => right.degree - left.degree || left.rank - right.rank).slice(0, 6),
    [layout.nodes],
  );
  const searchResults = useMemo(
    () => searchKnowledgeNodes(snapshot.graph.nodes, searchQuery),
    [searchQuery, snapshot.graph.nodes],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;
  const focused = layout.nodes.find((node) => node.id === requestedFocusId) ?? prominent[0] ?? layout.nodes[0];
  const relatedIds = useMemo(() => {
    const related = new Set<ObservatoryNode["id"]>();
    if (!focused) return related;
    for (const edge of layout.edges) {
      if (edge.source === focused.id) related.add(edge.target);
      if (edge.target === focused.id) related.add(edge.source);
    }
    return related;
  }, [focused, layout.edges]);
  const positioned = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);

  function focusNode(node: Pick<ObservatoryNode, "id">): void {
    setRequestedFocusId(node.id);
  }

  return (
    <div className="knowledge-graph-shell">
      <div className="observatory-stage">
        <div className="observatory-stage-head">
          <span>Neural Observatory</span>
          <div className="observatory-stage-controls">
            <label>
              <span>Mật độ</span>
              <select
                aria-label="Mật độ Observatory"
                value={density}
                onChange={(event) => setDensity(Number(event.currentTarget.value) as ObservatoryDensity)}
              >
                {OBSERVATORY_DENSITIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <small aria-live="polite">{layout.nodes.length}/{snapshot.graph.stats.returnedNodes} node hiển thị</small>
          </div>
        </div>
        <svg
          className="knowledge-graph"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-label={`Bản đồ Galaxy của ${snapshot.brain.name}`}
        >
          <title>{`Bản đồ tri thức JarvisOS của ${snapshot.brain.name}`}</title>
          <defs>
            <radialGradient id="observatory-node-halo">
              <stop offset="0" stopColor="#c7c0ff" stopOpacity="0.92" />
              <stop offset="0.28" stopColor="#9b8cff" stopOpacity="0.58" />
              <stop offset="1" stopColor="#9b8cff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="observatory-focus-halo">
              <stop offset="0" stopColor="#f2feff" stopOpacity="1" />
              <stop offset="0.32" stopColor="#56e6f4" stopOpacity="0.72" />
              <stop offset="1" stopColor="#56e6f4" stopOpacity="0" />
            </radialGradient>
            <filter id="observatory-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g className="observatory-depth-grid" aria-hidden="true">
            <ellipse cx="380" cy="234" rx="300" ry="174" />
            <ellipse cx="380" cy="234" rx="226" ry="128" />
            <ellipse cx="380" cy="234" rx="138" ry="76" />
            <path d="M64 234 H696" />
            <path d="M380 50 V418" />
          </g>
          <g className="observatory-motion">
            <g className="knowledge-edges" aria-hidden="true">
              {layout.edges.map((edge, index) => {
                const source = positioned.get(edge.source);
                const target = positioned.get(edge.target);
                if (!source || !target) return null;
                const focusedEdge = focused && (edge.source === focused.id || edge.target === focused.id);
                const dimmed = focused && !focusedEdge;
                return <line
                  key={`${edge.source}-${edge.target}-${index}`}
                  className={focusedEdge ? "is-focused" : dimmed ? "is-dimmed" : undefined}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  opacity={focusedEdge ? 0.9 : Math.max(0.13, edge.depth * 0.42)}
                />;
              })}
            </g>
            <g className="knowledge-nodes">
              {[...layout.nodes].sort((left, right) => left.depth - right.depth).map((node) => {
                const isFocused = focused?.id === node.id;
                const isRelated = relatedIds.has(node.id);
                const isDimmed = focused !== undefined && !isFocused && !isRelated;
                const className = [
                  "observatory-node",
                  isFocused ? "is-focused" : "",
                  isRelated ? "is-related" : "",
                  isDimmed ? "is-dimmed" : "",
                  node.rank < 4 ? "is-hub" : "",
                ].filter(Boolean).join(" ");
                return <g
                  key={node.id}
                  className={className}
                  transform={`translate(${node.x} ${node.y})`}
                  data-observatory-depth={node.depth.toFixed(2)}
                >
                  <g className="observatory-node-visual">
                    <circle
                      className="observatory-node-halo"
                      r={node.radius * (isFocused ? 3.4 : 2.55)}
                      fill={isFocused ? "url(#observatory-focus-halo)" : "url(#observatory-node-halo)"}
                      opacity={isDimmed ? 0.16 : 0.44 + (node.depth * 0.42)}
                    />
                    <circle
                      className="observatory-node-core"
                      r={node.radius * (isFocused ? 1.18 : 0.78)}
                      filter={isFocused || isRelated ? "url(#observatory-soft-glow)" : undefined}
                      opacity={isDimmed ? 0.24 : 0.72 + (node.depth * 0.28)}
                    />
                    <circle className="observatory-node-lens" r={Math.max(1.2, node.radius * 0.24)} />
                    {(isFocused || node.rank < 3) ? <text y={node.radius + 13}>{nodeLabel(node)}</text> : null}
                  </g>
                </g>;
              })}
            </g>
            <g className="observatory-hitplane">
              {layout.nodes.map((node) => {
                const hitSize = Math.max(30, node.radius * 4.8);
                return <foreignObject
                  key={node.id}
                  x={node.x - hitSize / 2}
                  y={node.y - hitSize / 2}
                  width={hitSize}
                  height={hitSize}
                >
                  <button
                    type="button"
                    className="observatory-node-hit"
                    aria-label={`Tập trung ${nodeLabel(node)}`}
                    onClick={() => focusNode(node)}
                    onFocus={() => focusNode(node)}
                    onPointerEnter={() => focusNode(node)}
                  />
                </foreignObject>;
              })}
            </g>
          </g>
          {focused ? <g className="observatory-reticle observatory-motion" transform={`translate(${focused.x} ${focused.y})`} aria-hidden="true">
            <circle r={focused.radius * 2.2} />
            <path d={`M-${focused.radius * 3.3} 0 H-${focused.radius * 2.6} M${focused.radius * 2.6} 0 H${focused.radius * 3.3} M0 -${focused.radius * 3.3} V-${focused.radius * 2.6} M0 ${focused.radius * 2.6} V${focused.radius * 3.3}`} />
          </g> : null}
        </svg>
        <div className="observatory-coordinates" aria-hidden="true">
          <span>JARVIS GRAPH</span><span>READ-ONLY PROJECTION</span>
        </div>
      </div>
      <aside className="observatory-inspector" aria-label="Chi tiết node đang tập trung">
        <div className="observatory-search">
          <label htmlFor="observatory-search">Tìm node tri thức</label>
          <input
            id="observatory-search"
            type="search"
            value={searchQuery}
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            placeholder="Tên node hoặc phân vùng…"
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
          />
          {hasSearchQuery && searchResults.length > 0
            ? <output className="observatory-search-status">{searchResults.length} kết quả trong snapshot</output>
            : null}
          {hasSearchQuery && searchResults.length === 0
            ? <output className="observatory-search-empty">Không tìm thấy node phù hợp.</output>
            : null}
        </div>
        {focused ? <>
          <p className="observatory-kicker">Đang tập trung</p>
          <h3>{nodeLabel(focused)}</h3>
          <dl>
            <div><dt>Phân vùng</dt><dd>{focused.folder || "root"}</dd></div>
            <div><dt>Kết nối</dt><dd>{focused.links} liên kết trực tiếp</dd></div>
            <div><dt>Trong trường</dt><dd>{relatedIds.size} quan hệ hiển thị</dd></div>
          </dl>
        </> : null}
        <div className={`observatory-node-list${hasSearchQuery ? " is-search" : ""}`}>
          <p>{hasSearchQuery ? "Kết quả tìm kiếm" : "Node nổi bật"}</p>
          <ol aria-label={hasSearchQuery ? "Kết quả tìm kiếm tri thức" : "Các node nổi bật"}>
            {(hasSearchQuery ? searchResults : prominent).map((node) => <li key={node.id}>
              <button
                type="button"
                aria-label={hasSearchQuery ? `Mở node ${nodeLabel(node)}` : undefined}
                className={focused?.id === node.id ? "is-current" : undefined}
                onClick={() => focusNode(node)}
              >
                <span>{nodeLabel(node)}</span>
                <small>{node.folder || "root"} · {node.links}</small>
              </button>
            </li>)}
          </ol>
        </div>
      </aside>
    </div>
  );
}
