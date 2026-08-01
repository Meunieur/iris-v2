# Phase 1 Secure Attached Shell Verification

**Date:** 2026-07-24  
**Checkpoint state:** `READY_FOR_PHASE_1_REVIEW`  
**Branch:** `phase/1-secure-shell`

## Outcome

The Phase 1 Electron/React shell is built, packaged, visible at its target
1280x800 size, and proven to attach read-only to the existing JarvisOS runtime.
The live packaged check found and fixed two release-only defects before this
checkpoint:

1. workspace TypeScript sources and `tsconfig` files were included in ASAR;
2. the sandboxed preload tried to load a sibling CommonJS module, which Electron
   does not permit in a sandboxed preload.

The final package excludes internal workspace source/config files and bundles
the four-method preload surface into one CommonJS file. The final packaged run
shows the Vietnamese HUD and emits no preload, uncaught-renderer, startup, or
network load error.

## Deterministic verification

All commands below ran from a fresh `npm ci` install:

| Check | Result |
|---|---|
| `npm run lint` | Pass, no warnings |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 15 files, 272 tests |
| `npm run test:integration` | Pass: 1 file, 4 tests |
| `npm run build` | Pass |
| `npm audit --omit=dev` | Pass: 0 production vulnerabilities |
| `npm run package:win` | Pass |
| `designmd lint DESIGN.md` | Pass: 0 errors, 0 warnings |
| local Markdown link check | Pass: 29 Markdown files |
| repository JSON parsing | Pass: 21 JSON files |
| `git diff --check` | Pass; only Windows line-ending notices |

`npm ci` still reports two high-severity findings in development/build tooling.
They are excluded from the shipped production dependency audit, which reports
zero vulnerabilities. Do not use `npm audit fix --force` without a separate
toolchain review.

## Package integrity

- Executable: `release/win-unpacked/Iris v2.exe`.
- ASAR: `release/win-unpacked/resources/app.asar`.
- Notice: `release/win-unpacked/resources/THIRD_PARTY_NOTICES.md`.
- ASAR contains the required main, bundled preload, renderer, contracts and
  adapter outputs.
- ASAR contains no `@iris/*/src`, internal `tsconfig*.json`, or stale
  `dist/electron/preload/api.cjs` entry.
- Electron Builder used Electron `43.2.0` from the validated local extraction
  cache. The Phase 1 package still uses Electron's default icon.

## Live JarvisOS evidence

Public probes against `http://127.0.0.1:7777` showed:

- health `ok`;
- version `0.9.156`;
- Windows mode;
- authentication required and not authenticated;
- listener PID `27024` (`python3.11.exe`);
- stable sanitized runtime fingerprint
  `bce294b5c275e347b3af78b85e1f4e07cbcf497094b4708b934587258bf5d181`.

Two-sample probes before and while Iris was open reported `sameRuntime: true`.
After a renderer-only `Ctrl+R` reload, and again after Iris was stopped, the
listener PID and fingerprint were unchanged. A listener scan across ports
`7777-7816` found only `127.0.0.1:7777` owned by PID `27024`; Iris created no
second backend. Stopping Iris left JarvisOS healthy and listening.

## Packaged UI and recovery evidence

The final packaged shell was observed at Windows 100% scale:

- `sign_in_required`: visible as `Cần đăng nhập`, health `ok`, version `0.9.156`,
  mode `windows`, empty public brain/session lists, no raw backend path or
  session preview;
- offline/reconnecting: launched against unused loopback port `7816`, visible as
  `Đang kết nối lại`, health `offline`, unknown version/mode, with no sign-in or
  side-effect controls;
- renderer reload: immediately showed `Đang kết nối`, then reconciled back to
  `Cần đăng nhập` without changing the Jarvis runtime identity;
- keyboard: first `Tab` produced a visible cyan focus ring on `Làm mới trạng
  thái`; `Enter` refreshed; the next `Tab` moved the visible focus ring to
  `Đăng nhập JarvisOS`;
- reduced motion: deterministic UI tests and CSS verify the
  `prefers-reduced-motion: reduce` path disables transitions/animation. The
  Windows system preference was not changed during this checkpoint.

The restricted Jarvis sign-in window was visibly opened and stayed on the exact
loopback Jarvis origin. No credential, cookie, password manager, or CAPTCHA was
inspected or automated.

## Release-only defect fixed during verification

The first packaged launch was a black shell. Captured Electron stderr showed:

- `Unable to load preload script`;
- `Error: module not found: ./api.cjs`;
- renderer failure because `window.iris` was undefined.

Electron's sandboxed preload loader supports only a limited polyfilled
`require`; local CommonJS module separation is unavailable. The build now pins
`esbuild@0.28.1` and bundles `preload.cts` plus `api.cjs` into one
`preload.cjs`, while keeping `sandbox: true`. A scaffold contract test protects
the bundler dependency and build/dev command, and the final packaged stderr is
empty of application errors.

## Human checkpoint still required

The operator must complete the visible Jarvis login manually. Until that
happens, the following remain intentionally unverified:

- authenticated `ready` state;
- protected `/brains` and `/sessions?limit=50` reads through the in-memory
  Electron session;
- renderer display of the live protected public projections.

This is a human authentication step, not authorization to inspect or automate
credentials. Phase 2 must not begin until the product owner reviews this shell
and either completes that sign-in check or explicitly accepts it as deferred.

## Explicitly deferred

Gemini/provider credentials, gestures/camera/media, turn execution, graph and
memory views, managed lifecycle, telemetry, data migration, promotion and every
Hermes capability pack remain disabled and outside Phase 1.
