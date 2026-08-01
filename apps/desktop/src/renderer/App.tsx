import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GestureEvent } from "@iris/gesture-runtime";
import type { BrainSummary, JarvisTaskInput } from "@iris/contracts";
import type { JarvisKnowledgeSnapshot, JarvisReadSnapshot } from "@iris/jarvis-adapter";
import { useGestureCamera } from "./gesture/use-gesture-camera.js";
import { CommandDeck } from "./hud/CommandDeck.js";
import { DesktopHud } from "./hud/DesktopHud.js";
import { isGestureActionAllowed } from "./hud/policy.js";
import type { ReaderView } from "./hud/types.js";
import { useHudNative } from "./hud/use-hud-native.js";
import { useConversation } from "./conversation/use-conversation.js";
import { useJarvisTask } from "./task/use-jarvis-task.js";
import { EXPERIMENTAL_SURFACES_ENABLED } from "./surface-flags.js";

const EMPTY_SNAPSHOT: JarvisReadSnapshot = Object.freeze({
  sequence: 0,
  capturedAt: "",
  endpoint: "",
  connection: "connecting",
  health: Object.freeze({
    status: "offline",
    authRequired: true,
    authenticated: false,
  }),
  brains: Object.freeze([]),
  sessions: Object.freeze([]),
});

function preferNewer(current: JarvisReadSnapshot, next: JarvisReadSnapshot): JarvisReadSnapshot {
  return next.sequence >= current.sequence ? next : current;
}

function readerFor(id: string | undefined, snapshot: JarvisReadSnapshot, width: number): ReaderView | undefined {
  if (id === undefined) return undefined;
  if (id === "runtime") {
    return {
      id,
      eyebrow: "Nguồn duy nhất",
      title: "Runtime JarvisOS",
      width,
      paragraphs: [
        `Kết nối hiện tại: ${snapshot.connection}.`,
        `Health: ${snapshot.health?.status ?? "đang kiểm tra"}; phiên bản ${snapshot.health?.version ?? "chưa rõ"}.`,
        "Iris chỉ gắn vào một runtime JarvisOS và không sở hữu dữ liệu brain, vault hay session.",
      ],
    };
  }
  if (id === "brain") {
    const brain = snapshot.brains.find((item) => item.isDefault) ?? snapshot.brains[0];
    return {
      id,
      eyebrow: "Ngữ cảnh nhận thức",
      title: "Brain đang hoạt động",
      width,
      paragraphs: brain === undefined
        ? ["Chưa có brain nào được JarvisOS công bố cho Iris."]
        : [
          `${brain.name} có ${brain.notes} ghi chú được công bố.`,
          brain.isDefault ? "Đây là brain mặc định của runtime hiện tại." : "Đây là brain khả dụng đầu tiên.",
          "Iris không đọc đường dẫn, nội dung riêng tư hay dữ liệu vault của brain.",
        ],
    };
  }
  if (id === "session") {
    const sessions = snapshot.sessions.slice(0, 5);
    return {
      id,
      eyebrow: "Chỉ mục công khai",
      title: "Phiên gần đây",
      width,
      paragraphs: sessions.length === 0
        ? ["Chưa có phiên nào để hiển thị."]
        : sessions.map((session) => (
          `${session.title || "Phiên chưa đặt tên"} · ${session.engine ?? "engine chưa rõ"} · ${session.model ?? "model chưa rõ"} · ${session.messageCount ?? 0} tin nhắn.`
        )),
    };
  }
  return undefined;
}

function clampReaderWidth(value: number): number {
  return Math.min(420, Math.max(320, Math.round(value)));
}

