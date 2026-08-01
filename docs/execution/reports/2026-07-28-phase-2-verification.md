# Phase 2 Glass HUD and Gesture Runtime Verification

**Date:** 2026-07-28

**State:** `PHASE_2_MANUAL_ACCEPTANCE_PENDING`
**Branch:** `phase/1-secure-shell`

## Outcome

Phase 2 implementation is present and the current Windows package passes its
deterministic, packaging and visual HUD/Deck checks. The product owner then
authorized a fresh camera run, temporary Windows scale changes and Parsec
Virtual Display activation if no physical secondary monitor was available.
Camera lifecycle/performance and actual 125%/150% Windows scale checks now have
fresh evidence. The phase is not yet accepted because the four physical gesture
ergonomics, actual 200% scale, a live secondary display and final owner review
remain open.

## Resumed work and root-cause repair

The worktree already contained an uncommitted packaged MediaPipe fix:

- `iris://` gained `supportFetchAPI: true`;
- CSP changed from `connect-src 'none'` to same-origin `connect-src 'self'`;
- `script-src` gained only `wasm-unsafe-eval`, with no generic `unsafe-eval` or
  remote HTTP/WS origin;
- source tests assert the protocol and CSP boundary.

The first full verification then reproduced a TypeScript failure in
`apps/desktop/test/package-policy.test.ts`. Commit `453373b` had added
`package-policy.mjs` and its TypeScript test but omitted the sibling declaration
used by the existing script pattern. Adding `package-policy.d.mts` fixed the
root cause. Lint also identified and removed one unnecessary escape in the new
CSP regression test.

## Deterministic verification

