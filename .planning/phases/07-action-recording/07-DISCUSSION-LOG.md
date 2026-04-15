# Phase 7: Action Recording - Discussion Log

**Date:** 2026-04-15
**Mode:** discuss (autonomous continuation)
**Reason:** Discussion was continued with recommended defaults to complete workflow handoff without further blocking.

## Areas Covered

1. Recording Session Model
2. Event-to-Step Mapping
3. Deterministic Ordering and Wait Semantics
4. JSON Workflow Contract Shape
5. Command Palette Start/Stop + UI State Reflection

## Decision Trace

### Area 1 - Recording Session Model
- **Question:** How should recording attach to browser context?
- **Options considered:**
  - Lock to active tab at record start
  - Allow free tab switching during one recording
  - Prompt for tab on every captured action
- **Selected:** Lock to active tab at start.
- **Rationale:** Matches Phase 6 ownership determinism and avoids cross-tab ambiguity in captured steps.

- **Question:** What happens when bound tab disappears?
- **Options considered:**
  - Stop recording immediately with reason
  - Auto-rebind to newest active tab
  - Keep recording idle until tab reappears
- **Selected:** Stop immediately with explicit reason.
- **Rationale:** Prevents silently corrupted workflows.

### Area 2 - Event-to-Step Mapping
- **Question:** Which action vocabulary should recording output?
- **Options considered:**
  - Canonical set (`navigate`, `click`, `type`, `wait`)
  - Raw low-level event stream
  - Extended set with optional extras in v1
- **Selected:** Canonical set.
- **Rationale:** Keeps Phase 7 schema stable and Phase 8 playback predictable.

- **Question:** How should typing be captured?
- **Options considered:**
  - One step per keystroke
  - Coalesced final field value
  - Mixed strategy by input type
- **Selected:** Coalesced final value by field.
- **Rationale:** Eliminates noise and improves replay reliability.

### Area 3 - Deterministic Ordering and Wait Semantics
- **Question:** What defines authoritative step order?
- **Options considered:**
  - Monotonic sequence index
  - Event timestamps only
  - Browser event-id references
- **Selected:** Monotonic sequence index.
- **Rationale:** Stable across machine speed and timestamp drift.

- **Question:** How should waits be represented?
- **Options considered:**
  - Explicit wait steps for readiness boundaries
  - Raw time sleeps
  - No wait steps (infer at runtime)
- **Selected:** Explicit readiness waits.
- **Rationale:** Deterministic playback and less flaky automation behavior.

### Area 4 - JSON Workflow Contract Shape
- **Question:** What minimum workflow schema should Phase 7 persist?
- **Options considered:**
  - Versioned contract with required metadata + steps
  - Steps-only payload
  - Rich playback policy contract now
- **Selected:** Versioned contract with required metadata + steps.
- **Rationale:** Enables forward-compatible schema evolution while staying in Phase 7 scope.

- **Question:** How to handle sensitive typed values?
- **Options considered:**
  - Persist raw values for all fields
  - Placeholder variables for password-like fields
  - Ask user for every typed value
- **Selected:** Placeholder variables for password fields.
- **Rationale:** Reasonable baseline security without heavy UX overhead.

### Area 5 - Command Palette + UI State Reflection
- **Question:** How should recording lifecycle be controlled in v1?
- **Options considered:**
  - Command palette start/stop commands
  - Toolbar-only controls
  - Hybrid command + sidebar controls
- **Selected:** Command palette start/stop commands.
- **Rationale:** Preserves command-first UX and avoids premature sidebar coupling.

- **Question:** Where should active recording state be visible?
- **Options considered:**
  - Persistent browser chrome indicator
  - Command palette only
  - Modal toast only
- **Selected:** Persistent chrome indicator (plus action feedback).
- **Rationale:** Keeps status visible during capture and lowers accidental recording risk.

## Deferred Ideas Captured

- Multi-tab recording session composition
- Advanced variable management UX
- Playback execution controls and retries
- Library/history management UI

## Outcome

Phase 7 context is now complete and ready for downstream research/planning.

---

*Phase: 07-action-recording*
*Generated: 2026-04-15*
