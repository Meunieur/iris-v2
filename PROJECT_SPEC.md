# Iris v2 — Product Specification

**Status:** proposed constitution, implementation-ready for the first spike  
**Owner:** product owner of JarvisOS / Iris v2  
**Last reviewed:** 2026-07-24

## 1. Objective

Build a desktop operator system that feels like Iris at the surface and thinks
and acts like JarvisOS underneath.

Iris v2 must provide:

- Iris's Electron/React transparent HUD, Glass UI language, task reader and
  hand-gesture interaction model.
- A smooth Gemini Live conversation plane for voice, interruption and natural
  language.
- JarvisOS's complete operator plane: skills, tools, MCP, workflows, agents,
  sessions, second brain, memory, vault, files, media and galaxy knowledge
  view, including the newest capabilities available in the canonical JarvisOS
  runtime at integration time.
- A guarded path for Hermes capabilities that add real value without creating a
  second brain, a second policy engine or an unreviewed tool escape hatch.

The end state is one principal operator system, not three loosely connected
assistants. Iris v2 owns how the operator experiences the system; JarvisOS owns
what the system is allowed to know and do.

## 2. Product principles

1. **One brain, one authority.** JarvisOS is the canonical source for brain
   selection, memory, vault, sessions, tools, skills, policy and audit.
2. **Conversation is not execution.** Gemini may understand, narrate and
   propose. JarvisOS validates and executes.
3. **Local-first by default.** Camera frames, gesture inference, transcripts and
   sensitive context stay local unless a clearly disclosed provider operation
   requires otherwise.
4. **Visible agency.** Every meaningful operation has a visible lifecycle:
   proposed, awaiting approval, running, completed, failed or cancelled.
5. **Composable ownership.** Reuse interfaces and assets; do not merge large
   applications until ownership, licensing and failure behavior are explicit.
6. **Recoverable state.** A crashed renderer, voice provider or optional Hermes
   worker must not corrupt the Jarvis brain or leave an invisible running task.

## 3. Primary user stories

### Conversation and control

- The operator opens Iris v2 and sees connection, brain and session state before
  speaking.
- The operator talks naturally with Gemini Live, interrupts it, changes topic,
  and resumes the current task without losing context.
- Gemini recognizes a requested operation and displays a concise proposal before
  JarvisOS executes anything with a non-trivial side effect.
- The operator can stop an active task from voice, HUD button or gesture.

### HUD and gestures

- A transparent always-on-top HUD remains unobtrusive and click-through except
  for deliberate interactive zones.
- Point-and-hold selects/clicks; open palm scrolls; two palms resize a reader;
  closed fist dismisses the reader. Gesture confidence and camera status are
  visible and never silently treated as authorization.
- Camera permission, model loading and privacy state are explicit. No camera
  frame is uploaded by the gesture subsystem.

### Jarvis operator surface

- The operator switches Jarvis brains and sessions from Iris v2 without creating
  a local shadow database.
- Live Jarvis events appear as task cards, tool steps, streamed response text,
  completion and errors.
- Memory, files, skill/tool catalogs and the galaxy knowledge graph are browsable
  in views designed for the HUD rather than merely embedded as a raw dashboard.
- Background work exposes progress, logs, cancellation and recovery state.

### Capability growth

- New Jarvis skills and tools become discoverable through the canonical registry.
- Hermes-derived capability packs can be enabled per environment only after
  provenance, permission, compatibility and rollback checks pass.
- The operator can see which provider, skill, tool and policy produced an action.

## 4. Scope

### In scope for Iris v2

- Electron desktop shell and secure preload boundary.
- React/TypeScript HUD, Glass UI, task reader, session/brain controls and
  galaxy knowledge view.
- Local MediaPipe gesture runtime with pinned assets and normalized gesture
  events.
- Gemini Live conversation adapter, transcript state and interruption UX.
- A typed JarvisOS REST/WebSocket adapter and event normalizer.
- Capability proposal/approval envelope and visible audit state.
- Packaging, managed JarvisOS discovery/startup, recovery and migration checks.
- Selective, optional Hermes capability packs described in the roadmap.

### Explicitly out of scope for the first implementation

- Rewriting the JarvisOS Python backend or moving its data stores.
- A new Iris-owned second brain, memory database, vault or session authority.
- Direct Gemini tool execution that bypasses JarvisOS policy.
- A wholesale Hermes fork or blind copying of Hermes's provider/runtime tree.
- Automatic publishing, purchasing, messaging or other external side effects
  without an explicit policy and approval path.

## 5. Technical baseline

