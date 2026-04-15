# Phase 7 Research: Action Recording

## Objective
Research implementation approach for Phase 7 action recording so plans can deliver AUTO-02 while honoring locked decisions D-01 through D-18 from the phase context.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/STATE.md
- .planning/phases/07-action-recording/07-CONTEXT.md
- implementation_plan.md
- src/main/main.ts
- src/main/cdpBridge.ts
- src/main/browserRuntime.ts
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/renderer/lib/commandPalette.ts
- src/renderer/components/CommandPalette.tsx
- src/renderer/App.tsx
- copilot-instructions.md

## Decision Fidelity Constraints
- D-01 to D-04 require strict single-session recording ownership, start/stop through command palette, and explicit busy/termination semantics.
- D-05 to D-08 require canonical event vocabulary (`navigate`, `click`, `type`, `wait`) and tab-bound capture scope.
- D-09 to D-11 require deterministic ordering through monotonic sequence IDs with explicit wait boundaries.
- D-12 to D-15 require a validated versioned JSON workflow contract and secret-safe placeholders.
- D-16 to D-18 require command palette lifecycle controls and visible recording-state feedback in renderer UI.

## Existing Architecture Findings

### 1. Main process is the correct recording authority boundary
- `src/main/main.ts` already centralizes privileged managers and typed IPC handlers.
- `src/main/cdpBridge.ts` already enforces a single-owner automation lock model suitable for recording ownership policy reuse.
- Recording capture and workflow persistence should stay in main process; renderer should only invoke typed recorder commands.

### 2. Active-tab semantics already exist for deterministic session binding
- `src/main/browserRuntime.ts` provides active tab identity and lifecycle transitions.
- Tab closure and target invalidation can be observed from runtime state, aligning with D-03 fail-stop semantics.
- Existing active-tab resolution pattern used in Phase 6 can be reused for recorder session start.

### 3. Shared contract and preload patterns are ready for recorder extension
- `src/shared/browser.ts` and `src/shared/ipc.ts` are the established location for typed request/response contracts.
- `src/preload/index.ts` already exposes a safe, narrow API and can add recorder lifecycle methods without changing architecture.
- Existing channel naming and API signatures are consistent and compile-safe.

### 4. Command palette integration path is straightforward
- `src/renderer/lib/commandPalette.ts` already holds command registry and command run functions.
- `src/renderer/components/CommandPalette.tsx` handles execution and errors in one place.
- Adding `automation record` and `automation stop` commands fits existing design with minimal UX churn.

### 5. Workflow storage shape should be introduced now with compatibility for Phase 8
- There is no dedicated automation workflow persistence module yet.
- Phase 7 should establish a stable workflow JSON envelope with `version: 1`, deterministic step ordering, and placeholder support.
- Storage implementation should remain local-first in main process and avoid playback-specific policy fields.

## Recommended Technical Approach

### A. Recorder service in main process
- Introduce a dedicated recorder manager module (for example `src/main/actionRecorder.ts`) that owns:
  - start(session request)
  - stop(session id)
  - getStatus()
  - appendStep(event normalization)
  - getDraftWorkflow(session id)
- Enforce single active recording session using the same ownership discipline as Phase 6.

### B. Canonical action normalization pipeline
- Normalize captured user interactions into step actions only: `navigate`, `click`, `type`, `wait`.
- Coalesce typing by element identity with latest value semantics.
- Assign monotonic `seq` values at normalization time.
- Insert explicit readiness waits at navigation/DOM boundaries instead of arbitrary sleep durations.

### C. Versioned workflow schema and guardrails
- Define shared types for workflow documents and steps in `src/shared/browser.ts`.
- Add runtime validation in main process before persistence (zod is available in project stack guidance).
- Store sensitive inputs as variable placeholders for secret fields.

### D. Recorder IPC and preload surface
- Add typed IPC channels for recorder start/stop/status and optional draft retrieval.
- Expose corresponding preload methods via `window.pathfinder` with no raw event stream exposure.
- Keep channel semantics deterministic and explicit for future playback compatibility.

### E. Renderer integration for lifecycle visibility
- Add command palette commands `automation record` and `automation stop` in command registry.
- Add persistent recording indicator in renderer chrome state.
- Keep feedback immediate and actionable for already-recording/not-recording/failure states.

## Security Considerations
- Preserve trust boundary: renderer issues intent, main process owns capture and persistence.
- Reject malformed start/stop/session requests through typed contracts and runtime validation.
- Prevent privilege escalation by avoiding raw CDP/event transport exposure to renderer.
- Mask secret field values in persisted workflows via variable placeholders.
- Ensure recording shutdown on app quit or bridge invalidation to avoid stale ownership state.

## Validation Architecture
- Quick checks per task: `npm run typecheck`
- Wave checks: `npm run lint; npm run typecheck; npm run build`
- Focus checks for Phase 7:
  - recorder start binds to one tab and rejects concurrent start
  - normalized steps emit only `navigate/click/type/wait` actions with monotonic `seq`
  - workflow payload validates against versioned schema and secret placeholders
  - command palette start/stop commands drive recorder state transitions
  - UI indicator reflects recording state changes without requiring palette reopen

## Risks and Mitigations
- Risk: noisy low-level event capture produces unstable workflows.
  - Mitigation: enforce canonical normalization and coalescing pipeline before persistence.
- Risk: stale session ownership when target tab disappears or app exits.
  - Mitigation: central recorder shutdown hooks on tab invalidation and app lifecycle events.
- Risk: schema drift before playback phase begins.
  - Mitigation: versioned schema with strict validation and deterministic key structure now.
- Risk: recorder controls diverge from command-first UX.
  - Mitigation: implement command palette control as primary entry with visible shell-level status.

## Deliverables Expected from Planning
- Plan for workflow contract and IPC/preload surface expansion.
- Plan for main-process recorder manager and normalization pipeline.
- Plan for command palette integration plus renderer recording-state indicator.
- Threat-model entries for ownership spoofing, malformed payload injection, and secret leakage.

## Confidence
Medium-high. Architecture already has strong typed IPC and ownership patterns from Phase 6; main implementation risk is producing deterministic, low-noise step normalization without over-scoping into playback.

---
*Research completed: 2026-04-15*
