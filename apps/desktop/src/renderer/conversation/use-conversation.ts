import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ConversationEvent,
  ConversationMicrophoneState,
  ConversationSnapshot,
} from "@iris/gemini-bridge";
import { pcm16BytesToFloat32, resampleFloat32ToPcm16 } from "./audio.js";

const EMPTY_SNAPSHOT: ConversationSnapshot = Object.freeze({
  sequence: 0,
  provider: "gemini",
  model: "gemini-3.1-flash-live-preview",
  state: "disabled",
  microphone: "off",
  remoteStreaming: false,
  inputTranscript: "",
  outputTranscript: "",
  cost: "unavailable",
});

type CaptureResources = Readonly<{
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  mute: GainNode;
}>;

function preferNewer(current: ConversationSnapshot, next: ConversationSnapshot): ConversationSnapshot {
  return next.sequence >= current.sequence ? next : current;
}

function stopCapture(resources: CaptureResources | undefined): void {
  if (resources === undefined) return;
  resources.processor.onaudioprocess = null;
  resources.source.disconnect();
  resources.processor.disconnect();
  resources.mute.disconnect();
  for (const track of resources.stream.getTracks()) track.stop();
  void resources.context.close().catch(() => undefined);
}

export function useConversation(enabled = true) {
  const [state, setState] = useState<ConversationSnapshot>(EMPTY_SNAPSHOT);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const capture = useRef<CaptureResources | undefined>(undefined);
  const playbackContext = useRef<AudioContext | undefined>(undefined);
  const playbackSources = useRef(new Set<AudioBufferSourceNode>());
  const playbackEnd = useRef(0);

  const stopPlayback = useCallback(() => {
    for (const source of playbackSources.current) {
      try { source.stop(); } catch { /* source may have completed */ }
      source.disconnect();
    }
    playbackSources.current.clear();
    playbackEnd.current = 0;
  }, []);

  const playAudio = useCallback((pcm16: Uint8Array, sampleRate: number) => {
    if (typeof AudioContext === "undefined") return;
    try {
      const context = playbackContext.current ?? new AudioContext({ sampleRate });
      playbackContext.current = context;
      const floats = pcm16BytesToFloat32(pcm16);
      const buffer = context.createBuffer(1, floats.length, sampleRate);
      buffer.getChannelData(0).set(floats);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const startAt = Math.max(context.currentTime, playbackEnd.current);
      playbackEnd.current = startAt + buffer.duration;
      playbackSources.current.add(source);
      source.onended = () => {
        playbackSources.current.delete(source);
        source.disconnect();
      };
      source.start(startAt);
    } catch {
      setNotice("Không thể phát âm thanh Gemini.");
    }
  }, []);

  const applySnapshot = useCallback((next: ConversationSnapshot) => {
    setState((current) => preferNewer(current, next));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const dispose = window.iris.onConversationEvent((event: ConversationEvent) => {
      if (!active) return;
      if (event.type === "snapshot") applySnapshot(event.snapshot);
      else if (event.type === "audio_output") playAudio(event.pcm16, event.sampleRate);
      else if (event.type === "interrupted") stopPlayback();
    });
    void window.iris.getConversationSnapshot()
      .then((next) => { if (active) applySnapshot(next); })
      .catch(() => { if (active) setNotice("Không thể đọc trạng thái hội thoại."); });
    return () => {
      active = false;
      dispose();
      stopCapture(capture.current);
      capture.current = undefined;
      stopPlayback();
      const context = playbackContext.current;
      playbackContext.current = undefined;
      void context?.close().catch(() => undefined);
      void window.iris.stopConversation().catch(() => undefined);
    };
  }, [applySnapshot, enabled, playAudio, stopPlayback]);

  const beginCapture = useCallback(async (): Promise<boolean> => {
    if (typeof navigator.mediaDevices?.getUserMedia !== "function" || typeof AudioContext === "undefined") {
      setNotice("Thiết bị không hỗ trợ microphone cục bộ.");
      return false;
    }
    await window.iris.requestMicrophonePermissionIntent(true);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch {
      await window.iris.requestMicrophonePermissionIntent(false).catch(() => undefined);
      await window.iris.setMicrophoneState("blocked").catch(() => undefined);
      setNotice("Microphone chưa được cấp quyền.");
      return false;
    }

    try {
      const context = new AudioContext({ sampleRate: 16_000 });
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4_096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;
      processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        const pcm16 = resampleFloat32ToPcm16(channel, event.inputBuffer.sampleRate, 16_000);
        void window.iris.sendConversationAudio(pcm16).catch(() => undefined);
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      capture.current = { stream, context, source, processor, mute };
      applySnapshot(await window.iris.setMicrophoneState("active"));
      return true;
    } catch {
      for (const track of stream.getTracks()) track.stop();
      await window.iris.setMicrophoneState("blocked").catch(() => undefined);
      setNotice("Không thể khởi tạo đường thu microphone.");
      return false;
    }
  }, [applySnapshot]);

  const start = useCallback(async () => {
    setBusy(true);
    setNotice(undefined);
    try {
      const next = await window.iris.startConversation();
      applySnapshot(next);
      if (next.state === "disabled" || next.state === "missing_credentials" || next.state === "error" || next.state === "degraded") return;
      await beginCapture();
    } catch {
      setNotice("Không thể bắt đầu hội thoại Gemini.");
    } finally {
      setBusy(false);
    }
  }, [applySnapshot, beginCapture]);

  const stop = useCallback(async () => {
    setBusy(true);
    stopCapture(capture.current);
    capture.current = undefined;
    await window.iris.requestMicrophonePermissionIntent(false).catch(() => undefined);
    try { applySnapshot(await window.iris.stopConversation()); } catch { setNotice("Không thể dừng hội thoại."); }
    finally { setBusy(false); }
  }, [applySnapshot]);

  const interrupt = useCallback(async () => {
    stopPlayback();
    try { applySnapshot(await window.iris.interruptConversation()); } catch { setNotice("Không thể ngắt lượt nói."); }
  }, [applySnapshot, stopPlayback]);

  const sendText = useCallback(async (text: string) => {
    try { await window.iris.sendConversationText(text); } catch { setNotice("Không thể gửi câu chữ vào hội thoại."); }
  }, []);

  const setMicrophone = useCallback(async (next: ConversationMicrophoneState) => {
    try { applySnapshot(await window.iris.setMicrophoneState(next)); } catch { setNotice("Không thể đổi trạng thái microphone."); }
  }, [applySnapshot]);

  return { state, busy, notice, start, stop, interrupt, sendText, setMicrophone };
}
