# ADR-008: Publish a Curated Snapshot, Not the Internal Working History

- **Status:** Accepted — source-first curated publication approved
- **Date:** 2026-07-31
- **Accepted:** 2026-08-01

## Context

Iris v2 is being prepared for a public GitHub launch, but this repository began
as a machine-local engineering workspace. Its history contains operational
handoffs, agent prompts, local checkout paths and runtime evidence that are
useful for continuity but are not part of the public product.

There is currently no Git remote or authenticated public repository identity.
The product owner selected Apache-2.0 for original Iris v2 code and authorized
a step-by-step source-first GitHub publication. That makes it possible to keep a
clean publication boundary before anything is exposed. GitHub documents that
deleting a file from the current tree does not
remove it from Git history, that changing a private repository to public exposes
its code and activity, and that rewriting published history is disruptive and
easy to recontaminate.

## Decision

Keep the current repository and history as the private engineering evidence
source. Create a new public repository named `iris-v2` from an allowlisted,
verified release-candidate snapshot after the authenticated GitHub owner and
private conduct-reporting channel are confirmed.

The public snapshot should include product source, deterministic tests, public
contracts/ADRs, curated verification summaries, community files, notices and
release tooling. It should exclude machine-local agent prompts, continuation
handoffs, raw research notes, local process/path evidence and generated
artifacts unless a specific item is deliberately sanitized and promoted.

Before the initial import:

1. run the full deterministic, package and dependency gates on the candidate;
2. scan the exact public snapshot for secrets, personal paths, private content
   and prohibited file types;
3. verify every public Markdown link against the exported file set;
4. create one reviewable initial import commit with the chosen license;
5. enable GitHub secret scanning/push protection and least-privilege CI before
   accepting external contributions.

Acceptance authorizes preparation and publication of the verified source-only
snapshot. It does not authorize exposing the internal history, publishing a
Windows binary, enabling a provider, changing Jarvis runtime ownership or
copying Jarvis data.

## Reversible implementation evidence

The local `release:public-preflight` command now evaluates the Git index and
non-ignored candidate files against the default-deny allowlist in
`tools/release/public-surface.json`. It
separates technical failures from owner-gated community/legal files, refuses
symlinks and other unsupported Git entry modes, validates public Markdown links
and emits a content-derived candidate digest. The gate implements the proposed
boundary for review; Windows CI enforces its technical subset while the full
gate remains strict. Neither mode exports or publishes files.

## Alternatives considered

- **Make this working repository public:** rejected as the default because old
  internal paths and operational artifacts remain reachable in history.
- **Rewrite the current history and publish it:** possible but high-risk; it
  changes commit hashes, complicates coordination and can be recontaminated.
- **Publish only a binary:** rejected because it weakens auditability,
  contribution and the technical story that can earn GitHub trust.

## Consequences

A fresh public import sacrifices the internal commit-by-commit history on the
public surface, but preserves that history privately and produces a smaller,
clearer and safer repository for new users. Future public development can then
continue normally from the initial import commit.

The owner accepted this boundary on 2026-08-01. Publishing the existing history
would be a different decision and still requires a separate full-history
sensitive-data audit plus an approved rewrite/rotation plan.

## References

- <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>
- <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility>
- <https://docs.github.com/en/code-security/concepts/secret-security/push-protection>
