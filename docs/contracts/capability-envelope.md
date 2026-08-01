# Contract — Capability Envelope v1 proposal schema

**Status:** Phase 0 local proposal schema only. No JarvisOS envelope endpoint, policy evaluation, approval, or execution path is established.
**Owner:** Iris v2 validates an untrusted proposal at its boundary; JarvisOS is the only future authority for policy, approval, execution, and audit.

## Implemented validation order

`capabilityEnvelopeSchema` first runs an iterative resource/safety preflight over the untrusted value, then pipes values that pass into the recursive Zod shape. The preflight avoids recursively walking attacker-controlled input before its depth, node, collection, key, string, JSON-type, and cycle constraints are known.

The outer envelope and defined structural subobjects use strict Zod validation. The parser accepts only:

- `version: "1"`;
- UUID intent and idempotency IDs;
- non-empty source, context, request, and risk-reason fields;
- nullable provenance fields, with each non-null provenance string non-empty;
- JSON-only request arguments;
- risk levels `R0`, `R1`, `R2`, or `R3`;
- `approval.state: "proposed"` only, plus an explicit required flag and offset-bearing expiry timestamp; and
- an offset-bearing creation timestamp.

Unknown structural fields, including a request-level `executable_code` field, unknown risk values, and client assertions such as `approved: true` are rejected.

## Resource and time guarantees

The iterative preflight rejects an envelope when any limit or invariant below is violated:

| Constraint | Implemented limit |
|---|---|
| Serialized JSON budget | 64 KiB maximum |
| Nesting depth | 8 levels maximum |
| Total visited values/nodes | 512 maximum |
| Entries in any object or array | 64 maximum |
| Object key size | 128 UTF-8 bytes maximum |
| String value size | 16 KiB UTF-8 bytes maximum |
| Cycles | Rejected |
| Non-JSON values | Rejected, including non-finite numbers and values such as `undefined`, functions, symbols, and big integers |

Node-detectable Proxy objects are rejected before observation traps can run.
Object and array accessors are rejected without invocation; sparse arrays,
non-plain prototypes, and prototype-sensitive keys (`__proto__`, `prototype`,
and `constructor`) also fail closed. Non-array objects must have exactly
`Object.prototype` or a null prototype, so `Date`, `Map`, class instances, and
other non-plain prototypes are rejected before their values are traversed.

The JSON payload surface is the object's own enumerable string keys. Preflight
enumerates those keys incrementally, rejects a 65th entry before reading its
value, and copies each accepted data-descriptor value exactly once into a new
null-prototype object or array snapshot. The byte, depth, node, collection, key,
credential-key, JSON-type, and cycle constraints apply to those exact snapshot
values. The completed snapshot is frozen and piped to Zod; Zod never validates
the original untrusted object. This closes the accessor/descriptor time-of-check
to time-of-use gap while retaining the 64-entry per-container bound.

Symbol and non-enumerable properties are not part of the JSON payload surface
and cannot confer capability authority. These guards bound validation work over
JSON-shaped data; they do not make arbitrary JavaScript objects safe execution
containers.

Credential-bearing keys are rejected throughout objects using qualified, normalized key forms: credential words are recognized as segments across common casing/separators, and known compact forms cover API/client secrets, private/signing keys, access/refresh/session/ID/GitHub/bearer tokens, authorization, cookies, passwords, passphrases, and generic secrets.

After shape validation, `approval.expires_at` must be strictly after `created_at`, and the proposal lifetime must be no more than 15 minutes. This validates the interval between the two envelope timestamps; it does not make the client authoritative for current time, policy, or approval.

## Semantic boundary

The preflight proves bounded JSON structure and rejects qualified credential keys. It does not validate capability-specific argument semantics and does not prove that arbitrary string values contain no executable instructions or unknown secret format. Capability-specific argument schemas, semantic code/instruction validation, and server-side secret handling remain future Jarvis gates.

The accepted `risk`, `approval`, and `provenance` values are advisory proposal data, never authoritative decisions. Parsing an envelope neither discovers a capability nor authorizes an operation.

## Fail-closed lifecycle boundary

The product lifecycle remains the target direction:

```text
draft → proposed → policy_evaluated → awaiting_approval → approved
      → executing → completed | failed | cancelled | expired | rejected
```

Phase 0 creates or accepts only `proposed`. All later states must originate from a future JarvisOS response schema after policy evaluation. A renderer, gesture, transcript, Gemini output, or tool result cannot promote, approve, execute, or infer successful execution from a proposal.

Until versioned Jarvis capability-catalog and envelope endpoints exist, every unknown capability and unrecognized envelope or policy state fails closed. The Phase 0 schema deliberately has no submit, execute, retry, or approval method.

## Required future authority

Before side-effecting use, JarvisOS must provide and own:

1. a sanitized, versioned capability catalog with availability, risk, and provenance;
2. an authenticated main-process broker for protected REST/WebSocket access;
3. server policy evaluation that replaces or confirms advisory proposal fields;
4. capability-specific argument schemas plus authoritative run, step, terminal outcome, approval, and audit records; and
5. current-time expiry enforcement, idempotency, cancellation, reconnection, and rollback behavior.

R2/R3 actions require separately approved Jarvis policy and visible, target-specific human confirmation. This checkpoint packet authorizes none of those changes.

## Future UI constraint

When a server contract exists, the renderer must show the plain-language action and target, capability/provenance, risk and reason, redacted arguments, expiry, and authoritative policy state. An accidental gesture cannot approve R2/R3, and voice approval must bind to the visible intent and target. These are future acceptance criteria, not evidence that an approval UI exists today.
