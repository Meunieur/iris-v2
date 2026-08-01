import { CameraDock } from "./CameraDock.js";
import { CommandIcon, RefreshIcon } from "./icons.js";
import { GestureReticle } from "./GestureReticle.js";
import { OrbStatusAnchor } from "./OrbStatusAnchor.js";
import { ReaderOverlay } from "./ReaderOverlay.js";
import { StatusStack } from "./StatusStack.js";
import type { HudSurfaceActions, HudSurfaceState } from "./types.js";
import { ConversationDock } from "../conversation/ConversationDock.js";

type DesktopHudProps = HudSurfaceState & HudSurfaceActions & Readonly<{ onToggleDeck(): void }>;

export function DesktopHud(props: DesktopHudProps) {
  const conversation = props.conversation;
  return (
    <main className="desktop-hud" data-hud-mode="hud">
      <div className="hud-safe-zone" aria-hidden="true" />
      <header className="hud-topline">
        <span className="brand-mark"><i /> IRIS V2</span>
        <span className="shortcut-hint">Ctrl + Shift + Space</span>
      </header>
      <div className="hud-right-rail">
        <div className="hud-toolbar hud-hit">
          <button type="button" className="icon-button" aria-label="Làm mới trạng thái" onClick={props.onRefresh} disabled={props.refreshing}><RefreshIcon /></button>
          {props.snapshot.connection === "sign_in_required" ? <button type="button" className="text-button" onClick={props.onSignIn}>Đăng nhập JarvisOS</button> : null}
          <button type="button" className="icon-button" aria-label="Mở Command Deck" onClick={props.onToggleDeck}><CommandIcon /></button>
        </div>
        <StatusStack snapshot={props.snapshot} onOpenReader={props.onOpenReader} />
      </div>
      <div className="hud-left-rail">
        <CameraDock gesture={props.gesture} onEnable={props.onEnableGesture} onPause={props.onPauseGesture} onStop={props.onStopGesture} />
        {conversation ? <div className="hud-conversation hud-hit"><ConversationDock state={conversation} busy={props.conversationBusy ?? false} notice={props.conversationNotice} compact onStart={props.onStartConversation ?? (() => undefined)} onStop={props.onStopConversation ?? (() => undefined)} onInterrupt={props.onInterruptConversation ?? (() => undefined)} onSendText={props.onSendConversationText ?? (() => undefined)} /></div> : null}
      </div>
      <OrbStatusAnchor snapshot={props.snapshot} />
      {props.notice ? <div className="hud-notice glass-chip" role="alert">{props.notice}</div> : null}
      {props.reader ? <ReaderOverlay reader={props.reader} onClose={props.onCloseReader} /> : null}
      {props.gesture.primaryReticle ? <GestureReticle reticle={props.gesture.primaryReticle} /> : null}
      {props.gesture.secondaryReticle ? <GestureReticle reticle={props.gesture.secondaryReticle} secondary /> : null}
    </main>
  );
}
