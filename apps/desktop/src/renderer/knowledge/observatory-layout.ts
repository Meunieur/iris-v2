import type { KnowledgeGraphEdge, KnowledgeGraphNode, PublicKnowledgeGraph } from "@iris/contracts";

export type ObservatoryNode = KnowledgeGraphNode & Readonly<{
  x: number;
  y: number;
  depth: number;
  radius: number;
  degree: number;
  rank: number;
}>;

export type ObservatoryEdge = KnowledgeGraphEdge & Readonly<{
  depth: number;
}>;

export type ObservatoryLayout = Readonly<{
  width: number;
  height: number;
  nodes: readonly ObservatoryNode[];
  edges: readonly ObservatoryEdge[];
}>;

type LayoutOptions = Readonly<{
  maxNodes?: number;
  width?: number;
  height?: number;
  preferredNodeIds?: readonly KnowledgeGraphNode["id"][];
}>;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function hashFraction(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function selectRepresentativeNodes(
  graph: Pick<PublicKnowledgeGraph, "nodes" | "edges">,
  maxNodes: number,
  preferredNodeIds: readonly KnowledgeGraphNode["id"][],
): readonly Readonly<{ node: KnowledgeGraphNode; degree: number; rank: number }>[] {
  const known = new Set(graph.nodes.map((node) => node.id));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const degree = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    if (!known.has(edge.source) || !known.has(edge.target)) continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const ranked = [...graph.nodes].sort((left, right) => {
    const leftDegree = Math.max(left.links, degree.get(left.id) ?? 0);
    const rightDegree = Math.max(right.links, degree.get(right.id) ?? 0);
    if (leftDegree !== rightDegree) return rightDegree - leftDegree;
    if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  const rankIndex = new Map(ranked.map((node, index) => [node.id, index]));
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<KnowledgeGraphNode["id"]>()]));
  for (const edge of graph.edges) {
    if (!known.has(edge.source) || !known.has(edge.target)) continue;
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const selected = new Map<KnowledgeGraphNode["id"], KnowledgeGraphNode>();
  const leaders = new Map<string, KnowledgeGraphNode>();
  for (const node of ranked) {
    const folder = node.folder || "root";
    if (!leaders.has(folder)) leaders.set(folder, node);
  }

  for (const preferredId of preferredNodeIds) {
    if (selected.size >= maxNodes) break;
    const preferred = nodeById.get(preferredId);
    if (preferred) selected.set(preferred.id, preferred);
  }
  const leadingHub = ranked[0];
  if (leadingHub && selected.size < maxNodes) selected.set(leadingHub.id, leadingHub);
  for (const preferredId of preferredNodeIds) {
    const neighbors = [...(adjacency.get(preferredId) ?? [])]
      .sort((left, right) => (rankIndex.get(left) ?? Number.MAX_SAFE_INTEGER) - (rankIndex.get(right) ?? Number.MAX_SAFE_INTEGER));
    for (const neighborId of neighbors) {
      if (selected.size >= maxNodes) break;
      const neighbor = nodeById.get(neighborId);
      if (neighbor) selected.set(neighbor.id, neighbor);
    }
    if (selected.size >= maxNodes) break;
  }
  for (const leader of leaders.values()) {
    if (selected.size >= maxNodes) break;
    selected.set(leader.id, leader);
  }
  const topologySeeds = [...selected.values(), ...ranked.slice(0, 4)];
  for (const seed of topologySeeds) {
    const neighbors = [...(adjacency.get(seed.id) ?? [])]
      .sort((left, right) => (rankIndex.get(left) ?? Number.MAX_SAFE_INTEGER) - (rankIndex.get(right) ?? Number.MAX_SAFE_INTEGER));
    for (const neighborId of neighbors) {
      if (selected.size >= maxNodes) break;
      const neighbor = nodeById.get(neighborId);
      if (neighbor) selected.set(neighbor.id, neighbor);
    }
    if (selected.size >= maxNodes) break;
  }
  for (const node of ranked) {
    if (selected.size >= maxNodes) break;
    selected.set(node.id, node);
  }

  return [...selected.values()]
    .sort((left, right) => (rankIndex.get(left.id) ?? 0) - (rankIndex.get(right.id) ?? 0))
    .map((node, rank) => ({
      node,
      degree: Math.max(node.links, degree.get(node.id) ?? 0),
      rank,
    }));
}

export function buildObservatoryLayout(
  graph: Pick<PublicKnowledgeGraph, "nodes" | "edges">,
  options: LayoutOptions = {},
): ObservatoryLayout {
  const width = options.width ?? 760;
  const height = options.height ?? 460;
  const maxNodes = Math.max(1, Math.min(96, options.maxNodes ?? 72));
  const selected = selectRepresentativeNodes(graph, maxNodes, options.preferredNodeIds ?? []);
  if (selected.length === 0) return { width, height, nodes: [], edges: [] };

  const visibleIds = new Set(selected.map(({ node }) => node.id));
  const edges = graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const highestDegree = Math.max(1, ...selected.map(({ degree }) => degree));
  const minimumDimension = Math.min(width, height);

  const working = selected.map(({ node, degree, rank }, index) => {
    const phase = hashFraction(node.id) * Math.PI * 2;
    const radius = Math.sqrt((index + 0.65) / selected.length) * minimumDimension * 0.35;
    const angle = (index * GOLDEN_ANGLE) + phase * 0.18;
    return {
      node,
      degree,
      rank,
      x: (Math.cos(angle) * radius * 1.18),
      y: (Math.sin(angle) * radius * 0.82),
    };
  });
  const byId = new Map(working.map((item, index) => [item.node.id, index]));

  for (let iteration = 0; iteration < 84; iteration += 1) {
    const forceX = new Float64Array(working.length);
    const forceY = new Float64Array(working.length);

    for (let left = 0; left < working.length; left += 1) {
      const source = working[left];
      if (!source) continue;
      for (let right = left + 1; right < working.length; right += 1) {
        const target = working[right];
        if (!target) continue;
        const deltaX = source.x - target.x;
        const deltaY = source.y - target.y;
        const distanceSquared = Math.max(36, (deltaX * deltaX) + (deltaY * deltaY));
        const distance = Math.sqrt(distanceSquared);
        const repulsion = 1_650 / distanceSquared;
        const pushX = (deltaX / distance) * repulsion;
        const pushY = (deltaY / distance) * repulsion;
        forceX[left] = (forceX[left] ?? 0) + pushX;
        forceY[left] = (forceY[left] ?? 0) + pushY;
        forceX[right] = (forceX[right] ?? 0) - pushX;
        forceY[right] = (forceY[right] ?? 0) - pushY;
      }
    }

    for (const edge of edges) {
      const sourceIndex = byId.get(edge.source);
      const targetIndex = byId.get(edge.target);
      if (sourceIndex === undefined || targetIndex === undefined) continue;
      const source = working[sourceIndex];
      const target = working[targetIndex];
      if (!source || !target) continue;
      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const ideal = 54 + (Math.min(source.degree, target.degree) < 3 ? 16 : 0);
      const pull = (distance - ideal) * 0.011;
      const pullX = (deltaX / distance) * pull;
      const pullY = (deltaY / distance) * pull;
      forceX[sourceIndex] = (forceX[sourceIndex] ?? 0) + pullX;
      forceY[sourceIndex] = (forceY[sourceIndex] ?? 0) + pullY;
      forceX[targetIndex] = (forceX[targetIndex] ?? 0) - pullX;
      forceY[targetIndex] = (forceY[targetIndex] ?? 0) - pullY;
    }

    const cooling = 0.74 - (iteration / 150);
    for (let index = 0; index < working.length; index += 1) {
      const item = working[index];
      if (!item) continue;
      const horizontalForce = (forceX[index] ?? 0) - item.x * 0.008;
      const verticalForce = (forceY[index] ?? 0) - item.y * 0.011;
      item.x += clamp(horizontalForce * cooling, -7, 7);
      item.y += clamp(verticalForce * cooling, -7, 7);
    }
  }

  const minX = Math.min(...working.map((item) => item.x));
  const maxX = Math.max(...working.map((item) => item.x));
  const minY = Math.min(...working.map((item) => item.y));
  const maxY = Math.max(...working.map((item) => item.y));
  const graphWidth = Math.max(1, maxX - minX);
  const graphHeight = Math.max(1, maxY - minY);
  const scale = Math.min((width - 86) / graphWidth, (height - 78) / graphHeight);

  const nodes: ObservatoryNode[] = working.map(({ node, degree, rank, x, y }) => {
    const depth = clamp(0.3 + (degree / highestDegree) * 0.54 + hashFraction(node.id) * 0.16, 0.24, 1);
    return {
      ...node,
      x: 43 + ((x - minX) * scale),
      y: 39 + ((y - minY) * scale),
      depth,
      radius: clamp(3.2 + Math.sqrt(degree) * 0.82 + depth * 1.4, 4.2, 11.5),
      degree,
      rank,
    };
  });
  const positioned = new Map(nodes.map((node) => [node.id, node]));
  const projectedEdges: ObservatoryEdge[] = edges.map((edge) => ({
    ...edge,
    depth: ((positioned.get(edge.source)?.depth ?? 0.5) + (positioned.get(edge.target)?.depth ?? 0.5)) / 2,
  }));

  return { width, height, nodes, edges: projectedEdges };
}
