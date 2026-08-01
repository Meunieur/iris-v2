import { access, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import extract from "@electron-internal/extract-zip";
import { downloadArtifact } from "@electron/get";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDirectory, "..");
const workspaceRoot = path.resolve(desktopRoot, "..", "..");
const distributionDirectory = path.join(workspaceRoot, ".cache", "electron-dist");
const packageJson = JSON.parse(await readFile(path.join(desktopRoot, "package.json"), "utf8"));
const electronVersion = packageJson.devDependencies?.electron;

if (typeof electronVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(electronVersion)) {
  throw new Error("Desktop package must pin an exact Electron version");
}

async function validDistribution() {
  try {
    const version = (await readFile(path.join(distributionDirectory, "version"), "utf8")).trim();
    await access(path.join(distributionDirectory, "electron.exe"));
    return version === electronVersion;
  } catch {
    return false;
  }
}

if (!await validDistribution()) {
  await rm(distributionDirectory, { recursive: true, force: true });
  await mkdir(distributionDirectory, { recursive: true });
  try {
    const archive = await downloadArtifact({
      version: electronVersion,
      artifactName: "electron",
      platform: "win32",
      arch: "x64",
    });
    await extract(archive, { dir: distributionDirectory });
  } catch (error) {
    await rm(distributionDirectory, { recursive: true, force: true });
    throw error;
  }
}

if (!await validDistribution()) throw new Error("Prepared Electron distribution failed validation");
console.info(`[iris] electron_dist_ready ${electronVersion}`);
