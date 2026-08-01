import { useEffect, useRef, useState } from "react";

import {
  createGestureEngine,
  type GestureEvent,
  type Point,
} from "@iris/gesture-runtime";
import type { GestureViewState, ReticleView } from "../hud/types.js";
import { isGestureActionAllowed } from "../hud/policy.js";
import {
  createMediaPipeSession,
  type MediaPipeSession,
} from "./media-pipe-session.js";

type Viewport = Readonly<{ width: number; height: number; mirrored: boolean }>;
type ScrollRegion = Readonly<{ top: number; height: number }>;
type GestureFrameCallback = (timestampMs: number) => void | Promise<void>;

export type GestureCameraDependencies = Readonly<{
  requestPermissionIntent(enabled: boolean): Promise<{ accepted: true }>;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createVideo(): HTMLVideoElement;
  createSession(assets: Readonly<{ wasmRoot: string; modelUrl: string }>): MediaPipeSession;
  requestFrame(callback: GestureFrameCallback): number;
  cancelFrame(handle: number): void;
  viewport(): Viewport;
  targetAt(point: Point): string | undefined;
  scrollRegion(): ScrollRegion | undefined;
}>;

type GestureCameraOptions = Readonly<{
  onEvent(event: GestureEvent): void;
}>;

type ActiveResources = {
  frame?: number;
  session: MediaPipeSession;
  stream: MediaStream;
  video: HTMLVideoElement;
};

const INITIAL_STATE: GestureViewState = Object.freeze({
  enabled: false,
  camera: "off",
  model: "idle",
  gesture: "unknown",
  tracking: false,
});

function assetUrl(path: string): string {
  return new URL(path, window.location.href).href;
}

function defaultDependencies(): GestureCameraDependencies {
  return {
    requestPermissionIntent: (enabled) => window.iris.requestGesturePermissionIntent(enabled),
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createVideo: () => document.createElement("video"),
    createSession: ({ wasmRoot, modelUrl }) => createMediaPipeSession({ wasmRoot, modelUrl }),
    requestFrame: (callback) => window.requestAnimationFrame((timestamp) => { void callback(timestamp); }),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight, mirrored: true }),
    targetAt: (point) => {
      const target = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>("[data-gesture-action]");
      const action = target?.dataset.gestureAction;
      return action !== undefined && isGestureActionAllowed(action) ? action : undefined;
    },
    scrollRegion: () => {
      const element = document.querySelector<HTMLElement>("[data-reader-scroll]");
      if (element === null) return undefined;
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, height: bounds.height };
    },
  };
}

function reticle(point: Point, confidence: number, dwellProgress: number): ReticleView {
  return {
    x: point.x,
    y: point.y,
    confidence,
    dwellProgress,
    state: dwellProgress > 0 ? "dwelling" : "tracking",
  };
}

export function useGestureCamera(
  options: GestureCameraOptions,
  injected?: GestureCameraDependencies,
) {
  const dependencies = injected ?? defaultDependencies();
  const [state, setState] = useState<GestureViewState>(INITIAL_STATE);
  const mounted = useRef(true);
  const generation = useRef(0);
  const resources = useRef<ActiveResources | undefined>(undefined);
  const engine = useRef(createGestureEngine());
  const onEvent = useRef(options.onEvent);
  onEvent.current = options.onEvent;

  const release = async () => {
    const active = resources.current;
    resources.current = undefined;
    if (active === undefined) return;
    if (active.frame !== undefined) dependencies.cancelFrame(active.frame);
    for (const track of active.stream.getTracks()) track.stop();
    active.video.pause();
    active.video.srcObject = null;
    try {
      await active.session.close();
    } catch {
      // Cleanup is best-effort; no provider error is exposed to the renderer.
    }
    engine.current.reset();
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  const setSafeState = (next: GestureViewState) => {
    if (mounted.current) setState(next);
  };

  const stopWithState = async (camera: "off" | "paused") => {
    generation.current += 1;
    await release();
    try {
      await dependencies.requestPermissionIntent(false);
    } catch {
      // Expiry in the main process remains the final safety net.
    }
    setSafeState({ ...INITIAL_STATE, camera });
  };

  const enable = async () => {
    const activeGeneration = generation.current + 1;
    generation.current = activeGeneration;
    await release();
    setSafeState({ ...INITIAL_STATE, enabled: true, camera: "requesting", model: "loading" });
    try {
      await dependencies.requestPermissionIntent(true);
      const stream = await dependencies.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      if (!mounted.current || generation.current !== activeGeneration) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      const video = dependencies.createVideo();
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      const session = dependencies.createSession({
        wasmRoot: assetUrl("mediapipe/wasm/"),
        modelUrl: assetUrl("mediapipe/models/gesture_recognizer.task"),
      });
      resources.current = { session, stream, video };
      setSafeState({ ...INITIAL_STATE, enabled: true, camera: "active", model: "loading" });

      const schedule = () => {
        const current = resources.current;
        if (current === undefined || generation.current !== activeGeneration) return;
        current.frame = dependencies.requestFrame(processFrame);
      };
      const processFrame = async (timestampMs: number) => {
        const current = resources.current;
        if (current === undefined || generation.current !== activeGeneration) return;
        try {
          if (current.video.readyState >= 2) {
            const viewport = dependencies.viewport();
            const observation = await current.session.process(current.video, timestampMs, viewport);
            if (observation !== undefined && generation.current === activeGeneration) {
              const primary = observation.hands.find((hand) => hand.id === "primary");
              const targetId = primary?.pointer === undefined ? undefined : dependencies.targetAt(primary.pointer);
              const update = engine.current.update({
                ...observation,
                viewport,
                targetId,
                scrollRegion: dependencies.scrollRegion(),
              });
              const pointer = [...update.events].reverse().find((event) => event.type === "pointer");
              for (const event of update.events) onEvent.current(event);
              setSafeState({
                enabled: true,
                camera: "active",
                model: "ready",
                gesture: update.state.gesture,
                tracking: update.state.tracking,
                primaryReticle: pointer?.type === "pointer"
                  ? reticle(pointer.point, pointer.confidence, pointer.dwellProgress)
                  : undefined,
                secondaryReticle: update.state.secondary?.pointer === undefined
                  ? undefined
                  : reticle(
                    update.state.secondary.pointer,
                    Math.min(
                      update.state.secondary.gestureConfidence,
                      update.state.secondary.trackingConfidence,
                    ),
                    0,
                  ),
              });
            }
          }
          schedule();
        } catch {
          generation.current += 1;
          await release();
          setSafeState({
            ...INITIAL_STATE,
            camera: "error",
            model: "error",
            error: "Không thể khởi động nhận diện cử chỉ cục bộ.",
          });
        }
      };
      schedule();
    } catch {
      generation.current += 1;
      await release();
      try {
        await dependencies.requestPermissionIntent(false);
      } catch {
        // The one-shot main-process permission intent also expires automatically.
      }
      setSafeState({
        ...INITIAL_STATE,
        camera: "error",
        model: "error",
        error: "Không thể mở camera cho điều khiển cử chỉ.",
      });
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      void releaseRef.current();
    };
  }, []);

  return {
    state,
    enable,
    pause: () => stopWithState("paused"),
    stop: () => stopWithState("off"),
  } as const;
}
