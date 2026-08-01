# Phase 0 final verification packet

**Date:** 2026-07-24
**Checkpoint state:** `READY_FOR_PM_REVIEW`
**Scope:** contract characterization and attached-only runtime identity only.

## Reviewed implementation

This offline reconciliation reviews current contract-only implementation HEAD `5c56ddb`. The latest bounded-renderer/envelope sequence is:

- `e71ad6b` — `fix: bound renderer credential scanner`
- `d34bead` — `fix: close renderer truncation edge cases`
- `622862d` — `fix: keep bearer redaction line bounded`
- `f402e57` — `fix: preserve drive paths during redaction`
- `8227f55` — `fix: harden escaped credentials and envelope bounds`
- `c25ad16` — `fix: validate capability snapshot once`
- `5c56ddb` — `fix: reject capability proxy inputs`

Historical live evidence was collected after listener commit `4995fd3`; it was not rerun for later contract-only commits, including `5c56ddb`.

## Fresh verification

All commands in this section were run offline from the Phase 0 worktree after the checkpoint documentation was reconciled with the current implementation. No command contacted, authenticated, started, stopped, restarted, migrated, or modified JarvisOS. The previously authorized live evidence is preserved separately below and was not rerun.

| Command | Sanitized result |
|---|---|
| `npm ci` | Exit 0: 54 packages added, 57 packages audited, 0 vulnerabilities. |
| `npm run typecheck` | Exit 0. |
| `npm test` | Exit 0: 4 test files and 181 tests passed. |
| `npx -y -p @google/design.md designmd lint DESIGN.md` | Exit 0: 0 errors, 0 warnings, 1 informational finding. |
| `git diff --check c522fde..HEAD` | Exit 0 with no whitespace errors. |
| Fail-fast local Markdown link check over all tracked Markdown files | Exit 0: `LOCAL_MARKDOWN_LINKS_OK`. |
| Tracked Markdown syntax check for split links and balanced fences | Exit 0: `MARKDOWN_SYNTAX_OK`. |
| Parse every tracked JSON file | Exit 0: `TRACKED_JSON_OK`. |

## Renderer projection evidence

- Public projections select fields explicitly; raw structural backend paths, CLI locations and CLI session IDs, stop tags, cookies, and credential-bearing fields are omitted. Public `authRequired` and `authenticated` booleans remain intentionally available without credential material.
- Raw brain paths become deterministic opaque IDs. Both public `SessionSummary` and the current projection omit raw `brain`, `cli_session_id`, and `preview`; preview requires a separately approved policy/contract.
- Raw text is bounded before scanner/regex work at 16 Ki UTF-16 code units. Oversized input receives an idempotent `…[source truncated]` marker without splitting a surrogate pair, and recognized standalone token fragments cut at the boundary are redacted.
- The bounded deterministic scanner recognizes plain, quoted, and escaped-quoted credential keys; Basic/Bearer/Token Authorization values; unknown Authorization schemes that fail closed to the end of their line; multiline quoted values; assigned or bare private/signing PEM blocks; and common standalone API/GitHub/Gemini token families. Unquoted authorization and standalone bearer matching are line-bounded. Covered Windows drive-path cases remain visible.
- Escaped-quoted values use bounded, run-aware backslash-run parsing. Embedded escaped quotes are distinguished from closing quotes, while malformed even runs fail safe without leaking the remaining value.
- Plain line-style `Cookie` and `Set-Cookie` redact through the end of their line and preserve the next line. Quoted and escaped-JSON cookie fields redact their value while preserving adjacent safe fields.
- Final projected user-visible free text is capped at 16 KiB UTF-8. Scanner/redaction/truncation markers are idempotent under repeated sanitization.
- Redaction is defense-in-depth, not proof that arbitrary text has no secret. Deliberate user-visible paths and unknown credential formats may remain; downstream text stays untrusted.
- Legacy `tool_result` remains diagnostic-only, unknown events become `unknown_event`, a text `response` does not complete a turn, and legacy completion never fabricates success.

## Capability-envelope evidence

An iterative preflight runs before recursive Zod validation and rejects over-budget or unsafe JSON using these guarantees:

- 64 KiB total JSON budget;
- maximum depth 8 and maximum 512 visited nodes;
- maximum 64 entries in any object or array;
- maximum 128 UTF-8 bytes per key and 16 KiB UTF-8 bytes per string;
- cycle and non-JSON rejection, including non-finite numbers; and
- qualified normalized credential-key rejection throughout objects.

Node-detectable Proxy objects are rejected before observation traps. Object and
array accessors are rejected without invocation; sparse arrays, non-plain
prototypes, and prototype-sensitive keys fail closed. Own enumerable string
keys are enumerated incrementally, and observing a 65th entry rejects before its
value is read. Accepted data-descriptor values are copied exactly once into a
new null-prototype object or array snapshot while every byte, depth, node,
collection, key, credential-key, JSON-type, and cycle constraint is enforced
against those exact values. The completed snapshot is frozen and passed to Zod;
the original untrusted object is not read again. Symbol and non-enumerable
properties are outside the JSON payload surface and cannot confer authority.