| Command | Result |
|---|---|
| Focused CSP/main/MediaPipe tests | 4 files, 9 tests passed |
| `npm test` | 27 files, 329 tests passed |
| `npm run test:integration` | 1 file, 4 tests passed |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm audit --omit=dev` | Pass, 0 vulnerabilities |
| `npm run package:win` | Pass |
| `designmd lint DESIGN.md` | Pass, 0 errors and 0 warnings |

The package verifier inspected 796 ASAR/resource entries and confirmed model
SHA-256 `97952348CF6A6A4915C2EA1496B4B37EBABC50CBBF80571435643C455F2B0482`.

## Final owner-test build

After the manual-check documentation was reconciled, the Windows directory
package was rebuilt from the current branch with `npm run package:win`. The
fresh command completed the production build, Electron packaging and package
verifier in one successful run.

- executable: `release/win-unpacked/Iris v2.exe`;
- size: `225614336` bytes;
- executable SHA-256:
  `6D9FC9388F9DE50254A7758E63C3C227DC599E6E5B88063CD85B4EB4377FA76E`;
- package verifier: 796 entries and the expected MediaPipe model hash;
- launch smoke: four Iris Electron processes, one responsive `Iris v2` window;
- Jarvis listener remained one PID `47756` on port 7777, version `0.9.234`;
- no listener appeared on ports `7778-7816`.

The package was left running with camera off for product-owner testing. The
remaining hand-gesture judgments belong to the owner acceptance checklist and
are not represented as automated pass results.

## High-DPI window-boundary repair

The first controlled 200% Chromium-scale run exposed a real native-window
boundary bug: a 1080p work area is approximately 960x516 DIP at 200%, while
the shell had a fixed `minHeight: 640`. Electron therefore clipped the lower
HUD and the two-row Command Deck. The fix clamps shell minimum width/height to
the selected display work area and makes short two-column Deck viewports
vertically scrollable. Regression tests cover both contracts.

The rebuilt package was then checked at the following scales without changing
Windows settings or enabling camera access:

| Controlled run | Result |
|---|---|
| 125% (`--force-device-scale-factor=1.25`) | HUD and Command Deck complete; shortcut and focus path intact |
| 150% (`--force-device-scale-factor=1.5`) | HUD and Command Deck complete; no clipped controls observed |
| 200% (`--force-device-scale-factor=2.0`) | HUD fits the work area; Deck exposes a scrollbar and reaches the brain link/footer after scroll |

These controlled renderer-scale checks were supplemented by a temporary real
Windows setting run. The primary 1920x1080 display was changed from 100% to
125%, then 150%, with the packaged Iris process closed and reopened after each
change. The Command Deck remained complete and unclipped at both settings. The
primary display was restored to 100% and Iris was reopened once more.

Windows did not offer 200% in the primary display's recommended scale list; the
available values stopped at 175%. Custom scaling was not used because applying
it would require a disruptive sign-out. Actual 200% therefore remains open.

## Fresh packaged UI evidence

The current `release/win-unpacked/Iris v2.exe` was launched and inspected:

- Desktop HUD was transparent and edge anchored with the desktop safe zone
  visible;
- camera began in the explicit off state;
- the read-only Jarvis surface showed `Cần đăng nhập`, version `0.9.156`, Windows
  mode, empty public brain/session states and no protected content;
- `Ctrl+Shift+Space` expanded the same window into the Command Deck;
- Escape returned to Desktop HUD;
- Tab displayed the cyan focus ring on the refresh control;
- a hit-test at safe-zone coordinate `(1400, 600)` resolved to Windows
  `explorer.exe` `FolderView`, not Iris, proving the transparent area remained
  click-through; after explicitly activating Iris, the refresh control inside
  a `.hud-hit` region accepted a real click and retained Jarvis version
  `0.9.156`;
- closing Iris removed its windows/processes without stopping JarvisOS.

No login or credential entry was automated. The product owner explicitly
authorized the camera and display-setting actions recorded below.

## Camera-off network and resource baseline

With the packaged HUD visible and camera still off, the Iris process tree had
four expected Electron processes: main, GPU, network utility and sandboxed
renderer. The network utility exposed one established connection only:
`127.0.0.1:<ephemeral> -> 127.0.0.1:7777`. No remote TCP endpoint was present.

A 3.08 second camera-off sample recorded:

- aggregate Iris CPU: 4.61% of total logical-processor capacity;
- aggregate working set: 346.7 MiB;
- sampled GPU 3D utilization: 0.806%, plus 0.024% on one copy engine;
- video decode and video encode counters: 0%.

This is the idle HUD baseline used for comparison with the fresh camera-active
sample below.

## Fresh camera lifecycle and performance

The operator-approved packaged run used the machine's `HD camera`. Camera
frames remained hidden and local to the renderer. The observable lifecycle was:

- explicit camera-off start;
- `Camera cục bộ đang hoạt động` with the local model in `ready` state;
- `Điều khiển cử chỉ đã tạm dừng` after pause;
- a second successful enable to `ready`;
- `Camera đang tắt` after the explicit stop action.

A four-second camera-active sample recorded five Iris Electron processes and:

- aggregate Iris CPU: 14.88% of total logical-processor capacity;
- aggregate working set: 637.3 MiB;
- sampled GPU 3D utilization: 1.134% average / 1.218% maximum on the busiest
  Iris engine, plus a second 3D engine at 0.482% maximum;
- sampled GPU copy utilization: 0.025% maximum.

Five subsequent 2.5-second UI-state samples remained `ready` but reported
`Chưa nhận diện`. No point, palm, two-palm or fist observation was available,
so no physical ergonomic result is claimed. Deterministic landmark/state-machine
coverage remains green, but the real four-gesture acceptance item stays open.

## Secondary-display and Parsec result

The machine exposed one active physical 1920x1080 display. The installed
`Parsec Virtual Display Adapter` was healthy, Parsec VDD driver `0.45` was
present, and `Fallback To Virtual Display` was already `On`.

Parsec's current host-only/free state cannot add an extra display while the
physical display remains attached. The UI exposed additional `Virtual Displays`
only behind Warp/Teams owner connections, while free fallback applies only when
no physical display exists. The run did not start a paid trial, automate
re-authentication, or disable the only physical display. Therefore no live
secondary bounds/reticle or 200%-on-secondary result is claimed.

## Runtime ownership evidence

The earlier packaged shutdown check reported:

- Jarvis listener PID `33456` on `127.0.0.1:7777`;
- version `0.9.156`, auth required, unauthenticated, Windows mode;
- fingerprint `bce294b5c275e347b3af78b85e1f4e07cbcf497094b4708b934587258bf5d181`;
- `sameRuntime: true` with no comparison reasons;
- no listener on ports `7778-7816`.

The JarvisOS checkout remained on dirty HEAD
`5fc8b282866056874b8d1a80b6ef3ab6a234ffba`. Its live `/version` endpoint
reported `0.9.231` as available. This Iris verification did not modify or update
JarvisOS.

During the later real-DPI close/reopen sequence, port 7777 became temporarily
unavailable and Iris correctly displayed its reconnecting/offline state. No
backend start, stop, update or migration action was issued by this verification.
The runtime later returned independently as one exact loopback listener with:

- listener PID `47756`;
- version `0.9.234`, auth required, unauthenticated, Windows mode;
- the same private data-root fingerprint
  `bce294b5c275e347b3af78b85e1f4e07cbcf497094b4708b934587258bf5d181`;
- a fresh two-sample `sameRuntime: true` comparison for PID `47756`;
- no listener on ports `7778-7816`.

This proves a single recovered runtime with the same canonical data root, not
continuity of the former PID. The external restart/version-change cause remains
unverified and must not be attributed to Iris without further evidence.

## Historical camera evidence retained

The 2026-07-24 `iris-phase2.stderr.log` was captured after the CSP/protocol
files received their current local-MediaPipe changes. It records OBS Virtual
Camera acquisition, MediaPipe graph startup, local inference, device stop,
graph close and WebGL context destruction. This supports the repair but is not
represented as a fresh 2026-07-28 operator permission/ergonomics run.

## Remaining verification and gate

- real point dwell, palm scroll, two-palm resize and fist dismiss ergonomics;
- actual Windows 200% scale (100%, 125% and 150% are freshly observed; the
  controlled 200% renderer-scale check is also recorded above);
- secondary-monitor bounds and reticle mapping;
- optional authenticated protected Jarvis brain/session projections;
- product-owner Phase 2 acceptance.

Until the required Phase 2 manual items and owner review complete, Phase 3
Gemini work remains blocked. Gemini credentials, managed mode, telemetry,
migration, Hermes packs, side effects and production promotion remain disabled.
