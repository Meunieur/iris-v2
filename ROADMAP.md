# Iris v2 — Implementation Roadmap

The roadmap is ordered by dependency and risk. Each phase is a vertical slice
that must leave the product runnable. “Inherited from JarvisOS” means surfaced
through a tested adapter, not copied into Iris v2.

## MVP Core — the completion target before extensions

The product owner simplified the project on 2026-08-01. Iris v2 reaches its
first meaningful completion when the default packaged surface can launch the
Electron HUD, attach to exactly one JarvisOS runtime, run the local gesture
state machine and load/search the sanitized Second Brain. This is the 90%
value path for the project; it is intentionally narrower than every capability
JarvisOS may eventually expose.

The default MVP surface is HUD + Command Deck + Jarvis health/auth/version +
opaque brains/sessions + explicit Second Brain load/search/density + camera-off
gesture controls and keyboard fallbacks. Gemini conversation, R0 task
execution, capability approval/catalog, workflow runs, MCP/provider actions,
memory/file detail, Hermes and managed runtime remain extension backlog. Their
existing code is preserved but advanced renderer panes are hidden unless local
development opts into `VITE_IRIS_EXPERIMENTAL=1`.

### MVP acceptance ladder

1. [x] `npm run test:mvp` passes without a live credential.
2. [x] `npm run build` and `npm run package:win` produce the application.
3. [x] `npm run probe:jarvis -- --repeat 2` proves one stable attached listener.
4. [x] A manual operator check opened HUD/Deck, signed in, loaded the Second
   Brain and confirmed the local search path; camera remained opt-in/off.
5. [x] `docs/execution/MVP_SCOPE.md`, this roadmap and the handoff record the
   remaining extension boundary.

Detailed Phase 6–8 plans below are retained as the post-MVP backlog. They do
not block the core completion gate and may begin only as separately contracted,
test-first slices.

## Phase 0 — Constitution and architecture characterization

**Goal:** freeze ownership and characterize the legacy read-only boundary before
an owner selects the production runtime host. Phase 0 does not create a second
lifecycle or authorize a Phase 1 shell.

### Tasks

1. [x] Record source/runtime provenance and the attached-first proposal.
2. [x] Freeze sanitized Phase 0 schemas and renderer-safe projections for
   health, auth status, version, brains, sessions, and legacy events. Omit
   raw structural backend path/credential-bearing fields; omit preview from
   both the public session type and projection until separately approved; and
   pre-bound, scan/redact, then final-bound renderer-visible free text as
   defense-in-depth, including bounded escaped-quote and cookie-line handling.
3. [x] Add a strict, resource-bounded local capability proposal schema with an
   iterative preflight before recursive validation, plain-object enforcement,
   Proxy/accessor and sparse-array rejection, incremental own-key enumeration
   that rejects a 65th entry before reading its value, and a frozen bounded
   snapshot that is validated instead of the original untrusted object.
4. [x] Add a read-only, two-sample attached-runtime identity probe that accepts
   only exact IPv4/IPv6 loopback bindings owned by one process.
5. [x] Assemble the checkpoint packet and stop for product-owner review.

**Acceptance criteria**

- JarvisOS is documented as the sole runtime/data/brain/policy owner; the
  production host proposal is not yet approved.
- Contract fixtures represent current sanitized legacy payloads, reject
  malformed/dangerous or over-budget proposal data, and render only explicit
  public fields. Raw renderer text is limited to 16 Ki UTF-16 code units before
  deterministic credential scanning and final output is limited to 16 KiB
  UTF-8. Covered credential assignments, authorization/token/PEM forms and
  source-boundary fragments redact without consuming deliberate Windows drive
  paths. Embedded escaped quotes and cookie lines/fields fail safely while
  preserving covered adjacent safe content. Unknown formats may remain; text
  stays untrusted.
- The probe proves a stable, attached, unauthenticated local runtime identity
  without altering it, and fails closed for wildcard, mixed, non-loopback, or
  multiple-owner listener bindings. Managed start/stop is not implemented or
  verified.

**Verification**

- [x] Run deterministic schemas, bounded projection/envelope, redaction, and
  loopback-listener probe tests.
