import { useEffect, useRef, type CSSProperties } from "react";
import { CloseIcon } from "./icons.js";
import type { ReaderView } from "./types.js";

export function ReaderOverlay({ reader, onClose }: { reader: ReaderView; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const style = { "--reader-width": `${reader.width}px` } as CSSProperties;
  return (
    <aside className="reader-overlay glass-panel elevated hud-hit" aria-labelledby="reader-title" style={style}>
      <header className="reader-header">
        <div><p className="micro-label">{reader.eyebrow}</p><h2 id="reader-title">{reader.title}</h2></div>
        <button ref={closeRef} type="button" className="icon-button" data-gesture-action="reader.close" aria-label="Đóng bảng đọc" onClick={onClose}><CloseIcon /></button>
      </header>
      <div className="reader-scroll" data-reader-scroll>
        {reader.paragraphs.map((paragraph, index) => <p key={`${reader.id}-${index}`}>{paragraph}</p>)}
      </div>
      <footer className="reader-footer"><span>Open palm · cuộn</span><span>Hai lòng bàn tay · đổi kích thước</span><span>Nắm tay · đóng</span></footer>
    </aside>
  );
}
