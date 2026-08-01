import { createHash } from "node:crypto";

import { z } from "zod";

import { sanitizeRendererText, type BrainSummary } from "./public-projections.js";

export const MAX_PUBLIC_GRAPH_NODES = 500;
export const MAX_PUBLIC_GRAPH_EDGES = 1_000;

const boundedText = z.string().max(16 * 1024);
const nonNegativeInteger = z.number().int().nonnegative();

export const rawKnowledgeGraphSchema = z.object({
  nodes: z.array(z.object({
    id: boundedText,
    label: boundedText,
    folder: boundedText,
    color: boundedText.optional(),
    path: boundedText,
    fullpath: boundedText.optional(),
    links: nonNegativeInteger,
    t: z.number().finite().nonnegative(),
  }).passthrough()).max(2_000),
  edges: z.array(z.object({
    source: boundedText,
    target: boundedText,
  }).passthrough()).max(10_000),
  categories: z.array(z.object({
    name: boundedText,
    count: nonNegativeInteger,
  }).passthrough()).max(32),
  stats: z.object({
    total_notes: nonNegativeInteger,
    total_links: nonNegativeInteger,
    orphans: nonNegativeInteger,
    hidden: nonNegativeInteger,
  }).passthrough(),
}).passthrough().superRefine((value, context) => {
  const seen = new Set<string>();
  value.nodes.forEach((node, index) => {
    if (seen.has(node.id)) {
      context.addIssue({
        code: "custom",
        path: ["nodes", index, "id"],
        message: "Duplicate graph node ID",
      });
    }
    seen.add(node.id);
  });
});

export type RawKnowledgeGraph = z.infer<typeof rawKnowledgeGraphSchema>;

export type KnowledgeGraphNode = Readonly<{
  id: `node_${string}`;
  label: string;
  folder: string;
  source: "jarvis_brain";
  links: number;
  createdAt: number;
}>;

export type KnowledgeGraphEdge = Readonly<{
  source: KnowledgeGraphNode["id"];
  target: KnowledgeGraphNode["id"];
}>;

export type PublicKnowledgeGraph = Readonly<{
  nodes: readonly KnowledgeGraphNode[];
  edges: readonly KnowledgeGraphEdge[];
  categories: readonly Readonly<{ name: string; count: number }>[];
  stats: Readonly<{
    totalNotes: number;
    totalLinks: number;
    orphans: number;
    hidden: number;
    returnedNodes: number;
    returnedEdges: number;
    truncated: boolean;
  }>;
}>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function opaqueNodeId(brainId: BrainSummary["id"], rawId: string): KnowledgeGraphNode["id"] {
  const digest = createHash("sha256").update(brainId).update("\0").update(rawId).digest("hex");
  return `node_${digest}`;
}

export function projectKnowledgeGraph(
  raw: RawKnowledgeGraph,
  brainId: BrainSummary["id"],
): PublicKnowledgeGraph {
  const selected = raw.nodes.slice(0, MAX_PUBLIC_GRAPH_NODES);
  const nodeIds = new Map(selected.map((node) => [node.id, opaqueNodeId(brainId, node.id)]));
  const nodes = selected.map((node): KnowledgeGraphNode => ({
    id: nodeIds.get(node.id) as KnowledgeGraphNode["id"],
    label: sanitizeRendererText(node.label),
    folder: sanitizeRendererText(node.folder),
    source: "jarvis_brain",
    links: node.links,
    createdAt: node.t,
  }));
  const eligibleEdges = raw.edges.flatMap((edge): KnowledgeGraphEdge[] => {
    const source = nodeIds.get(edge.source);
    const target = nodeIds.get(edge.target);
    return source === undefined || target === undefined ? [] : [{ source, target }];
  });
  const edges = eligibleEdges.slice(0, MAX_PUBLIC_GRAPH_EDGES);
  return deepFreeze({
    nodes,
    edges,
    categories: raw.categories.map((category) => ({
      name: sanitizeRendererText(category.name),
      count: category.count,
    })),
    stats: {
      totalNotes: raw.stats.total_notes,
      totalLinks: raw.stats.total_links,
      orphans: raw.stats.orphans,
      hidden: raw.stats.hidden,
      returnedNodes: nodes.length,
      returnedEdges: edges.length,
      truncated: raw.nodes.length > nodes.length || raw.edges.length > edges.length,
    },
  });
}
