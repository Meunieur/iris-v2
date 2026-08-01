---
name: Iris v2 Operator Glass
version: 0.2.1
colors:
  canvas: "#080A0F"
  surface: "#111722"
  surfaceElevated: "#182233"
  primary: "#56E6F4"
  cyan: "#56E6F4"
  violet: "#9B8CFF"
  text: "#F2F6FA"
  textMuted: "#9BA9B8"
  success: "#62E6A7"
  warning: "#F3C969"
  danger: "#FF7186"
  knowledgeField: "#050811"
  knowledgeNode: "#9B8CFF"
  knowledgeFocus: "#56E6F4"
  knowledgeEdge: "rgba(155, 140, 255, 0.22)"
  knowledgeEdgeFocus: "rgba(86, 230, 244, 0.72)"
typography:
  display:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
  mono:
    fontFamily: "JetBrains Mono, Consolas, monospace"
spacing:
  unit: "4px"
  hudGutter: "16px"
  cardGap: "10px"
rounded:
  card: "16px"
  control: "10px"
  pill: "999px"
---

# Iris v2 — Durable Visual Identity

## Overview

Iris v2 is a calm operator cockpit floating above the desktop: transparent,
precise and alive to the operator, without turning every state into spectacle.
The visual lineage comes from Iris's Glass HUD and gesture reticle; the product
role comes from JarvisOS. Use a deep-space canvas, translucent layered panels,
electric cyan for active intent and restrained violet for cognition/graph state.

The signature orb/reactor may remain as a compact status anchor, but it is a
functional instrument: connection, listening, thinking, approval and failure
must be legible without decorative animation.

The Galaxy is the product's Neural Observatory: a spatial, topology-led view of
the attached Jarvis brain. It should feel like looking into a living instrument,
not at a chart pasted into a dashboard. Its depth and motion always explain
connectivity, focus, capture state or navigation.

## Colors

- `canvas` is the near-black transparent backdrop and must preserve desktop
  context.
- `surface` and `surfaceElevated` are translucent dark glass layers with enough
  contrast for text. Prefer a subtle border over a heavy shadow.
- `cyan` means active listening, focus, gesture target and confirmed connection.
- `violet` means knowledge, graph, memory and reasoning context.
- `success`, `warning` and `danger` are semantic only; never use color alone.
- Vietnamese diacritics and long task names must remain readable at the default
  HUD scale.

Avoid gradients as decoration. If a gradient is required for a state transition,
keep it short, low-contrast and documented in the component.

## Typography

- Display labels are compact but never condensed to the point of losing
  diacritics.
- Body copy favors short, direct sentences and generous line height.
- Monospace is reserved for IDs, tool names, latency and diagnostic payloads.
- Use sentence case for operator-facing labels; avoid all-caps paragraphs.
- Minimum interactive text size is 12px in the HUD and 14px in the reader.

## Layout

- The HUD is a transparent, always-on-top layer with an intentional safe zone
  around desktop work. Default to click-through outside explicit hit regions.
- The default surface is a compact edge-anchored Desktop HUD. A recoverable
  global shortcut expands the same window and state into an interactive Command
  Deck for setup, diagnostics, keyboard navigation and detailed inspection.
- The primary right-side reader is approximately 320–420px wide on desktop and
  can expand through the two-palm resize gesture.
- Keep the orb/status anchor, task stack and camera/gesture dock visually
  separate so one animation cannot hide another state.
- Galaxy knowledge view may use a larger canvas, but node density must yield to
  labels, focus and a readable breadcrumb.
- Every panel has a visible escape/close route and a keyboard equivalent.
- The Command Deck may use more of the canvas, but it must preserve the same
  orb, reader, status semantics and three-layer depth system as the Desktop HUD;
  it is not a second visual product or a generic dashboard skin.

## Elevation and depth

Use three layers only: canvas, glass surface and elevated reader/modal. Depth is
communicated by opacity, a 1px border and a soft local shadow. Do not build a
stack of neon outlines or a permanently glowing “arc reactor” that competes
with task content.

The Neural Observatory may create depth inside its own field through node scale,
edge opacity, blur, occlusion and restrained parallax. This is one visualization
surface inside the glass layer, not additional application elevation. A focused
node may rise toward cyan while unrelated nodes recede; the rest of the Command
Deck remains optically stable.

## Shapes

- Cards: 14–18px radius, 1px border, compact internal spacing.
- Reticle: circular/rounded geometry with a clear active target and confidence
  ring; no tiny details that disappear over a busy desktop.
- Buttons: rounded rectangles with a stable focus ring; destructive actions use
  semantic danger treatment and explicit text.
- Graph nodes: compact luminous discs with selected, related, hub and distant
  states. Halo size and apparent depth encode graph meaning; avoid ornamental
  spheres whose material has no relation to the data.

## Components

