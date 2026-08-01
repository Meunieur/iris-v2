# Iris v2 — Security, Privacy and Safety Contract

Iris v2 is an operator system with access to local data and potentially
side-effecting tools. Security is a product feature, not a release checklist.

## 1. Threat model

| Threat | Example | Required mitigation |
|---|---|---|
| Compromised renderer | XSS or malicious remote text calls an IPC method | Narrow preload, schema validation, sender/origin checks, sandbox where possible |
| Secret exposure | Gemini/Jarvis key appears in `window`, logs or crash dump | Keep credentials in runtime/backend; redact logs; return capability state, not keys |
| Tool bypass | Gemini says “run this now” and invokes a shell/browser directly | Capability envelope + Jarvis policy/approval; Gemini is proposal-only |
| Path escape | Brain/file ID becomes `..\\` or an arbitrary absolute path | Server-side opaque ID resolution, allowlists, canonicalization and tests |
| Prompt/skill injection | Retrieved document tells the model to ignore approval | Treat content as data; policy is outside model context and enforced server-side |
| Duplicate runtime | Hot reload starts two Jarvis processes on one data root | Singleton discovery/lock, health check and lifecycle supervisor |
| Camera privacy | Gesture frames leave the machine or remain active after close | Explicit permission, local inference, pause/stop control, no frame persistence |
| Provider compromise/outage | Gemini or remote service is unavailable or returns malformed data | Typed schemas, timeouts, fallback text/TTS, no implicit retries for side effects |
| Skill supply chain | Unreviewed Hermes/Jarvis skill executes arbitrary code | Provenance, version pin, AST/static audit, capability allowlist and rollback |
| Build dependency supply chain | A packaging-only parser exhausts CI memory or a new advisory enters the lockfile | Locked install, exact advisory provenance, dev-only reachability proof, expiry and fail-closed CI |
| External side effect | Send/delete/purchase/browser action is triggered accidentally | Risk levels, explicit confirmation, idempotency and audit event |
| Egress leakage | Tool sends brain content to an unexpected host | Network policy, host allowlist, redaction and visible provider attribution |

## 2. Non-negotiable invariants

1. Renderer code never receives raw API keys, refresh tokens, cookies or vault
   secrets.
2. The renderer never selects an arbitrary file or brain path. It submits an
   opaque ID that JarvisOS resolves and authorizes.
3. A model response, gesture, web page or skill instruction cannot change the
   risk policy or approve itself.
4. Every side-effecting request carries `intent_id`, `session_id`, provenance,
   risk and an idempotency key.
5. Camera inference is local by default. No frames are uploaded, persisted or
   used for biometric identification.
6. Unknown protocol events, capabilities and Hermes packs fail closed.
7. Shutdown and cancellation are observable; orphan child processes are cleaned
   up or surfaced as a recovery warning.

## 3. Risk levels

- **R0 — view/read:** health, status, graph query, local UI state. May be
  auto-approved by policy.
- **R1 — reversible local change:** draft, organize, create a non-public note.
  Policy may auto-approve only if the operator configured it.
- **R2 — external or account-scoped:** browser actions, messages, API writes,
  media generation or cloud calls. Show target, provider and confirmation.
- **R3 — destructive/financial/security:** delete, publish, purchase, auth,
  policy/credential change. Require explicit, fresh confirmation and a clear
  cancellation/rollback story.

Gesture input can initiate an R0/R1 proposal but cannot be the sole approval
for R2/R3. Voice confirmation must be bound to the visible proposal and expire.

## 4. Electron boundary requirements

- `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` when
  compatible with the selected preload design.
- Expose a small, versioned API; do not expose a catch-all config object or
  arbitrary command method.
- Validate every IPC payload with a schema and verify the sender window/origin.
- Block unexpected navigation/popups; open external links through an explicit
  user-confirmed system handler.
- Keep window operations and backend lifecycle in the main process, but make
  each operation allowlisted and auditable.

## 5. Gemini boundary requirements

Gemini receives only the minimum context needed for conversation. Sensitive
memory/vault material requires Jarvis retrieval policy and redaction. Gemini
function/tool calls are converted to the capability envelope in
[docs/contracts/capability-envelope.md](docs/contracts/capability-envelope.md).
No Gemini SDK callback may call a raw shell, filesystem, browser or MCP method.

## 6. Gesture boundary requirements

- Permission is requested only after the operator enables gesture mode.
- Model/WASM files are pinned, integrity-checked and served locally.
- Apply confidence, dwell and cooldown thresholds; stale pose data expires.
- Display the active gesture and a pause/disable control.
- Keep mouse/keyboard/voice fallback available.
- Record aggregate diagnostics only when enabled; never record frames by default.

## 7. Hermes boundary requirements

Every Hermes-derived pack needs:

1. source URL, commit/version, license and maintainer;
2. declared tools, network egress, filesystem scope and required secrets;
3. static/provenance audit and compatibility test;
4. Jarvis policy mapping and an explicit feature flag;
5. kill switch, rollback path and audit events.

If a pack cannot satisfy these requirements, it remains research-only and is
not enabled in Iris v2.

## 8. Build dependency exception policy

A temporary dependency exception is valid only when all of these are recorded
in `tools/security/audit-policy.json` and enforced by `npm run audit:policy`:

1. the exact official advisory URL, accountable owner, concrete reason and a
   near-term `review_by` date;
2. every affected lockfile node is development-only and its advisory provenance
   resolves completely to the reviewed URL;
3. no critical finding is present and the production audit remains clean;
4. CI fails for an unknown advisory, missing/cyclic-only provenance,
   production-reachable node, critical finding or expired review date.

An exception documents and constrains residual risk; it does not authorize a
release, signing decision or unrelated dependency drift. Release-candidate
review must either upgrade the affected chain or explicitly accept a renewed,
time-bounded exception.

## 9. Security verification gates

Before release, run preload exposure tests, navigation/IPC tests, path traversal
fixtures, prompt-injection fixtures, secret-redaction checks, camera/network
checks, duplicate-runtime tests and a real packaged smoke test. Record command,
environment, result and remaining risk in the release handoff.

## 10. Reporting a vulnerability

Do not disclose a suspected vulnerability, credential, private brain content or
raw private path in a public issue, discussion, screenshot or pull request.

Once the public GitHub repository enables private vulnerability reporting, use
the repository's **Security → Report a vulnerability** flow. Until that private
channel is published, retain the minimum sanitized reproduction locally and
wait for the product owner to announce the reporting contact. No public email
address or support identity is inferred by this repository.

Include only what is necessary to reproduce the problem:

- affected commit or release and Windows version;
- the trust boundary and impact;
- minimal sanitized steps or fixture;
- whether Jarvis, Gemini, camera or an optional provider was enabled;
- any known mitigation that does not destroy user data.

The maintainer should acknowledge the private report, reproduce it in an
isolated environment, publish a remediation plan and coordinate disclosure only
after a fixed artifact and rollback guidance are ready.
