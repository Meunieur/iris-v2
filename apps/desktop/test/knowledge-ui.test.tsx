// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BrainSummary, KnowledgeGraphEdge, KnowledgeGraphNode } from "@iris/contracts";
import type { JarvisKnowledgeSnapshot } from "@iris/jarvis-adapter";

import { KnowledgeDock } from "../src/renderer/knowledge/KnowledgeDock";
import { buildObservatoryLayout } from "../src/renderer/knowledge/observatory-layout";

const primaryId = `brain_${"a".repeat(64)}` as const;
const secondaryId = `brain_${"b".repeat(64)}` as const;
const brains: readonly BrainSummary[] = [
  { id: primaryId, name: "Brain Default", notes: 12, isDefault: true },
  { id: secondaryId, name: "Orca", notes: 7, isDefault: false },
];
const ready: JarvisKnowledgeSnapshot = {
  state: "ready",
  capturedAt: "2026-07-31T03:00:00.000Z",
  brain: brains[0] as BrainSummary,
  graph: {
    nodes: [
      { id: `node_${"1".repeat(64)}`, label: "Architecture", folder: "wiki", source: "jarvis_brain", links: 1, createdAt: 1_785_000_000 },
      { id: `node_${"2".repeat(64)}`, label: "Preferences", folder: "memory", source: "jarvis_brain", links: 1, createdAt: 1_785_000_001 },
      { id: `node_${"3".repeat(64)}`, label: "Kiến trúc hệ thống", folder: "architecture", source: "jarvis_brain", links: 1, createdAt: 1_785_000_002 },
    ],
    edges: [
      { source: `node_${"1".repeat(64)}`, target: `node_${"2".repeat(64)}` },
      { source: `node_${"1".repeat(64)}`, target: `node_${"3".repeat(64)}` },
    ],
    categories: [{ name: "wiki", count: 1 }, { name: "memory", count: 1 }, { name: "architecture", count: 1 }],
    stats: {
      totalNotes: 620,
      totalLinks: 1_200,
      orphans: 20,
      hidden: 120,
      returnedNodes: 500,
      returnedEdges: 1_000,
      truncated: true,
    },
  },
};

const denseNodes: KnowledgeGraphNode[] = Array.from({ length: 120 }, (_, index) => ({
  id: `node_${String(index + 10).padStart(64, "0")}`,
  label: index === 119 ? "Ghi chú đặc biệt cuối trường" : `Node mật độ ${index + 1}`,
  folder: index % 2 === 0 ? "wiki" : "memory",
  source: "jarvis_brain",
  links: index < 12 ? 20 - index : 2,
  createdAt: 1_785_100_000 + index,
}));
const denseEdges: KnowledgeGraphEdge[] = denseNodes.slice(1).map((node, index) => ({
  source: (denseNodes[index] as KnowledgeGraphNode).id,
  target: node.id,
}));
const denseReady: JarvisKnowledgeSnapshot = {
  ...ready,
  graph: {
    ...ready.graph,
    nodes: denseNodes,
    edges: denseEdges,
    stats: {
      ...ready.graph.stats,
      hidden: 380,
      returnedNodes: 120,
      returnedEdges: denseEdges.length,
    },
  },
};

afterEach(cleanup);

