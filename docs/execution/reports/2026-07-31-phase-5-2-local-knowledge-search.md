# Phase 5.2 local knowledge-search verification

Date: 2026-07-31

Scope: read-only search and topology focus inside the Iris v2 Galaxy panel

Runtime owner: JarvisOS remains the sole brain, policy, auth and data authority

## Outcome

Iris can now search the sanitized graph snapshot already loaded from JarvisOS
by public node label or folder. Vietnamese accents are normalized locally, so a
query such as `kien truc` matches `Kiến trúc hệ thống` and `bao mat` matches
`Bảo mật vận hành`. Ranking is deterministic, limited to at most 12 results and
does not inspect or render private paths, raw Jarvis IDs or source records.

Selecting a result outside the default 72-node projection rebuilds the bounded
layout with that node and one of its direct relations pinned into the visible
field. Normal focus changes reuse the current projection, avoiding unnecessary
topology movement.

No endpoint, IPC method, preload capability, credential behavior, brain
selection policy, Jarvis runtime or Jarvis data was changed.

## Test-first evidence

The first targeted run failed for the intended reasons:

- the local `knowledge-search` module did not exist;
- the `Tìm node tri thức` searchbox was absent; and
- `preferredNodeIds` did not bring a hidden searched node into the bounded
  projection.

After implementation, the targeted search/layout/UI suite passed 10/10 tests.
The final deterministic run passed:

| Check | Result |
|---|---|
| Unit/UI suite | 55 files, 449 tests passed |
| Disposable HTTP integration | 4/4 passed |
| TypeScript | Passed |
| Zero-warning lint | Passed |
| Production build | Passed |
| Fail-closed policy audit | Passed; 16 reviewed development findings, review by 2026-08-14 |
| Public technical preflight | Passed with 0 technical errors |

The full suite retains the reduced-motion contract that disables
`.observatory-motion` animation when Windows requests reduced motion.

## Browser and accessibility evidence

The real rendered preview component was checked at 920 x 1000:

1. `bao mat` produced exactly one result, `Bảo mật vận hành`.
2. Pressing Enter on the result updated the inspector through the keyboard path.
3. `node khong ton tai` exposed the explicit no-results status.
4. The compact layout kept the graph, search rail, inspector and provenance
   visible without horizontal overflow.
5. A fresh post-fix load added no browser console error or warning. The only
   buffered console entry was an older HMR root-ownership error; the preview now
   disposes its React root before a hot replacement, and no new instance was
   recorded after the fix.

Visual evidence: `iris-knowledge-search-phase5-2.png` in the local Codex
visualization artifact folder. The preview uses representative local data and
copies no Jarvis data.

## Package evidence

`npm run package:win` rebuilt the workspace and Electron app, then the package
verifier inspected 1,381 files successfully.

- Executable: `release/win-unpacked/Iris v2.exe`
- Size: 225,636,864 bytes
- SHA-256: `BCC978AA24C62386D40EE3243A136DC1FC344391C44264FADFF62DFEE6EA2B56`
- Pinned gesture-model SHA-256:
  `97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482`

The first packaging attempt found the old artifact DLL locked by a running Iris
test process from this exact worktree. Its executable path was revalidated
immediately before stopping only that process; the second package run passed.
JarvisOS was not stopped, restarted or modified.

## Security and remaining gates

- Search performs no fetch and introduces no renderer authority.
- Only sanitized labels, folders and already-public link counts are indexed.
- Result limits and the existing projection caps preserve bounded renderer work.
- Protected real-content search is not claimed: the rebuilt package requires a
  fresh manual Iris login and no credential was inspected or automated.
- Large protected-graph performance and the Phase 5 everyday-dashboard product
  checkpoint remain pending human gates.
- Public release remains owner-blocked on `LICENSE`, `CODE_OF_CONDUCT.md` and
  `SUPPORT.md`; the technical preflight passes independently of those choices.
