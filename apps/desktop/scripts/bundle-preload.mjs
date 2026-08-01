import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const desktopRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = path.join(desktopRoot, "dist", "electron", "preload");

await mkdir(outputDirectory, { recursive: true });
await rm(path.join(outputDirectory, "api.cjs"), { force: true });
await build({
  entryPoints: [path.join(desktopRoot, "src", "preload", "preload.cts")],
  outfile: path.join(outputDirectory, "preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2022",
  external: ["electron"],
  sourcemap: false,
  legalComments: "none",
});
