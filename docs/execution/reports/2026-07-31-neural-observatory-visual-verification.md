# Iris v2 Neural Observatory visual verification

Date: 2026-07-31
Scope: Phase 5 read-only Galaxy presentation only

## Outcome

The fixed circular node plot was replaced with a deterministic 2.5D topology
renderer named **Neural Observatory**. The renderer remains a projection of the
existing bounded `JarvisKnowledgeSnapshot`; it does not add a Jarvis route,
copy a graph database, change the default brain or create a mutation path.

The selected visual direction is captured in `DESIGN.md` version `0.2.0`:
violet knowledge depth, cyan operator focus, topology-led composition, one slow
field drift, an explicit inspection rail and a fully static reduced-motion
state.

## Boundary and implementation evidence

- `KnowledgeDock` still receives the same read-only snapshot and delegates only
  the ready-state graph visualization to `NeuralObservatory`.
- The pure layout ranks effective graph degree, preserves folder leaders,
  includes hub neighbours before unrelated nodes, caps the visible field and
  drops edges whose endpoints are not visible.
- The same focused-node state is used by pointer hover, click, keyboard focus,
  the cyan relation field and the readable inspector.
- Opaque node IDs remain React keys only; visible labels, accessibility names
  and inspector content do not expose raw IDs or backend paths.
- The browser-visible preview uses the real product components with local
  representative data. It is labelled `NO JARVIS DATA COPIED` and does not
  bypass the packaged authentication gate.

## Test-first evidence

The first targeted run was RED for the intended reasons: the layout module,
Neural Observatory semantics and explicit reduced-motion rule did not exist.
After implementation:

- targeted topology/UI/responsive suite: 3 files, 8 tests passed;
- full deterministic suite: 54 files, 445 tests passed;
- disposable HTTP integration: 1 file, 4 tests passed;
- typecheck: passed;
- zero-warning lint: passed;
- production build: passed;
- `DESIGN.md` lint: 0 errors, 0 warnings;
- fail-closed audit policy: passed under the existing reviewed development-only
  advisory exception through 2026-08-14.

## Visual and packaged evidence

- The local preview was inspected at 1600 x 1000 and at a 920 px-wide compact
  target close to the Command Deck Galaxy panel. Both retained the topology,
  inspector, labels and controls without collapsing the graph.
- A real browser click on `JarvisOS Runtime` changed the unique inspector
  heading to `JarvisOS Runtime`, proving the focus/inspection path outside the
  unit harness.
- `npm run package:win` passed and the package verifier inspected 1,381 files.
- `release/win-unpacked/Iris v2.exe` is 225,636,864 bytes with SHA-256
  `059D2F09DD872D07CF89E747FD8298B3568793D15E4963B2FDFCCDD650ADFA07`.
- The packaged Command Deck opened against the canonical local JarvisOS runtime
  and showed health `ok`, version `0.9.286`, camera off, Gemini off and the
  explicit Galaxy sign-in gate.

## Remaining gates

- The packaged auth partition is in-memory and required a fresh login. No
  credential or authentication dialog was automated, so the protected live
  graph is not claimed as verified in this pass.
- Search, `/ws/graph`, memory statistics/retrieval, file detail, progressive
  loading and a large protected-graph performance probe remain Phase 5 work.
- This visual approval does not pass the full Phase 5 product checkpoint or any
  earlier Gemini/gesture checkpoint.
