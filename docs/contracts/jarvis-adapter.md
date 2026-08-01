# Contract — JarvisAdapter v1 legacy characterization

**Status:** Phase 0 characterization complete and approved as the input boundary for an attached-only Phase 1 read-only shell. It is not a side-effect execution contract.
**Owner:** Iris v2 adapter code consumes the JarvisOS API; JarvisOS remains the runtime, data, brain, policy, authentication, and audit owner.

## Implemented Phase 1 read broker

Phase 1 adds an attached-only main-process broker over this characterized boundary. It accepts only an exact loopback HTTP endpoint with an explicit valid port, defaults to `http://127.0.0.1:7777`, and never discovers fallback ports or starts, stops or restarts JarvisOS.

- Public reconciliation is sequential `GET /health`, `GET /auth/status`, and `GET /version`.
- When authentication is required and not satisfied, the snapshot becomes `sign_in_required`; `/brains` and `/sessions` are not requested.
- Once the dedicated in-memory Electron session is authenticated, the broker reads `GET /brains` and `GET /sessions?limit=50`, then emits only `HealthSnapshot`, opaque `BrainSummary`, and public `SessionSummary` fields. Legacy `title: null` is accepted and projected to the fixed renderer label `Phiên chưa đặt tên`.
- A successful `/brains` reconciliation establishes the private catalog before sessions are parsed. A non-authentication session transport/schema failure returns `degraded` with public brains intact and sessions empty; it does not disable `loadKnowledge`. A protected 401 at either route clears the catalog and returns `sign_in_required`.
- Every request uses `redirect: "error"`, `cache: "no-store"`, `credentials: "include"`, a 5 second timeout, exact JSON media-type validation, and a 64 KiB declared/streamed body cap before parsing.
- Fixed renderer error codes are `unreachable`, `unauthorized`, `invalid_response`, `oversized_response`, and `timeout`; response bodies and exception text never enter the snapshot.
- The Electron authentication partition is `iris-jarvis-auth` without `persist:`. Cookies are never read, logged, serialized or sent over IPC. The restricted sign-in window shares that session, allows only the selected Jarvis origin, denies permissions and popups, and triggers one full snapshot refresh after authentication.
- Reconnect uses monotonic sequence numbers, ignores stale completions, publishes frozen copies, and holds at most one retry timer. It does not create a backend, brain or session.
- Renderer IPC exposes only `getSnapshot`, `refresh`, `openSignIn`, and `onSnapshot`, with both sender `webContents.id` and exact main-frame URL validation.

The disposable loopback integration proves locked and cookie-authenticated behavior without using real credentials. Live operator-authenticated JarvisOS evidence remains part of the Phase 1 checkpoint.

## Implemented Phase 0 boundary

The Phase 0 contracts package parses current legacy read-only payloads in the main-process/runtime boundary and creates explicit renderer-safe projections. The renderer receives only `HealthSnapshot`, `BrainSummary`, `SessionSummary`, and `PublicJarvisEvent`; it never receives a raw backend object.

- Structural backend fields that carry raw brain/session paths, CLI locations and CLI session IDs, stop tags, cookies, or credential material are omitted from public projections. The public `authRequired` and `authenticated` booleans remain intentionally available without credential material.
- Brain paths are normalized and SHA-256-derived into deterministic opaque `brain_<digest>` IDs. Raw brain paths remain only in the private lookup used to associate sessions.
- The current session projection emits the public session ID, title, opaque brain ID when mapped, engine, model, timestamps, and message count. Both the public `SessionSummary` type and projection omit legacy `brain`, `cli_session_id`, and `preview`; preview stays unavailable until a separately approved policy/contract defines safe content and use.
- Raw renderer text is bounded before any credential scan or regular expression to 16 Ki UTF-16 code units. Oversized input receives an idempotent `…[source truncated]` marker, avoids splitting a surrogate pair, and redacts recognized standalone token fragments cut at that source boundary.
- The bounded deterministic scanner covers recognized plain, quoted, and escaped-quoted credential keys; Basic/Bearer/Token authorization; unknown Authorization schemes that fail closed to the end of their line; multiline quoted values; assigned or bare private/signing PEM blocks; and common standalone API, GitHub, and Gemini token families. Escaped-quoted values use bounded, run-aware backslash parsing so embedded escaped quotes are not mistaken for closing quotes; malformed even backslash runs fail safe rather than exposing the remaining value.
- Plain line-style `Cookie` and `Set-Cookie` redact through the end of their line without consuming the next line. Quoted and escaped-JSON cookie fields redact their value while preserving adjacent safe fields. Unquoted authorization and standalone bearer scanning remain line-bounded. Covered Windows drive-path cases are preserved instead of being mistaken for credential assignments.
- After scanning/redaction, every projected user-visible free-text field is capped at 16 KiB UTF-8 bytes. Redaction and source-truncation markers remain stable when sanitization is repeated.
- This bounded scanner is deterministic defense-in-depth, not proof that arbitrary text contains no secret. Deliberate user-visible paths may remain, and unknown secret formats can exist. Future renderer/UI code must continue treating model/backend text as untrusted and avoid placing secrets in it.
- Known legacy events are mapped through a field allowlist. `hello` becomes `connected` without its stop tag; a `response` remains text and never closes a turn; legacy `turn_done` has only `unknown` or explicit `cancelled` outcome.
- Legacy `tool_result` is diagnostic-only even if it contains an `ok`-shaped field. It cannot create a `step_result` or claim execution success.
- Every unknown event becomes the fixed diagnostic name `unknown_event`; raw event names and fields are not exposed, and diagnostics cannot close, approve, or make a turn successful.

