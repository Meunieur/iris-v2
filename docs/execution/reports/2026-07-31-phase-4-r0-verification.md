# Phase 4 R0 Task Lifecycle Verification — 2026-07-31

## Verdict

The bounded Phase 4 R0 vertical slice is ready for product-owner and companion
backend review. Iris can submit, reconcile, stop and render one authoritative
read-only Jarvis task through a fixed main/preload surface. The deterministic,
disposable-wire, build, package and packaged-UI gates pass.

This is not a live-runtime pass. The companion JarvisOS change remains isolated
on branch `codex/iris-phase4-contract` in a dedicated worktree. It has not been
merged into the canonical JarvisOS
checkout or installed on the active runtime at `127.0.0.1:7777`. No credential
was automated and no live worker/provider execution is claimed.

## Delivered boundary

- JarvisOS owns authenticated `/iris/v1/turns` submit/snapshot/stop routes,
  opaque brain resolution, UUID replay binding, task/run/event storage,
  terminal outcome, orphan state and stop.
- The internal `iris-read` lane forces risk `R0`, mode `suggest`, local
  `Read`/`Glob`/`Grep`/`LS`, read-only MCP policy, and explicit denial of write,
  shell, browser and subtask tools.
- Iris main owns one pending submit, exact-key replay, cursor polling,
  generation guards, one timer, bounded recent events and sign-in recovery.
- Preload exposes only `getTaskSnapshot`, `sendTurn`, `stopTurn` and
  `onTaskSnapshot`; IPC accepts no path, risk, capability, endpoint or target
  task ID from renderer input.
- Command Deck shows the authoritative R0 lifecycle, brain context, run/event
  provenance, replay/orphan state, stop and terminal result. Model text cannot
  mark a task complete.

## Independent review repairs

The review added regression coverage and fixes for:

1. case-insensitive forward-slash brain-path leakage in terminal text;
2. credential-like terminal text reaching preload without final redaction;
3. extra HTTP fields such as `risk` or `path` being silently ignored;
4. a new turn replacing a submit whose response was lost and awaiting replay;
5. replay provenance disappearing after the next cursor poll;
6. renderer event accumulation growing beyond the 100-event window;
7. stop remaining actionable after sign-out and task connection status hiding
   the sign-in requirement;
8. active-title deduplication colliding when distinct UUIDs share eight leading
   characters; and
9. disabled task controls looking visually enabled in the packaged Deck.

## Fresh verification

| Gate | Evidence |
|---|---|
| Iris unit/contract/UI | 49 files, 419 tests passed |
| Disposable HTTP integration | 1 file, 4 tests passed |
| Jarvis companion contract | 32 focused route/store/lane/wire/route-table tests passed |
| Static quality | TypeScript typecheck passed; zero-warning lint passed |
| Dependency audit | `npm audit --omit=dev`: 0 vulnerabilities |
| Production build | Vite production renderer and all workspace packages built |
| Windows package | 1,381 files verified; Electron 43.2.0; pinned gesture model SHA-256 `97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482` |
| Packaged visual smoke | `Iris v2.exe` opened one responsive Deck at 1920×1080; JarvisOS 0.9.270/sign-in-required, camera off, Gemini off, Galaxy and task panels were visible without overlap; disabled R0 send styling was visibly distinct |
| Shutdown hygiene | The four processes whose executable path matched the packaged Iris binary were revalidated and stopped; zero matching Iris processes remained |

The Jarvis test run emitted only existing FastAPI `on_event` deprecation
warnings. No Phase 4 test, build, lint, audit, package or visual gate failed.

## Open gates

1. Review and merge the companion JarvisOS slice without overwriting unrelated
   canonical working-tree files.
2. Restart the one canonical Jarvis runtime only with product-owner approval.
3. Manually authenticate the in-memory Iris session and prove protected brain
   selection plus a real R0 task through the installed route.
4. Record task execution, progress, terminal result, stop, renderer restart and
   backend/provider interruption against the real runtime.
5. Obtain the Phase 4 human checkpoint before opening any R1/R2/R3 approval or
   mutation work. Phase 6 remains the owner of those decisions.
