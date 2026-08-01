# Contract — Jarvis-owned Iris task lifecycle v1

**Status:** accepted for deterministic implementation; companion JarvisOS
branch is not yet installed into the live runtime.

**Owners:** JarvisOS owns authentication, brain resolution, policy, tools,
execution, task/run/event storage and terminal outcome. Iris main owns bounded
transport, retry/poll coordination and renderer-safe projection. The renderer
owns presentation only.

## Submit

`POST /iris/v1/turns` accepts strict JSON:

```json
{
  "version": 1,
  "intent_id": "UUID",
  "idempotency_key": "UUID",
  "brain_id": "brain_<64 lowercase hex>",
  "session_id": "optional bounded public session label",
  "message": "1..4000 characters"
}
```

Unknown fields are rejected. In particular, a client cannot submit `path`,
`risk`, capability, route, tool or approval fields for the server to ignore or
reinterpret.

The route resolves `brain_id` only against the current server-owned `/brains`
catalog. Raw paths and unknown opaque IDs return not-found. The server computes
and stores a canonical payload digest, creates only `created_by=iris-v2`,
`capability=iris-read`, `execution_mode=suggest`, and starts that exact task.

The first accepted request returns HTTP 201. An exact replay returns HTTP 200
with `replayed=true` and the same `task_id`. A changed payload under the same
key returns HTTP 409 and creates no task.

## Snapshot and event cursor

`GET /iris/v1/turns/{task_id}?after_event_id=N` returns only an Iris-owned task.
The response is an allowlist:

- `version`, `task_id`, `intent_id`, opaque `brain_id`, bounded `session_id`;
- fixed `risk=R0`;
- authoritative `status`, `terminal`, `outcome`, `current_run_id`;
- `orphaned`, derived from a running task whose Jarvis lease expired;
- `can_stop`, `replayed`, `event_cursor` and bounded terminal `result`;
- event records containing only numeric ID, fixed type, run ID and timestamp;
- run records containing only run ID, status and lifecycle timestamps.

The projection omits `brain_root`, raw paths, task intent, generic metadata,
payload hashes, cookies, credentials, engine internals, tool arguments, event
messages, stack traces and raw backend objects. A known brain root appearing in
terminal result text is replaced case-insensitively before projection. Iris
main applies the shared bounded credential redactor once more before any result
can reach preload. All text remains untrusted renderer content.

Terminal outcome is mapped only from Jarvis task status:

| Jarvis status | Public outcome |
|---|---|
| `done` | `succeeded` |
| `review` | `needs_approval` |
| `blocked` | `blocked` |
| `cancelled` | `cancelled` |
| `archived` | `archived` |

Non-terminal statuses have no outcome. Model text and diagnostic events never
close a task.

## Stop

`POST /iris/v1/turns/{task_id}/stop` can stop only tasks with both
`created_by=iris-v2` and `capability=iris-read`. Ready work becomes cancelled;
a running worker is cancelled through the existing Jarvis worker tag and its
authoritative store state is returned. Foreign and unknown tasks are reported
as not-found.

Stop is not rollback. The R0 lane has no mutation authority, so this slice has
no side-effect replay or compensation surface.

## Main-process reconciliation

Iris exposes exactly `getTaskSnapshot`, `sendTurn`, `stopTurn` and
`onTaskSnapshot` across preload. `sendTurn` accepts only opaque brain ID plus a
bounded message and optional bounded public session ID. Main creates UUIDs and
retains the pending request in memory.

- If submit transport fails before a response is observed, retry uses the same
  intent and idempotency IDs.
- After a task ID is known, refreshes use GET plus `event_cursor`; they never
  resubmit.
- Terminal states stop polling.
- Stale async completions are ignored by generation.
- At most one retry/poll timer exists.
- A pending unknown submit cannot be replaced by a new intent, replay
  provenance survives later polls, and renderer history retains only the 100
  most recent allowlisted events while the authoritative cursor advances.
- Auth failure becomes sign-in-required; transport/schema failure becomes
  reconnecting without inventing progress or completion.

## Closed gates

The companion Jarvis route must be reviewed, merged and the canonical runtime
restarted before live task execution can pass. Installing that backend change
or restarting the user's live runtime is a separate owner gate because the
canonical Jarvis working tree has unrelated user files and the current process
is active.

Phase 6 remains required before any mutation, approval or R1/R2/R3 capability.
The Phase 2 physical gesture checks, live Gemini checkpoint and protected
Second Brain human review remain deferred rather than passed.