### Orb and status anchor

Shows one primary state at a time: offline, ready, listening, thinking,
approval-required, executing or error. Motion must pause when the operator has
reduced-motion enabled.

### Application icon

The packaged application uses a solid deep-space tile with a cyan outer lens,
alternating cyan/violet aperture arcs and a bright central focus point. It must
remain recognizable at 16–32px, use no text or decorative gradient, and share
the same `canvas`, `surface`, `cyan`, `violet` and `text` tokens as the HUD.
Transparent rounded corners are allowed; the Electron atom mark is not part of
the Iris v2 identity.

### Glass task card

Contains task title, source/session, current step, risk badge, progress and
actions. A task card never implies success merely because a model produced text.

### Reader overlay

Supports streamed response, tool provenance, copy/expand/close, keyboard focus,
open-palm scroll and two-palm resize. Closed fist dismisses only when confidence
and dwell thresholds are satisfied.

### Gesture/camera dock

Displays camera permission, model readiness, FPS/latency (when useful), current
gesture and a clear pause toggle. Camera frames are never shown or transmitted
by default; a preview is opt-in and local.

### Conversation dock

Keeps provider, microphone/remote-streaming state, listening/speaking state,
latency and short-lived transcript visible without competing with Jarvis task
state. Starting remote voice is an explicit text-labelled action. Disabled,
missing-credential, reconnecting and degraded modes remain useful and legible.
When Gemini proposes a capability, show source, capability, risk and “chờ Jarvis
phê duyệt”; Phase 3 provides no approve or execute control.

### Galaxy knowledge view

Uses violet as a knowledge accent, with search, focus, relation type, source and
staleness visible. The graph is a visualization of Jarvis data, not a second
index owned by the renderer.

The approved Neural Observatory direction replaces the initial concentric demo
with a deterministic topology-led 2.5D field. Select a bounded representative
set by connectivity rather than input order, retain the edges between those
nodes, and use node scale/depth to expose hubs without hiding smaller notes. A
single cyan focus path distinguishes the selected node and its direct relations;
violet remains the knowledge color everywhere else.

The field owns most of the Galaxy panel. A compact inspection rail shows the
focused label, folder, relation count and readable prominent-node fallback.
Pointer and keyboard focus must produce the same selection state. The graph may
use subtle radial falloff, a data-colored halo and one slow spatial drift, but
must not use a generic purple gradient, uncontrolled particle storm or bright
idle pulse. Reduced-motion mode is completely static.

Brain selection must say it changes Iris view context only, never the Jarvis
default. Sign-in, empty, truncated and unavailable states stay useful; raw
IDs/paths and mutation affordances are never visualized. The authoritative
returned/total counts remain visible even when the visual node set is capped.

For bounded snapshots above 36 nodes, expose `Gọn · 36`, `Chuẩn · 72` and
`Dày · 96` as one compact keyboard-operable density control. A density change
only recomputes the local projection; it never fetches, persists or implies that
more Jarvis data was loaded. A node chosen from search remains pinned with a
local relation at the selected density, and the authoritative returned/total
counts remain unchanged.

### Approval sheet

Summarizes what will happen, which capability will run, target/account, risk,
source/provenance, expiry and approve/reject controls. The approve control must
not be activatable by an accidental gesture.

## Motion

Motion communicates state changes, not personality for its own sake:

- 120–220ms for panel/reticle transitions.
- A slower, subtle breathing pulse for listening/thinking.
- One low-amplitude Observatory drift may communicate spatial depth after a
  snapshot loads; node selection and relation emphasis remain user-driven.
- Progress motion stops when the backend reports a pause or failure.
- No looping animation while idle that steals attention.
- Respect `prefers-reduced-motion` and provide a global “quiet HUD” mode.

## Interaction and accessibility

- Mouse, keyboard, voice and gesture are equivalent entry points with the same
  policy outcome.
- Focus order is deterministic; click-through mode must not trap keyboard
  focus.
- Never rely on hue, motion or camera pose alone to convey a critical state.
- Provide tooltips or accessible names for icons, especially the orb and gesture
  controls.
- Touch/trackpad fallback remains available when the camera is blocked.

## Do and don't

### Do

- Keep Iris's glass/transparency and tactile reticle language.
- Make backend, brain and approval state visible at a glance.
- Use cyan/violet sparingly as semantic signals.
- Let the operator understand and stop an action before it becomes irreversible.

### Don't

- Do not copy Iris's implementation risks (broad preload, unrestricted config,
  CDN-only gesture assets or unvalidated IPC) into Iris v2.
- Do not turn the HUD into a dense dashboard with every Jarvis endpoint visible
  simultaneously.
- Do not use “AI magic” language where a concrete capability, source or risk is
  available.
- Do not add a decorative glow, gradient or animation unless it improves a
  decision the operator must make.
