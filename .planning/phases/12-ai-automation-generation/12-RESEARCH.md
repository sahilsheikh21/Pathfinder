# Phase 12 Research: AI Automation Generation

## Objective
Research a practical implementation path for Phase 12 so planning can satisfy AI-03 and AI-05: generate schema-valid automation drafts from natural-language prompts, expose command-first generation controls with progress/cancel, and require explicit preview/edit/approve before save/run.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/STATE.md
- .planning/phases/12-ai-automation-generation/12-CONTEXT.md
- .planning/phases/10-llm-adapter-layer/10-CONTEXT.md
- .planning/phases/11-page-analysis/11-CONTEXT.md
- implementation_plan.md
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/main/main.ts
- src/main/llm/llmAdapterService.ts
- src/main/automationPlayback.ts
- src/main/automationLibraryStore.ts
- src/main/actionRecorder.ts
- src/renderer/lib/commandPalette.ts
- src/renderer/components/AutomationPlaybackPrompt.tsx
- src/renderer/App.tsx

## Locked Decision Constraints
- Single primary candidate draft per request in v1.
- Draft must conform to RecorderWorkflowDocument (version 1) before preview.
- Supported action set remains navigate/click/type/wait.
- Prompt flow is freeform-first with optional structured constraints.
- Preview/edit/approve lives in AI sidebar and requires explicit Save Draft / Save and Run / Discard.
- Command palette must expose generate and cancel commands with deterministic status and retry flow.
- No auto-save and no unapproved execution in this phase.

## Existing Architecture Findings

### 1) Strong reusable workflow contract and validator path already exist
- Workflow schema/types are centralized in src/shared/browser.ts.
- Main playback pipeline in src/main/automationPlayback.ts already validates workflow version, step ordering, and supported actions.
- This is the best enforcement anchor for "valid before preview" by reusing or extracting validation logic.

### 2) LLM generation backend is available but domain-agnostic
- src/main/llm/llmAdapterService.ts provides provider-neutral text generation + typed failures.
- Phase 12 needs a domain service that turns natural language into workflow JSON candidates and maps generation failures to actionable UI results.

### 3) Command-first patterns are established
- src/renderer/lib/commandPalette.ts already supports AI command namespace and command-to-sidebar focus flow.
- Existing command error semantics (keep palette open on failure) can be reused for generation retries.

### 4) Approval and runtime plumbing can be reused
- automationLibraryUpsert and automationLibraryRun APIs already exist and can implement Save Draft / Save and Run.
- AutomationPlaybackPrompt patterns provide a baseline for structured interactive confirmation flows.

## Recommended Technical Approach

### A) Contract-first addition for generation
- Add new shared contracts in src/shared/browser.ts and channels in src/shared/ipc.ts:
  - request model: prompt + optional constraints
  - result model: generated draft, validation state, warnings, failure category
  - runtime status model: idle/generating/validating/ready/failed/cancelled
  - cancellation and approval payloads

### B) Main-process orchestration service
- Create src/main/llm/automationGenerationService.ts:
  - compose prompt using freeform + optional constraints
  - invoke llmAdapterService.generate
  - parse and normalize model output to workflow candidate
  - run strict schema validation before returning preview payload
  - maintain operation status/cancel state for one active generation at a time

### C) Validation reuse strategy
- Reuse existing playback validation rules by extracting shared validator helper from automationPlayback.ts or creating a shared validator utility consumed by both playback and generation service.
- Ensure generated steps are sorted/normalized and action-specific required fields are enforced before preview.

### D) Renderer approval surface
- Extend AI sidebar in App.tsx with:
  - prompt input + optional constraints
  - generation status and cancel action
  - structured step editor + optional raw JSON panel
  - explicit approval actions (Save Draft, Save and Run, Discard)
- Keep unapproved drafts in memory-only renderer state.

### E) Command palette integration
- Add ai.automation.generate and ai.automation.cancel to src/renderer/lib/commandPalette.ts.
- Command execution should always focus AI sidebar section and then run requested action.

## Security and Threat Notes
- Treat model output as untrusted input until schema-normalized and validated.
- Never execute generated output directly without user approval.
- Keep generated prompt/result logs redacted and avoid including secrets from variable values.
- Enforce typed, user-actionable failures for malformed output and provider errors.

## Risks and Mitigations
- Risk: Hallucinated selectors or unsupported actions in model output.
  - Mitigation: strict action whitelist + schema validator + inline editor correction before approval.
- Risk: Long-running generation affecting UX clarity.
  - Mitigation: explicit generation status machine and command/panel cancel controls.
- Risk: Invalid run triggered from partially edited draft.
  - Mitigation: revalidate on each approval action before save/run.

## Validation Architecture
- Quick checks after each task commit:
  - npm run typecheck
- Wave checks:
  - npm run lint
  - npm run typecheck
- Phase checks:
  - npm run build
  - command palette generate/cancel commands route to AI sidebar and report deterministic status
  - generated drafts are schema-valid before preview
  - preview/edit/approve actions enforce explicit approval before persistence/execution

## Planning Deliverables Expected
- Plan for shared contracts + IPC/preload bridge + main generation service.
- Plan for renderer sidebar draft review/editor/approval flow.
- Plan for command palette integration and progress/cancel UX.
- Plan for validation coverage of schema conformance and approval gating.

## Confidence
Medium-high. The major primitives (typed LLM backend, workflow validator, command architecture, library/run APIs) already exist; Phase 12 primarily composes and hardens these paths.

---
*Research completed: 2026-04-16*