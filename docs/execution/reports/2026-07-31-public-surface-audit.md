# Iris v2 Public Surface and Privacy Audit

- **Date:** 2026-07-31
- **Scope:** current tracked snapshot, public-history strategy and GitHub launch
  hygiene
- **Verdict:** `CURRENT_SNAPSHOT_SANITIZED_PUBLIC_HISTORY_GATE_PENDING`

## Outcome

The current snapshot no longer contains the local Windows account name or a
contiguous high-signal credential pattern. Machine-specific prose was converted
to portable repository/runtime language. Synthetic Windows paths remain in
security tests and fixtures because they prove path rejection, redaction and
opaque projection behavior.

The repository is still not safe to publish with its complete existing history.
Earlier commits retain machine-local paths and internal coordination artifacts.
Because no remote exists, the recommended boundary is a new public repository
created from a curated release-candidate snapshot after owner approval, rather
than changing this internal repository's visibility.

## Baseline inventory

The pre-remediation snapshot contained:

- 211 tracked files, including 52 Markdown files;
- no tracked `.env`, PEM/key, database, log or raster screenshot file;
- 97 Windows drive-path occurrences across 25 files;
- two occurrences of the local Windows account name in internal documentation;
- five contiguous secret-shaped strings in one credential-redaction test;
- no Git remote, public license, support identity or signing identity.

The largest tracked binary is the pinned local MediaPipe gesture model. Its
license/notice and packaged SHA-256 verification remain part of the release
contract.

## Remediation applied

- Root agent and OpenCode guidance now refer to portable repository and
  canonical-runtime locations instead of fixed machine paths.
- Handoff, status, research and historical verification prose no longer names a
  local Windows user or checkout root.
- Credential-redaction fixtures construct Google/OpenAI-like tokens and a PEM
  header from deterministic fragments. Runtime test coverage is unchanged, but
  the repository no longer contains a contiguous value likely to trigger public
  push protection as a false positive.

The post-remediation working snapshot reports:

- zero local-account-name occurrences;
- zero contiguous high-signal secret patterns under the bounded scanner;
- 81 drive-path occurrences across 17 files, all in synthetic tests, fixtures
  or documentation code assertions rather than machine-local prose;
- zero tracked environment, private-key, database, log or raster screenshot
  paths.

## Public versus internal material

### Public candidate

- application/package source and deterministic tests;
- `README.md`, `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`;
- contracts, accepted public ADRs and curated release evidence;
- GitHub templates, CI, Dependabot and release-note configuration;
- `DESIGN.md`, third-party notices and pinned asset provenance.

### Internal by default

- machine-local continuation handoffs and raw execution plans;
- coordinator prompts and agent-specific operating history;
- raw upstream checkout notes and local process/path evidence;
- generated package output, caches, logs and temporary runtime diagnostics.

An internal file may move to the public set only after it is sanitized, linked
from the public information architecture and reviewed for lasting user value.

## History and GitHub risk

GitHub states that deleting a sensitive file from the current tree leaves it in
history, while changing repository visibility to public exposes code and
activity to everyone. GitHub also warns that history rewriting changes commit
hashes, disrupts collaboration and can be recontaminated. Push protection is a
preventive control, not a substitute for reviewing the history or rotating a
real secret.

Accordingly, [ADR-008](../../decisions/ADR-008-public-release-boundary.md)
proposes a fresh public import from an allowlisted snapshot. No export, history
rewrite, remote creation or visibility change was performed in this audit.

Official references:

- <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>
- <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility>
- <https://docs.github.com/en/code-security/concepts/secret-security/push-protection>

## Remaining owner gates

1. Accept or reject the clean-snapshot public repository boundary.
2. Choose the original-code license and contribution terms.
3. Choose the GitHub owner/repository name and private security/conduct contact.
4. Approve the exact public file allowlist before the initial import.
5. Approve signing identity, version and public release candidate only after the
   canonical Jarvis/runtime and remaining human gates pass.
