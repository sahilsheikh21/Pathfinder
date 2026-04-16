# Phase 12: AI Automation Generation - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate candidate automation workflows from natural-language user prompts, validate them against the existing workflow schema before presentation, expose generation through command-first flows with progress/cancel controls, and require explicit user preview/edit/approve before save or run.

</domain>

<decisions>
## Implementation Decisions

### Generation Output and Validation
- **D-01:** Generation returns one primary candidate workflow draft per request in v1 for predictable approval flow.
- **D-02:** Every generated draft must be normalized to `RecorderWorkflowDocument` (`version: 1`) before user preview.
- **D-03:** Unsupported or low-confidence intents must fail with typed actionable guidance instead of emitting malformed workflow JSON.
- **D-04:** Generated steps are constrained to currently supported playback actions (`navigate`, `click`, `type`, `wait`) in this phase.

### Prompt Input Model
- **D-05:** Generation accepts freeform natural-language prompt as the primary input.
- **D-06:** Prompt flow includes optional structured constraints (`targetUrl`, `objective`, `variables`, `notes`) to improve determinism.
- **D-07:** Missing critical intent details trigger a clarification prompt in the AI panel rather than implicit assumptions.

### Preview, Edit, and Approval UX
- **D-08:** Preview and approval happen in the AI sidebar section to stay consistent with existing AI command flows.
- **D-09:** Review surface is hybrid: structured step editor first, with optional advanced raw JSON view.
- **D-10:** User must explicitly choose one approval action: `Save Draft`, `Save and Run`, or `Discard`.
- **D-11:** Unapproved drafts remain in memory only and are never persisted automatically.

### Command Palette and Runtime Controls
- **D-12:** Add command entries `ai.automation.generate` and `ai.automation.cancel` under AI command namespace.
- **D-13:** Command execution auto-focuses the AI sidebar section and displays deterministic generation states (`idle`, `generating`, `validating`, `ready`, `failed`, `cancelled`).
- **D-14:** Cancel must be explicit and user-invoked; no hidden retries or auto-restarts.
- **D-15:** Generation failures remain retryable from the same panel with preserved prompt inputs.

### Post-Approval Routing
- **D-16:** `Save Draft` stores the approved workflow in the automation library as an imported entry with AI-generation provenance metadata.
- **D-17:** `Save and Run` performs save first, then executes via existing playback run path.
- **D-18:** Approval is always required before any run triggered from generated output in this phase.

### the agent's Discretion
- Exact copywriting for generation status, failure messages, and clarification prompts.
- Exact visual design of the step editor and JSON toggle controls within existing tokenized sidebar styling.
- Internal heuristic details for translating prompt text into selector/step candidates, as long as schema validity and user approval requirements are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirement Anchors
- `.planning/ROADMAP.md` - Phase 12 goals, requirement mapping (`AI-03`, `AI-05`), and success criteria.
- `.planning/REQUIREMENTS.md` - AI automation generation and command-progress requirement definitions.
- `.planning/PROJECT.md` - command-first and local-first constraints plus Electron process-boundary rules.
- `.planning/STATE.md` - current completed baseline through Phase 11.

### Product Direction
- `implementation_plan.md` - AI automation generation and command model direction for milestone 3.

### Existing Type and IPC Contracts
- `src/shared/browser.ts` - workflow document schema, variable types, playback action constraints, LLM and page-analysis contract patterns.
- `src/shared/ipc.ts` - typed IPC channel extension points and Pathfinder API shape.
- `src/preload/index.ts` - secure renderer bridge pattern for new generation methods.

### Runtime and Persistence Anchors
- `src/main/llm/llmAdapterService.ts` - provider-neutral generation pipeline and typed failure mapping.
- `src/main/automationPlayback.ts` - strict workflow validation and run lifecycle behavior.
- `src/main/automationLibraryStore.ts` - save/upsert semantics and runnable workflow source requirements.
- `src/main/actionRecorder.ts` - canonical workflow step ordering and variable placeholder patterns.

### Renderer and Command Integration Anchors
- `src/renderer/lib/commandPalette.ts` - command registration, fuzzy matching, and command dependency model.
- `src/renderer/components/AutomationPlaybackPrompt.tsx` - existing variable prompt and approval-adjacent interaction pattern.
- `src/renderer/App.tsx` - command execution wiring, AI panel focus behavior, playback status/cancel handling.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/llm/llmAdapterService.ts`: provides stable provider-neutral text generation backend for draft synthesis.
- `src/main/automationPlayback.ts`: already enforces strict workflow validation and can be reused as pre-approval validation path.
- `src/main/automationLibraryStore.ts`: ready persistence path for approved generated drafts.
- `src/renderer/lib/commandPalette.ts`: established command namespace and active-tab guard/error behavior for new AI generation commands.
- `src/renderer/components/AutomationPlaybackPrompt.tsx`: reusable interaction pattern for structured user confirmation/inputs.

### Established Patterns
- Main process owns privileged generation and automation operations; renderer consumes typed preload APIs only.
- Command palette is a first-class control surface and must stay deterministic with clear error handling.
- AI sidebar is already used for analysis workflows with busy state, cancellation, and actionable error UX.
- Workflow execution engine only supports the current action set and strict ordering constraints.

### Integration Points
- Add generation-specific request/result contracts in shared types and IPC.
- Implement generation orchestration service in main process near existing LLM adapter and playback validation flows.
- Extend preload bridge and renderer command wiring for generate/cancel/status actions.
- Build sidebar preview/editor/approval surface in App-level AI panel with save/run routing into existing library/playback managers.

</code_context>

<specifics>
## Specific Ideas

- Prefer deterministic single-draft flow for v1 so users can reliably review and approve without high cognitive load.
- Keep generation and approval in the AI sidebar so command-invoked workflows land in one consistent place.
- Enforce schema-valid output before preview to prevent invalid workflow drafts from reaching user approval surfaces.
- This context pass was completed autonomously using recommended defaults due interrupted interactive discussion.

</specifics>

<deferred>
## Deferred Ideas

- Autonomous multi-step execution without explicit approval (belongs to Phase 13 live-agent controls).
- Multi-candidate ranking/simulation scoring and model-comparison generation pipelines.
- Cross-session draft history/versioning for generated workflows beyond standard library save flow.

</deferred>

---

*Phase: 12-ai-automation-generation*
*Context gathered: 2026-04-16*
