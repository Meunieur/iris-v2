import type { KnowledgeGraphNode } from "@iris/contracts";

import { MAX_LOCAL_SEARCH_QUERY_LENGTH, normalizeLocalSearchText } from "../local-search.js";

const DEFAULT_RESULT_LIMIT = 6;
const MAX_RESULT_LIMIT = 12;

function matchRank(node: KnowledgeGraphNode, query: string): number | undefined {
  const label = normalizeLocalSearchText(node.label);
  const folder = normalizeLocalSearchText(node.folder);
  if (label.startsWith(query)) return 0;
  if (label.includes(query)) return 1;
  if (folder.startsWith(query)) return 2;
  if (folder.includes(query)) return 3;

  const terms = query.split(" ").filter(Boolean);
  if (terms.length > 1 && terms.every((term) => label.includes(term) || folder.includes(term))) return 4;
  return undefined;
}

export function searchKnowledgeNodes(
  nodes: readonly KnowledgeGraphNode[],
  rawQuery: string,
  resultLimit = DEFAULT_RESULT_LIMIT,
): readonly KnowledgeGraphNode[] {
  const query = normalizeLocalSearchText(rawQuery, MAX_LOCAL_SEARCH_QUERY_LENGTH);
  if (!query) return [];
  const limit = Math.max(1, Math.min(MAX_RESULT_LIMIT, resultLimit));

  return nodes
    .map((node) => ({ node, rank: matchRank(node, query) }))
    .filter((candidate): candidate is Readonly<{ node: KnowledgeGraphNode; rank: number }> => candidate.rank !== undefined)
    .sort((left, right) =>
      left.rank - right.rank
      || right.node.links - left.node.links
      || left.node.label.localeCompare(right.node.label, "vi"),
    )
    .slice(0, limit)
    .map(({ node }) => node);
}