- [x] Run one authorized two-sample read-only probe after the loopback-only
  listener commit `4995fd3` and a separate no-extra-listener scan. Preserve
  that historical evidence without rerunning it for later contract-only
  commits, including `5c56ddb`.
- [x] Product-owner review and approval of all six checkpoint items on
  2026-07-24.
- [ ] Authenticated protected-endpoint, renderer/backend crash recovery,
  packaged shell, provider/Gemini, gestures/media, managed lifecycle, and
  Hermes verification.

**Checkpoint:** `APPROVED_2026-07-24`. The owner approved:

1. standalone Iris v2 executable with attached-only Phase 1;
2. source JarvisOS data root remains canonical; no AppData migration;
3. main-process authenticated broker handles REST/WebSocket credentials;
4. current default brain remains unchanged and uses an opaque ID;
5. telemetry remains off by default;
6. managed mode, Gemini credentials, and every Hermes pack remain disabled
   until later explicit gates.

Phase 1 is authorized within those exact constraints. This approval does not
authorize managed mode, migration, renderer credentials, telemetry, Gemini,
Hermes, promotion, or side-effecting operator actions.

## Phase 1 — Secure shell and read-only Jarvis connection

**Goal:** launch a real Electron/React shell that safely reports Jarvis health,
brains and sessions.

### Tasks

1. [x] Scaffold Electron + React + TypeScript + Vite with pinned dependencies.
2. [x] Implement hardened BrowserWindow/preload APIs and navigation rules.
3. [x] Implement `JarvisAdapter.health`, `listBrains`, `listSessions` and reconnect
   state using mock fixtures first, then the local runtime.
4. [x] Render a minimal connection/brain/session HUD using `DESIGN.md` tokens.
5. [x] Add logs that identify mode, endpoint and protocol without secrets.

**Acceptance criteria**

- Renderer exposes no Node primitives, secrets or arbitrary IPC.
- The shell shows offline/connecting/ready and the canonical brain/session list.
- Restart/reconnect does not create a new backend or session unintentionally.

**Verification**

- [x] Unit and contract tests for adapter/schema/reconnect behavior.
- [x] Electron preload/navigation security tests.
- [x] Disposable loopback HTTP integration, production build, production audit,
  and Windows unpacked package creation.
- [x] Real local and packaged public smoke against Jarvis health/version/auth,
  restricted sign-in window, listener/process ownership, renderer reconnect,
  Iris shutdown, offline state, keyboard focus and target-scale HUD.
- [ ] Operator completes manual sign-in and verifies authenticated `ready` plus
  protected brain/session public projections. A 2026-07-31 login reached the
  protected boundary and exposed nullable legacy session titles; the resulting
  adapter bug is fixed and packaged, but the in-memory session was cleared by
  the rebuild, so a fresh post-fix login remains pending.

**Checkpoint:** `READY_FOR_PHASE_1_REVIEW`. The thin shell, restricted sign-in,
runtime ownership, renderer reload/shutdown recovery and packaged UI are
demonstrated. Manual operator login is the remaining human checkpoint action;
do not begin Phase 2 before review.

**Owner decision 2026-07-24:** Phase 1 accepted and Phase 2 authorized. The
manual authenticated protected projection check remains explicitly unverified;
acceptance does not manufacture that evidence.

## Phase 2 — Iris Glass HUD and local gesture runtime

**Goal:** own the Iris interaction surface independently of Gemini, Hermes and
side-effecting tools.

### Tasks

0. [x] Implement the approved dual-mode product shape: transparent edge-anchored
   Desktop HUD by default, with the same window expanding into an interactive
   Command Deck through a recoverable global shortcut.
1. [x] Port/rebuild HUD shell, task stack, reader, reticle and camera dock into
   isolated `hud-ui` components with retained MIT notices.
2. [x] Vendor/pin MediaPipe WASM and gesture model assets locally.
3. [x] Implement normalized `GestureEvent` types, confidence stabilization, dwell,
   cooldown and stale-data expiry.
4. [x] Implement point-and-hold select, open-palm reader scroll, two-palm resize and
   closed-fist dismiss with mouse/keyboard equivalents.
