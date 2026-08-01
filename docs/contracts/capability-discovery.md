# Contract — Future Jarvis Capability Discovery and Inheritance

**Status:** future design target; not a frozen or implemented Phase 0 wire
contract.

## Purpose

“Inherit the latest JarvisOS features” is the intended model: Iris v2 should
discover and present capabilities from the connected canonical JarvisOS runtime;
it must not maintain a hand-copied list of tools or a second implementation.

No capability-catalog endpoint is currently established. Until a future
Jarvis-owned, sanitized, versioned endpoint and corresponding fixtures exist,
unknown capabilities fail closed and Iris v2 performs no generic capability
execution.

## Discovery model

When a future catalog contract is approved, the adapter should request a
sanitized capability catalog at connection and periodically during a session.
The following target record is not implemented by Phase 0; each record should
include:

```ts
type CapabilitySummary = {
  id: string;                 // stable opaque capability ID
  kind: "skill" | "tool" | "workflow" | "agent" | "mcp" | "service";
  displayName: string;
  description?: string;
  version?: string;
  status: "available" | "degraded" | "disabled" | "approval_required";
  risk: "R0" | "R1" | "R2" | "R3";
  provenance?: {
    source: "jarvis" | "hermes_pack" | "plugin" | "provider";
    sourceId?: string;
    version?: string;
  };
  inputSchema?: unknown;      // schema, never executable code
  updatedAt?: string;
};
```

The exact wire endpoint is not frozen in Phase 0. A future endpoint must be
Jarvis-owned, sanitized, versioned, and covered by fixtures before this target
model is implemented. Unknown fields may be considered for forward
compatibility only after that contract exists; unknown capability kinds remain
unavailable until explicitly mapped.

## Intended inheritance rules (future)

1. Iris v2 should render the live catalog and must not hard-code “latest” tool names.
2. A capability would be executable only if JarvisOS reports it available and
   its policy allows the current brain/session/context.
3. Catalog changes should invalidate stale UI proposals; the operator must see
   that a capability changed or disappeared.
4. A future new Jarvis capability may be used in read-only mode through a
   generic adapter only when its schema/risk contract is validated. Until then,
   no generic execution occurs. Side-effecting capabilities require an explicit
   envelope mapping and test fixture.
5. Adapter compatibility should be negotiated using protocol/version metadata.
   If the backend is older, Iris v2 should degrade visibly rather than guessing.
6. Hermes-derived records would need to identify their pack/provenance and pass
   the same Jarvis policy path; they must never appear as an untrusted direct
   executor.

## Future release sync checklist

Before an Iris v2 release:

- compare the live Jarvis capability catalog with the adapter's normalized
  mappings;
- run contract tests for added/removed/changed capabilities;
- verify every new R2/R3 capability has an approval and audit path;
- update the integration matrix and release notes with intentional exclusions;
- confirm no new Jarvis data store, secret or direct executor was introduced.

## Intended failure behavior (future)

- Catalog unavailable: a future UI should retain the last safe read-only view
  with a stale badge and disable side-effecting launches until refreshed.
- Capability removed mid-run: a future adapter should let Jarvis finish/cancel
  authoritatively and show the reason; it must never retry through a similarly
  named capability.
- Schema mismatch: a future adapter must fail closed and offer a
  JarvisOS/runtime update path.