describe("Second Brain Galaxy view", () => {
  it("keeps brain selection view-only and keyboard operable", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onLoad = vi.fn();
    render(<KnowledgeDock
      brains={brains}
      selectedBrainId={primaryId}
      state={{ state: "idle" }}
      connection="ready"
      busy={false}
      onSelect={onSelect}
      onLoad={onLoad}
    />);

    expect(screen.getByRole("heading", { name: "Galaxy Second Brain" })).toBeTruthy();
    expect(screen.getByText(/không đổi brain mặc định/i)).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "Brain để xem" }), secondaryId);
    expect(onSelect).toHaveBeenCalledWith(secondaryId);
    await user.click(screen.getByRole("button", { name: "Tải Second Brain" }));
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /đặt mặc định|ghi|xóa|thực thi|chạy/i })).toBeNull();
  });

  it("renders bounded graph evidence and an accessible fallback without opaque IDs", () => {
    const view = render(<KnowledgeDock
      brains={brains}
      selectedBrainId={primaryId}
      state={ready}
      connection="ready"
      busy={false}
      onSelect={() => undefined}
      onLoad={() => undefined}
    />);

    expect(screen.getByLabelText("Bản đồ Galaxy của Brain Default")).toBeTruthy();
    expect(screen.getByText("Neural Observatory")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tập trung Architecture" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tập trung Preferences" })).toBeTruthy();
    expect(view.container.querySelector("[data-observatory-depth]")).toBeTruthy();
    expect(screen.getAllByText("Architecture").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Preferences").length).toBeGreaterThan(0);
    expect(screen.getByText(/500\/620 node/)).toBeTruthy();
    expect(screen.getByText(/đã giới hạn/i)).toBeTruthy();
    expect(screen.getByText(/Nguồn: JarvisOS Second Brain/i)).toBeTruthy();
    expect(view.container.textContent).not.toContain(primaryId);
    expect(view.container.textContent).not.toContain("node_111");
    expect(view.container.textContent).not.toContain("fullpath");
  });

  it("keeps pointer and keyboard node focus in the same readable inspection state", async () => {
    const user = userEvent.setup();
    render(<KnowledgeDock
      brains={brains}
      selectedBrainId={primaryId}
      state={ready}
      connection="ready"
      busy={false}
      onSelect={() => undefined}
      onLoad={() => undefined}
    />);

    await user.click(screen.getByRole("button", { name: "Tập trung Preferences" }));

    expect(screen.getByRole("heading", { name: "Preferences" })).toBeTruthy();
    expect(screen.getByText("1 liên kết trực tiếp")).toBeTruthy();
  });

  it("finds Vietnamese nodes without diacritics and opens the result in the inspector", async () => {
    const user = userEvent.setup();
    render(<KnowledgeDock
      brains={brains}
      selectedBrainId={primaryId}
      state={ready}
      connection="ready"
      busy={false}
      onSelect={() => undefined}
      onLoad={() => undefined}
    />);

    const search = screen.getByRole("searchbox", { name: "Tìm node tri thức" });
    search.focus();
    await user.keyboard("kien truc");

    expect(screen.getByText("1 kết quả trong snapshot")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mở node Kiến trúc hệ thống" }));
    expect(screen.getByRole("heading", { name: "Kiến trúc hệ thống" })).toBeTruthy();

    await user.clear(search);
    await user.type(search, "khong ton tai");
    expect(screen.getByText("Không tìm thấy node phù hợp.")).toBeTruthy();
  });

  it("reveals 36, 72 or 96 nodes while keeping a searched hidden node focused", async () => {
    const user = userEvent.setup();
    render(<KnowledgeDock
      brains={brains}
      selectedBrainId={primaryId}
      state={denseReady}
      connection="ready"
      busy={false}
      onSelect={() => undefined}
      onLoad={() => undefined}
    />);

    const density = screen.getByRole("combobox", { name: "Mật độ Observatory" });
    expect(screen.getByText("72/120 node hiển thị")).toBeTruthy();

    await user.selectOptions(density, "36");
    expect(screen.getByText("36/120 node hiển thị")).toBeTruthy();

    const compactIds = new Set(buildObservatoryLayout(denseReady.graph, { maxNodes: 36 }).nodes.map((node) => node.id));
    const hiddenNode = denseNodes.find((node) => !compactIds.has(node.id));
    if (!hiddenNode) throw new Error("Expected a node outside the compact projection");
    expect(screen.queryByRole("button", { name: `Tập trung ${hiddenNode.label}` })).toBeNull();

    const search = screen.getByRole("searchbox", { name: "Tìm node tri thức" });
    await user.type(search, hiddenNode.label);
    await user.click(screen.getByRole("button", { name: `Mở node ${hiddenNode.label}` }));
    expect(screen.getByRole("heading", { name: hiddenNode.label })).toBeTruthy();
    expect(screen.getByText("36/120 node hiển thị")).toBeTruthy();

    await user.selectOptions(density, "96");
    expect(screen.getByText("96/120 node hiển thị")).toBeTruthy();
  });

  it("shows the auth gate instead of issuing a mutation affordance", () => {
    render(<KnowledgeDock
      brains={[]}
      state={{ state: "sign_in_required", capturedAt: "2026-07-31T03:00:00.000Z" }}
      connection="sign_in_required"
      busy={false}
      onSelect={() => undefined}
      onLoad={() => undefined}
    />);

    expect(screen.getByText(/Đăng nhập JarvisOS để xem Second Brain/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tải Second Brain" })).toBeNull();
  });
});
