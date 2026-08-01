import { describe, expect, it } from "vitest";

import type { KnowledgeGraphNode } from "@iris/contracts";

import { searchKnowledgeNodes } from "../src/renderer/knowledge/knowledge-search";

function node(index: number, label: string, folder = "wiki", links = 1): KnowledgeGraphNode {
  return {
    id: `node_${index.toString().padStart(64, "0")}`,
    label,
    folder,
    source: "jarvis_brain",
    links,
    createdAt: 1_785_000_000 + index,
  };
}

describe("local knowledge search", () => {
  it("matches Vietnamese labels without requiring diacritics", () => {
    const nodes = [
      node(1, "Kiến trúc hệ thống", "architecture", 7),
      node(2, "Bảo mật vận hành", "security", 5),
      node(3, "Operator preferences", "memory", 2),
    ];

    expect(searchKnowledgeNodes(nodes, "kien truc").map((item) => item.label)).toEqual(["Kiến trúc hệ thống"]);
    expect(searchKnowledgeNodes(nodes, "bao mat").map((item) => item.label)).toEqual(["Bảo mật vận hành"]);
  });

  it("searches safe public labels and folders with deterministic bounded ranking", () => {
    const nodes = [
      node(1, "Runtime overview", "runtime", 2),
      node(2, "Jarvis runtime", "wiki", 8),
      node(3, "Task lifecycle", "runtime", 4),
      node(4, "Runtime recovery", "runtime", 7),
    ];

    expect(searchKnowledgeNodes(nodes, "runtime", 3).map((item) => item.label)).toEqual([
      "Runtime recovery",
      "Runtime overview",
      "Jarvis runtime",
    ]);
    expect(searchKnowledgeNodes(nodes, "   ")).toEqual([]);
  });
});
