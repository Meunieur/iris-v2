import { rawAuthStatusSchema } from "@iris/contracts";
import {
  getBoundedJson,
  type JarvisTransport,
  type Scheduler,
} from "@iris/jarvis-adapter";

import { authWindowOptions, isAllowedAuthNavigation } from "./security.js";

type NavigationEvent = {
  preventDefault(): void;
};

export type AuthWindowLike = {
  close(): void;
  focus(): void;
  isDestroyed(): boolean;
  loadURL(url: string): Promise<unknown>;
  on(event: "closed", listener: () => void): unknown;
  show(): void;
  webContents: {
    on(
      event: "will-navigate" | "will-redirect",
      listener: (event: NavigationEvent, url: string) => void,
    ): unknown;
    setWindowOpenHandler(handler: (details: { url: string }) => { action: "deny" }): unknown;
  };
};

export type AuthSessionLike = {
  fetch(input: string, init?: RequestInit): Promise<Response>;
  setPermissionCheckHandler(handler: () => boolean): void;
  setPermissionRequestHandler(
    handler: (webContents: unknown, permission: string, callback: (allowed: boolean) => void) => void,
  ): void;
};

type JarvisAuthSessionInput = {
  endpoint: URL;
  session: AuthSessionLike;
  createWindow(options: ReturnType<typeof authWindowOptions>): AuthWindowLike;
  scheduler: Scheduler;
  onAuthenticated(): Promise<unknown> | unknown;
  pollMs?: number;
};

const DEFAULT_AUTH_POLL_MS = 1_000;

export function createSessionTransport(session: Pick<AuthSessionLike, "fetch">): JarvisTransport {
  return {
    fetch: (url, init) => session.fetch(url.href, {
      ...init,
      credentials: "include",
    }),
  };
}

export class JarvisAuthSession {
  readonly #endpoint: URL;
  readonly #session: AuthSessionLike;
  readonly #transport: JarvisTransport;
  readonly #createWindow: JarvisAuthSessionInput["createWindow"];
  readonly #scheduler: Scheduler;
  readonly #onAuthenticated: JarvisAuthSessionInput["onAuthenticated"];
  readonly #pollMs: number;
  #window: AuthWindowLike | undefined;
  #pollHandle: unknown | undefined;

  constructor(input: JarvisAuthSessionInput) {
    this.#endpoint = new URL(input.endpoint.href);
    this.#session = input.session;
    this.#transport = createSessionTransport(input.session);
    this.#createWindow = input.createWindow;
    this.#scheduler = input.scheduler;
    this.#onAuthenticated = input.onAuthenticated;
    this.#pollMs = input.pollMs ?? DEFAULT_AUTH_POLL_MS;

    this.#session.setPermissionCheckHandler(() => false);
    this.#session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  }

  async open(): Promise<{ opened: boolean }> {
    if (this.#window !== undefined && !this.#window.isDestroyed()) {
      this.#window.focus();
      return { opened: false };
    }

    const window = this.#createWindow(authWindowOptions());
    this.#window = window;
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const guardNavigation = (event: NavigationEvent, url: string) => {
      if (!isAllowedAuthNavigation(url, this.#endpoint)) event.preventDefault();
    };
    window.webContents.on("will-navigate", guardNavigation);
    window.webContents.on("will-redirect", guardNavigation);
    window.on("closed", () => {
      if (this.#window === window) this.#window = undefined;
      this.#clearPoll();
    });

    try {
      await window.loadURL(this.#endpoint.href);
    } catch {
      window.close();
      return { opened: false };
    }

    window.show();
    if (this.#window === window && !window.isDestroyed()) await this.#poll(window);
    return { opened: true };
  }

  async #poll(window: AuthWindowLike): Promise<void> {
    try {
      const auth = await getBoundedJson({
        transport: this.#transport,
        url: new URL("auth/status", this.#endpoint),
        schema: rawAuthStatusSchema,
      });
      if (this.#window !== window || window.isDestroyed()) return;
      if (auth.authed) {
        window.close();
        await this.#onAuthenticated();
        return;
      }
    } catch {
      if (this.#window !== window || window.isDestroyed()) return;
    }
    this.#schedulePoll(window);
  }

  #schedulePoll(window: AuthWindowLike): void {
    if (this.#pollHandle !== undefined || this.#window !== window || window.isDestroyed()) return;
    this.#pollHandle = this.#scheduler.set(this.#pollMs, () => {
      this.#pollHandle = undefined;
      if (this.#window === window && !window.isDestroyed()) void this.#poll(window);
    });
  }

  #clearPoll(): void {
    if (this.#pollHandle === undefined) return;
    this.#scheduler.clear(this.#pollHandle);
    this.#pollHandle = undefined;
  }
}
