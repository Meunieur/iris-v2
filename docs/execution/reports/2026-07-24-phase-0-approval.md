# Phase 0 product-owner approval

**Date:** 2026-07-24  
**Decision state:** all six Phase 0 checkpoint decisions approved  
**Authorized next slice:** Phase 1 secure standalone shell in attached-only mode

## Approval evidence

The product owner explicitly approved all six decisions in the private Phase 0
checkpoint. The public consequences of those decisions are restated below.

## Authorized

- standalone Iris v2 executable direction;
- attached-only Phase 1 against one already-running canonical JarvisOS runtime;
- source JarvisOS data root remains canonical with no AppData migration;
- a narrow main-process-only REST/WebSocket credential boundary;
- the current default brain remains unchanged and is represented by opaque ID;
- telemetry remains off by default.

## Still disabled or deferred

- managed JarvisOS start/stop or process ownership;
- any new credential source or renderer credential access;
- Gemini credentials or provider connection;
- every Hermes capability pack;
- data migration, telemetry, side-effecting controls, production promotion,
  autostart, or default-app changes.

Phase 1 must remain read-only, must not create a backend or session, and must
return to the roadmap's Phase 1 human checkpoint before Iris UI extraction.
