const IPC_CHANNELS = Object.freeze({
  getSnapshot: "iris:jarvis:get-snapshot",
  refresh: "iris:jarvis:refresh",
  openSignIn: "iris:jarvis:open-sign-in",
  snapshot: "iris:jarvis:snapshot",
  loadKnowledge: "iris:jarvis:load-knowledge",
  getTaskSnapshot: "iris:task:get-snapshot",
  sendTurn: "iris:task:send-turn",
  stopTurn: "iris:task:stop-turn",
  taskSnapshot: "iris:task:snapshot",
  getHudNativeSnapshot: "iris:hud:get-native-snapshot",
  setHudMode: "iris:hud:set-mode",
  setPointerInteractive: "iris:hud:set-pointer-interactive",
  requestGesturePermissionIntent: "iris:hud:request-gesture-permission-intent",
  hudNativeSnapshot: "iris:hud:native-snapshot",
  getConversationSnapshot: "iris:conversation:get-snapshot",
  startConversation: "iris:conversation:start",
  stopConversation: "iris:conversation:stop",
  setMicrophoneState: "iris:conversation:set-microphone-state",
  requestMicrophonePermissionIntent: "iris:conversation:request-microphone-permission-intent",
  sendConversationAudio: "iris:conversation:send-audio",
  sendConversationText: "iris:conversation:send-text",
  interruptConversation: "iris:conversation:interrupt",
  conversationSnapshot: "iris:conversation:snapshot",
  conversationEvent: "iris:conversation:event",
});

function createRendererApi(ipc) {
  return Object.freeze({
    getSnapshot: () => ipc.invoke(IPC_CHANNELS.getSnapshot),
    refresh: () => ipc.invoke(IPC_CHANNELS.refresh),
    openSignIn: () => ipc.invoke(IPC_CHANNELS.openSignIn),
    loadKnowledge: (brainId) => ipc.invoke(IPC_CHANNELS.loadKnowledge, brainId),
    getTaskSnapshot: () => ipc.invoke(IPC_CHANNELS.getTaskSnapshot),
    sendTurn: (input) => ipc.invoke(IPC_CHANNELS.sendTurn, input),
    stopTurn: () => ipc.invoke(IPC_CHANNELS.stopTurn),
    onTaskSnapshot: (listener) => {
      const wrapped = (_event, snapshot) => listener(snapshot);
      ipc.on(IPC_CHANNELS.taskSnapshot, wrapped);
      return () => ipc.removeListener(IPC_CHANNELS.taskSnapshot, wrapped);
    },
    onSnapshot: (listener) => {
      const wrapped = (_event, snapshot) => listener(snapshot);
      ipc.on(IPC_CHANNELS.snapshot, wrapped);
      return () => ipc.removeListener(IPC_CHANNELS.snapshot, wrapped);
    },
    getHudNativeSnapshot: () => ipc.invoke(IPC_CHANNELS.getHudNativeSnapshot),
    setHudMode: (mode) => ipc.invoke(IPC_CHANNELS.setHudMode, mode),
    setPointerInteractive: (interactive) => ipc.invoke(IPC_CHANNELS.setPointerInteractive, interactive),
    requestGesturePermissionIntent: (enabled) => ipc.invoke(IPC_CHANNELS.requestGesturePermissionIntent, enabled),
    onHudNativeSnapshot: (listener) => {
      const wrapped = (_event, snapshot) => listener(snapshot);
      ipc.on(IPC_CHANNELS.hudNativeSnapshot, wrapped);
      return () => ipc.removeListener(IPC_CHANNELS.hudNativeSnapshot, wrapped);
    },
    getConversationSnapshot: () => ipc.invoke(IPC_CHANNELS.getConversationSnapshot),
    startConversation: () => ipc.invoke(IPC_CHANNELS.startConversation),
    stopConversation: () => ipc.invoke(IPC_CHANNELS.stopConversation),
    setMicrophoneState: (state) => ipc.invoke(IPC_CHANNELS.setMicrophoneState, state),
    requestMicrophonePermissionIntent: (enabled) => ipc.invoke(IPC_CHANNELS.requestMicrophonePermissionIntent, enabled),
    sendConversationAudio: (chunk) => ipc.invoke(IPC_CHANNELS.sendConversationAudio, chunk),
    sendConversationText: (text) => ipc.invoke(IPC_CHANNELS.sendConversationText, text),
    interruptConversation: () => ipc.invoke(IPC_CHANNELS.interruptConversation),
    onConversationEvent: (listener) => {
      const wrapped = (_event, event) => listener(event);
      ipc.on(IPC_CHANNELS.conversationEvent, wrapped);
      return () => ipc.removeListener(IPC_CHANNELS.conversationEvent, wrapped);
    },
  });
}

module.exports = { IPC_CHANNELS, createRendererApi };