5. [x] Implement click-through default and explicit interactive hit regions.

**Design decision 2026-07-24:** the product owner approved direction 3, the
dual-mode Iris HUD plus Command Deck. Implementation follows the reviewed
[Phase 2 design specification](docs/superpowers/specs/2026-07-24-phase-2-glass-hud-gesture-design.md).

**Acceptance criteria**

- The app works without network access after dependencies/assets are installed.
- Camera remains off until enabled and stops when gesture mode is paused/closed.
- False or stale gestures cannot activate approval or destructive controls.
- HUD remains usable at common Windows DPI/scaling settings.

**Verification**

- [x] Deterministic gesture state-machine/coordinate tests with recorded landmark
  fixtures that contain no camera frames.
- [x] Fresh Windows package, local-asset/CSP policy, HUD/Deck shortcut, Escape,
  keyboard focus, safe-zone click-through, interactive HUD hit region,
  camera-off loopback/resource baseline, shutdown, stable single-Jarvis-runtime
  smoke test, and controlled renderer-scale checks at 125/150/200%.
- [x] Fresh operator-approved camera enable/pause/stop, camera-active CPU/GPU,
  and actual Windows 100/125/150% checks with a package restart at each changed
  scale.
- [ ] Point dwell, palm scroll, two-palm resize, fist dismiss, actual Windows
  200%, and secondary-monitor bounds/reticle mapping. The installed Parsec VDD
  cannot add a second display in the current host-only/free state while the
  physical display remains attached.

**Checkpoint:** `PHASE_2_MANUAL_ACCEPTANCE_DEFERRED`. Implementation and
deterministic verification are complete. The remote product owner directed the
project to continue on 2026-07-28; the manual items above remain explicitly
unverified debt rather than a pass. See the
[2026-07-28 verification report](docs/execution/reports/2026-07-28-phase-2-verification.md).

## Phase 3 — Gemini Live conversation bridge

**Goal:** deliver smooth realtime conversation while preserving Jarvis authority.

### Tasks

1. [x] Implement main-process/service Gemini credential and connection broker.
2. [x] Add voice input/output, interruption, transcript and reconnect state.
3. [x] Convert Gemini function-call/intent output to a validated capability proposal;
   do not bind any raw tool executor.
4. [x] Add visible provider, recording/listening and degraded-mode state. Surface
   latency/cost as unavailable until a provider supplies trustworthy values.
5. [x] Preserve the Jarvis text surface as the fallback path and expose
   provider/error state without claiming a side effect executed.

**Acceptance criteria**

- A natural voice turn can be interrupted and resumed.
- Credentials never reach renderer state or logs.
- A side-effect request stops at “proposal/approval required” until Jarvis
  accepts it.
- Provider loss leaves the active Jarvis session recoverable.

**Verification**

- [x] Mock provider tests for reconnect, malformed messages, timeouts,
  interruption and bounded audio/text input.
- [x] Proposal rejection tests for unsupported capabilities, missing Jarvis
  context and credential-bearing arguments.
- [ ] Live provider smoke test only after deterministic tests pass and the
  product owner explicitly supplies/authorizes credentials.

**Checkpoint:** human review of conversation quality, privacy state and proposal
UX before execution is connected.

**Sequencing note (2026-07-28):** the remote product owner directed work to
continue while the remaining Phase 2 physical checks are unavailable. Those
checks remain unverified debt rather than a pass. Phase 3 may be implemented
and deterministically verified with Gemini disabled by default; credentials,
live-provider smoke and this Phase 3 human checkpoint remain separately gated.

**Automated implementation status (2026-07-28):** complete for the
disabled-by-default bridge, fixed preload surface, microphone permission intent,
proposal-only Jarvis boundary, HUD/Deck conversation dock, deterministic tests,
Windows package verification and no-credential packaged launch smoke. No live
Gemini session, conversation-quality acceptance or Jarvis execution connection
is claimed.

## Phase 4 — Jarvis turn execution and live task stream

**Goal:** execute approved work through Jarvis and render trustworthy progress.

