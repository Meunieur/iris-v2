# Iris v2 Public Candidate Preflight

- **Date:** 2026-07-31
- **Scope:** proposed fresh public-import source snapshot
- **Verdict:** `TECHNICALLY_CLEAN_OWNER_BLOCKED`

## Outcome

Iris v2 now has a deterministic, fail-closed preflight for the exact source
surface proposed by ADR-008. The policy separates files that are technically
required from community/legal files that only the product owner can define.
The command performs no export, remote creation, visibility change or public
action.

The stabilized local candidate contains 210 files. Its technical error count is
zero. Publication remains blocked on exactly three owner-gated files:

- `LICENSE`;
- `CODE_OF_CONDUCT.md`;
- `SUPPORT.md`.

The command emits the candidate SHA-256 on every run. That digest is deliberately
not embedded in this candidate report because doing so would make the report
hash itself recursively and invalidate the recorded value.

## Contract and failure paths

`tools/release/public-surface.json` records the reviewable, default-deny public
allowlist and explicit internal exclusions. The implementation:

- reads cached Git files plus non-ignored candidate files;
- excludes every unlisted path plus explicit internal-only prompts, handoffs
  and raw plans;
- fails on missing required public files while reporting owner-gated files
  separately;
- refuses symlinks, submodules, unmerged stages and other unsupported Git modes
  without following them outside the repository;
- rejects environment/credential/database/log file types and unapproved binary
  extensions or null-bearing content;
- scans candidate text for high-signal secret forms and personal home paths;
- verifies inline, reference-style and embedded HTML links in public Markdown;
- hashes sorted path/content pairs into a deterministic SHA-256.

The full command remains non-zero while owner blockers exist. Windows CI uses
the explicit `--technical-only` mode, which returns success only when the
technical error count is zero; owner blockers remain visible in the output and
are never reclassified as resolved. Unknown command-line options fail closed.

## Verification

- 16 focused unit/contract tests passed across default-deny, technical-error,
  owner-blocked, ready, CI technical-only and unknown-option paths;
- release-tool TypeScript checking passed under its own project configuration;
- zero-warning repository lint passed;
- the full deterministic suite passed 53 files and 442 tests;
- the disposable HTTP integration suite passed 4 tests;
- the production build, full dependency policy and production dependency audit
  passed, with zero known production vulnerabilities;
- a real repository preflight returned `owner-blocked`, technical errors `0`
  and the three owner blockers above;
- the real npm technical-only command returned success while retaining all
  three owner blockers in its report.

The public snapshot cannot become `ready` until the owner selects the
legal/community inputs and approves ADR-008. The canonical Jarvis runtime and
the remaining live/physical release gates are unchanged by this reversible
repository-only slice.
