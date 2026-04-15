# Phase 7: Action Recording - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture in-browser user interactions as reusable workflow definitions, persist them as structured JSON steps, and control recording start/stop from the command palette with clear recording-state feedback in UI. Playback behavior, automation library management, and AI-generated flows are out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Recording session model
- **D-01:** Recording starts through command palette action (`automation record`) and uses the existing automation bridge ownership model in main process.
- **D-02:** A recording session binds to the resolved tab at start and remains locked to that `tabId` for deterministic capture.
- **D-03:** If the bound tab is closed/destroyed or the bridge disconnects, recording stops immediately with an explicit stop reason surfaced to UI.
- **D-04:** Only one recording session can be active at a time; concurrent start requests are rejected as busy.

### Event-to-step mapping
- **D-05:** Recorder emits a canonical step set only: `navigate`, `click`, `type`, and `wait`.
- **D-06:** `type` events are coalesced per target field into stable final-value steps (avoid noisy per-keystroke output).
- **D-07:** `click` steps prefer stable selector capture, with fallback metadata when selector quality is weak.
- **D-08:** `navigate` steps are recorded for top-level URL transitions in the bound tab only.

### Deterministic ordering and wait behavior
- **D-09:** Each step gets a monotonic sequence index (`seq`) that defines execution order.
- **D-10:** Recorder injects explicit `wait` steps for navigation/DOM readiness boundaries instead of arbitrary time sleeps.
- **D-11:** Diagnostic timestamps can be included, but ordering authority is `seq`, not wall-clock timestamp.

### Workflow JSON contract
- **D-12:** Persist a versioned workflow payload (`version: 1`) with stable top-level structure for downstream playback.
- **D-13:** Required workflow fields are `id`, `name`, `createdAt`, `updatedAt`, and `steps`; optional metadata fields are allowed but must be schema validated.
- **D-14:** Each step includes `id`, `seq`, `action`, and action-specific payload with deterministic key ordering.
- **D-15:** Password-field inputs are stored as variable placeholders (secret type) rather than raw cleartext literals.

### Command palette control and UI state
- **D-16:** Add `automation record` and `automation stop` command palette actions for recorder lifecycle control.
- **D-17:** Surface recorder state in browser chrome with a persistent recording indicator while active.
- **D-18:** Start/stop results must provide immediate user-visible feedback (success, already-recording, not-recording, failure).

### the agent's Discretion
- Exact selector scoring and fallback heuristic details.
- Recorder status indicator visual styling and placement details inside existing chrome constraints.
- Default naming strategy for unsaved workflow drafts before library features land.

</decisions>

<specifics>
## Specific Ideas

- Keep recording outputs low-noise and deterministic so Phase 8 playback can execute without heuristic guesswork.
- Favor command-driven lifecycle control first; avoid introducing sidebar-driven recording controls in this phase.
- Keep one-tab session ownership strict to avoid hidden cross-tab coupling in v1 automation architecture.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and product constraints
- `.planning/ROADMAP.md` - Phase 7 goal, requirement mapping, and success criteria.
- `.planning/REQUIREMENTS.md` - `AUTO-02` requirement definition and traceability.
- `.planning/PROJECT.md` - command-first constraints, Electron security boundaries, and local-first architecture.
- `implementation_plan.md` - automation engine direction, command palette automation commands, and phase roadmap intent.

### Existing automation/runtime integration anchors
- `src/main/main.ts` - IPC registration and lifecycle wiring for automation bridge services.
- `src/main/cdpBridge.ts` - single-owner CDP session model and status/error semantics.
- `src/main/browserRuntime.ts` - active tab resolution and tab lifecycle events that bound recording must follow.
- `src/shared/browser.ts` - shared automation types and contract surface.
- `src/shared/ipc.ts` - typed IPC channel definitions and renderer API contract.
- `src/preload/index.ts` - secure renderer-to-main bridge exposure.

### Existing command/UI integration anchors
- `src/renderer/lib/commandPalette.ts` - command registration, ranking, and command run contract.
- `src/renderer/components/CommandPalette.tsx` - command execution UX and error behavior.
- `src/renderer/App.tsx` - app-level shortcut handling and shell composition where recorder status can integrate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/cdpBridge.ts`: already provides ownership lock, status, and structured error reasons for single-session automation control.
- `src/main/browserRuntime.ts`: provides deterministic active-tab identity and lifecycle events for tab-bound recording.
- `src/renderer/lib/commandPalette.ts`: existing command model can add recording lifecycle commands without architectural changes.
- `src/shared/browser.ts` and `src/shared/ipc.ts`: established location for typed recorder contracts and IPC channels.

### Established Patterns
- Privileged automation behavior is main-process owned; renderer only invokes typed preload APIs.
- Commands are keyboard-first and deterministic, with immediate inline error feedback.
- Phase 6 established strict ownership and fail-fast semantics for automation bridge behavior.

### Integration Points
- Extend main-process automation services with recorder lifecycle and step buffering.
- Add typed recorder IPC methods through `src/shared/ipc.ts` and `src/preload/index.ts`.
- Wire command palette actions to recorder start/stop and publish recording-state updates into the renderer shell.

</code_context>

<deferred>
## Deferred Ideas

- Multi-tab or session-spanning recording flows.
- Advanced variable editing UX and bulk secret management.
- Playback-time retry policies and execution controls (Phase 8).
- Automation library CRUD, tagging, and history presentation (Phase 9).

</deferred>

---

*Phase: 07-action-recording*
*Context gathered: 2026-04-15*
