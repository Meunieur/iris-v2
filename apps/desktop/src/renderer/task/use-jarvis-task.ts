import { useCallback, useEffect, useState } from "react";

import type { JarvisTaskInput } from "@iris/contracts";
import type { JarvisTaskControllerSnapshot } from "@iris/jarvis-adapter";

const EMPTY_TASK: JarvisTaskControllerSnapshot = Object.freeze({
  sequence: 0,
  capturedAt: "1970-01-01T00:00:00.000Z",
  connection: "idle",
});

function preferNewer(
  current: JarvisTaskControllerSnapshot,
  next: JarvisTaskControllerSnapshot,
): JarvisTaskControllerSnapshot {
  return next.sequence >= current.sequence ? next : current;
}

export function useJarvisTask(enabled = true) {
  const [state, setState] = useState<JarvisTaskControllerSnapshot>(EMPTY_TASK);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const dispose = window.iris.onTaskSnapshot((next) => {
      if (active) setState((current) => preferNewer(current, next));
    });
    void window.iris.getTaskSnapshot()
      .then((next) => {
        if (active) setState((current) => preferNewer(current, next));
      })
      .catch(() => {
        if (active) setNotice("Không thể đọc trạng thái tác vụ Jarvis.");
      });
    return () => {
      active = false;
      dispose();
    };
  }, [enabled]);

  const send = useCallback(async (input: JarvisTaskInput) => {
    setBusy(true);
    setNotice(undefined);
    try {
      const next = await window.iris.sendTurn(input);
      setState((current) => preferNewer(current, next));
      return next;
    } catch {
      setNotice("Không thể gửi tác vụ R0 qua cầu nối Jarvis.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setBusy(true);
    setNotice(undefined);
    try {
      const next = await window.iris.stopTurn();
      setState((current) => preferNewer(current, next));
      return next;
    } catch {
      setNotice("Không thể xác nhận dừng tác vụ với Jarvis.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, notice, send, stop } as const;
}
