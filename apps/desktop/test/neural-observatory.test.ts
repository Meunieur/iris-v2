import { describe, expect, it } from "vitest";

import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "@iris/contracts";

import { buildObservatoryLayout } from "../src/renderer/knowledge/observatory-layout";

function graphNode(index: number, links: number): KnowledgeGraphNode {
  return {
    id: `node_${index.toString().padStart(64, "0")}`,
    label: `Node ${index}`,
    folder: index % 2 === 0 ? "wiki" : "memory",
    source: "jarvis_brain",
    links,
    createdAt: 1_785_000_000 + index,
  };
}

describe("Neural Observatory layout", () => {
  it("selects representative hubs by topology instead of taking the first input nodes", () => {
    const nodes = Array.from({ length: 80 }, (_, index) => graphNode(index, index === 79 ? 40 : 1));
    const hub = nodes[79] as KnowledgeGraphNode;
    const edges: KnowledgeGraphEdge[] = nodes.slice(0, 40).map((node) => ({ source: hub.id, target: node.id }));

    const layout = buildObservatoryLayout({ nodes, edges }, { maxNodes: 24 });

    expect(layout.nodes).toHaveLength(24);
    expect(layout.nodes.some((node) => node.id === hub.id)).toBe(true);
    expect(layout.edges.length).toBeGreaterThan(0);
    const visible = new Set(layout.nodes.map((node) => node.id));
    expect(layout.edges.every((edge) => visible.has(edge.source) && visible.has(edge.target))).toBe(true);
  });

  it("produces the same spatial projection for the same immutable graph snapshot", () => {
    const nodes = Array.from({ length: 12 }, (_, index) => graphNode(index, 12 - index));
    const edges: KnowledgeGraphEdge[] = nodes.slice(1).map((node, index) => ({
      source: (nodes[index] as KnowledgeGraphNode).id,
      target: node.id,
    }));

    expect(buildObservatoryLayout({ nodes, edges })).toEqual(buildObservatoryLayout({ nodes, edges }));
  });

  it("pins a searched node and its local relation into a bounded projection", () => {
    const nodes = Array.from({ length: 80 }, (_, index) => graphNode(index, index < 30 ? 20 - (index % 4) : 0));
    const searched = nodes[79] as KnowledgeGraphNode;
    const neighbor = nodes[78] as KnowledgeGraphNode;
    const edges: KnowledgeGraphEdge[] = [
      ...nodes.slice(1, 31).map((node, index) => ({ source: (nodes[index] as KnowledgeGraphNode).id, target: node.id })),
      { source: searched.id, target: neighbor.id },
    ];

    const defaultLayout = buildObservatoryLayout({ nodes, edges }, { maxNodes: 24 });
    const searchedLayout = buildObservatoryLayout({ nodes, edges }, { maxNodes: 24, preferredNodeIds: [searched.id] });

    expect(defaultLayout.nodes.some((node) => node.id === searched.id)).toBe(false);
    expect(searchedLayout.nodes).toHaveLength(24);
    expect(searchedLayout.nodes.some((node) => node.id === searched.id)).toBe(true);
    expect(searchedLayout.nodes.some((node) => node.id === neighbor.id)).toBe(true);
    expect(searchedLayout.edges).toContainEqual(expect.objectContaining({ source: searched.id, target: neighbor.id }));
  });

  it("projects the maximum public snapshot into the dense 96-node field within budget", () => {
    const nodes = Array.from({ length: 500 }, (_, index) => graphNode(index, 1 + (index % 24)));
    const edges: KnowledgeGraphEdge[] = Array.from({ length: 1_000 }, (_, index) => ({
      source: (nodes[index % nodes.length] as KnowledgeGraphNode).id,
      target: (nodes[(index * 17 + 31) % nodes.length] as KnowledgeGraphNode).id,
    }));

    const startedAt = performance.now();
    const layout = buildObservatoryLayout({ nodes, edges }, { maxNodes: 96 });
    const elapsedMs = performance.now() - startedAt;

    expect(layout.nodes).toHaveLength(96);
    expect(layout.edges.length).toBeLessThanOrEqual(1_000);
    expect(elapsedMs).toBeLessThan(250);
  });
});
