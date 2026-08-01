import { useEffect, useRef, useState } from "react";

import type { HudMode, HudNativeSnapshot } from "../../main/hud-native.js";

const INITIAL_NATIVE: HudNativeSnapshot = Object.freeze({
  mode: "deck",
  pointerInteractive: true,
  shortcutAvailable: false,
});

export function useHudNative() {
  const [snapshot, setSnapshot] = useState<HudNativeSnapshot>(INITIAL_NATIVE);
  const [error, setError] = useState<string>();
  const active = useRef(true);
  const latest = useRef(snapshot);
  const requestedPointer = useRef(snapshot.pointerInteractive);

  const accept = (next: HudNativeSnapshot) => {
    if (!active.current) return;
    latest.current = next;
    requestedPointer.current = next.pointerInteractive;
    setSnapshot(next);
  };

  useEffect(() => {
    active.current = true;
    const dispose = window.iris.onHudNativeSnapshot(accept);
    void window.iris.getHudNativeSnapshot()
      .then(accept)
      .catch(() => {
        if (active.current) setError("Không thể đồng bộ trạng thái cửa sổ HUD.");
      });
    return () => {
      active.current = false;
      dispose();
    };
  }, []);

  useEffect(() => {
    if (snapshot.mode !== "hud") return undefined;
    const onPointerMove = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const interactive = target?.closest(".hud-hit") !== null && target !== null;
      if (interactive === requestedPointer.current) return;
      requestedPointer.current = interactive;
      void window.iris.setPointerInteractive(interactive)
        .then(accept)
        .catch(() => {
          requestedPointer.current = latest.current.pointerInteractive;
          if (active.current) setError("Không thể cập nhật vùng tương tác HUD.");
        });
    };
    window.addEventListener("mousemove", onPointerMove, true);
    return () => window.removeEventListener("mousemove", onPointerMove, true);
  }, [snapshot.mode]);

  const setMode = async (mode: HudMode) => {
    setError(undefined);
    try {
      accept(await window.iris.setHudMode(mode));
    } catch {
      setError("Không thể chuyển chế độ HUD.");
    }
  };

  return { snapshot, error, setMode } as const;
}
