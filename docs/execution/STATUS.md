# Iris v2 Execution Status

**Updated:** 2026-08-01
**Overall state:** `MVP_CORE_VERIFIED_EXTENSION_BACKLOG`.
**MVP direction:** The product owner requested a focused completion slice on 2026-08-01: Electron HUD + local gesture runtime + one attached JarvisOS + read-only Second Brain. The default renderer hides Gemini/task panes; advanced capability work remains extension backlog.
**Phase 1:** accepted by the product owner on 2026-07-24. Code, deterministic verification, final Windows packaging, public live runtime, ownership/reload/shutdown and target-scale UI evidence are complete. Manual operator login and authenticated protected reads remain explicitly unverified.
**Phase 2:** implementation, deterministic verification, packaging, HUD/Deck runtime smoke, fresh camera lifecycle/performance, actual Windows 125%/150%, and controlled 200% renderer-scale checks are complete. Four physical gesture ergonomics, actual Windows 200%, secondary-monitor and final owner review remain deferred and explicitly unverified because the owner is remote.
**Phase 8 source preview:** the curated source snapshot is published at [Meunieur/iris-v2](https://github.com/Meunieur/iris-v2) as a fresh public history under Apache-2.0. GitHub-hosted Windows CI passes the locked install, deterministic tests, integration, typecheck, lint, public-surface preflight, build and dependency audits. Community templates, Discussions and private vulnerability reporting are enabled. No signed public binary or Marketplace unit exists; the full dependency graph and production graph report zero known vulnerabilities.

## MVP Core progress

| Item | State | Evidence / next gate |
|---|---|---|
| Scope | Approved by product owner 2026-08-01 | [MVP scope](MVP_SCOPE.md); advanced panes are preserved but default-off |
| Core test gate | Verified 2026-08-01 | `npm run test:mvp` passed 15 files / 185 tests; full suite passed 56 files / 458 tests |
| Attached runtime | Verified 2026-08-01 | `npm run probe:jarvis -- --repeat 2` passed; no duplicate JarvisOS process or data root |
| Package check | Verified 2026-08-01 | Build, Windows package verifier, lint, typecheck and policy audit passed |
| Product checkpoint | Verified 2026-08-01 | Manual packaged HUD/Deck shows `Sẵn sàng`, `Đã đăng nhập`, Brain Default and live Second Brain; local search is deterministic/UI-covered and no credential was automated |

### Fresh 2026-08-01 MVP Core verification

- `npm run test:mvp`: 15 files / 185 tests passed.
- `npm test`: 56 files / 458 tests passed; `npm run test:integration`: 4/4
  disposable HTTP tests passed.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run audit:policy`
  and `npm audit --omit=dev --audit-level=high` all passed. The current full
  dependency graph and production graph report zero known vulnerabilities.
- `npm run package:win` passed the package verifier: 1,381 files and the
  pinned gesture-model hash `97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482`.
- `npm run probe:jarvis -- --repeat 2` passed against the attached loopback
  JarvisOS `0.9.286`: health `ok`, auth required, one stable listener and
  `sameRuntime: true` across both samples.
- The freshly packaged app was opened and inspected at runtime. HUD and
  Command Deck toggled successfully; the default Deck showed `MVP CORE`,
  read-only Galaxy Second Brain, camera off and no conversation/task panes.
  The app then closed to zero matching Iris windows.
- The product owner then completed manual sign-in in the packaged app. A fresh
  protected read showed `Sẵn sàng`, `Đã đăng nhập`, Brain Default (222 notes),
  50 public sessions and a loaded Second Brain with `đã đồng bộ`, 98/98 nodes,
  371/371 links, 8 groups and a 72/98-node Neural Observatory projection.
  No credential was automated or inspected. Search behavior remains covered by
  the deterministic/local UI tests; a separate live typed-search action is not
  required for the read-only bridge contract.

## Current operating posture

- **Runtime mode:** attached-only to one already-running JarvisOS instance.
- **Endpoint characterized:** `http://127.0.0.1:7777`.
- **Canonical owner:** source JarvisOS owns process policy, authentication,
  data roots, brains, sessions, memory, vault, tools and audit.
- **Managed mode:** disabled. Iris v2 must not start, stop, migrate or create a
  second JarvisOS data root during Phase 0 or Phase 1.

## Phase 4 R0 progress

| Item | State | Evidence / next gate |
|---|---|---|
| Jarvis-owned task contract | Complete in companion branch | Versioned submit/snapshot/stop routes resolve only opaque catalog brain IDs and bind UUID intent/payload provenance to brain-scoped idempotency. The server fixes `created_by=iris-v2`, `capability=iris-read`, risk `R0` and mode `suggest`; unknown fields fail closed. |
| Read-only execution lane | Deterministically verified | Local tools are limited to `Read`, `Glob`, `Grep`, `LS`; read-only MCP patterns remain behind Jarvis policy; write/edit/shell/web/subtask tools are denied. Companion branch: `codex/iris-phase4-contract` in an isolated JarvisOS worktree. |
| Iris reconciliation | Complete for bounded slice | Stable replay IDs, task-ID/cursor polling, one timer, generation guards, stop, auth recovery, orphan state, preserved replay provenance and a 100-event renderer window are covered. |
| IPC/preload | Deterministically verified | Four fixed task methods/events, trusted sender/frame validation and strict input allowlists; no endpoint, cookie, path, risk, capability, arbitrary target or generic IPC/fetch reaches renderer. |
| Command Deck task plane | Packaged and visually verified | R0 composer, explicit brain, task/run/event/replay/orphan/result states and stop are visible beside Gemini and Galaxy. The signed-out packaged state disables mutation controls both behaviorally and visually. |
| Fresh verification | Complete for deterministic/package gates | 53 Iris files/442 tests; 4 HTTP integration tests; 32 Jarvis companion tests; typecheck; zero-warning lint; production audit 0 vulnerabilities; 1,381-file Windows package with the pinned gesture model hash. The full audit policy accepts only one exact development-only advisory and expires on 2026-08-14. |
| Live canonical execution | Gated and unverified | The companion backend is not merged or installed on the active JarvisOS 0.9.270 runtime. No credential was automated, no real worker/provider task was run, and restart/reconnect/stop against port 7777 is not claimed. Owner review is required before merge/restart. |

Full evidence: [Phase 4 R0 verification](reports/2026-07-31-phase-4-r0-verification.md).
Build-chain evidence: [supply-chain hardening verification](reports/2026-07-31-build-supply-chain-hardening.md).

## Public repository and release preparation

| Item | State | Evidence / next gate |
|---|---|---|
| Product narrative | Published | The focused README leads with usefulness, authority boundary, verified status, deterministic setup and live CI evidence. |
| Community surface | Published | Apache-2.0 contribution terms, Contributor Covenant 2.1, issue/feature/PR templates, support policy and GitHub Discussions are available. |
| CI and dependency updates | Hosted and verified | Windows CI passes locked install, tests, integration, typecheck, lint, build, fail-closed full-graph audit policy and production audit with read-only permissions and full-SHA official actions. Dependabot covers npm and GitHub Actions. |
| Privacy/security reporting | Published; curated boundary enforced | Privacy data flows and no-public-disclosure guidance are documented. The bounded scan finds no local-account marker or contiguous high-signal secret pattern in the public snapshot. [ADR-008](../decisions/ADR-008-public-release-boundary.md) keeps internal history private. GitHub private vulnerability reporting is enabled; the conduct contact is published separately. |
| Public-candidate preflight | Ready and CI-enforced | The 2026-08-01 candidate contains 241 files with 0 technical errors and 0 owner blockers. Full and technical-only modes pass. |
| Launch media | Locally rendered and verified 2026-08-01 | README hero, 1280 x 640 social preview and an 8-second silent H.264 loop use representative read-only Observatory data, contain no private desktop/Jarvis data and are individually binary-allowlisted. See the [verification report](reports/2026-08-01-launch-media-verification.md). |
| Launch/rollback | Prepared | [Public release plan](PUBLIC_RELEASE_PLAN.md) defines stages, candidate checklist, media hygiene, hard rollback triggers and owner gates. |
| Distribution | Source-only preview published | Apache-2.0 source version `0.1.0-alpha.1` is available at [Meunieur/iris-v2](https://github.com/Meunieur/iris-v2). No signed binary or Marketplace unit is published. |

## Phase 0 progress

| Item | State | Evidence / next gate |
|---|---|---|
| Runtime and source provenance recorded | Complete for Task 1 | [runtime audit](reports/2026-07-23-live-runtime-audit.md) and [upstream notes](../research/UPSTREAM_NOTES.md) |
| Runtime-host decision | Accepted | [ADR-001](../decisions/ADR-001-runtime-ownership.md); standalone Iris v2 with attached-only Phase 1 |
| Contract characterization | Complete | Raw structural backend path/credential-bearing fields are omitted; public `SessionSummary` and its projection omit preview; text is pre-bounded, deterministically scanned/redacted with escaped-quote/cookie fail-safe handling, then final-bounded. Proposal preflight rejects Proxy/accessor, sparse-array, non-plain-prototype, prototype-sensitive-key, and over-budget inputs; it rejects a 65th entry before reading its value and validates a frozen bounded snapshot instead of the original object. Legacy events fail closed. Current implementation HEAD: `5c56ddb`. |
| Attached runtime identity probe | Complete for attached unauthenticated mode | Historical live evidence was collected after listener commit `4995fd3`. The authorized two-sample run identified one stable selected runtime whose complete binding set passed exact loopback/one-owner validation; it was not rerun for later contract-only commits, including `5c56ddb`. |
| Phase 0 checkpoint packet | Approved 2026-07-24 | [verification report](reports/2026-07-23-phase-0-verification.md) and [approval record](reports/2026-07-24-phase-0-approval.md) |

## Phase 1 progress

| Item | State | Evidence / next gate |
|---|---|---|
| Secure attached shell | Live packaged | Electron 43.2.0 shell uses custom `iris://` renderer protocol, sandbox, context isolation, denied navigation/popups/permissions and one in-memory auth partition. Sandboxed preload is bundled into one file. |
| Read-only adapter | Deterministically verified | Exact loopback endpoint parser; fixed GET routes; 5 second timeout; 64 KiB response cap; redirect/content-type/schema checks; public projections only. |
| Reconnect and renderer bridge | Deterministically verified | Monotonic snapshots, stale completion rejection, one retry timer, sender ID/frame validation and four-method preload surface. |
| Operator HUD | Packaged and visually verified | Vietnamese sign-in-required and offline/reconnecting states at 1280x800, visible keyboard focus, empty/error states and reduced-motion source/tests using `DESIGN.md` tokens. |
| Local integration | Complete for disposable server | Locked and cookie-authenticated read paths, redirect denial, timeout and GET-only behavior pass against a disposable loopback server. |
| Windows package | Verified | `release/win-unpacked/Iris v2.exe`; ASAR has required outputs and excludes internal workspace source/config. Preload and renderer start without application errors. |
| Historical live JarvisOS ownership | Reverified 2026-07-28 | Stable PID `33456` and fingerprint before/after the earlier packaged Iris shutdown; only port 7777 listened across 7777-7816. A later externally owned restart is recorded under Phase 2. |
| Authenticated protected projection | Bug reproduced and repaired; final re-login pending | The dedicated session accepted an operator login on 2026-07-31. Live protected reconciliation exposed 8/48 sessions with `title = null`; the strict contract hid the valid brain catalog. Nullable titles and session-only degradation are now covered and packaged. The rebuild cleared the intentionally in-memory cookie, so a post-fix manual re-login remains required before claiming `ready` and protected graph readability. |

See [the Phase 1 verification report](reports/2026-07-24-phase-1-verification.md).

## Phase 2 progress

| Item | State | Evidence / next gate |
|---|---|---|
| Product direction | Approved 2026-07-24 | Transparent click-through HUD by default; global shortcut expands the same window into an interactive Command Deck. |
| Glass HUD and native boundary | Implemented and freshly packaged | One transparent window, fixed shortcut, same-window Deck, click-through HUD, narrow IPC, same-origin local-WASM CSP and packaged asset verification. |
| Gesture runtime | Deterministically verified | 329 unit tests cover normalization, stabilization, dwell, cooldown, stale expiry, scroll, scale, dismiss, camera cleanup, forbidden actions, shell minimum bounds, short-viewport layout and reduced-motion CSS behavior; 4 HTTP integration tests also pass. |
| Live packaged UI | Verified 2026-07-28 | HUD, Command Deck, `Ctrl+Shift+Space`, Escape, visible keyboard focus, safe-zone click-through to Explorer, interactive refresh hit region, actual Windows 125%/150% and controlled 200% scale behavior were observed in `release/win-unpacked/Iris v2.exe`. |
| Camera-off runtime baseline | Verified 2026-07-28 | Four expected Electron processes, one loopback-only TCP connection to Jarvis `127.0.0.1:7777`, 4.61% aggregate CPU, 346.7 MiB working set and 0.806% sampled 3D GPU utilization over a 3.08 second idle sample; the fresh active comparison is recorded below. |
| Fresh camera lifecycle/performance | Partially verified 2026-07-28 | Physical `HD camera` reached local `ready`, pause and stop returned visible paused/off states; a four-second active sample used 14.88% aggregate CPU, 637.3 MiB working set and 1.218% maximum sampled 3D GPU. Five observation samples detected no hand gesture, so real ergonomics remain open. |
| Owner-test Windows build | Ready 2026-07-28 | Fresh `release/win-unpacked/Iris v2.exe` is 225614336 bytes with SHA-256 `EA822BBD0823BE09DE9871D8FCC7DD136C5B0C15ABDA0E85CD96A5A5873AE545`; package verification inspected 1,377 entries, including the Gemini bridge/SDK and expected MediaPipe model hash. Launch smoke produced four responsive Electron processes and one window without creating another Jarvis listener. |
| Current Jarvis recovery | Reverified 2026-07-28 | After a transient external outage during real-DPI testing, one listener returned as PID `47756`, version `0.9.234`, with the same private data-root fingerprint and no adjacent listener. Cause of the external restart/version change is unverified. |
| Manual acceptance residual | Deferred by owner direction 2026-07-28 | Point dwell, palm scroll, two-palm resize, fist dismiss, actual Windows 200%, live secondary-monitor bounds/reticle mapping and owner review remain unverified. Parsec VDD is installed with fallback on, but adding a second display while the physical monitor remains attached requires a Warp/Teams owner connection. This debt is not recorded as a pass. |

## Phase 3 authorization

The remote product owner directed the project to continue on 2026-07-28 because
they could not perform the Phase 2 physical test. Deterministic Phase 3 work may
therefore proceed with a disabled-by-default Gemini broker, mock-provider tests
and a proposal-only Jarvis boundary. This sequencing decision does not provide
a Gemini credential, authorize silent remote microphone transmission, connect
execution, or satisfy the Phase 3 human conversation/privacy checkpoint.

## Phase 3 progress

| Item | State | Evidence / next gate |
|---|---|---|
| Pure Gemini bridge contract | Deterministically verified | Bounded provider normalization, lifecycle/reconnect/resumption state, transcript/audio limits and proposal validation are isolated in `@iris/gemini-bridge`; failure paths reject malformed, oversized, cyclic, unsupported and credential-bearing input. |
| Main-process provider boundary | Packaged, disabled by default | Pinned `@google/genai` `2.13.0`; key, provider socket and resumption handle remain in main memory. Only `propose_capability` is declared; no built-in search, code execution, URL context or MCP executor is connected. |
| Renderer/preload boundary | Deterministically verified | Fixed conversation IPC only; explicit microphone permission intent; audio-only capture; PCM16 16 kHz input and 24 kHz output; interruption, transcript, reconnect, degraded and missing-credential states. Renderer receives neither credentials nor raw provider objects. |
| Conversation UX | Packaged | HUD and Command Deck show provider, lifecycle, microphone, transcript, cost/error availability and proposal-only state. There is no approve/execute control. Keyboard and reduced-motion fallbacks remain available. |
| Jarvis execution | Intentionally not connected | Capability output stops at a validated `proposed` envelope with source, risk and context. A later authenticated Jarvis proposal/approval contract is required before execution work begins. |
| Live Gemini/human checkpoint | Deferred and unverified | No credential was supplied or enabled. A live audio turn, barge-in quality, provider reconnect/resumption and privacy/proposal review still require explicit owner participation. |
| Windows package/runtime | Verified without credentials | Fresh package contains the Gemini bridge, pinned SDK and main broker. Default launch produced one responsive Iris window/four Electron processes, left the existing Jarvis listener unchanged, then shut down cleanly. |

## Phase 5 read-only sequencing exception

The remote product owner directed Iris to proceed with the JarvisOS Second
Brain connection on 2026-07-31 while physical gesture acceptance remains
unavailable. This authorizes only the reversible read-only slice described in
[the roadmap](../../ROADMAP.md) and [knowledge contract](../contracts/jarvis-knowledge.md).
That exception was exercised before Phase 4. The Phase 4 R0 contract is now
implemented in an isolated companion branch but is not installed into the live
runtime; earlier manual checkpoints remain deferred rather than passed.

| Item | State | Evidence / next gate |
|---|---|---|
| Knowledge contract/projection | Deterministically verified | Raw graph is capped at 2 MiB/2,000 nodes/10,000 edges, then projected to at most 500 nodes/1,000 edges with sanitized text and SHA-256-derived public IDs. Raw node IDs, `path` and `fullpath` are omitted. |
| Private brain lookup | Main-process only | Opaque brain IDs resolve only through the latest authenticated `/brains` catalog; auth/protected-read failure clears the private path map. Renderer input cannot supply a path or endpoint. |
| IPC/preload | Deterministically verified | One fixed `loadKnowledge(brain_<64 hex>)` method with trusted sender/frame validation; no generic fetch, WebSocket, file, mutation, default-brain or execution method. |
| Galaxy Command Deck | Packaged and visually refined | Explicit load/refresh, view-only selector, deterministic topology-led Neural Observatory, relation focus, readable inspector, accent-insensitive local label/folder search, operator-controlled 36/72/96 local density, source/count/truncation/auth/error states, keyboard parity and a static reduced-motion mode. Browser checks passed at wide and compact panel targets. |
| Local knowledge search | Deterministically and visually verified | Search stays inside the sanitized loaded snapshot, never exposes opaque IDs, and deterministically ranks at most 12 results. A searched node outside the default 72-node projection is pinned with a local relation. `bao mat` resolved `Bảo mật vận hành`; Enter activation and the no-results state passed in the compact browser check. |
| Session Index | Deterministically and visually verified | Accent-insensitive filtering covers only public title/engine/model in the loaded 50-session snapshot, preserves recency order and caps rendered matches. IDs, preview, paths and content are not searchable or displayed. Escape clear, result count and no-results state passed at the compact browser target. |
| Observatory density/performance | Deterministically and visually verified | The renderer locally reveals 36/72/96 nodes without fetching or persisting. A searched node outside the compact projection remains pinned while the count stays 36. A 500-node/1,000-edge representative snapshot projected 96 nodes over 20 runs at 6.413 ms median, 39.241 ms p95 and 43.291 ms maximum, below the 250 ms regression budget. |
| Deterministic verification | Complete for this slice | 56 unit/UI files and 455 tests, 4 disposable HTTP integration tests, typecheck, zero-warning lint, build and the fail-closed audit policy all pass. Density UI and the hidden-focus regression were observed RED before implementation/fix. |
| Windows package | Verified 2026-07-31 | Package verifier inspected 1,381 files including the compiled read boundaries and pinned gesture model. Final branded `Iris v2.exe` is 225,636,864 bytes with SHA-256 `1443F783157ABC0D3C3A005C7E50534D7BEA54F2A3B08DFDEC40244B0567FE98`. |
| Real attached runtime | Public/auth gate reverified | Packaged Iris opened the Command Deck against JarvisOS `0.9.286` and showed health `ok`, camera off, Gemini off and Galaxy sign-in-required. No authentication dialog or credential was automated. |
| Protected live graph/session checkpoint | Accepted by product owner 2026-08-01 | The product owner reports manual Iris authentication plus review/acceptance of the Phase 5 protected graph/session and everyday-dashboard checkpoint. No credential was inspected or automated by Iris. The next boundary is Phase 6 capability discovery; mutation, workflow-run, provider and MCP actions remain unauthorized until their Jarvis-owned contracts exist. |

See [the Phase 2 verification report](reports/2026-07-28-phase-2-verification.md).
Physical owner testing remains pending until an operator review can be scheduled.

## Scope guard

This record approves the standalone Iris v2 host direction, attached-only
Phase 1, the bounded Phase 2 presentation/gesture implementation and completed
automated Phase 3 boundary work, the bounded Phase 5 read-only graph slice and
the deterministic Phase 4 R0 task contract. It does not approve merging or
restarting the live Jarvis runtime, managed mode, Gemini credentials, Hermes packs,
telemetry, data migration, promotion, or any side-effecting capability.
The bounded scanner covers the documented key/authorization/token/PEM/cookie
families, run-aware escaped quotes, and covered Windows drive paths, but unknown
formats may remain and all text stays untrusted. Envelope limits apply to its
own-enumerable-string-key JSON surface and the frozen snapshot validated by
Zod. The probe does not prove authenticated or managed-runtime behavior.
