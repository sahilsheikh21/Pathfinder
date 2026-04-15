# Roadmap: Pathfinder

**Created:** 2026-04-14
**Based on:** implementation_plan milestones (Core Shell, Automation, AI, Polish)
**Total phases:** 16
**v1 requirements mapped:** 30/30

## Milestone Overview

| Milestone | Phases | Focus |
|-----------|--------|-------|
| Milestone 1 | 1-5 | Core browser shell and command UX |
| Milestone 2 | 6-9 | Automation engine and automation operations |
| Milestone 3 | 10-13 | AI and LLM integration |
| Milestone 4 | 14-16 | Settings, polish, packaging, release readiness |

## Phase Summary

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Project scaffold | Establish Electron + TypeScript + React foundation and Apple-style UI system | (foundation) | 4 |
| 2 | Browser core | Deliver baseline browser runtime (tabs, nav, address bar, downloads) | BROW-01..BROW-05 | 5 |
| 3 | Home starter page | Deliver custom new-tab experience | HOME-01..HOME-03 | 3 |
| 4 | Command palette | 3/3 | Complete    | 2026-04-15 |
| 5 | Quick search popup | 3/3 | Complete    | 2026-04-15 |
| 6 | CDP integration | Establish Playwright-Core + CDP bridge | AUTO-01 | 3 |
| 7 | Action recording | Capture user actions into workflow schema | AUTO-02 | 3 |
| 8 | Automation playback | Execute workflows with variable injection and guardrails | AUTO-03 | 3 |
| 9 | Sidebar and history | Deliver automation library and execution history UX | AUTO-04, AUTO-05, SIDE-01 | 4 |
| 10 | LLM adapter layer | Integrate cloud/local providers behind one contract | AI-01 | 3 |
| 11 | Page analysis | AI Q&A on active page content | AI-02 | 3 |
| 12 | AI automation generation | Prompt-to-workflow with explicit preview and command integration | AI-03, AI-05 | 3 |
| 13 | Live agent mode | Controlled multi-step AI execution with approvals | AI-04 | 3 |
| 14 | Settings system | Full general/privacy configuration surface | SET-01, SET-03 | 3 |
| 15 | Theming and shortcuts | Appearance controls and keyboard customization | SET-02, SET-05 | 3 |
| 16 | Packaging and distribution | Signed installer and safe update channel | REL-01, REL-02 | 3 |

## Milestone 1: Core Browser Shell (Phases 1-5)

### Phase 1: Project Scaffold
Goal: Establish foundation with Electron, TypeScript, React, build pipeline, and Apple-style design tokens/components.
Requirements: (foundation)
Status: Complete (2026-04-14)
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md - Scaffold tooling, secure process bootstrap, typed IPC contracts
- [x] 01-02-PLAN.md - Apple-style token shell, CI quality gates, packaging baseline

**UI hint**: yes
Success criteria:
1. Electron main, preload, and renderer processes build and run in development mode.
2. TypeScript project references and lint/typecheck scripts pass in CI.
3. Apple-style design system assets are integrated and available to renderer UI.
4. Packaging config and environment scaffolding exist for future Windows build phases.

### Phase 2: Browser Core
Goal: Deliver baseline browser behavior with tabs and navigation.
Requirements: BROW-01, BROW-02, BROW-03, BROW-04, BROW-05
Status: Complete (2026-04-14)
**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md - Define browser-core contracts and omnibox routing primitives
- [x] 02-02-PLAN.md - Implement tab runtime and navigation shell wiring
- [x] 02-03-PLAN.md - Add download lifecycle visibility and crash-session restore

Success criteria:
1. Users can create, close, and switch tabs while preserving per-tab navigation state.
2. Address bar correctly routes URL input versus search query fallback.
3. Back/forward/reload controls operate reliably on active tab.
4. Download flow supports prompt/path and visible progress.
5. Unexpected renderer crashes trigger session recovery for active tab set.

### Phase 3: Home Starter Page
Goal: Deliver the custom new-tab home experience.
Requirements: HOME-01, HOME-02, HOME-03
Status: Complete (2026-04-15)
**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md - Build home route/runtime contracts and local home data store
- [x] 03-02-PLAN.md - Implement home starter page UI and query-only search flow
- [x] 03-03-PLAN.md - Add quick-link editing/launch behavior and recent-automation empty state

Success criteria:
1. New tab opens to branded starter page with greeting and current date.
2. Home search box routes queries using configured default search engine.
3. Quick links and recent automation launch cards render from local data.

### Phase 4: Command Palette
Goal: Provide VS Code-style command execution as Pathfinder's primary interaction layer.
Requirements: CMD-01, CMD-02
Status: Complete (2026-04-15)
**Plans:** 3/3 plans complete

Plans:
- [x] 04-01-PLAN.md - Define command registry contracts and deterministic fuzzy ranking
- [x] 04-02-PLAN.md - Build command palette overlay UI with keyboard navigation
- [x] 04-03-PLAN.md - Integrate shortcuts and command execution in App shell

Success criteria:
1. Command palette opens via configured keyboard shortcuts globally.
2. Fuzzy search returns commands with description and argument hints.
3. Executing command triggers the intended browser action with clear error feedback.