| Layer | Baseline | Constraint |
|---|---|---|
| Desktop | Electron, secure BrowserWindow, narrow preload | `contextIsolation`, `nodeIntegration:false`, sandbox where compatible, sender/origin validation |
| UI | React + TypeScript + Vite | Keep renderer free of secrets, filesystem and unrestricted shell access |
| HUD | Iris-derived transparent window and Glass components | Click-through by default; interactive regions are explicit |
| Gesture | `@mediapipe/tasks-vision` with local WASM/model assets | Pin versions/assets; camera is opt-in and local-only |
| Conversation | Gemini Live via a dedicated main-process/service adapter | Credentials stay in the runtime boundary; reconnect and fallback are required |
| Operator backend | Existing JarvisOS FastAPI REST/WebSocket runtime | One canonical process/data root; adapter normalizes events |
| Optional capability source | Hermes skills/tools/services | Feature-flagged, provenance-checked, policy-gated and reversible |

Exact dependency versions must be pinned in the implementation repository. Do
not retain Iris's CDN model/WASM dependency in production.

## 6. Intended project structure

```text
Iris v2/
├── AGENTS.md
├── README.md
├── PROJECT_SPEC.md
├── ARCHITECTURE.md
├── DESIGN.md
├── SECURITY.md
├── INTEGRATION_MATRIX.md
├── ROADMAP.md
├── THIRD_PARTY_NOTICES.md
├── .gitignore
├── apps/
│   └── desktop/                 # Electron main/preload + React renderer
├── packages/
│   ├── contracts/               # shared normalized types and schemas
│   ├── gesture-runtime/         # local MediaPipe adapter
│   ├── jarvis-adapter/          # REST/WS client and event normalization
│   ├── gemini-bridge/           # conversation plane and proposal bridge
│   ├── hud-ui/                  # Iris-derived visual components
│   └── capability-policy/       # envelope, risk and approval client state
├── docs/
│   ├── contracts/
│   ├── decisions/
│   └── research/
└── tests/
    ├── contract/
    ├── integration/
    ├── security/
    └── e2e/
```

The structure is directional, not permission to create empty packages before
their contracts are tested. A vertical slice may keep modules together until a
real boundary emerges.

## 7. Development commands (target)

These commands become executable after the Phase 1 scaffold lands:

```text
npm install
npm run dev
npm run lint
npm test
npm run test:integration
npm run build
npm run package:win
```

Each command must document whether it needs a running JarvisOS backend, camera
permission, Gemini credentials or an optional Hermes service. No command may
silently contact a remote provider during a unit-test run.

## 8. Testing strategy

- **Contract tests:** validate Jarvis REST/WS payloads, reconnects, event order,
  cancellation and schema rejection using fixtures.
- **Unit tests:** gesture stabilization, coordinate mapping, envelope lifecycle,
  transcript state, risk classification and adapter normalization.
- **Security tests:** preload exposure, sender validation, path traversal,
  secret redaction, origin navigation, camera permission and prompt-injection
  attempts that try to bypass approval.
- **Integration tests:** connect to a disposable/local JarvisOS instance and
  verify health → session → turn → tool events → completion.
- **E2E/runtime tests:** launch the packaged shell, check click-through/interactive
  HUD behavior, camera opt-in, reconnect and clean shutdown.
- **Human acceptance:** verify voice interruption, gesture ergonomics, readable
  Vietnamese text, approval clarity and recovery from a killed provider.

## 9. Boundaries

### Always

- Reuse JarvisOS APIs and data roots instead of inventing shadow state.
- Show source, risk and approval status for side-effecting actions.
- Keep third-party notices and pinned asset provenance with the build.
- Prefer local fixtures and deterministic tests before live-provider tests.

### Ask for explicit approval first

- Sending messages, publishing content, buying, deleting, authenticating to a
  new account, changing security policy or enabling a new Hermes pack.
- Changing JarvisOS data migrations, backend ownership, default brain or secret
  storage.
- Adding a remote camera/voice/telemetry provider.

### Never

- Put Gemini, Jarvis or provider secrets in renderer state, logs or URLs.
- Let a gesture, transcript or model output alone authorize a high-risk action.
- Run two Jarvis backends against the same data root.
- silently upload camera frames or copy the complete Hermes/Jarvis brain into
  Iris v2.

## 10. Definition of success

The first release candidate is successful when a fresh machine can launch Iris
v2, connect to exactly one JarvisOS runtime, hold a Gemini conversation, display
live task/tool events, switch brains and sessions, inspect memory/graph state,
use local gestures, request a guarded action, stop it, recover from disconnect,
and leave no secrets or duplicate data behind. The packaged app must make the
same ownership and approval states visible as development mode.

## 11. Approved Phase 0 decisions and later gates

The product owner approved the Phase 0 decision set on 2026-07-24:

1. the production direction is a standalone Iris v2 executable, with
   attached-only Phase 1;
2. the source JarvisOS data root remains canonical and is not migrated to
   AppData;
3. REST/WebSocket credentials belong only in a tested main-process broker;
4. the current default brain remains unchanged and is represented by opaque ID;
5. telemetry is off by default; and
6. managed mode, Gemini credentials, and every Hermes pack remain disabled
   until later explicit gates.

Later phases must still obtain the exact approvals required by the roadmap for
managed lifecycle, provider credentials, Hermes packs, side effects, packaging
promotion, and default/autostart changes.
