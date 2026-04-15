# Phase 8: Automation Playback - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute saved workflow JSON against the browser runtime with deterministic step order, pre-run variable collection, runtime validation, timeout controls, and explicit failure policy behavior. This phase does not include automation library CRUD or sidebar history UX.

</domain>

<decisions>
## Implementation Decisions

### Playback session and target binding
- **D-01:** Playback is triggered through command-first actions, with a primary `automation run` command entry.
- **D-02:** Playback resolves target tab from active tab by default; explicit `tabId` targeting remains optional.
- **D-03:** Playback acquires the Phase 6 automation bridge lock as `automation-engine`; if lock is busy, run start is rejected with typed busy reason.
- **D-04:** The resolved tab binding remains fixed for the full run; tab destruction or bridge disconnect ends run immediately with typed failure reason.

### Variable prompt and secret handling
- **D-05:** Variable requirements are resolved in a preflight pass before step execution begins.
- **D-06:** All required variables are collected in one pre-run prompt flow, not mid-run prompts per step.
- **D-07:** Secret variables are masked in UI and kept in memory for current run only; secret values are never persisted into saved workflow JSON.
- **D-08:** Missing required variables fail fast at preflight with actionable variable names/prompts.

### Runtime validation and timeout controls
- **D-09:** Playback validates workflow contract at run start: `version: 1`, supported actions (`navigate`, `click`, `type`, `wait`), and monotonic `seq` ordering.
- **D-10:** Each step is revalidated at execution time for required action fields before dispatch.
- **D-11:** Use deterministic timeout policy: workflow default timeout plus optional per-step timeout override, with bounded min/max clamps.
- **D-12:** No implicit sleep heuristics are introduced; wait behavior is driven by explicit `wait` steps and action completion signals.

### Failure policy and run result semantics
- **D-13:** Default failure policy is `stop-on-error` and returns actionable context (`stepId`, `seq`, `action`, `reason`, `message`).
- **D-14:** Playback also supports explicit `continue-on-error` policy selection for this phase.
- **D-15:** Under continue policy, failed steps are logged and execution proceeds; run exits with a partial-failure result when any step fails.

### the agent's Discretion
- Exact command argument syntax for selecting workflow and policy.
- Exact shape of progress updates presented in renderer command UX.
- Internal runner decomposition (single module vs split validator/executor helpers) as long as typed contracts remain explicit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirement anchors
- `.planning/ROADMAP.md` - Phase 8 goal, `AUTO-03` mapping, and success criteria.
- `.planning/REQUIREMENTS.md` - `AUTO-03` requirement definition and traceability.
- `.planning/PROJECT.md` - command-first constraints, Electron security posture, and local-first expectations.
- `implementation_plan.md` - automation playback direction and milestone intent.

### Existing automation contracts and runtime layers
- `src/shared/browser.ts` - workflow schema (`RecorderWorkflowDocument`), variable definitions, step contracts, and recorder/playback-adjacent types.
- `src/shared/ipc.ts` - typed IPC channel and preload API extension points for playback commands/status.
- `src/preload/index.ts` - secure renderer bridge pattern for new playback APIs.
- `src/main/cdpBridge.ts` - single-owner automation session lock and connect/disconnect status model.
- `src/main/actionRecorder.ts` - deterministic workflow shape assumptions produced by recording in Phase 7.
- `src/main/browserRuntime.ts` - active tab targeting and tab lifecycle events needed for playback binding.
- `src/main/main.ts` - manager initialization, IPC registration, and lifecycle cleanup wiring.

### Existing command and renderer integration anchors
- `src/renderer/lib/commandPalette.ts` - command registration and execution pattern for automation actions.
- `src/renderer/App.tsx` - app-level command integration and automation-state polling patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/cdpBridge.ts`: already provides typed lock semantics and bridge lifecycle states required by playback ownership.
- `src/main/actionRecorder.ts`: provides deterministic step contract assumptions (`seq`, supported actions, secret placeholders).
- `src/shared/browser.ts`: central source of workflow and variable contracts to reuse for playback validation.
- `src/renderer/lib/commandPalette.ts`: existing command entry point can add `automation run` without changing UX model.

### Established Patterns
- Main process owns privileged automation control; renderer only calls typed preload APIs.
- Automation operations use explicit typed success/failure reasons rather than opaque errors.
- Keyboard-first command flow is the primary interaction pattern for automation lifecycle actions.

### Integration Points
- Add playback runner lifecycle in main process near existing bridge/recorder managers.
- Extend IPC + preload contracts with playback start/status/cancel endpoints.
- Surface playback progress/failure feedback through command UX and app-level status refresh.

</code_context>

<specifics>
## Specific Ideas

- Keep playback deterministic and contract-driven so recorded workflows from Phase 7 execute without hidden heuristics.
- Preserve strict lock ownership from Phase 6 to prevent concurrent automation races during run execution.
- Because this invocation was non-interactive, recommended defaults were selected to unblock planning while staying within Phase 8 scope.

</specifics>

<deferred>
## Deferred Ideas

- Saved automation library CRUD and tagging UX (Phase 9).
- Persistent run history surfaces in sidebar (Phase 9).
- Visual workflow editor and step-level inline editing (future phase).
- Advanced retry/backoff strategy presets beyond stop/continue policy (future phase).

</deferred>

---

*Phase: 08-automation-playback*
*Context gathered: 2026-04-15*
