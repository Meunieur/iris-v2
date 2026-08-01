# Phase 5.4 Observatory density and performance verification

**Date:** 2026-07-31

**Scope:** renderer-only density control over the existing sanitized Jarvis
knowledge snapshot

**Authority:** JarvisOS remains the sole owner of brain, graph, memory, policy
and authentication state

## Outcome

The Neural Observatory now lets the operator select a 36, 72 or 96 node field.
The control recomputes only the local deterministic projection; it adds no
network, IPC, filesystem, cache, persistence or mutation boundary. A node found
through local search remains spatially focused at the selected density even
when it was outside the original projection.

This slice does not claim `/ws/graph`, server pagination, server-side
progressive loading, protected live-content acceptance or memory statistics.

## Test-first evidence

The initial UI test failed because the density selector did not exist. After the
control was implemented, compact browser verification found a second defect:
focusing a searched node outside the 36-node field rebuilt the pinned layout at
the 72-node default while the selector still displayed 36. A deterministic UI
regression reproduced that behavior RED. The pinned layout now receives both
the active `maxNodes` value and preferred node IDs; the regression passes and
the visible count remains 36.

Final deterministic checks:

| Check | Result |
|---|---|
| Unit/UI | 56 files, 455 tests passed |
| Disposable HTTP integration | 4/4 passed |
| Typecheck | Passed |
| Lint | Passed with zero warnings |
| Production build | Passed |
| Dependency audit policy | Passed; 16 reviewed development findings, review by 2026-08-14 |
| Technical public preflight | Passed; 229 allowlisted candidate files, 0 technical errors |

## Performance probe

The source-level probe used a representative maximum public projection of 500
nodes and 1,000 edges, selected a 96-node field and ran the deterministic layout
20 times on the local verification host.

| Metric | Result |
|---|---:|
| Output | 96 nodes, 50 retained edges |
| Median | 6.413 ms |
| p95 | 39.241 ms |
| Maximum | 43.291 ms |
| Regression budget | less than 250 ms |

The 250 ms threshold is intentionally tolerant of CI variance. These figures
prove local projection cost for a representative public snapshot; they do not
prove protected live graph transport or backend scan latency.

## Browser-visible verification

At a compact 920 x 1000 viewport, the local no-Jarvis-data preview started at
`72/120 node hiển thị`, changed to 36, searched for `fragment 120` and focused
`Knowledge Fragment 120` while retaining `36/120 node hiển thị`. It then changed
to 96 successfully. Keyboard-operable labels and returned/total counts remained
visible. No new console warning or error appeared after the fix.

The preview contains generated representative labels and topology only; it does
not copy Jarvis brain, graph, path, session or memory data.

## Packaged evidence

`npm run package:win` verified 1,381 files, including the compiled read boundary
and pinned gesture model. The resulting `Iris v2.exe` is 225,636,864 bytes with
SHA-256:

`1443F783157ABC0D3C3A005C7E50534D7BEA54F2A3B08DFDEC40244B0567FE98`

## Security and remaining gates

- Density values are fixed to 36, 72 and 96; renderer input cannot request an
  arbitrary server endpoint, path or collection size.
- Public labels/folders were already sanitized and bounded before this local
  control can read them. Raw IDs and paths remain absent.
- No credential was inspected, stored or automated.
- A fresh manual login is still required to verify protected real-content
  search/density and the Phase 5 everyday-dashboard checkpoint.
- `/ws/graph`, server-side progressive loading, session detail/pagination and a
  genuinely read-only bounded memory-statistics endpoint remain later contracts.
- `LICENSE`, `CODE_OF_CONDUCT.md` and `SUPPORT.md` remain explicit product-owner
  decisions and the only three public-preflight blockers before a release.