**Bounded slice status (2026-07-31):** deterministic implementation, review,
Windows packaging and packaged UI verification are complete. The first
vertical slice is deliberately R0 and
read-only-by-construction: a companion Jarvis branch owns versioned
submit/snapshot/stop routes, opaque brain resolution, UUID idempotency,
authoritative task/run/outcome state and a forced suggest-mode tool allowlist.
Iris owns strict public contracts, main-process reconciliation, fixed preload
methods and the Command Deck task card. The companion backend is not installed
into the live runtime; protected real-task, restart, mutation and Phase 6
approval gates remain closed.

### Tasks

1. [x] Implement `sendTurn`, `stopTurn` and event subscription from the frozen
   contract.
2. [x] Replace ambiguous legacy chat events with a fixed public task-event
   allowlist backed by Jarvis task/run records.
3. [x] Map authoritative state to a task card with risk, task/run/event,
   replay, orphan, stop and terminal-result evidence.
4. [x] Preserve `brain_id`, `session_id`, `run_id` and idempotency across reconnect.
5. [x] Implement stop, retry-safe reconciliation, bounded event history and
   orphan-run detection.

**Acceptance criteria**

- The R0 read-only turn is created and executed only by JarvisOS authority.
- UI never reports completion before the authoritative completion event.
- Lost submit responses replay the same intent/key; known tasks poll only by ID
  and cursor; stop cannot target a renderer-selected or foreign task.
- R1/R2/R3 and all side effects remain closed for Phase 6.

**Verification**

- [x] Strict contract, out-of-order/duplicate/unknown/stale response and
  renderer-boundary fixtures.
- [x] Disposable loopback submit → exact replay → task/cursor snapshot plus
  companion store/lane/route-table verification.
- [x] Full Iris tests, integration, typecheck, lint, production audit, Windows
  package verification and a 1920×1080 packaged Deck check.
- [ ] Install into the canonical authenticated runtime and prove a real R0
  worker, stop, renderer restart and controlled backend/provider interruption.

**Checkpoint:** `READY_FOR_PHASE_4_R0_REVIEW`. See the
[Phase 4 R0 verification report](docs/execution/reports/2026-07-31-phase-4-r0-verification.md).
Review and an explicit runtime gate are required before merging/restarting the
canonical Jarvis runtime; this checkpoint is not recorded as passed.

## Phase 5 — Second brain, memory and galaxy knowledge view

**Goal:** inherit JarvisOS cognition without duplicating storage.

**Sequencing note (2026-07-31):** the remote product owner directed the project
to defer unavailable physical gesture acceptance and proceed to a reversible,
read-only Phase 5 slice before Phase 4. That historical sequencing did not pass
the Phase 2 or Phase 3 human checkpoints. Phase 4 R0 is now implemented only in
the companion/deterministic form described above and authorizes no mutation.

**Automated slice 5.1 status (2026-07-31):** implemented and packaged for
opaque brain-view selection plus a bounded REST `/graph` snapshot, fixed
trusted-frame IPC, sanitized/hashed public node IDs, readable Galaxy fallback,
sign-in/error/truncation states and GET-only disposable integration. The live
protected boundary then revealed nullable titles in 8/48 legacy sessions. The
contract now accepts that real shape, emits `Phiên chưa đặt tên`, and keeps a
valid brain catalog available when only session parsing fails. A 401 still
clears the catalog and returns `sign_in_required`. Snapshot-local Galaxy search
and filtering of the loaded public session index are now implemented;
server-side session pagination/detail, `/ws/graph`, memory
statistics/retrieval, file detail, server-side progressive loading, post-rebuild protected
live content and the Phase 5 product checkpoint remain pending.

**Neural Observatory refinement (2026-07-31):** the product owner approved a
more cinematic sci-fi direction and the flat circular plot was replaced with a
deterministic, topology-led 2.5D field. Hub-aware node selection, relation
focus, readable inspection, keyboard parity and an explicit static
reduced-motion mode are implemented, browser-verified at wide and compact
panel scales, and packaged. This changes presentation only; the protected live
graph still requires a fresh manual login. See the
[visual verification report](docs/execution/reports/2026-07-31-neural-observatory-visual-verification.md).