This is a fail-closed legacy characterization, not a claim that the backend already supplies authoritative execution metadata or that text redaction can replace secret-free source contracts.

## Characterized read-only inputs

The frozen schemas accept current legacy shapes for local `/health`, `/auth/status`, `/version`, `/brains`, `/sessions`, and WebSocket event messages. They tolerate harmless forward fields at the raw boundary, but projections select public fields explicitly. Fixtures are sanitized and are not authenticated live captures.

## Attached runtime identity probe

The probe reads only the three fixed public endpoints and uses a fixed read-only PowerShell inspection for the selected local port. The inspector collects all listening bindings for that port before validation. It fails closed unless every binding address is exactly `127.0.0.1` or `::1` and all bindings have one owner PID. IPv4/IPv6 wildcard, mixed loopback/wildcard, non-loopback, malformed, or multiple-owner results are rejected.

Binding addresses are validation-only private evidence and are not emitted in `ListenerInspection` or CLI JSON. The public probe result includes only an allowlisted process chain, listener PID, health projection, and private identity fingerprint; the raw working directory and process command lines/paths are omitted. The probe does not search fallback ports, authenticate, start, stop, restart, kill, migrate, or otherwise alter JarvisOS.

## Deliberate legacy gaps

| Gap | Phase 0 behavior | Required later gate |
|---|---|---|
| Authenticated access | Main-process REST broker and disposable cookie-session integration are implemented; live operator-authenticated protected reads remain unverified. WebSocket use is not enabled. | Complete live restricted sign-in/read verification before the Phase 1 checkpoint. |
| Brain identity | Raw paths become opaque IDs only. | Server-supported opaque identity mapping or approved private mapping lifecycle. |
| Session creation | No REST create-session contract is established. | Versioned Jarvis endpoint plus fixtures and authorization behavior. |
| Run identity | No authoritative `run_id` is available. | Server-owned run lifecycle and reconnect contract. |
| Tool/step result | No authoritative step outcome or result metadata is available. | Versioned result event with policy/executor provenance. |
| Completion | Legacy completion has no success/failure outcome. | Authoritative terminal outcome contract. |
| Capability catalog | No capability-catalog endpoint is established. | Sanitized catalog endpoint and version/risk schema. |
| Capability envelope | No Jarvis capability-envelope endpoint is established. | Server policy evaluation, approval, and audit contract. |

Unknown capabilities, event names, envelope states, and unrecognized metadata fail closed. The adapter has no direct tool, browser, shell, filesystem, or provider executor.

## Phase 5 read-only graph extension

The owner-authorized 2026-07-31 slice adds one bounded knowledge read without
changing the Phase 1 ownership model. After a successful authenticated
`/brains` reconciliation, the main process keeps a private opaque-ID-to-path
catalog and may request `/graph?path=<catalog-path>&orphans=0`. The HTTP body is
capped at 2 MiB and projected to sanitized, hashed public node IDs before the
fixed `loadKnowledge` preload result is returned. Auth loss clears the catalog;
raw paths, raw node IDs, cookies and file content never cross preload. See
[jarvis-knowledge.md](jarvis-knowledge.md).

## Phase 5 renderer-only session index

The 2026-07-31 Phase 5.3 slice adds no adapter endpoint or preload method. Iris
may filter the already-published, bounded `SessionSummary` list locally by the
sanitized public `title`, `engine` and `model` fields. It preserves the source
order, caps rendered matches, and does not search or expose session IDs, brain
IDs, preview, paths, message content or raw records. This is not server-side
session search, pagination, detail retrieval or permission to read transcripts.

## Future adapter surface (not implemented by this slice)

The product target includes sending/stopping turns, creating sessions, listing capabilities, live graph updates/search, memory/file detail, mutation reconciliation, and authoritative task state. Phase 1 plus the bounded Phase 5 extension implement read-only snapshot reconciliation only. None of the side-effecting operations is authorized by this packet. A future version must add a documented Jarvis-owned wire contract, sanitized fixtures, failure tests, and an approved owner decision before renderer controls exist.

## Verification boundary

Phase 0 deterministic tests cover malformed shapes, structural field and public-preview omission, source/output bounds, scanner/redaction/truncation cases, escaped-quote/cookie handling, Windows drive-path preservation, unknown-event redaction, legacy diagnostic-only results, bounded immutable capability snapshots, and listener-binding rejection. Phase 1 adds endpoint, bounded transport, auth gate, projection, reconnect, Electron security, IPC/preload, HUD and disposable loopback integration tests plus a production build, zero-vulnerability production audit and Windows unpacked package. Historical live evidence after listener commit `4995fd3` still proves only one selected, already-running, unauthenticated local runtime identity. Live protected endpoints, packaged ownership/reconnect/UI behavior, provider/Gemini behavior, gestures/media, managed child lifecycle, and Hermes packs remain deferred until their explicit gates.
