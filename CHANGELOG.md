# Changelog

All notable Iris v2 changes will be recorded in this file. The project has not
published its first versioned release; dates below identify verified
development milestones rather than general-availability releases.

## Unreleased

### Added

- Selected MIT for original Iris v2 code, preserved the ASHR12/iris MIT notice
  and MediaPipe Apache-2.0 terms, added a source-preview support policy and
  accepted the ADR-008 clean public-snapshot boundary.
- Assigned `0.1.0-alpha.1` to the source-first developer preview while keeping
  every workspace private from accidental npm publication.
- Added the MVP Core scope: default HUD + gesture + attached JarvisOS +
  read-only Second Brain, a deterministic `npm run test:mvp` gate and an
  explicit extension backlog for Gemini/task/workflow/MCP/Hermes work.
- Added a default-off experimental surface flag (`VITE_IRIS_EXPERIMENTAL=1`)
  so preserved conversation and task panes do not participate in the core
  runtime unless local development opts in.
- Recorded the product owner's 2026-08-01 acceptance of the Phase 5
  protected/human checkpoint; Phase 6 capability discovery may now proceed
  read-first while mutation and workflow-run controls remain contract-gated.
- Added operator-controlled `Gọn · 36`, `Chuẩn · 72` and `Dày · 96` Neural
  Observatory projections over the loaded sanitized snapshot, with stable
  density when a searched hidden node is pinned and a maximum-snapshot
  performance regression budget.
- Added a renderer-only Session Index with accent-insensitive filtering over
  public title/engine/model fields, bounded recent-order results, Escape clear
  and explicit result-count/no-results states.
- Added accent-insensitive local Galaxy search over sanitized labels/folders,
  deterministic bounded ranking, keyboard activation, an explicit no-results
  state and topology pinning for searched nodes outside the default field.
- Replaced the flat circular Galaxy plot with the deterministic Neural
  Observatory: topology-aware depth, hub focus, relation highlighting, a
  readable inspection rail, keyboard parity, static reduced-motion behavior
  and a local no-Jarvis-data visual verification page.
- Public-facing README, privacy notice, contribution boundary, GitHub issue and
  pull-request templates, Windows CI and release-readiness plan.
- Patched the development process runner from `concurrently` 10.0.3 to 10.0.4
  to remove its vulnerable `shell-quote` dependency.
- Upgraded the package verifier to `@electron/asar` 4.2.1 and added a tested,
  fail-closed dependency audit policy to local checks and Windows CI.
- Removed machine-account identifiers and contiguous secret-shaped test values
  from the current snapshot, and proposed a curated-snapshot public repository
  boundary that preserves internal engineering history privately.
- Added a deterministic, default-deny public-candidate manifest and preflight
  that excludes unlisted files and rejects secret/path/file-type hazards,
  unsafe Git modes and broken public Markdown links while keeping
  legal/community choices owner-gated. Windows CI now enforces the technical
  subset without treating unresolved owner decisions as complete.

### Verified

- Full public preflight passed for 236 candidate files with zero technical
  errors and zero owner blockers after publishing Contributor Covenant 2.1
  with the owner-provided private enforcement contact.
- A fresh Windows package verified 1,381 application files plus the packaged
  Apache license, project NOTICE, third-party notices and ASHR12/iris MIT text.
- MVP Core verification passed: 15/185 focused tests, 56/459 full tests,
  disposable integration 4/4, typecheck, lint, build, package verification and
  policy audit.
- A packaged HUD/Deck smoke confirmed the `MVP CORE` default surface, local
  camera-off state, read-only Galaxy panel and hidden conversation/task panes;
  the app closed cleanly after inspection.
- Protected live read checkpoint completed after manual owner sign-in:
  JarvisOS `0.9.286` reported ready, Brain Default exposed 222 notes, 50 public
  sessions reconciled and Galaxy returned 98/98 nodes, 371/371 links and 8
  groups with a 72/98-node local observatory projection.

### Pending release gates

- Authenticated GitHub owner and first hosted CI run for the clean `iris-v2`
  import.
- Canonical Jarvis Phase 4 installation and protected live R0 worker, stop,
  renderer restart and provider-interruption evidence.
- Live Gemini conversation review, protected Galaxy review and deferred
  physical gesture/DPI/multi-monitor checks.
- The stable Electron Builder chain still propagates 16 development-only
  package findings from one reviewed `brace-expansion` advisory. Production
  dependencies report zero known vulnerabilities. The explicit exception
  expires on 2026-08-14; upgrade the stable builder chain or complete a fresh
  owner review before using it for a signed release candidate.
- Full public preflight approval of the exact curated snapshot; do not expose
  the internal working history by default.

## 2026-07-31 — Phase 4 R0 deterministic milestone

### Added

- Jarvis-owned R0 submit, snapshot and stop contract on an isolated companion
  branch with opaque brain resolution, idempotency and authoritative events.
- Iris task reconciliation with replay, cursor polling, reconnect, stop,
  orphan-state handling and a bounded renderer event window.
- Fixed task IPC/preload methods and the Command Deck task plane.

### Verified

- 426 Iris tests, 4 HTTP integration tests, 32 focused Jarvis companion tests,
  typecheck, zero-warning lint, production dependency audit and Windows package.
- Packaged 1920x1080 Command Deck inspection with sign-in-required controls.

### Not verified

- Installation into or restart of the canonical Jarvis runtime.
- A protected real worker task, live stop/recovery or side-effecting capability.

## 2026-07-31 — Phase 5 read-only Galaxy milestone

### Added

- Bounded read-only Jarvis graph projection with opaque public node IDs.
- Command Deck Galaxy view with source, count, truncation, sign-in and error
  states.
- Branded Iris aperture application icon.

### Not verified

- Fresh protected post-fix login and human graph readability review.

## 2026-07-28 — Phase 3 deterministic conversation milestone

### Added

- Disabled-by-default Gemini bridge with bounded audio/transcript lifecycle,
  reconnect behavior and a proposal-only capability boundary.

### Not verified

- Credentialed live provider quality, interruption/resumption and human privacy
  review.

## 2026-07-28 — Phase 2 Glass HUD milestone

### Added

- Transparent Desktop HUD, same-window Command Deck, local MediaPipe assets and
  permission-aware gesture lifecycle.

### Not verified

- Four physical gesture ergonomics, actual Windows 200% DPI and a live
  secondary display.

## 2026-07-24 — Phase 1 secure shell milestone

### Added

- Hardened Electron shell, attached-only Jarvis adapter, restricted sign-in and
  renderer-safe health/brain/session projections.