**Automated slice 5.2 status (2026-07-31):** implemented accent-insensitive
Vietnamese search over the already loaded, sanitized graph snapshot. Results
are deterministically bounded and search only public labels/folders; selecting
a node that was outside the default projection pins it and a local relation
into the 72-node field without adding IPC, network calls or a second data
store. Keyboard activation, the no-results state and the compact 920 x 1000
layout were browser-verified and the Windows package passed. Protected search
against real Jarvis content still requires a fresh manual login and human
review. See the [Phase 5.2 verification report](docs/execution/reports/2026-07-31-phase-5-2-local-knowledge-search.md).

**Automated slice 5.3 status (2026-07-31):** implemented a renderer-only
Session Index over the existing sanitized `/sessions?limit=50` projection.
Accent-insensitive search is limited to public title, engine and model fields,
preserves recent-session order and exposes no ID, preview, path, content or new
IPC/network method. Escape clears the filter; explicit result-count and empty
states are keyboard/browser verified and packaged. This completes only the
local search portion of Task 2; session detail/pagination and memory
statistics/retrieval remain later contracts. See the
[Phase 5.3 verification report](docs/execution/reports/2026-07-31-phase-5-3-session-index.md).

**Automated slice 5.4 status (2026-07-31):** added an operator-controlled
36/72/96-node density selector over the already loaded, sanitized graph
snapshot. Density changes are renderer-only: they add no fetch, pagination,
cache or persistence, and a searched node outside the selected projection stays
pinned with a local relation without increasing the selected density. A
500-node/1,000-edge representative probe projected the 96-node field in under
the 250 ms regression budget across 20 runs (median 6.413 ms, p95 39.241 ms,
maximum 43.291 ms). Compact browser interaction and the Windows package passed.
This completes the local performance-control portion of Task 5 only;
server-side progressive loading, protected real-content review and the Phase 5
product checkpoint remain pending. See the
[Phase 5.4 verification report](docs/execution/reports/2026-07-31-phase-5-4-observatory-density-performance.md).

**Phase 5 product checkpoint (2026-08-01):** the product owner reports manual
Iris authentication and acceptance of the protected/human Phase 5 review. This
authorizes Phase 6 read-first capability discovery. It does not authorize a
new Jarvis mutation route, workflow execution, provider/MCP control or data
migration without a separate owner-approved contract.

### Tasks

1. Add brain switching with opaque IDs and visible active-brain context.
2. Add session browser/search and memory statistics/retrieval views.
3. Build the Iris galaxy view over Jarvis `/graph` and `/ws/graph`, including
   source, relation, staleness, focus and search.
4. Add file/memory detail panels through approved Jarvis APIs.
5. Add graph size/performance limits and server-side progressive loading.

**Acceptance criteria**

- All brain, memory, session and graph changes are immediately visible in the
  canonical Jarvis dashboard/API and survive an Iris restart.
- Iris v2 creates no brain/memory/session database of its own.
- Large graphs remain navigable and identify source/staleness.

**Verification**

- Cross-client consistency test between Iris v2 and JarvisOS.
- Path/ID authorization tests and large-graph performance probe.
- Human review of graph readability and Vietnamese search.

**Checkpoint:** product owner confirms that Iris v2 can replace the everyday
Jarvis dashboard for conversation, task tracking and brain navigation.

## Extension backlog — Phase 6: skills, tools, workflows and operator approvals

**Goal:** expose the latest JarvisOS capabilities as a coherent operator surface.

### Tasks

1. Add searchable skill/tool/workflow catalogs with version, source, risk and
   availability.
2. Implement the capability approval sheet and policy-result states.
3. Add workflow launch, progress, logs, stop and recovery using Jarvis APIs.
4. Surface MCP/provider routing and capability health without exposing secrets.
5. Add media/files/browser/computer capabilities only through declared policies.

**Acceptance criteria**

- Every capability shown in Iris maps to a current Jarvis capability record.
- R2/R3 actions require the configured explicit approval and produce an audit
  trail.
- Removed/disabled Jarvis tools disappear or show unavailable without breaking
  the HUD.

**Verification**

