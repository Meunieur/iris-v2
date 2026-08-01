import path from "node:path";

import type { BrowserWindowConstructorOptions } from "electron";

export const SHELL_ORIGIN = "iris://app";
export const DEV_RENDERER_URL = "http://127.0.0.1:5173/";
export const AUTH_PARTITION = "persist:iris-jarvis-auth";

const secureWebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webviewTag: false,
  webSecurity: true,
  navigateOnDragDrop: false,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  spellcheck: false,
} as const;

type WindowBounds = Readonly<{ x: number; y: number; width: number; height: number }>;

type VideoPermissionInput = Readonly<{
  webContentsId: number;
  shellWebContentsId: number;
  currentUrl: string;
  trustedUrl: string;
  permission: string;
  mediaTypes?: readonly string[] | undefined;
}>;

const DEFAULT_HUD_BOUNDS: WindowBounds = Object.freeze({
  x: 0,
  y: 0,
  width: 1920,
  height: 1040,
});

export function shellWindowOptions(
  preloadPath: string,
  bounds: WindowBounds = DEFAULT_HUD_BOUNDS,
): BrowserWindowConstructorOptions {
  return {
    ...bounds,
    minWidth: Math.min(960, bounds.width),
    minHeight: Math.min(640, bounds.height),
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    webPreferences: {
      ...secureWebPreferences,
      preload: preloadPath,
    },
  };
}

export function isTrustedVideoPermission(input: VideoPermissionInput): boolean {
  return input.permission === "media"
    && input.webContentsId === input.shellWebContentsId
    && input.currentUrl === input.trustedUrl
    && input.mediaTypes?.length === 1
    && input.mediaTypes[0] === "video";
}

export function isTrustedAudioPermission(input: VideoPermissionInput): boolean {
  return input.permission === "media"
    && input.webContentsId === input.shellWebContentsId
    && input.currentUrl === input.trustedUrl
    && input.mediaTypes?.length === 1
    && input.mediaTypes[0] === "audio";
}

export function authWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 520,
    height: 680,
    minWidth: 420,
    minHeight: 560,
    show: false,
    backgroundColor: "#07090d",
    autoHideMenuBar: true,
    webPreferences: {
      ...secureWebPreferences,
      partition: AUTH_PARTITION,
    },
  };
}

export function rendererEntry(argv: readonly string[]): string {
  return argv.includes("--dev") ? DEV_RENDERER_URL : `${SHELL_ORIGIN}/index.html`;
}

export function isAllowedAuthNavigation(candidate: string, endpoint: URL): boolean {
  try {
    const target = new URL(candidate);
    return target.origin === endpoint.origin
      && target.protocol === "http:"
      && target.username === ""
      && target.password === "";
  } catch {
    return false;
  }
}

export function resolveRendererAsset(rendererRoot: string, requestUrl: string): string | undefined {
  const match = /^iris:\/\/app(\/[^?#]*)?$/i.exec(requestUrl);
  if (match === null) return undefined;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(match[1] ?? "/");
  } catch {
    return undefined;
  }

  if (decodedPath.includes("\0") || decodedPath.includes("\\") || decodedPath.includes("%")) return undefined;
  const segments = decodedPath.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment))) {
    return undefined;
  }
  if (segments.length === 0) segments.push("index.html");

  const root = path.resolve(rendererRoot);
  const candidate = path.resolve(root, ...segments);
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return candidate;
}
