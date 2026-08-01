# Iris v2 Public Release Plan

- **Prepared:** 2026-07-31
- **Release posture:** source-first developer preview approved; remote creation
  remains gated by GitHub authentication
- **Goal:** earn technical trust and organic GitHub attention through a
  coherent product story, reproducible evidence and an honest security
  boundary.

## Product brief

### Audience

- developers building local-first AI agents and desktop operator surfaces;
- HCI, voice and gesture experimenters who need keyboard-accessible fallbacks;
- agent-platform engineers interested in authority, approval and provenance;
- self-hosters who value visible state and one canonical memory/runtime owner.

### Job to be done

Give one operator a calm Windows cockpit where conversation, knowledge and task
progress are visible together without handing secrets or execution authority to
the renderer or conversational model.

### Public positioning

> Iris v2 is a transparent Windows cockpit for governed local AI: Gemini can
> converse, the HUD can gesture, and JarvisOS remains the sole authority for
> memory, policy and execution.

The differentiator is not another animated assistant. It is the combination of
an expressive desktop surface with explicit authority, provenance, recovery
and truthful task state.

### Non-goals for the first public release

- claiming autonomous or side-effecting work that has not passed approval E2E;
- presenting a model response as evidence that a tool ran;
- bundling a second Jarvis data root or silently starting another backend;
- enabling Hermes, remote camera upload, telemetry or external providers by
  default;
- submitting the Electron executable itself to GitHub Marketplace.

## What strong public repositories consistently communicate

GitHub's own repository guidance emphasizes a README that quickly explains why
the project is useful, how to start, where to get help and who maintains it. Its
community-profile checklist adds a license, contribution guide, code of conduct
and security policy. Releases should attach versioned notes and binaries rather
than leaving users to infer a build from a branch.

Reference repositories such as Open Interpreter and screenpipe lead with one
clear promise, show an immediate path to try the product, explain safety or
privacy tradeoffs, and make contribution/release activity visible. Iris should
adopt that information architecture while keeping its own calm Glass identity
and evidence-first voice.

Sources:

- <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes>
- <https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories>
- <https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases>
- <https://github.com/openinterpreter/open-interpreter>
- <https://github.com/screenpipe/screenpipe>

## Launch assets

### Repository foundation

| Item | State | Gate |
|---|---|---|
| Public product README and architecture boundary | Prepared | Final proofread after live gate |
| Privacy and security posture | Prepared | Public reporting channel and final privacy review |
| Contribution guide | Prepared under Apache-2.0 | First hosted review after import |
| Issue and pull-request templates | Prepared | GitHub labels after remote exists |
| Windows CI | Prepared | First hosted run on the eventual remote |
| Changelog and release-note categories | Prepared | `0.1.0-alpha.1` source preview; no binary release |
| Production dependency audit | Zero known vulnerabilities | Re-run on every candidate |
| Development packaging dependency audit | 16 propagated package findings from one reviewed advisory; fail-closed policy passes | Stable Electron Builder upgrade or fresh owner review by 2026-08-14 before a signed candidate |
| Current snapshot privacy scrub | Complete for bounded scanner | Zero local-account markers and zero contiguous high-signal secret patterns; remaining drive paths are synthetic test/fixture inputs |
| Deterministic public-candidate preflight | Ready 2026-08-01 | 236 files, 0 technical errors and 0 owner blockers |
| Public history boundary | Accepted | [ADR-008](../decisions/ADR-008-public-release-boundary.md) keeps internal history private and publishes a fresh curated import |
| Code of conduct | Prepared | Contributor Covenant 2.1 with owner-provided private enforcement contact |
| Project license | Prepared | Apache-2.0 with `Iris v2 contributors` notice and preserved third-party terms |
| Support channel | Prepared | Discussions for questions, Issues for bugs; enable after remote exists |

### Media package

Do not publish screenshots taken over a private desktop. Produce a clean,
staged media set from the exact release candidate:

1. 1280x800 hero image: Command Deck with synthetic brain/task data, visible
   Jarvis authority and no private paths.
2. 8-15 second silent loop: compact HUD expands into the Deck, opens Galaxy,
   then shows an R0 task moving through authoritative events.
3. 60-90 second narrated demo: conversation proposal, Jarvis task execution,
   stop/recovery and local gesture/keyboard parity.
4. GitHub social preview using the aperture icon, deep-space canvas, cyan intent
   and violet cognition tokens from `DESIGN.md`.

Every capture must show only behavior that passed on the same artifact. Synthetic
or fixture-backed data must be labelled as demo data.

## Owner decisions required before public launch

| Decision | Why it cannot be inferred |
|---|---|
| Approve the canonical Phase 4 Jarvis merge/restart window | Changes the live backend and requires rollback/runtime observation |
| Choose the GitHub owner and repository name | Required for links, badges, support and release identity |
| Decide how public users obtain JarvisOS | The desktop is not meaningfully runnable without an attached compatible authority |
| Choose signing certificate and publisher identity | Required for trustworthy Windows distribution and SmartScreen reputation |
| Approve live Gemini credentials/provider review | External data flow and cost require explicit owner authorization |
| Approve promotion/autostart | Changes daily-driver and startup behavior and is a separate Phase 8 gate |