export function App() {
  const [snapshot, setSnapshot] = useState<JarvisReadSnapshot>(EMPTY_SNAPSHOT);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [readerId, setReaderId] = useState<string>();
  const [readerWidth, setReaderWidth] = useState(360);
  const [selectedKnowledgeBrainId, setSelectedKnowledgeBrainId] = useState<BrainSummary["id"]>();
  const [knowledge, setKnowledge] = useState<JarvisKnowledgeSnapshot | Readonly<{ state: "idle" | "loading" }>>({ state: "idle" });
  const [knowledgeBusy, setKnowledgeBusy] = useState(false);
  const [knowledgeNotice, setKnowledgeNotice] = useState<string>();
  const native = useHudNative();
  const conversation = useConversation(EXPERIMENTAL_SURFACES_ENABLED);
  const task = useJarvisTask(EXPERIMENTAL_SURFACES_ENABLED);
  const gestureControl = useRef<{ pause(): Promise<void> } | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const dispose = window.iris.onSnapshot((next) => {
      if (active) setSnapshot((current) => preferNewer(current, next));
    });
    void window.iris.getSnapshot()
      .then((next) => {
        if (active) setSnapshot((current) => preferNewer(current, next));
      })
      .catch(() => {
        if (active) setNotice("Không thể đọc trạng thái JarvisOS.");
      });
    return () => {
      active = false;
      dispose();
    };
  }, []);

  const onGestureEvent = useCallback((event: GestureEvent) => {
    if (event.type === "select") {
      if (!isGestureActionAllowed(event.targetId)) return;
      if (event.targetId.startsWith("reader.open.")) {
        setReaderId(event.targetId.slice("reader.open.".length));
        setReaderWidth(360);
      } else if (event.targetId === "reader.close") {
        setReaderId(undefined);
      } else if (event.targetId === "gesture.pause") {
        void gestureControl.current?.pause();
      }
      return;
    }
    if (event.type === "scroll") {
      document.querySelector<HTMLElement>("[data-reader-scroll]")?.scrollBy({
        top: event.deltaY,
        behavior: "auto",
      });
    } else if (event.type === "scale") {
      setReaderWidth(clampReaderWidth(360 * event.factor));
    } else if (event.type === "dismiss") {
      setReaderId(undefined);
    }
  }, []);

  const gesture = useGestureCamera({ onEvent: onGestureEvent });
  gestureControl.current = { pause: gesture.pause };
  const reader = useMemo(
    () => readerFor(readerId, snapshot, readerWidth),
    [readerId, readerWidth, snapshot],
  );

  useEffect(() => {
    const selectedStillExists = snapshot.brains.some((brain) => brain.id === selectedKnowledgeBrainId);
    if (selectedStillExists) return;
    const next = snapshot.brains.find((brain) => brain.isDefault) ?? snapshot.brains[0];
    setSelectedKnowledgeBrainId(next?.id);
    setKnowledge(snapshot.connection === "sign_in_required"
      ? { state: "sign_in_required", capturedAt: snapshot.capturedAt }
      : { state: "idle" });
  }, [selectedKnowledgeBrainId, snapshot.brains, snapshot.capturedAt, snapshot.connection]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && readerId === undefined && native.snapshot.mode === "deck") {
        void native.setMode("hud");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [native, readerId]);

  const refresh = async () => {
    setRefreshing(true);
    setNotice(undefined);
    try {
      const next = await window.iris.refresh();
      setSnapshot((current) => preferNewer(current, next));
    } catch {
      setNotice("Không thể làm mới trạng thái JarvisOS.");
    } finally {
      setRefreshing(false);
    }
  };

  const signIn = async () => {
    setNotice(undefined);
    try {
      await window.iris.openSignIn();
    } catch {
      setNotice("Không thể mở cửa sổ đăng nhập JarvisOS.");
    }
  };

  const loadKnowledge = async () => {
    if (selectedKnowledgeBrainId === undefined) return;
    setKnowledgeBusy(true);
    setKnowledgeNotice(undefined);
    setKnowledge({ state: "loading" });
    try {
      setKnowledge(await window.iris.loadKnowledge(selectedKnowledgeBrainId));
    } catch {
      setKnowledge({
        state: "unavailable",
        capturedAt: new Date().toISOString(),
        errorCode: "invalid_response",
      });
      setKnowledgeNotice("Không thể tải Second Brain qua cầu nối Iris.");
    } finally {
      setKnowledgeBusy(false);
    }
  };

  const common = {
    snapshot,
    native: native.snapshot,
    gesture: gesture.state,
    reader,
    refreshing,
    notice: notice ?? native.error,
    onOpenReader: (id: string) => {
      setReaderId(id);
      setReaderWidth(360);
    },
    onCloseReader: () => setReaderId(undefined),
    onRefresh: () => { void refresh(); },
    onSignIn: () => { void signIn(); },
    onEnableGesture: () => { void gesture.enable(); },
    onPauseGesture: () => { void gesture.pause(); },
    onStopGesture: () => { void gesture.stop(); },
    conversation: EXPERIMENTAL_SURFACES_ENABLED ? conversation.state : undefined,
    conversationBusy: EXPERIMENTAL_SURFACES_ENABLED ? conversation.busy : undefined,
    conversationNotice: EXPERIMENTAL_SURFACES_ENABLED ? conversation.notice : undefined,
    onStartConversation: EXPERIMENTAL_SURFACES_ENABLED ? () => { void conversation.start(); } : undefined,
    onStopConversation: EXPERIMENTAL_SURFACES_ENABLED ? () => { void conversation.stop(); } : undefined,
    onInterruptConversation: EXPERIMENTAL_SURFACES_ENABLED ? () => { void conversation.interrupt(); } : undefined,
    onSendConversationText: EXPERIMENTAL_SURFACES_ENABLED ? (text: string) => { void conversation.sendText(text); } : undefined,
    knowledge,
    selectedKnowledgeBrainId,
    knowledgeBusy,
    knowledgeNotice,
    onSelectKnowledgeBrain: (brainId: BrainSummary["id"]) => {
      setSelectedKnowledgeBrainId(brainId);
      setKnowledge({ state: "idle" });
      setKnowledgeNotice(undefined);
    },
    onLoadKnowledge: () => { void loadKnowledge(); },
    task: EXPERIMENTAL_SURFACES_ENABLED ? task.state : undefined,
    taskBusy: EXPERIMENTAL_SURFACES_ENABLED ? task.busy : undefined,
    taskNotice: EXPERIMENTAL_SURFACES_ENABLED ? task.notice : undefined,
    onSelectTaskBrain: (brainId: BrainSummary["id"]) => {
      setSelectedKnowledgeBrainId(brainId);
    },
    onSendTask: EXPERIMENTAL_SURFACES_ENABLED ? (input: JarvisTaskInput) => { void task.send(input); } : undefined,
    onStopTask: EXPERIMENTAL_SURFACES_ENABLED ? () => { void task.stop(); } : undefined,
  };

  return native.snapshot.mode === "hud"
    ? <DesktopHud {...common} onToggleDeck={() => { void native.setMode("deck"); }} />
    : <CommandDeck {...common} onToggleHud={() => { void native.setMode("hud"); }} />;
}
