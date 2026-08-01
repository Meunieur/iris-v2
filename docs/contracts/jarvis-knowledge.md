# Contract — Jarvis Second Brain read bridge v1

**Status:** authorized for a deterministic read-only slice on 2026-07-31.
**Owner:** JarvisOS owns brains, paths, notes, memory, graph data, policy and
authentication. Iris v2 owns only the bounded adapter and Galaxy presentation.

## Purpose

Expose a useful Second Brain/Galaxy view without creating an Iris database,
changing the Jarvis default brain, or sending a raw path to the renderer. This
slice intentionally skips Phase 4 turn execution and does not satisfy the
deferred Phase 2 gesture or Phase 3 live-conversation checkpoints.

## Legacy routes consumed

The attached main-process session may issue only these authenticated GETs:

1. `GET /brains` through the existing base snapshot reconciliation.
2. `GET /graph?path=<server-returned-brain-path>&orphans=0` after the operator
   selects one opaque brain ID published by that same catalog.

The graph route is never built from renderer text. The private path must come
from the latest successful authenticated `/brains` response and is discarded
when protected reconciliation fails or authentication is lost.

The current `GET /memory/stats` route is excluded. Its implementation calls a
helper that may create missing memory folders and `MEMORY.md`, so it is not a
pure read contract even though the HTTP verb is GET. Memory statistics and
detail panels remain pending until JarvisOS exposes a genuinely read-only,
bounded, authenticated endpoint.

## Raw graph boundary

The main process accepts the characterized Jarvis graph shape:

- `nodes`: at most 2,000 objects with string `id`, `label`, `folder`, `path`,
  optional `fullpath`, non-negative integer `links`, and finite non-negative
  timestamp `t`;
- `edges`: at most 10,000 `{source,target}` string pairs;
- `categories`: at most 32 `{name,count}` entries;
- `stats`: non-negative integer `total_notes`, `total_links`, `orphans`, and
  `hidden`;
- harmless unknown forward fields are accepted at the raw boundary and never
  forwarded automatically.

The graph HTTP body has a separate hard cap of 2 MiB. Redirects, wrong media
types, malformed JSON, authentication failure, oversized bodies, invalid
shapes and timeouts fail closed with fixed error codes.

## Public projection

The renderer receives one immutable `JarvisKnowledgeSnapshot`:

- fixed state: `ready`, `sign_in_required`, or `unavailable`;
- capture time and selected public `BrainSummary`;
- at most 500 public nodes and 1,000 public edges;
- public node IDs are SHA-256-derived from the opaque brain ID plus the raw
  graph node ID;
- node label/folder and category names pass through the existing bounded
  renderer sanitizer;
- node source is the fixed value `jarvis_brain`; raw `path` and `fullpath` are
  omitted;
- public edges are retained only when both endpoints survived projection;
- stats include authoritative raw counts, returned counts and a `truncated`
  flag.

The renderer never receives a brain path, file path, cookie, credential,
arbitrary endpoint, raw graph object or file content. Unknown brain IDs and
stale catalogs fail closed.

## Preload and UI surface

Preload adds exactly one fixed method:

```ts
loadKnowledge(brainId: `brain_${string}`): Promise<JarvisKnowledgeSnapshot>
```

Main IPC verifies the exact sender/frame and validates the ID as
`brain_` followed by 64 lowercase hexadecimal characters. No generic fetch,
query, path, WebSocket, mutation, default-brain switch or file-read method is
exposed.

The Command Deck Galaxy panel must:

- describe brain selection as a view context, not a Jarvis default change;
- require an explicit load/refresh action because graph scans can be costly;
- display source, bounded/truncated state, graph counts and auth/error state;
- retain keyboard operation, a readable node/category fallback and reduced
  motion;
- expose no memory write, file open, execute, approve or delete control.

## Renderer-only density reveal

The Neural Observatory may expose exactly three local projection sizes:
36, 72 and 96 nodes. The default is 72. This control operates only on the
sanitized `JarvisKnowledgeSnapshot` already held by the renderer and therefore:

- issues no adapter, IPC, network or filesystem request;
- performs no server pagination, progressive fetch, caching or persistence;
- never changes the authoritative returned/total counts;
- retains the selected density when a searched node outside the current
  projection is focused; and
- pins that focused node plus a deterministic local relation so the inspector
  does not imply a disconnected result.

The maximum visual projection is 96 nodes. This local reveal is not the future
`/ws/graph` or server-side progressive-loading contract.

## Verification

- Contract tests reject path/fullpath leakage, credential-shaped text,
  oversized collections, invalid endpoints and edges to omitted nodes.
- Adapter tests prove only a server-returned path is used and that serialized
  public output contains no private path or raw node ID.
- IPC/preload tests prove fixed-channel and trusted-frame enforcement.
- UI tests cover authenticated, sign-in-required, empty, truncated and error
  states with keyboard-operable controls, including 36/72/96 density changes
  and stable density when a hidden searched node is focused.
- A representative maximum public snapshot of 500 nodes and 1,000 edges must
  project the 96-node field within the documented deterministic performance
  budget.
- Disposable loopback integration proves authenticated GET-only behavior.
- The real attached runtime may prove the public auth boundary while the owner
  is remote; protected Second Brain content remains explicitly unverified until
  the operator authenticates the dedicated Iris session.
