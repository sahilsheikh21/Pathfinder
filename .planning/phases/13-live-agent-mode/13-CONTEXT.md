# Phase 13: Live Agent Mode - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Allow AI-assisted multi-step browser execution under explicit user control, with high-impact approval gates, per-step rationale logging, and pause/cancel controls. This phase implements requirement `AI-04` and does not introduce autonomous no-approval execution.

</domain>

<decisions>
## Implementation Decisions

### High-Impact Approval Policy
- **D-01:** Use a risk-tier model: low-risk read/inspect actions can run without approval; high-impact actions require explicit approval before execution.
- **D-02:** High-impact actions include irreversible or externally visible changes (for example: submit, delete, purchase, send, credential entry, file upload/download mutation, account/security changes).
- **D-03:** Approval is always action-scoped; prior approvals in a session do not permanently bypass future high-impact checks.

### Approval Cadence and UX
- **D-04:** Use hybrid approval flow: one initial plan-preview approval, plus checkpoint approvals when a high-impact step is reached.
- **D-05:** Each approval prompt must show action intent, target, risk tier, and expected side effect so the user can make an informed decision quickly.
- **D-06:** User controls in the checkpoint are `Approve`, `Reject`, and `Cancel run`; rejected high-impact steps do not auto-fallback into unsafe alternatives.

### Step Log and Rationale Visibility
- **D-07:** Log every executed/planned step with: planned action, risk tier, approval decision (if applicable), observed result, and next-step rationale.
- **D-08:** Keep logs local-first and structured for deterministic replay/debug; sensitive values are redacted using existing redaction posture from prior AI phases.
- **D-09:** Expose live run timeline in the existing AI sidebar flow so command-triggered runs and UI review share one source of truth.

### Pause, Cancel, and Resume Semantics
- **D-10:** `Pause` takes effect at the next safe boundary (between steps), preserving run state.
- **D-11:** `Cancel` is immediate hard-stop and prevents further agent actions in the current run.
- **D-12:** `Resume` continues from the last unexecuted step only when page context is still valid; otherwise require a user-confirmed re-plan/restart.

### the agent's Discretion
- Exact copywriting and visual treatment for risk badges, approval dialogs, and timeline labels.
- Exact safe-boundary implementation detail as long as pause never executes additional post-boundary actions.
- Exact internal schema names for audit events, provided the required fields in D-07 are captured.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirement Anchors
- `.planning/ROADMAP.md` - Phase 13 goal, requirement mapping (`AI-04`), success criteria.
- `.planning/REQUIREMENTS.md` - `AI-04` requirement definition and traceability.
- `.planning/PROJECT.md` - command-first and local-first constraints, secure process boundaries.
- `implementation_plan.md` - milestone intent for live agent mode and explicit-control posture.

### Prior Locked Decisions
- `.planning/phases/10-llm-adapter-layer/10-CONTEXT.md` - provider-neutral failures, secure secret handling, deterministic error contracts.
- `.planning/phases/11-page-analysis/11-CONTEXT.md` - grounded responses, cancellation/progress patterns, redaction posture.
- `.planning/phases/12-ai-automation-generation/12-CONTEXT.md` - explicit user approval before execution and command/sidebar integration model.

### Existing Code Anchors
- `src/shared/browser.ts` - AI and automation status/failure/cancel type contracts.
- `src/shared/ipc.ts` - typed IPC channels for AI and playback operations.
- `src/main/main.ts` - centralized handler wiring for AI generation/cancel/status and lifecycle integration.
- `src/main/automationPlayback.ts` - step execution lifecycle, failure policy, cancel handling, run status semantics.
- `src/main/llm/automationGenerationService.ts` - operation-state model and cancellation behavior.
- `src/preload/index.ts` - renderer-safe API bridge surface.
- `src/renderer/App.tsx` - AI sidebar state, generation status UX, command-to-panel focus behavior.
- `src/renderer/lib/commandPalette.ts` - command registration and execution patterns for AI controls.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/automationPlayback.ts`: mature run lifecycle model (running/completed/failed/cancelled) and cancellation hooks reusable for live agent control states.
- `src/shared/browser.ts`: existing typed status/error unions provide a strong base for live-agent approval and audit event contracts.
- `src/renderer/App.tsx`: existing AI sidebar busy-state and status messaging patterns can host approval/timeline UI without introducing a separate surface.
- `src/renderer/lib/commandPalette.ts`: command-first launch/cancel patterns already exist for AI generation and analysis.

### Established Patterns
- Main process owns privileged execution and orchestration; renderer consumes typed preload APIs only.
- Deterministic explicit control is preferred over silent retries/fallbacks in AI flows.
- Cancellation and operational status are first-class states and should remain user-visible.

### Integration Points
- Add live-agent request/status/approval contracts in shared types and IPC.
- Implement live-agent orchestrator in main process adjacent to playback + AI generation services.
- Add approval/timeline controls in AI sidebar and command actions for pause/cancel/resume.
- Reuse existing history/logging persistence approach for structured per-step audit trail.

</code_context>

<specifics>
## Specific Ideas

- User selected all four gray-area domains for this phase (approval policy, cadence UX, logging model, run controls).
- To recover from interrupted interactive flow, decisions were resolved with the recommended safety-first defaults aligned to prior phase patterns and AI-04.

</specifics>

<deferred>
## Deferred Ideas

- Fully autonomous long-horizon mode without step-level or high-impact approvals (future scope, aligns with deferred `V2-04`).
- Rich forensic payload capture (full raw DOM/tool payload snapshots for every step) beyond structured redacted audit logs.

</deferred>

---

*Phase: 13-live-agent-mode*
*Context gathered: 2026-04-16*