The strict structural schema still accepts only `proposed`. `approval.expires_at` must be after `created_at`, with a proposal lifetime of at most 15 minutes. Capability-specific argument semantics and semantic executable-code/instruction detection remain future Jarvis gates; bounded JSON validation does not authorize execution.

## Preserved loopback-only attached probe evidence

The final Windows inspector collects every listening binding for the selected port before deciding. It fails closed unless every binding is exactly `127.0.0.1` or `::1` and every binding has one owner PID. Wildcard, mixed loopback/wildcard, non-loopback, malformed, and multiple-owner results are rejected by deterministic tests.

The single earlier authorized live command remains the evidence of record: after listener commit `4995fd3`, `npm run probe:jarvis -- --endpoint http://127.0.0.1:7777 --repeat 2` exited 0; both samples were healthy on version `0.9.156`, authentication was required and unauthenticated, listener/fingerprint identity was stable, and `sameRuntime=true`. The separate earlier adjacent-port scan returned `NO_LISTENERS_7778_7816`.

Binding addresses are used only for validation and are not emitted in the probe result. Therefore, that successful run is evidence that the complete selected-port binding set passed the exact loopback/one-owner invariant, while this sanitized record contains no binding address, raw working directory, fingerprint value, command line, executable path, credential, or private content. Historical live evidence was collected after listener commit `4995fd3`; the live command and adjacent-port scan were not rerun for later contract-only commits, including `5c56ddb`.

## Phase 0 commit history reviewed

- `75b1b95` — `docs: capture Phase 0 runtime provenance`
- `7b708e1` — `feat: freeze legacy Jarvis contract projections`
- `1353075` — `fix: harden renderer contract projections`
- `e21ad55` — `feat: add attached Jarvis runtime identity probe`
- `101501c` — `fix: harden attached runtime identity checks`
- `1d9b7fd` — `docs: prepare Iris v2 Phase 0 checkpoint`
- `cad367e` — `docs: correct Phase 0 status claims`
- `06f0107` — `fix: bound renderer and envelope inputs`
- `bfc1e44` — `fix: redact quoted renderer credentials`
- `0aa6b35` — `fix: make renderer redaction idempotent`
- `4995fd3` — `fix: require loopback-only Jarvis listener`
- `7b26076` — `docs: reconcile Phase 0 final hardening`
- `e71ad6b` — `fix: bound renderer credential scanner`
- `d34bead` — `fix: close renderer truncation edge cases`
- `622862d` — `fix: keep bearer redaction line bounded`
- `f402e57` — `fix: preserve drive paths during redaction`
- `83194d2` — `docs: record bounded renderer scanner`
- `8227f55` — `fix: harden escaped credentials and envelope bounds`
- `171cde9` — `docs: close Phase 0 review findings`
- `c25ad16` — `fix: validate capability snapshot once`
- `5c56ddb` — `fix: reject capability proxy inputs`

## Legacy gaps and deferred verification

The characterized legacy adapter has no approved authenticated broker, REST create-session contract, authoritative `run_id`, authoritative step/outcome metadata, capability catalog, or capability-envelope endpoint. Unknown events and capabilities fail closed. The following remain unverified and deferred:

- authenticated protected REST/WebSocket endpoints;
- renderer and backend crash/kill recovery;
- packaged Electron shell and packaging lifecycle;
- provider/Gemini behavior;
- gestures, camera, and media behavior;
- managed child-process lifecycle, shutdown, and data-root migration; and
- every Hermes capability pack.

This checkpoint packet authorizes no launch-mode, migration, credential, telemetry, provider, or side-effect change.

## Required product-owner checkpoint

Before Phase 1, approve or change exactly these decisions:

1. standalone Iris v2 executable with attached-only Phase 1;
2. source JarvisOS data root remains canonical; no AppData migration;
3. main-process authenticated broker handles REST/WebSocket credentials;
4. current default brain remains unchanged and uses an opaque ID;
5. telemetry remains off by default;
6. managed mode, Gemini credentials, and every Hermes pack remain disabled
   until later explicit gates.

Until then, the documented state is `READY_FOR_PM_REVIEW`; Phase 1 has not started.

## Post-review provenance appendix

- Reviewed implementation parent HEAD: `5c56ddb`.
- Final merge range: `c522fde..(commit containing this appendix)`.

This report intentionally does not embed its own commit hash because that would require changing the content that the hash identifies. The containing commit is resolved self-consistently from repository history:

```powershell
$phase0ReportCommit = git log -1 --format=%H -- docs/execution/reports/2026-07-23-phase-0-verification.md
git log --oneline "c522fde..$phase0ReportCommit"
```

The first command identifies the commit containing this appendix; substituting that hash yields the exact final merge range without a false self-reference.
