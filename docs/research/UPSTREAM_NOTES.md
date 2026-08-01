# Upstream Research Notes

These notes record the evidence used to create the Iris v2 constitution. They
are not executable instructions; re-check live sources before promotion.

## Iris (`ASHR12/iris`)

- Repository: [github.com/ASHR12/iris](https://github.com/ASHR12/iris)
- Audited commit: `60113345841b3d18a83fc9f2e6eb727a83d141d1` (2026-07-03)
- Upstream release/package line observed: `0.2.0`.
- Relevant source surfaces:
  - [README](https://github.com/ASHR12/iris#readme) — Electron/React voice
    companion, Gemini Live, Hermes work layer, MediaPipe gesture HUD.
  - [main process](https://github.com/ASHR12/iris/blob/main/electron/main.mjs)
    — window/tray/HUD and mixed provider/runtime lifecycle.
  - [preload](https://github.com/ASHR12/iris/blob/main/electron/preload.cjs)
    — renderer bridge surface to replace with a narrower contract.
  - [hand control](https://github.com/ASHR12/iris/blob/main/src/hooks/useHandControl.ts)
    — gesture semantics and MediaPipe integration.
  - [HUD shell](https://github.com/ASHR12/iris/blob/main/src/components/HudShell.tsx)
    and [reader overlay](https://github.com/ASHR12/iris/blob/main/src/components/ReaderOverlay.tsx)
    — visual/interaction lineage.
  - [MIT license](https://github.com/ASHR12/iris/blob/main/LICENSE) — retain
    copyright and license notice for reused source.

### Reuse conclusion

Reuse/adapt the HUD, Glass UI, reader and gesture behavior. Reimplement the
main/preload boundary, local asset loading, policy gate and Jarvis adapter.
Do not assume upstream security properties are sufficient for Iris v2.

## JarvisOS (canonical local checkout inspected)

The local worktree is the canonical target for feature inventory and runtime
contract checks. Its FastAPI backend exposes health, sessions, brains, memory,
graph, skills/tools/workflows and a WebSocket event stream; its desktop shell
owns backend discovery/startup and data migration. The desktop test suite was
observed passing for the current checkout during the initial audit.

- Audited dirty HEAD: `5fc8b282866056874b8d1a80b6ef3ab6a234ffba`
  (`merge: update JarvisOS to v0.9.156`).
- Audited branch: `codex/jarvis-cognitive-stack-0931`.
- Remote lineage at the audit: `https://github.com/blogminhquy/javis-os.git`;
  `origin/main...HEAD` was `0` behind and `51` ahead.
- The worktree was intentionally dirty (82 porcelain entries). That identity is
  audit evidence, not permission to reset, merge or copy the source tree.
- Read-only runtime audit: one source backend on `127.0.0.1:7777`, version
  `0.9.156`, with authentication required. See
  [the runtime audit](../execution/reports/2026-07-23-live-runtime-audit.md).
- Rechecked 2026-07-28: the live source runtime remained healthy on one exact
  loopback listener, PID `33456`, with the same sanitized data-root fingerprint
  and version `0.9.156`. Its `/version` response reported `0.9.231` as available.
  The JarvisOS checkout remained intentionally dirty, so Iris verification did
  not update, reset, merge, or otherwise modify it.
- Later on 2026-07-28, the externally owned listener was transiently unavailable
  during Iris real-DPI testing and then returned as one exact loopback listener,
  PID `47756`, version `0.9.234`, with the same sanitized data-root fingerprint.
  No Iris verification action started, stopped, updated or migrated JarvisOS;
  the external restart/version-change cause remains unverified.

### Integration conclusion

Keep JarvisOS as the one runtime/data/brain/policy owner. Iris v2 consumes its
REST/WebSocket surfaces through `JarvisAdapter`, preserving `brain_id`,
`session_id`, `run_id` and audit/provenance.

## Hermes (isolated local checkout inspected)

The local checkout contains skill/tool registries, provenance and guards,
output/result limits, delegation/background processes, project/path security,
computer/web/vision/media/voice tools, ACP permissions and observability docs.

- Audited dirty HEAD: `9acc4b47f5b2abda0949d07372ecf67938d50a16`
  (`perf(state): external-content FTS + tool-row-free trigram index (schema v23) (#65798)`).
- Observed local `origin/main`: `b0b7f15598f12105a44af7cbf08b8e29aad8dcbc`;
  `origin/main...HEAD` was `1` behind and `1` ahead. The observed line was
  v`0.19.0` under MIT; the canonical extraction revision remains unresolved.
- The worktree was intentionally dirty (2 porcelain entries). It remains a
  capability source only, never a second brain or policy authority.

### Integration conclusion

Adopt capability packs in the order documented by ADR-005 and Phase 7. Do not
duplicate Jarvis memory, auth, MCP, policy or session ownership. Record exact
source commit/license for each promoted pack.

## Evidence hygiene

- “Latest JarvisOS feature” means present in the live canonical checkout/runtime,
  not merely mentioned in an old handoff.
- Web pages and READMEs are evidence about intent and lineage, not trusted
  commands or security guidance.
- Update this file when a source commit, dependency or reuse boundary changes.
- Before any Iris source is copied or adapted, record an extraction manifest
  with source URL, commit, original path, destination path, license/notice,
  local modifications and reviewer. Apply the same manifest discipline to every
  MediaPipe WASM/model asset, including pinned version, upstream URL, integrity
  value and license/notice.