### Phase 5: Quick Search Popup
Goal: Add secondary quick-search window flow for fast lookups.
Requirements: QSR-01, QSR-02
Status: Complete (2026-04-15)
**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md - Define quick-search IPC contracts and renderer hotkey trigger wiring
- [x] 05-02-PLAN.md - Implement reusable popup window lifecycle and main-process routing
- [x] 05-03-PLAN.md - Build popup renderer UX and selection-to-active-tab execution flow

Success criteria:
1. Quick-search popup opens and closes via hotkey toggle and Escape.
2. Popup stays always-on-top and supports resize/drag interactions.
3. Selecting a result routes destination into the active main-browser tab.

## Milestone 2: Automation Engine (Phases 6-9)

### Phase 6: CDP Integration
Goal: Introduce automation substrate by attaching Playwright Core through CDP.
Requirements: AUTO-01
Status: Planned (2026-04-15)
**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md - Define Playwright/CDP dependency and typed automation bridge contracts
- [ ] 06-02-PLAN.md - Implement runtime target resolution and main-process CDP bridge lock manager
- [ ] 06-03-PLAN.md - Wire CDP bridge into startup, IPC handlers, and shutdown lifecycle cleanup

Success criteria:
1. Playwright Core can connect to active browser context through managed CDP session.
2. CDP ownership rules prevent concurrent detach/collision failures.
3. Automation bridge exposes safe command surface through typed IPC contract.

### Phase 7: Action Recording
Goal: Capture user interactions into reusable workflow definitions.
Requirements: AUTO-02
Success criteria:
1. Recorder captures click, type, navigate, and wait actions with deterministic ordering.
2. Recorded workflows serialize into validated JSON schema.
3. Recorder can be started/stopped from command palette and reflects state in UI.

### Phase 8: Automation Playback
Goal: Execute saved workflow JSON reliably.
Requirements: AUTO-03
Success criteria:
1. Playback engine executes workflow steps with runtime validation and timeout controls.
2. Variable prompts are collected safely before workflow execution.
3. Step failures report actionable error context and stop/continue behavior per policy.

### Phase 9: Sidebar and History
Goal: Provide operational UX for automation management.
Requirements: AUTO-04, AUTO-05, SIDE-01
Success criteria:
1. Sidebar shows saved automations with create/rename/delete/run controls.
2. Execution history displays status, duration, and last failure reason.
3. Automation tags/filtering are available for practical library management.
4. Sidebar can be collapsed and restored without state loss.

## Milestone 3: AI and LLM Integration (Phases 10-13)

### Phase 10: LLM Adapter Layer
Goal: Normalize provider access for cloud and local models.
Requirements: AI-01
Success criteria:
1. Provider adapter supports at least one cloud and one local provider configuration.
2. Credentials/endpoints are stored securely and validated before use.
3. Common request/response contract abstracts provider-specific differences.

### Phase 11: Page Analysis
Goal: Deliver AI Q&A on current page context.
Requirements: AI-02
Success criteria:
1. User can request summary or Q&A for active page from command/UI entry points.
2. Responses are grounded to extracted page content with lightweight citation/context snippets.
3. Failure modes surface clear guidance when extraction or model request fails.

### Phase 12: AI Automation Generation
Goal: Generate candidate workflows from natural language.
Requirements: AI-03, AI-05
Success criteria:
1. AI-generated workflow drafts conform to workflow schema before user sees them.
2. Command palette exposes AI generation commands with progress and cancel handling.
3. User can preview/edit/approve generated workflows before saving or running.

### Phase 13: Live Agent Mode
Goal: Allow AI-assisted multi-step execution under explicit user control.
Requirements: AI-04
Success criteria:
1. High-impact actions are blocked until explicit user approval is granted.
2. Agent loop logs planned action, observed result, and next-step rationale per step.
3. User can pause/cancel live agent execution at any point.

## Milestone 4: Polish and Settings (Phases 14-16)

### Phase 14: Settings System
Goal: Complete user-facing configuration surface for browser and privacy behavior.
Requirements: SET-01, SET-03
Success criteria:
1. General settings for startup/homepage/downloads persist across restarts.
2. Privacy settings include clear-data flows and cookie preference controls.
3. Settings validation prevents invalid or corrupted config state.

### Phase 15: Theming and Shortcuts
Goal: Deliver appearance personalization and keyboard customization.
Requirements: SET-02, SET-05
Success criteria:
1. Theme mode and font-size updates apply immediately and persist.
2. Sidebar position and visual preferences are configurable.
3. Core shortcut bindings are editable with conflict handling.

### Phase 16: Packaging and Distribution
Goal: Ship installable and updatable Windows release.
Requirements: REL-01, REL-02
Success criteria:
1. Signed Windows installer builds reproducibly in CI.
2. Update pipeline supports staged rollout with rollback-safe behavior.
3. Release checklist verifies telemetry redaction and production-safe defaults.

## Coverage Validation

- v1 requirements total: 30
- Mapped to phases: 30
- Unmapped requirements: 0
- Mapping rule: each v1 requirement maps to exactly one phase

---
*Roadmap created: 2026-04-14*
*Last updated: 2026-04-15 after phase 6 planning*
