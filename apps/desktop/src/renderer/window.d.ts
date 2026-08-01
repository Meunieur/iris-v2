import type { IrisRendererApi } from "../preload/api.cjs";

declare global {
  interface Window {
    readonly iris: IrisRendererApi;
  }
}

export {};
