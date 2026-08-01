# Contributing to Iris v2

Thank you for helping make Iris v2 safer, clearer and more useful. The project
welcomes reproducible bug reports, product feedback, documentation corrections
and design discussions during the developer-preview period.

## Contribution terms

Original Iris v2 code is distributed under the Apache License 2.0. Unless a
contribution is conspicuously marked otherwise before submission, material
intentionally submitted for inclusion in Iris v2 is offered under the same
license, consistent with section 5 of Apache-2.0.

Before investing in a large change, open an issue or discussion so the scope,
authority boundary and verification plan can be agreed. Pull requests should
stay focused and must not include private Jarvis data, credentials, unlicensed
assets or machine-local evidence.

By submitting a contribution, you confirm that you have the right to license
it and that all third-party material is identified with its source, version,
license and required notices.

## Before opening an issue

1. Search existing issues and the current [execution status](docs/execution/STATUS.md).
2. Confirm the behavior on the latest public commit you can access.
3. Remove credentials, cookies, private paths, brain content and personal data
   from screenshots and logs.
4. Use the security reporting path in [SECURITY.md](SECURITY.md) for a suspected
   vulnerability; do not disclose it in a public issue.

Useful bug reports include:

- the exact action that triggered the problem;
- expected and actual behavior;
- Windows, Node.js and Iris versions or commit;
- whether Jarvis, camera or Gemini was enabled;
- a minimal reproduction and sanitized logs;
- whether the issue survives an Iris restart.

## Development setup

Iris v2 currently targets Windows and Node.js 22.18.0 or newer.

```powershell
npm ci
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
npm run audit:policy
```

The deterministic suites must not require a real credential, mutate a live
Jarvis data root or start a second Jarvis runtime. The full dependency audit
must fail closed for production-reachable or critical findings, unknown
advisories, missing provenance and expired exceptions. A packaged check uses:

```powershell
npm run package:win
```

## Architecture rules

- JarvisOS remains the sole execution, policy, authentication, secrets, brain,
  memory, session, workflow and audit authority.
- Renderer APIs stay fixed and narrow. Do not add generic IPC, filesystem,
  shell, credential or arbitrary network access.
- Gemini output is proposal-only until Jarvis policy accepts it.
- Hermes integrations are typed, feature-flagged and disabled by default.
- Camera inference remains local and off until the operator enables it.
- New boundaries are contract-first or test-first and include a failure path.
- Side-effecting capabilities carry provenance, risk, approval and idempotency.

Read [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and
[DESIGN.md](DESIGN.md) before proposing a change.

## Review evidence

A future code pull request will be expected to include:

- the user-visible outcome and ownership boundary;
- tests that prove the success and failure paths;
- full deterministic test, integration, typecheck and lint results;
- the full dependency audit-policy result and production audit result;
- a real runtime or packaged check proportional to the risk;
- screenshots for UI work at the target scale, with private data removed;
- documentation, contract, ADR and roadmap updates where the boundary changed;
- an explicit list of anything not verified.

Avoid unrelated formatting or refactors. Preserve existing work and keep each
slice small enough to review and roll back.
