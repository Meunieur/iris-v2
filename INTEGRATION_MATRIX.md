# Iris v2 — Integration Matrix

The matrix is the default answer to “reuse, rewrite or keep?” Update it before
adding a cross-project dependency.

| Capability | Existing source | Iris v2 ownership | Reuse mode | Planned phase | Gate / risk |
|---|---|---|---|---|---|
| Transparent Electron HUD | Iris | Iris v2 | Extract/adapt UI behavior and window contract | 2 | Secure window, click-through and navigation hardening |
| Glass surfaces / task cards | Iris | Iris v2 | Reuse visual patterns, reimplement with `DESIGN.md` tokens | 2–4 | Accessibility, density, no decorative clutter |
| Point/hold, palm scroll, two-palm resize, fist close | Iris + MediaPipe | Iris v2 gesture package | Port semantics; local pinned assets; normalize events | 2 | Camera consent, false positives, CPU/GPU load |
| Gesture model/WASM | Iris upstream | Iris v2 build assets | Vendor/pin with notices; no production CDN dependency | 2 | License, integrity, offline startup |
| Gemini Live conversation | Iris | Gemini bridge | Reuse protocol ideas; isolate credentials and lifecycle | 3 | Prompt injection, reconnect, provider outage, cost |
| Direct Iris Hermes bridge | Iris | None | Do not copy wholesale | 3/7 | Duplicated policy, secrets and runtime authority |
| Task reader / live activity | Iris + Jarvis events | Iris v2 | UI adapter over normalized Jarvis events | 4 | Event ordering, stale state, cancellation |
| Health / auth / version | JarvisOS | JarvisOS | Phase 1 bounded main-process GET broker | 1 | Exact loopback endpoint, 5s timeout, 64 KiB cap, no renderer credentials |
| Sessions | JarvisOS | JarvisOS | Phase 1 read-only public summaries; create/search/turn mutation deferred | 1 / 4–5 | No dual-write; raw brain path, CLI session ID and preview omitted |
| Brains / second brain | JarvisOS | JarvisOS | Phase 1 read-only opaque summaries; switching/memory/graph deferred | 1 / 5 | Raw paths stay private; no renderer-owned index or data root |
| Memory / vault / files | JarvisOS | JarvisOS | Query/render via opaque IDs | 5–6 | Secrets and absolute-path exposure |
| Galaxy knowledge view | JarvisOS graph endpoints | Iris v2 view, JarvisOS data | Visualize `/graph` and `/ws/graph` | 5 | Large graph performance, source/staleness clarity |
| Skills / tools / workflows | JarvisOS | JarvisOS capability broker | Discover/propose/execute through adapter | 6 | Approval and provenance; no renderer execution |
| MCP hub/provider routing | JarvisOS | JarvisOS | Existing runtime authority | 6 | Provider/auth drift, audit completeness |
| Hermes skill registry/provenance | Hermes | JarvisOS registry boundary | Port concepts or isolated service | 7 | AST audit, signatures, compatibility, license |
| Hermes lazy tool search/output limits | Hermes | Adapter/policy + Jarvis | Selective capability pack | 7 | Truncation semantics, hidden tool activation |
| Hermes delegation/background jobs | Hermes + Jarvis jobs | JarvisOS jobs | Map to one job/session model | 7 | Child process cleanup, cancellation, quotas |
| Hermes computer/web/vision/media tools | Hermes/Jarvis optional | Jarvis policy-gated capability | Opt-in sidecars only | 7–8 | High-risk external effects, egress, privacy |
| Auth/secrets/credentials | JarvisOS/runtime | JarvisOS | Never expose to renderer | All | Key leakage, IPC abuse |
| Backend lifecycle | JarvisOS desktop/runtime | One selected host | Phase 1 attaches only; managed child remains disabled | 1 / 8 | Duplicate process/data root |
| Packaging/update | Iris v2 + selected runtime host | Iris v2 package, JarvisOS runtime owner | Phase 1 unpacked thin shell; signing/update/promotion deferred | 1 / 8 | Migration, signing, rollback |
