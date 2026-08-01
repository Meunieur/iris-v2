# Live JarvisOS Runtime Audit — 2026-07-23

**Method:** read-only local process inspection plus unauthenticated requests to
the fixed loopback endpoint. No process was started, stopped or restarted, and
no source data, configuration, credentials, sessions, brains or vault content
was changed. The evidence was rechecked on 2026-07-24 while preparing this
record; volatile PID values are observations, not a future identity contract.

## Runtime observation

| Field | Observed value |
|---|---|
| Endpoint | `http://127.0.0.1:7777` |
| Listener | One loopback listener; PID `27024` during the recheck |
| Process chain | `python3.11.exe` (27024) ← `python.exe` (23272) ← `cmd.exe` (21788) |
| Health | `200 OK`; `status: ok`; source cwd matched the canonical JarvisOS checkout |
| Version | `0.9.156`; Windows mode; update available to `0.9.158` |
| Authentication | `/auth/status` returned `auth_required: true`, `require_login: true`, `authed: false` |

The status endpoint proves a healthy source runtime but does not confer an
authenticated session to Iris v2. Any protected REST or WebSocket use requires
an approved main-process broker; credentials must not enter the renderer.

## Canonical source data roots

The live source runtime reported the canonical JarvisOS checkout as its cwd. In the
source configuration, the local defaults resolve from that checkout unless an
explicit source-runtime environment override is set:

- runtime state: `server/` (`JAVIS_STATE_DIR` default);
- brains: `brains/` (`BRAINS_DIR` default);
- vault: `vault/` (`OBSIDIAN_VAULT_PATH` default);
- source session database: `server/conversations.db`;
- source tree: the JarvisOS checkout.

These roots remain owned by JarvisOS. Iris v2 does not copy, move, create or
migrate them.

## Source identity and divergence

| Source | Commit / state | Divergence evidence |
|---|---|---|
| Iris upstream | `60113345841b3d18a83fc9f2e6eb727a83d141d1` | Audited UI/gesture lineage; no local source copied by this task |
| JarvisOS | Branch `codex/jarvis-cognitive-stack-0931`, HEAD `5fc8b282866056874b8d1a80b6ef3ab6a234ffba` (`merge: update JarvisOS to v0.9.156`) | Dirty worktree; `origin/main...HEAD` count `0 behind / 51 ahead` |
| Hermes | HEAD `9acc4b47f5b2abda0949d07372ecf67938d50a16`; local `origin/main` `b0b7f15598f12105a44af7cbf08b8e29aad8dcbc`; v`0.19.0`, MIT | Dirty worktree; `origin/main...HEAD` count `1 behind / 1 ahead`; canonical extraction revision unresolved |

The dirty JarvisOS and Hermes trees are evidence inputs only. They are not to
be reset, merged, copied or modified from this repository.

## Legacy Electron artifact risk

The existing JarvisOS desktop artifact is not a safe attached-only Phase 1
host. Its `desktop/electron/main.js` sets a distinct
`%APPDATA%/JarvisOS_MinhQuy` user-data layout, scans for the next free port from
`7777` through the following range, then spawns a backend. Its desktop guide
also describes first-run migration into that AppData layout. This behavior can
produce a different port and data root from the live source runtime.

## Current adapter mismatches to characterize

- Health, version and auth are separate legacy responses; the Iris
  `HealthSnapshot` must be a safe aggregate rather than a raw response.
- Source brain/session payloads can contain paths and legacy fields, so Iris
  must project opaque IDs and omit paths and `cli_session_id` from renderer data.
- The current Phase 0 evidence has no approved authenticated broker for
  protected REST or WebSocket requests.
- Current REST/WebSocket data lacks a frozen runtime identity, `run_id`, risk,
  provenance and authoritative outcome metadata; a text response cannot be
  treated as a completed turn.
- There is no frozen capability-catalog or capability-envelope endpoint;
  unknown capabilities and events must fail closed.
- REST create-session behavior is not an established Phase 0 contract.

## Result

The evidence supports only the following proposal: a standalone Iris v2 host
that initially attaches to this source JarvisOS runtime. Managed mode remains
disabled until singleton identity, data-root fingerprint, authenticated broker
and process-tree shutdown contracts are approved.
