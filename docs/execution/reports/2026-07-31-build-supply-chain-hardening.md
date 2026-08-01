# Iris v2 Build Supply-Chain Hardening Verification

- **Date:** 2026-07-31
- **Scope:** Electron packaging dependencies, audit enforcement and packaged
  Windows regression smoke
- **Verdict:** `COMPLETE_WITH_TIME_BOUNDED_DEV_EXCEPTION`
- **Release effect:** deterministic development may continue; this report does
  not authorize a signed release candidate

## Outcome

Iris now distinguishes a clean production dependency graph from one known,
packaging-only advisory instead of treating either a raw package count or a
production-only audit as sufficient evidence.

The package verifier uses `@electron/asar` 4.2.1. The stable
`electron-builder` 26.15.3 dependency graph still pins legacy ASAR/glob/minimatch
packages and produces 16 propagated package findings. Every finding resolves to
the same `brace-expansion` denial-of-service advisory, and every affected
lockfile node is development-only. The production audit reports zero known
vulnerabilities.

`npm run audit:policy` now makes that residual risk explicit and fail-closed. A
new advisory, production-reachable node, critical finding, incomplete advisory
provenance or expired review date fails CI.

## Threat model and reachability

| Question | Evidence-backed answer |
|---|---|
| What can the advisory affect? | Availability of a build process that expands an attacker-influenced brace pattern; unbounded expansion may exhaust memory. |
| Does the vulnerable chain ship as an Iris runtime dependency? | No. Every reported lockfile node is marked development-only, and `npm audit --omit=dev --audit-level=high` reports zero findings. |
| What input reaches the chain in this repository? | Trusted, version-controlled packaging paths and metadata during a bounded local/CI build. Iris does not expose this parser to renderer, Jarvis, Gemini, camera or network input. |
| What is the remaining impact? | A malicious or accidentally pathological build input could deny service to a developer or CI build. It is not treated as harmless, only bounded and time-limited. |
| What ends the exception? | Upgrade the stable builder chain, or perform a fresh owner review before the 2026-08-14 deadline. |

## Dependency decision

Three bounded options were evaluated:

1. Keep all current pins and accept the raw audit output. Rejected because it
   provides no enforceable provenance or expiry.
2. Move to the available Electron Builder v27 alpha. Rejected for this release
   slice because it is prerelease software and still left audited packaging
   findings during evaluation.
3. Keep stable Electron Builder 26.15.3, move Iris's direct package verifier to
   ASAR 4.2.1, and enforce a narrow time-bounded exception for the remaining
   transitive build chain. Selected as the smallest reviewable mitigation.

The exception is recorded in `tools/security/audit-policy.json` with an owner,
reason, exact official advisory URL and review date. It is not a wildcard and
cannot allow critical or production-reachable findings.

Primary references:

- <https://github.com/electron/asar/releases/tag/v4.2.1>
- <https://github.com/advisories/GHSA-mh99-v99m-4gvg>
- <https://github.com/electron-userland/electron-builder/releases>

## Test-first enforcement

The policy module was introduced through a failing test before implementation.
Six initial cases covered the reviewed advisory, unknown advisory,
production-reachable node, critical severity, expiry, and missing/cyclic
provenance. The real npm graph then exposed propagated package cycles; a seventh
test reproduced that graph before the traversal was repaired to accept a cycle
only when another branch reaches the reviewed advisory.

The final focused suite contains seven passing tests. The implementation also
requires npm audit report version 2 and lockfile version 3, and it fails if any
vulnerability lacks affected nodes.

## Fresh deterministic and package evidence

| Gate | Result |
|---|---|
| `npm ci` | Passed from the current lockfile |
| `npm test` | 50 files, 426 tests passed |
| `npm run test:integration` | 1 file, 4 tests passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm run build` | Passed |
| `npm run audit:policy` | Passed; 16 vulnerability records, one exact allowed advisory, review by 2026-08-14 |
| `npm audit --omit=dev --audit-level=high` | Passed; zero known production vulnerabilities |
| `npm run package:win` | Passed with Electron 43.2.0 and 1,381 verified ASAR entries |

The package verifier retained the pinned local gesture model SHA-256
`97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482`.

Final unpacked executable:

- size: `225636864` bytes;
- SHA-256: `200B1E92E86D1B6663E8B509C220A9F4CE09F510E77962E91E18FE6A77195D6E`.

## Fresh packaged runtime regression smoke

The unpacked executable was launched once with a temporary loopback-only
DevTools port. This diagnostic option was not added to the product or package
configuration.

Renderer evidence showed:

- one `page` target titled `Iris v2` at `iris://app/index.html`;
- `document.readyState = complete`, one populated root, 116 elements, 109
  visible elements, eight buttons and eight interactive controls at 1920x1032;
- a visible transparent Desktop HUD with camera off, Gemini disabled and
  JarvisOS `0.9.270` reporting health `ok` while signed out;
- `Ctrl+Shift+Space` changed the same renderer from `hud` to `deck`;
- the Command Deck displayed the Phase 4 R0 task plane and Phase 5 read-only
  Galaxy alongside the authority/status panels without overlap;
- Escape returned the renderer to `hud`.

No credential was entered or automated. Camera, microphone, Gemini provider,
protected brain content and task execution were not enabled. After the smoke,
the exact executable path had zero matching processes and the temporary port
had no listener.

## Residual risk and next gate

- The full audit still reports 16 development-only package records. The policy
  constrains them to one official advisory; it does not remove the vulnerable
  transitive code.
- The exception expires after 2026-08-14. CI must turn red unless the stable
  chain is upgraded or the owner records a new evidence-backed review.
- The Windows workflow is locally syntax-checked but has not run on GitHub-hosted
  infrastructure because no public remote exists.
- Signing, public distribution and canonical Jarvis integration remain separate
  owner gates. This slice changed no runtime ownership, credential policy,
  telemetry, migration or provider setting.