- Catalog drift tests against the live Jarvis runtime.
- Approval bypass, expiry, replay and idempotency tests.
- One real low-risk workflow and one denied high-risk workflow E2E.

## Extension backlog — Phase 7: Hermes capability packs

**Goal:** adopt superior Hermes capabilities selectively and strengthen Jarvis,
not create a parallel agent stack.

### Candidate waves

1. **Safety foundation:** skill provenance, version metadata, AST/static audit,
   skill guard, path security and schema sanitization.
2. **Efficiency:** lazy tool search/loading, output limits, result storage and
   context/trajectory summaries.
3. **Operations:** delegated/background work, process registry, live logs,
   cancellation and project/environment isolation.
4. **Optional advanced tools:** computer use, web, vision, voice/media and
   video-generation adapters under R2/R3 policy and explicit feature flags.
5. **Observability:** lifecycle traces, provider/tool attribution, latency,
   egress and failure dashboards.

### Required task for every pack

1. Write a mini-spec and provenance record.
2. Decide port, adapter or sidecar; do not copy the whole subsystem.
3. Map its permissions and events to JarvisOS.
4. Add compatibility, failure, rollback and security tests.
5. Ship disabled by default until product-owner approval.

**Acceptance criteria**

- Each enabled pack adds a measurable capability or safety improvement.
- Jarvis memory, policy, session and capability registries remain canonical.
- Disabling/killing a Hermes pack leaves Jarvis core and Iris conversation usable.

**Verification**

- Provenance/license review, static audit and dependency scan.
- Egress/filesystem/process boundary test per pack.
- Failure injection and clean-disable/rollback test.

**Checkpoint:** review pack-by-pack evidence and approve only the exact packs to
promote.

## Extension backlog — Phase 8: packaging, migration, hardening and promotion

**Goal:** promote Iris v2 to the principal operator-system AI with a reversible
transition.

**Repository-launch foundation status (2026-08-01):** the source-first developer
preview is published from the ADR-008 curated boundary at
[Meunieur/iris-v2](https://github.com/Meunieur/iris-v2) under Apache-2.0. The
public repository includes the product README, privacy/contribution/security
boundaries, community templates, Discussions, pinned least-privilege Windows
CI, Dependabot, private vulnerability reporting and the staged rollback plan.
Hosted CI passes the exact public snapshot. Secret scanning, push protection,
vulnerability alerts and Dependabot security updates are enabled. The current
full dependency graph and production graph report zero known vulnerabilities.
No signed public binary, signing identity, Marketplace unit or live-runtime
promotion is inferred by this source release.

### Tasks

1. Package/sign the selected Electron/runtime architecture for Windows.
2. Implement safe discovery/migration of existing JarvisOS configuration and
   data without moving the canonical data root unless separately approved.
3. Add update/rollback, crash reporting (local by default), diagnostics export
   and recovery UI.
4. Run performance, long-session, offline, provider-outage, DPI/multi-monitor,
   startup and shutdown suites.
5. Stage a limited daily-driver period before changing autostart/default app.
6. Maintain the published source repository/release surface and select a
   separate GitHub Marketplace delivery unit (GitHub App or single-purpose
   Action) before any listing work; the desktop executable alone is not a
   Marketplace product.
7. Continue publishing from product-owner-approved curated snapshots rather
   than exposing machine-local working history; scan each exact public file set
   before import or update.

**Acceptance criteria**

- Upgrade and rollback preserve Jarvis brains, sessions, memory and vault.
- One packaged Iris v2 instance owns/discovers one backend process.
- All critical features work or degrade visibly when Gemini/Hermes/network is
  unavailable.
- Promotion has a documented backup and rollback path.

**Verification**

- Fresh-install, upgrade, downgrade and rollback matrix.
- 8+ hour soak with voice/gesture/task/graph activity and leak monitoring.
- Final security review and real packaged acceptance test.

**Promotion gate:** changing Iris v2 into the autostart/default operator app is a
separate explicit approval after the staged evidence is reviewed.

## Cross-phase quality bar

No phase advances on screenshots alone. Evidence must include tests, real
runtime behavior, logs/state reconciliation and an explicit list of remaining
risks. Prefer fewer complete vertical slices over broad unverified ports.