Resolved on 2026-08-01: Apache-2.0 original-code license, ADR-008 curated
snapshot boundary, repository name `iris-v2`, source-first developer preview
and the private conduct-reporting contact.

## Staged release sequence

### Stage 0 — deterministic developer preview

- Keep Gemini, Hermes, telemetry, managed mode and side effects disabled.
- Require CI, deterministic suites, integration, typecheck, lint, build and the
  full dependency audit policy.
- Publish no binary and make no general-user claim.

**Advance when:** the repository foundation is reviewed and its first hosted CI
run passes.

### Stage 1 — private release candidate

- Install the reviewed Phase 4 companion change during an approved window.
- Prove authenticated R0 worker, exact replay, stop, renderer restart and
  controlled backend/provider interruption.
- Re-run protected Galaxy and Phase 5 human-readability checks.
- Create an immutable version, Windows package, checksums, dependency inventory
  and rollback packet.

**Advance when:** no unresolved security/authority bypass exists and the owner
accepts all recorded residuals.

### Stage 2 — limited public preview

- Publish source only after license, support and reporting gates resolve.
- Mark the first binary as a GitHub pre-release.
- Monitor issues, startup failures, crash diagnostics and reproducibility for a
  bounded daily-driver period.
- Keep autostart and migration disabled.

**Advance when:** a clean checkout and fresh Windows package are reproducible,
critical flows pass and no data-integrity/security regression appears.

### Stage 3 — public launch

- Publish the clean media package, signed binary, checksums, release notes and
  verification summary.
- Add repository topics, social preview and GitHub Discussions after the remote
  identity is final.
- Share one evidence-led story: the UI, the authority boundary and a real
  stop/recovery run.

**Success signals:** qualified stars and follows, successful clean builds,
substantive issues/discussions, external demos or integrations, and contributors
who can explain the Jarvis authority boundary correctly. Raw star count alone
is not a release-quality metric.

## Release candidate checklist

### Product and runtime

- [ ] Canonical Phase 4 runtime gate approved and installed with backup.
- [ ] One and only one Jarvis listener/data root before, during and after Iris.
- [ ] Protected R0 worker, stop, restart/reconnect and interruption verified.
- [ ] Protected Galaxy and human everyday-dashboard checkpoint passed.
- [ ] Live Gemini and physical gesture debt either passed or visibly excluded.
- [ ] Fresh install, upgrade, downgrade and rollback matrix recorded.
- [ ] Eight-hour soak and resource-leak review completed.

### Quality and security

- [ ] Unit, integration, typecheck, lint, build and package verifier pass.
- [ ] No high/critical production dependency vulnerability.
- [ ] Full dependency audit has no unknown advisory, production-reachable node,
  critical finding, incomplete provenance or expired exception.
- [ ] Renderer/preload, navigation, path, redaction and duplicate-runtime suites pass.
- [ ] No secret/private path in source, logs, fixtures, screenshots or package.
- [ ] `npm run release:public-preflight` reports `ready` for the exact public
  snapshot with no path, secret, file-type, Git-mode or link error and no
  internal-only coordination artifact.
- [ ] Internal-only paths and machine-specific handoff details are sanitized or
  excluded from the public repository without falsifying historical evidence.
- [ ] External actions and release inputs are pinned and least-privileged.
- [ ] Final security, privacy, accessibility and UX review recorded.

### Distribution

- [ ] Project version is no longer `0.0.0`; release tag and notes match it.
- [ ] License, code of conduct, support and security-reporting path published.
- [ ] Windows artifact is signed and accompanied by SHA-256 checksums.
- [ ] Build provenance/attestation or an explicit equivalent is published.
- [ ] Clean media package approved against the exact release candidate.
- [ ] Rollback owner, trigger and communication path confirmed.

## Rollback plan

### Trigger conditions

Hold or withdraw the candidate immediately for any of these:

- duplicate Jarvis runtime/data-root ownership;
- secret, private brain content or raw path exposure;
- renderer or model approval bypass;
- task success shown without authoritative Jarvis completion;
- data integrity loss, unrecoverable migration or orphan process;
- a new high-impact vulnerability or critical startup regression.

### Response

1. Disable promotion/autostart and keep the candidate marked as a pre-release.
2. Stop distributing the affected binary; preserve its checksums and evidence
   for incident analysis rather than silently replacing it.
3. Return the live Jarvis source/runtime to the pre-approved backup commit and
   verify health, listener ownership and the original data-root fingerprint.
4. Launch the prior known-good Iris artifact and verify the critical read-only
   path.
5. Record impact, root cause, remediation and the new acceptance evidence before
   cutting another immutable candidate.

No data migration, credential rotation or destructive cleanup is part of this
generic rollback. Those require their own approved incident plan.
