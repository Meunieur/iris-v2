import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AUTH_PARTITION,
  DEV_RENDERER_URL,
  SHELL_ORIGIN,
  authWindowOptions,
  isAllowedAuthNavigation,
  isTrustedAudioPermission,
  isTrustedVideoPermission,
  rendererEntry,
  resolveRendererAsset,
  shellWindowOptions,
} from "../src/main/security";

describe("Electron window security policy", () => {
  it("creates a sandboxed shell with a single preload boundary", () => {
    const options = shellWindowOptions("E:\\Iris\\preload.cjs");

    expect(options).toMatchObject({
      width: 1920,
      height: 1040,
      x: 0,
      y: 0,
      show: false,
      transparent: true,
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      backgroundColor: "#00000000",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false,
        webSecurity: true,
        navigateOnDragDrop: false,
        preload: "E:\\Iris\\preload.cjs",
      },
    });
  });

  it("uses the selected display work area for the HUD window", () => {
    expect(shellWindowOptions("preload.cjs", { x: 1920, y: 0, width: 2560, height: 1400 })).toMatchObject({
      x: 1920,
      y: 0,
      width: 2560,
      height: 1400,
    });
  });

  it("never sets shell minimums larger than a high-DPI display work area", () => {
    expect(shellWindowOptions("preload.cjs", { x: 0, y: 0, width: 960, height: 516 })).toMatchObject({
      width: 960,
      height: 516,
      minWidth: 960,
      minHeight: 516,
    });
  });

  it("allows only video-only media permission from the trusted shell document", () => {
    const trusted = {
      webContentsId: 41,
      shellWebContentsId: 41,
      currentUrl: "iris://app/index.html",
      trustedUrl: "iris://app/index.html",
      permission: "media",
      mediaTypes: ["video"] as const,
    };

    expect(isTrustedVideoPermission(trusted)).toBe(true);
    expect(isTrustedVideoPermission({ ...trusted, mediaTypes: ["audio"] })).toBe(false);
    expect(isTrustedVideoPermission({ ...trusted, mediaTypes: ["video", "audio"] })).toBe(false);
    expect(isTrustedVideoPermission({ ...trusted, permission: "notifications" })).toBe(false);
    expect(isTrustedVideoPermission({ ...trusted, webContentsId: 99 })).toBe(false);
    expect(isTrustedVideoPermission({ ...trusted, currentUrl: "https://attacker.example/" })).toBe(false);
  });

  it("keeps microphone permission separate and audio-only", () => {
    const trusted = {
      webContentsId: 41,
      shellWebContentsId: 41,
      currentUrl: "iris://app/index.html",
      trustedUrl: "iris://app/index.html",
      permission: "media",
      mediaTypes: ["audio"] as const,
    };

    expect(isTrustedAudioPermission(trusted)).toBe(true);
    expect(isTrustedAudioPermission({ ...trusted, mediaTypes: ["video"] })).toBe(false);
    expect(isTrustedAudioPermission({ ...trusted, mediaTypes: ["audio", "video"] })).toBe(false);
    expect(isTrustedAudioPermission({ ...trusted, webContentsId: 99 })).toBe(false);
  });

  it("creates an in-memory auth window without a preload", () => {
    const options = authWindowOptions();

    expect(AUTH_PARTITION).toBe("iris-jarvis-auth");
    expect(AUTH_PARTITION.startsWith("persist:")).toBe(false);
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
      navigateOnDragDrop: false,
      partition: AUTH_PARTITION,
    });
    expect(options.webPreferences).not.toHaveProperty("preload");
  });

  it("uses only fixed renderer entries and ignores environment-provided URLs", () => {
    process.env.IRIS_DEV_URL = "https://attacker.example";

    expect(rendererEntry(["electron", "main.js", "--dev"])).toBe(DEV_RENDERER_URL);
    expect(rendererEntry(["electron", "main.js"])).toBe(`${SHELL_ORIGIN}/index.html`);
    expect(DEV_RENDERER_URL).toBe("http://127.0.0.1:5173/");
  });

  it.each([
    "http://127.0.0.1:7777/",
    "http://127.0.0.1:7777/auth/login",
    "http://127.0.0.1:7777/assets/app.js",
  ])("allows auth navigation on the selected exact origin: %s", (candidate) => {
    expect(isAllowedAuthNavigation(candidate, new URL("http://127.0.0.1:7777/"))).toBe(true);
  });

  it.each([
    "https://127.0.0.1:7777/",
    "http://localhost:7777/",
    "http://127.0.0.1:7778/",
    "http://example.com/",
    "file:///C:/Windows/System32/calc.exe",
    "javascript:alert(1)",
    "not a url",
  ])("blocks auth navigation outside the selected exact origin: %s", (candidate) => {
    expect(isAllowedAuthNavigation(candidate, new URL("http://127.0.0.1:7777/"))).toBe(false);
  });
});

describe("iris renderer asset resolution", () => {
  const rendererRoot = path.resolve("E:\\Iris\\dist\\renderer");

  it.each([
    ["iris://app/", "index.html"],
    ["iris://app/index.html", "index.html"],
    ["iris://app/assets/app-123.js", path.join("assets", "app-123.js")],
  ])("resolves safe renderer asset %s", (requestUrl, relativePath) => {
    expect(resolveRendererAsset(rendererRoot, requestUrl)).toBe(path.join(rendererRoot, relativePath));
  });

  it.each([
    "iris://other/index.html",
    "https://app/index.html",
    "iris://app/../secret.txt",
    "iris://app/%2e%2e/secret.txt",
    "iris://app/%252e%252e/secret.txt",
    "iris://app/assets%5csecret.js",
    "iris://app/%00secret.js",
    "iris://app/index.html?remote=true",
    "iris://app/index.html#fragment",
    "iris://app/C:/Windows/System32/calc.exe",
  ])("rejects renderer asset escape %s", (requestUrl) => {
    expect(resolveRendererAsset(rendererRoot, requestUrl)).toBeUndefined();
  });
});
