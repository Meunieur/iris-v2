# Iris v2 MVP Core Scope

**Status:** `APPROVED_BY_PRODUCT_OWNER_2026-08-01`

**Purpose:** finish one small, trustworthy vertical slice before adding more
capabilities. The MVP is complete when Iris can launch as an Electron HUD,
attach to exactly one JarvisOS runtime, run the local gesture state machine,
and read the JarvisOS Second Brain through the existing sanitized bridge.

## Product promise

Iris v2 is the visual and interaction layer. JarvisOS remains the only owner of
authentication, brains, sessions, memory, policy, tools and audit. The MVP
does not create a second database, start a second backend, or allow a model,
gesture or renderer action to bypass Jarvis policy.

## MVP surface

The default packaged surface contains only:

1. Electron shell with the transparent Desktop HUD and same-window Command
   Deck toggle.
2. Attached JarvisOS status: health, version, auth state, brains and recent
   public sessions.
3. Local gesture runtime with camera-off default, explicit opt-in, deterministic
   point/scroll/resize/dismiss semantics and keyboard/mouse fallbacks.
4. Explicit Second Brain load from a public opaque brain ID, sanitized Galaxy
   projection, local search and density controls.
5. Reconnect, offline, sign-in-required, empty and degraded states that fail
   closed and never invent work.

Gemini conversation, R0 task submission, capability catalogs, workflow runs,
MCP/provider controls, memory/file detail, Hermes packs and managed runtime
remain preserved in source but hidden from the default MVP surface. They are
extension backlog, not MVP completion gates. The experimental conversation and
task panes can be enabled only with `VITE_IRIS_EXPERIMENTAL=1` during local
development; this does not authorize their live provider or Jarvis runtime
actions.

## Verification ladder

Run the smallest deterministic check first:

```powershell
npm run test:mvp
```

Then prove the full local integration in order:

```powershell
npm run build
npm run package:win
npm run probe:jarvis -- --repeat 2
```

`test:mvp` is intentionally local and deterministic. It covers the renderer
surface, HUD/gesture behavior, Second Brain projection/search, preload/IPC
security, adapter contracts and the attached-runtime client without requiring
a live credential. `test:integration` remains a separate disposable-server
check; it is not hidden inside the quick MVP command.

## Definition of done

- `npm run test:mvp` passes with no live credential or network dependency.
- `npm run build` succeeds and the unpacked Windows package is produced.
- The packaged app visibly reaches HUD and Command Deck against one attached
  JarvisOS listener, with camera off until the operator enables it.
- The operator can manually sign in, select/load a brain, inspect the
  sanitized Second Brain graph and search it locally.
- No renderer secret, raw backend path, database copy, generic IPC, or
  side-effecting capability is introduced.
- Remaining advanced work is listed as extension backlog in `ROADMAP.md` and
  can be added one contract and one verified slice at a time.

## Engineering shape

- Keep changes in the existing workspace packages; avoid new frameworks or
  duplicate runtimes.
- Add or update a contract test before every new boundary.
- Prefer pure functions and deterministic fixtures for gesture and graph logic.
- Keep the renderer API narrow and project only fields that are explicitly
  safe to display.
- Treat camera, provider, web and skill content as untrusted and opt-in.

## After MVP

The next slice should be selected from the extension backlog only after the MVP
ladder is green. Each extension must state its Jarvis owner, contract,
failure/recovery behavior, security gate, deterministic tests and real runtime
evidence before it becomes part of the default product.
