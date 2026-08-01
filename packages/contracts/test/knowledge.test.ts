import { describe, expect, it } from "vitest";

import {
  projectKnowledgeGraph,
  rawKnowledgeGraphSchema,
  type BrainSummary,
} from "../src/index";

const brain: BrainSummary = {
  id: `brain_${"a".repeat(64)}`,
  name: "Brain Default",
  notes: 12,
  isDefault: true,
};

function rawGraph(nodeCount = 2) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `raw-node-${index}`,
    label: index === 0 ? "Architecture client_secret=must-not-leak" : `Node ${index}`,
    folder: index === 0 ? "wiki" : "memory",
    color: "#9b8cff",
    path: `Brain Default/private/folder/node-${index}.md`,
    fullpath: `E:\\private\\brains\\Brain Default\\node-${index}.md`,
    links: index === 0 ? 1 : 0,
    t: 1_785_000_000 + index,
  }));
  return {
    nodes,
    edges: nodeCount > 1 ? [{ source: "raw-node-0", target: "raw-node-1" }] : [],
    categories: [{ name: "Architecture", count: nodeCount }],
    stats: {
      total_notes: nodeCount,
      total_links: nodeCount > 1 ? 1 : 0,
      orphans: Math.max(0, nodeCount - 2),
      hidden: 0,
    },
  };
}

describe("Second Brain public graph contract", () => {
  it("projects opaque bounded nodes without raw IDs or paths", () => {
    const raw = rawKnowledgeGraphSchema.parse(rawGraph());

    const graph = projectKnowledgeGraph(raw, brain.id);
    const serialized = JSON.stringify(graph);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0]).toMatchObject({
      id: expect.stringMatching(/^node_[a-f0-9]{64}$/),
      label: "Architecture client_secret=[REDACTED]",
      folder: "wiki",
      source: "jarvis_brain",
      links: 1,
      createdAt: 1_785_000_000,
    });
    expect(graph.nodes[0]?.id).not.toBe("raw-node-0");
    expect(graph.edges).toEqual([{
      source: graph.nodes[0]?.id,
      target: graph.nodes[1]?.id,
    }]);
    expect(graph.stats).toMatchObject({ returnedNodes: 2, returnedEdges: 1, truncated: false });
    expect(serialized).not.toContain("raw-node");
    expect(serialized).not.toContain("E:\\\\private");
    expect(serialized).not.toContain("private/folder");
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("fullpath");
    expect(serialized).not.toContain('"path"');
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodes[0])).toBe(true);
  });

  it("caps public nodes and edges while dropping edges to omitted nodes", () => {
    const input = rawGraph(501);
    input.edges = Array.from({ length: 1_002 }, (_, index) => ({
      source: `raw-node-${index % 500}`,
      target: index === 1_001 ? "raw-node-500" : `raw-node-${(index + 1) % 500}`,
    }));
    input.stats.total_links = input.edges.length;

    const graph = projectKnowledgeGraph(rawKnowledgeGraphSchema.parse(input), brain.id);

    expect(graph.nodes).toHaveLength(500);
    expect(graph.edges).toHaveLength(1_000);
    expect(graph.edges.every((edge) => (
      graph.nodes.some((node) => node.id === edge.source)
      && graph.nodes.some((node) => node.id === edge.target)
    ))).toBe(true);
    expect(graph.stats.truncated).toBe(true);
  });

  it("rejects malformed and over-budget raw graph shapes", () => {
    expect(() => rawKnowledgeGraphSchema.parse({ ...rawGraph(), nodes: rawGraph(2_001).nodes })).toThrow();
    expect(() => rawKnowledgeGraphSchema.parse({
      ...rawGraph(),
      stats: { total_notes: -1, total_links: 0, orphans: 0, hidden: 0 },
    })).toThrow();
    expect(() => rawKnowledgeGraphSchema.parse({
      ...rawGraph(),
      edges: [{ source: "raw-node-0", target: 1 }],
    })).toThrow();
  });
});
