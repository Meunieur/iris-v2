# Iris v2 — GitHub distribution and Marketplace readiness

**Reviewed:** 2026-07-31
**Current verdict:** repository-launch preparation may continue; a GitHub
Marketplace submission is not yet an eligible or authorized delivery path.

## Why the desktop package cannot be listed directly

GitHub Marketplace publishes GitHub Apps, OAuth Apps and GitHub Actions. Iris v2
is currently an attached-only Windows Electron application. It has no GitHub App
registration, OAuth contract, root `action.yml`, Marketplace webhook, public
support/privacy surface or pricing plan. The executable therefore is not itself
a Marketplace listing unit.

Official references:

- <https://docs.github.com/en/apps/github-marketplace/creating-apps-for-github-marketplace/requirements-for-listing-an-app>
- <https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace>
- <https://docs.github.com/en/apps/github-marketplace/listing-an-app-on-github-marketplace/drafting-a-listing-for-your-app>

## Two legitimate future routes

### Route A — GitHub App

Use this only if Iris/Jarvis gains a clear GitHub-native job such as governed
issue triage, pull-request review, repository knowledge indexing or an approval
bridge. The app must add value beyond login, request minimum permissions, handle
installation and Marketplace plan webhooks, publish privacy/support links and
remain usable by the public. This route introduces external authentication,
repository access and possible side effects, so it requires a new owner-approved
ADR and security contract before implementation.

### Route B — single-purpose GitHub Action

Extract one deterministic automation into its own public repository with one
root `action.yml`, a unique Marketplace name, pinned runtime dependencies,
tests, semantic tags and release notes. The Action should be a narrow product,
not a wrapper that installs the complete Iris desktop/JarvisOS stack.

## Current repository-launch posture

- No Git remote is configured in the implementation worktree.
- No project-level license has been selected. Third-party notices do not choose
  a license for original Iris v2 code.
- A public-facing README, privacy notice, contribution boundary, changelog,
  issue/PR templates, pinned Windows CI and release-note categories are now
  prepared locally. The first hosted CI run remains impossible until a Git
  remote exists.
- The full dependency graph is guarded by an exact, development-only advisory
  policy with a 2026-08-14 review deadline; production dependencies currently
  report zero known vulnerabilities. A stable Electron Builder upgrade or
  fresh owner review remains a release-candidate gate.
- No public support URL, private conduct-reporting contact, code of conduct or
  signed binary release workflow exists.
- The current snapshot no longer contains the local account name or contiguous
  high-signal secret patterns. [ADR-008](../decisions/ADR-008-public-release-boundary.md)
  proposes keeping internal operating history private and importing a curated,
  scanned release-candidate snapshot into the future public repository.
- No GitHub App/Action metadata or Marketplace webhooks exist.
- The branded application icon now exists, but a feature card, product
  screenshots and concise demo video still need an approved public-media pass.
- Physical gesture, live Gemini, protected post-fix Second Brain, Phase 4
  execution and promotion gates remain explicitly incomplete.

## Recommended order

1. Finish the local product checkpoints and preserve honest verification debt.
2. Product owner selects the original-code license and accepts or rejects the
   curated-snapshot public repository boundary.
3. Review the prepared repository foundation, then complete the unresolved
   support/conduct policy, clean screenshots/demo and a signed versioned Windows
   release with checksums and provenance.
4. Choose GitHub App or Action only after a concrete GitHub-native job is
   approved. Write its ADR, permissions, data-retention and failure contract.
5. Build the Marketplace unit as a separate bounded vertical slice, obtain real
   adoption/security evidence, then draft the listing and assets.

## Definition of “GitHub-ready” for Iris v2

- A new user understands the product, authority boundary and privacy posture in
  under two minutes.
- A clean checkout can run deterministic tests and build without private paths,
  credentials or undocumented machine state.
- Releases have versioned notes, checksums, rollback guidance and provenance.
- Screenshots and claims match real packaged behavior; deferred gates are not
  advertised as complete.
- The selected license, support channel, privacy statement and security contact
  are explicit before public promotion.
