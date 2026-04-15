# Phase 9 Research: Sidebar and History

## Objective
Research implementation approach for Phase 9 so planning can deliver AUTO-04, AUTO-05, and SIDE-01 while preserving locked decisions in 09-CONTEXT.md.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/STATE.md
- .planning/phases/09-sidebar-and-history/09-CONTEXT.md
- .planning/phases/08-automation-playback/08-RESEARCH.md
- .planning/phases/08-automation-playback/08-01-PLAN.md
- .planning/phases/08-automation-playback/08-02-PLAN.md
- .planning/phases/08-automation-playback/08-03-PLAN.md
- implementation_plan.md
- copilot-instructions.md
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/main/main.ts
- src/main/automationPlayback.ts
- src/main/actionRecorder.ts
- src/main/homeStore.ts
- src/renderer/App.tsx
- src/renderer/components/HomeStarterPage.tsx
- src/renderer/lib/commandPalette.ts
- src/renderer/styles/global.css

## Locked Decision Constraints
- Sidebar behavior is explicit: left-docked, collapsible icon rail, persisted width/section/filter/scroll, narrow-width overlay fallback, and keyboard support.
- Library is local-first CRUD with free-form tags, text+tag filtering, strict naming rules, and run actions that reuse existing playback flow.
- History is operational, not analytics-only: statuses, duration, failure context, rerun, filtering, retention cap (500), redaction of secrets, and cross-surface consistency.
- AI chat remains placeholder-only in this phase.

## Existing Architecture Findings

### 1. Automation runtime data is already structured for history
- src/main/automationPlayback.ts already tracks run states, summary, first failure, run ids, and run source paths.
- src/shared/browser.ts already defines AutomationPlaybackRunSummary and AutomationPlaybackStepFailure types.
- These can be persisted into a dedicated history store with minimal transformation.

### 2. Recorder output is ready for library ingestion
- src/main/actionRecorder.ts outputs deterministic workflow documents with stable schema and variable placeholders.
- This supports "save latest recording" creation path without introducing new workflow formats.

### 3. Existing local-store pattern is proven
- src/main/homeStore.ts uses userData JSON persistence with validation and safe fallback resets.
- The same pattern can be reused for library/history stores or split into dedicated modules.

### 4. Renderer shell has central integration point
- src/renderer/App.tsx is already the orchestration layer for command palette, recorder, playback, and status pills.
- Sidebar state and cross-surface synchronization belong here, with new renderer components for panel sections.

### 5. IPC/preload architecture is ready to extend
- src/shared/ipc.ts and src/preload/index.ts already expose typed invoke patterns.
- Phase 9 can add typed channels for library CRUD, tag/filter queries, history listing, and history mutation.

## Recommended Technical Approach

### A. Add dedicated main-process operational stores
- Introduce a library store for saved automation metadata and workflow source references.
- Introduce a history store for normalized run records (with retention pruning and redaction guarantees).
- Keep both local-first under userData and validated on load.

### B. Add an operations manager layer in main process
- Centralize orchestration for:
  - library create/import/rename/delete/tag/filter
  - run and rerun actions
  - history write/update for running to terminal transitions
  - projection for Home recent automations
- Keep playback as source of truth for run execution and feed history from playback status transitions.

### C. Extend shared contracts and IPC surface
- Add explicit library item, history entry, filter request, and sidebar preference contracts in src/shared/browser.ts.
- Add corresponding typed channels and preload methods in src/shared/ipc.ts and src/preload/index.ts.

### D. Build sidebar renderer surfaces as composable sections
- Add a sidebar root component with saved automations/history/AI placeholder sections.
- Implement collapse/expand/icon-rail behavior with persisted preferences.
- Add virtualized history list rendering to keep interaction smooth at retention limits.

### E. Preserve command-first UX and unify behavior
- Add sidebar toggle command and keep command palette run/cancel unchanged.
- Make sidebar run/rerun call the same playback entry points used by command palette.
- Ensure failure badges and Home recent automations update from the same history-backed source.

## Security and Threat Notes
- Treat all renderer-originating library/history mutations as untrusted input and validate in main process.
- Never persist secret variable values to library/history records.
- Keep deletion actions explicit with confirmation to reduce accidental destructive operations.
- Ensure stale workflow references do not crash list/history views; mark as deleted/missing instead.

## Risks and Mitigations
- Risk: scope explosion from many locked UI decisions.
  - Mitigation: split execution into contract/store/runtime plans first, then UI and integration waves.
- Risk: history and playback divergence.
  - Mitigation: one-way history writes sourced from playback lifecycle transitions only.
- Risk: renderer performance degradation with large history.
  - Mitigation: enforce cap pruning in main process and virtualize renderer list.
- Risk: inconsistent state across Home, sidebar, and command palette.
  - Mitigation: establish one app-level source of truth and subscribe surfaces to the same typed updates.

## Validation Architecture
- Quick checks after each task: npm run typecheck
- Wave checks: npm run lint; npm run typecheck; npm run build
- Phase checks:
  - library CRUD/tag/filter behavior matches AUTO-04 decisions
  - history fields, ordering, retention, and rerun behavior match AUTO-05 decisions
  - sidebar section/collapse/restore behavior matches SIDE-01 and context decisions
  - no secret variables are written to persisted history/library records

## Planning Deliverables Expected
- Plan for shared contracts and typed IPC/preload surface for library/history/sidebar preferences.
- Plan for main-process stores/managers and playback-to-history lifecycle wiring.
- Plan for sidebar UI components, responsive collapse/overlay behavior, and section interactions.
- Plan for cross-surface integration (sidebar badges, home recent automations, command palette parity).

## Confidence
Medium. Existing runtime foundations are strong, but phase 9 has high decision density and requires careful sequencing to avoid regressions while integrating multiple surfaces.

---
*Research completed: 2026-04-15*
