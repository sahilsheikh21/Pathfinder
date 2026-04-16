# Phase 13 Research: Live Agent Mode

## Objective
Research a concrete implementation path for Phase 13 (AI-04): controlled multi-step AI execution with explicit approvals for high-impact actions, per-step rationale/audit logging, and pause/cancel controls with safe resume behavior.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/STATE.md
- .planning/phases/13-live-agent-mode/13-CONTEXT.md
- .planning/phases/10-llm-adapter-layer/10-CONTEXT.md
- .planning/phases/11-page-analysis/11-CONTEXT.md
- .planning/phases/12-ai-automation-generation/12-CONTEXT.md
- implementation_plan.md
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/main/main.ts
- src/main/automationPlayback.ts
- src/main/automationHistoryStore.ts
- src/main/llm/automationGenerationService.ts
- src/renderer/App.tsx
- src/renderer/lib/commandPalette.ts
- src/renderer/components/AutomationSidebar.tsx
- src/renderer/components/AutomationSidebarHistory.tsx

## Locked Decision Constraints
- Approval policy is risk-tiered: low-risk read/inspect steps can auto-run, high-impact steps require explicit approval.
- Approval cadence uses batches: user approves the next N planned steps.
- Log depth is full audit per step: planned action, risk tier, approval decision, observed result, next-step rationale.
- Pause/cancel/resume behavior: pause at safe boundary, cancel immediate hard stop, resume from last unexecuted step when context is valid.
- Keep command-first + AI sidebar operating model; preserve secure main-process orchestration boundaries.

## Existing Architecture Findings

### 1) There is already a robust step-runner and cancellation model in main process
- `src/main/automationPlayback.ts` already manages operation lifecycle, step execution, failure policy, and cancel transitions.
- This is the best base for live-agent execution control semantics instead of building a parallel runner from scratch.

### 2) AI operation state patterns already exist and are reusable
- `src/main/llm/automationGenerationService.ts` models active operation id, deterministic status transitions, and cancel semantics.
- `src/renderer/App.tsx` already consumes these states with user-visible messaging and retry behavior.

### 3) Typed shared contracts and IPC boundaries are established
- `src/shared/browser.ts` and `src/shared/ipc.ts` already define strict typed request/result shapes for AI and automation flows.
- `src/preload/index.ts` follows secure minimal wrappers pattern for renderer access.

### 4) Command-first and sidebar-first control surfaces are already integrated
- `src/renderer/lib/commandPalette.ts` has AI namespaced commands and dependency-injected handlers.
- `src/renderer/App.tsx` can focus AI section and route asynchronous AI operations with status and cancellation.

### 5) History/logging patterns exist and can be extended
- `src/main/automationHistoryStore.ts` already persists run records with lifecycle statuses.
- Live-agent audit trail can reuse this storage style with an extended per-step event schema.

## Recommended Technical Approach

### A) Contract-first live-agent API surface
- Extend `src/shared/browser.ts` with new live-agent types:
  - LiveAgentStartRequest/Result
  - LiveAgentStatus (idle/planning/running/waiting-approval/paused/cancelled/failed/completed)
  - LiveAgentApprovalRequest/Result (batch-scoped approvals)
  - LiveAgentStepAuditEvent (planned action, risk tier, approval decision, observed result, rationale)
  - LiveAgentPause/Resume/Cancel request/results
- Extend `src/shared/ipc.ts` with channels for start/status/approve/pause/resume/cancel and optional audit stream fetch.

### B) Main-process orchestrator service
- Add `src/main/liveAgentOrchestrator.ts` to coordinate:
  - generation/planning loop inputs
  - risk classification per proposed step (low vs high impact)
  - batch gating (N-step approval windows)
  - execution handoff to existing playback capabilities
  - pause-at-boundary control and immediate cancel handling
- Keep a single active run guard to avoid concurrent control races.

### C) High-impact risk classifier and batch approval gate
- Add a classifier utility in main process (`src/main/liveAgentRiskPolicy.ts`) with deterministic rules for high-impact categories:
  - submit/delete/purchase/send
  - credential entry and account/security settings mutation
  - file upload/download mutation side effects
- Before executing each batch, emit approval-required state with the concrete step list and risk labels.

### D) Audit log persistence and retrieval
- Add `src/main/liveAgentAuditStore.ts` for append-only per-step audit events keyed by run id.
- Persist redacted step payloads only (no secrets/raw credentials).
- Expose query APIs for renderer timeline rendering.

### E) Renderer and command integration
- Extend `src/renderer/App.tsx` AI section with live-agent controls:
  - Start run
  - Approve batch / reject batch
  - Pause / Resume / Cancel
  - Timeline view of step audit events
- Add command palette entries in `src/renderer/lib/commandPalette.ts`:
  - `ai.agent.start`
  - `ai.agent.pause`
  - `ai.agent.resume`
  - `ai.agent.cancel`

## Security and Threat Notes
- Treat all model-proposed steps as untrusted until risk classified and approval-gated.
- Prevent confused-deputy execution by enforcing approval checks in main process, not renderer.
- Redact sensitive values in all audit logs and status payloads crossing IPC.
- Block execution when tab/page context no longer matches expected run context unless user explicitly re-approves.

## Risks and Mitigations
- Risk: Approval bypass due race between resume/execute transitions.
  - Mitigation: single authoritative state machine and transition guards in orchestrator.
- Risk: Batch approvals become too broad and hide high-impact intent.
  - Mitigation: batch view must include step-by-step risk labels and side-effect summaries.
- Risk: Resume on stale page context causes unintended actions.
  - Mitigation: pre-resume context validation and mandatory re-approval on mismatch.
- Risk: Audit logs leak sensitive input values.
  - Mitigation: structured redaction at write-time and no raw payload storage.

## Validation Architecture
- Quick checks after each task commit:
  - npm run typecheck
- Wave checks:
  - npm run lint; npm run typecheck
- Phase checks:
  - npm run build
  - live-agent status transitions are deterministic across start/approval/pause/resume/cancel
  - high-impact steps do not execute without approval in batch gate
  - per-step audit timeline includes planned action, risk tier, approval, result, rationale

## Planning Deliverables Expected
- Plan for shared contracts + IPC/preload bridge and live-agent state machine.
- Plan for main-process orchestration, risk classification, batch approval gate, and audit persistence.
- Plan for renderer/command UX controls and timeline visibility.
- Plan for deterministic pause/cancel/resume behavior and context-validity guardrails.

## Confidence
Medium-high. Existing AI automation and playback architecture provides most required primitives; Phase 13 is primarily an orchestration, policy, and UX-control layer with strict gating and audit semantics.

---
*Research completed: 2026-04-16*