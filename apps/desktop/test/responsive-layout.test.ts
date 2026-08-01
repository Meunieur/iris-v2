import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("high-DPI renderer layout contract", () => {
  it("keeps the command deck vertically reachable on short two-column viewports", async () => {
    const css = await readFile(path.resolve("apps/desktop/src/renderer/styles.css"), "utf8");
    const start = css.indexOf("@media (max-width: 1180px) and (max-height: 700px)");
    const end = css.indexOf("@media (max-width: 760px)", start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const compactDeck = css.slice(start, end);
    expect(compactDeck).toContain("html, body, #root { overflow: auto; }");
    expect(compactDeck).toContain(".command-deck { min-height: 100vh; height: auto; overflow: visible; }");
    expect(compactDeck).toContain(".deck-layout { height: auto;");
  });

  it("removes decorative motion when Windows requests reduced motion", async () => {
    const css = await readFile(path.resolve("apps/desktop/src/renderer/styles.css"), "utf8");
    const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(reducedMotion).toContain("transition-duration: 0.01ms !important");
    expect(reducedMotion).toContain("animation-duration: 0.01ms !important");
    expect(reducedMotion).toContain(".orb-ring, .orb-ticks { animation: none !important; }");
    expect(reducedMotion).toContain(".observatory-motion { animation: none !important; }");
  });
});
