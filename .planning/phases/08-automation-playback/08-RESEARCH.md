# Phase 8 Research: Automation Playback

## Objective
Research implementation approach for Phase 8 automation playback so plans can satisfy `AUTO-03` while honoring locked Phase 8 context decisions (`D-01` through `D-15`).

## Inputs Reviewed
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/08-automation-playback/08-CONTEXT.md`
- `.planning/phases/07-action-recording/07-CONTEXT.md`
- `.planning/phases/07-action-recording/07-RESEARCH.md`
- `.planning/phases/07-action-recording/07-01-PLAN.md`
- `.planning/phases/07-action-recording/07-02-PLAN.md`
- `.planning/phases/07-action-recording/07-03-PLAN.md`
- `.planning/phases/07-action-recording/07-01-SUMMARY.md`
- `.planning/phases/07-action-recording/07-02-SUMMARY.md`
- `.planning/phases/07-action-recording/07-03-SUMMARY.md`
- `implementation_plan.md`
- `src/shared/browser.ts`
- `src/shared/ipc.ts`
- `src/preload/index.ts`
- `src/main/cdpBridge.ts`
- `src/main/actionRecorder.ts`
- `src/main/browserRuntime.ts`
- `src/main/main.ts`
- `src/renderer/lib/commandPalette.ts`
- `src/renderer/components/CommandPalette.tsx`
- `src/renderer/App.tsx`
- `src/renderer/styles/global.css`
- `copilot-instructions.md`

## Decision Fidelity Constraints
- `D-01` to `D-04`: playback is command-first, tab-bound, and must acquire the Phase 6 automation lock (`automation-engine` owner semantics).
- `D-05` to `D-08`: variable collection is a preflight stage; secrets are masked/in-memory only and missing values fail fast before execution.
- `D-09` to `D-12`: playback must enforce schema/action/ordering validation plus deterministic timeout policy; no hidden sleeps.
- `D-13` to `D-15`: default stop-on-error, optional continue-on-error, and step-level actionable failure context.

## Existing Architecture Findings

### 1. Contracts and IPC extension points are already stable
- `src/shared/browser.ts` already defines workflow step schema from recording (`navigate`, `click`, `type`, `wait`) and variable definitions.
- `src/shared/ipc.ts` and `src/preload/index.ts` are the established pattern for new automation methods.
- Phase 8 should extend these with playback-specific request/result/status contracts without breaking recorder contracts.

### 2. Main process is the correct execution boundary
- `src/main/main.ts` centralizes manager creation and IPC handlers.
- `src/main/cdpBridge.ts` already provides single-owner connect/disconnect lock semantics.
- Playback runner should remain main-process owned and be invoked through typed IPC only.

### 3. Tab binding and lifecycle hooks already exist
- `src/main/browserRuntime.ts` provides active-tab fallback and deterministic tab identity resolution.
- Existing `onTabClosed` hook can terminate active playback if bound target disappears.
- This supports `D-04` target-loss fail-stop behavior.

### 4. Command-first UX path exists in renderer
- `src/renderer/lib/commandPalette.ts` supports adding playback run/cancel commands.
- `src/renderer/App.tsx` already handles recorder status polling and command feedback pattern.
- A small variable prompt surface can be added in renderer without introducing sidebar/library UX (Phase 9 scope).

### 5. Saved-workflow source should stay minimal in Phase 8
- Phase 9 owns library CRUD/history UX (`AUTO-04`, `AUTO-05`, `SIDE-01`).
- For Phase 8, support playback from saved workflow JSON input path and typed preflight prompts, without introducing full management UI.

## Recommended Technical Approach

### A. Add explicit playback contracts
- Extend shared types with playback start/cancel/status contracts.
- Include:
  - source descriptor (file-backed workflow JSON)
  - variable map and missing-variable prompt payloads
  - run state + step failure metadata
  - failure policy enum (`stop-on-error`, `continue-on-error`)

### B. Build dedicated main-process playback runner
- Introduce a playback manager module that handles:
  - preflight validation (schema/version/action/seq)
  - variable requirement extraction and missing-variable response
  - step execution order by `seq`
  - timeout clamp policy (workflow default + per-step override)
  - stop/continue failure policy semantics and run summary

### C. Integrate with CDP lock and runtime lifecycle
- Playback start acquires automation lock via bridge owner `automation-engine`.
- Runner executes against resolved target page in bound tab only.
- Tab close/bridge loss/cancel transitions run state with typed reason.

### D. Renderer command flow with safe pre-run prompting
- Add command palette run/cancel actions for playback.
- On missing variables response, open a small prompt panel before execution.
- Secret variables render masked input and are sent only for current run request.

## Security Considerations
- Preserve trust boundary: renderer submits intent/variables, main validates and executes.
- Reject malformed JSON, unsupported actions, non-monotonic `seq`, and missing required fields before any browser action.
- Keep secret variable values in-memory only; never write secrets into persisted workflow files.
- Return typed failure reasons and step context without leaking secret values in error payloads.

## Validation Architecture
- Quick checks per task: `npm run typecheck`
- Wave checks: `npm run lint; npm run typecheck; npm run build`
- Phase checks:
  - preflight rejects malformed or incomplete workflow requests
  - required variable prompts are returned before run start when values are missing
  - stop-on-error halts at first failure with step context
  - continue-on-error executes remaining steps and reports partial-failure summary
  - tab-target loss and cancel transition playback state deterministically

## Risks and Mitigations
- Risk: CDP session lock conflicts with recorder/manual connect usage.
  - Mitigation: enforce bridge busy handling and typed busy response at playback start.
- Risk: action execution flakiness from selector timing.
  - Mitigation: deterministic timeout policy + explicit `wait` semantics from workflow.
- Risk: scope creep into automation library management.
  - Mitigation: keep source handling file-backed and command-driven in Phase 8; defer CRUD/history UX to Phase 9.
- Risk: secret leakage through logs/errors.
  - Mitigation: redact variable maps in logs and never include secret values in failure payloads.

## Deliverables Expected from Planning
- Plan for shared playback contracts and IPC/preload extension.
- Plan for main-process playback runner with preflight, timeout, and policy logic.
- Plan for command palette run/cancel flow with safe variable prompt UX.
- Threat-model coverage for malformed payloads, lock spoofing, and secret exposure.

## Confidence
Medium-high. Foundation from Phases 6 and 7 is strong; main implementation complexity is robust preflight validation and deterministic failure-policy handling under real page variability.

---
*Research completed: 2026-04-15*
