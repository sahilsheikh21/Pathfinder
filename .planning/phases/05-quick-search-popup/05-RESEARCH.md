# Phase 5 Research: Quick Search Popup

## Objective
Research implementation approach for Phase 5 quick-search popup so plans can deliver QSR-01 and QSR-02 while honoring locked decisions D-01 through D-12.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/STATE.md
- .planning/phases/05-quick-search-popup/05-CONTEXT.md
- implementation_plan.md
- package.json
- src/main/main.ts
- src/main/browserRuntime.ts
- src/preload/index.ts
- src/shared/ipc.ts
- src/shared/browser.ts
- src/renderer/App.tsx
- src/renderer/components/CommandPalette.tsx
- src/renderer/lib/omnibox.ts
- copilot-instructions.md

## Decision Fidelity Constraints
- D-01 to D-03 require `Ctrl+Shift+S` app-scoped toggle behavior.
- D-04 to D-06 require one reusable always-on-top popup window with native drag/resize behavior.
- D-07 to D-10 require query resolution via existing search-template semantics and selection routing into the active main tab.
- D-11 and D-12 require Escape close semantics and fresh query state on reopen.

## Existing Architecture Findings

### 1. Main process is the correct owner for popup BrowserWindow lifecycle
- `src/main/main.ts` currently owns app lifecycle and IPC registrations.
- No existing quick-search window management exists; adding it in main keeps Electron window APIs (`BrowserWindow`, always-on-top, bounds) in the right trust boundary.
- Reusing one hidden popup window aligns with D-04 and avoids create/destroy churn.

### 2. Routing selected results should reuse browser runtime tab operations
- `src/main/browserRuntime.ts` already provides tab creation and navigation primitives used by renderer.
- QSR-02 can be delivered by adding a main-process handler that ensures an active tab exists, then navigates it to the selected URL.
- This avoids duplicating tab state logic in renderer.

### 3. IPC contract extension is required but low-risk
- `src/shared/ipc.ts` and `src/preload/index.ts` already provide typed channel + bridge patterns.
- Quick-search needs dedicated channels for popup open/close/toggle and execute-selection routing.
- Typed payloads should include query/result target fields to preserve compile-time safety.

### 4. Renderer shortcut integration should mirror command palette guardrails
- `src/renderer/App.tsx` already captures app-scoped shortcuts and excludes editable targets.
- Quick-search hotkey handling can be added to the existing keydown effect with explicit conflict handling against command palette shortcuts.
- Keeping shortcut logic centralized in App avoids scattered keyboard state.

### 5. Query resolution can reuse existing omnibox utility
- `src/renderer/lib/omnibox.ts` already resolves query-or-url inputs with a default search template.
- Using this utility in quick-search execution keeps behavior aligned with home and command flows.

## Recommended Implementation Structure

### A. Main process quick-search window manager
- Add a small manager module (or local helper block in `main.ts`) that:
  - lazily creates one `BrowserWindow` for quick search
  - configures always-on-top and basic window options
  - toggles show/hide and focuses input on open
  - tracks bounds for session-level restore behavior

### B. Typed quick-search IPC surface
- Extend `src/shared/ipc.ts` and `src/preload/index.ts` with methods/channels for:
  - `quickSearchToggle()`
  - `quickSearchClose()`
  - `quickSearchOpen(query?)`
  - `quickSearchSubmit(selectionTarget)`
- Keep payloads explicit and narrow (`query`, `target`, optional metadata) to avoid arbitrary command execution.

### C. Renderer shortcut and command integration
- Update `src/renderer/App.tsx` keydown handling for `Ctrl+Shift+S`.
- Preserve editable-target guard.
- Route toggle requests through typed preload API rather than direct Electron access.

### D. Popup renderer UI
- Add a dedicated quick-search popup UI component/surface (either separate renderer route/context or overlay shell tied to popup window content).
- Include:
  - query input with autofocus
  - keyboard-driven result selection (Arrow/Enter)
  - Escape close behavior
  - clear empty/error states

### E. Selection-to-active-tab execution path
- On select, pass resolved target to main process.
- Main process ensures active tab exists (create one if absent), navigates target, and closes popup.

## Security Considerations
- Keep all BrowserWindow lifecycle in main process; renderer uses only preload-bridged methods.
- Do not execute arbitrary scripts from quick-search payloads.
- Validate navigation targets through existing resolver semantics before routing to browser runtime.
- Ensure quick-search popup actions cannot mutate tabs other than active/created-tab path defined by QSR scope.

## Validation Architecture
- Per task quick check: `npm run typecheck`
- Per wave full check: `npm run lint; npm run typecheck; npm run build`
- Focus checks:
  - `Ctrl+Shift+S` toggles popup open/close only when app is focused.
  - Escape closes popup without navigation.
  - Popup stays always-on-top and supports native drag/resize.
  - Selecting a result routes target into active main tab and closes popup.

## Risks and Mitigations
- Risk: Shortcut conflicts with existing command palette or text-entry contexts.
  - Mitigation: keep editable-target guard and explicit key conflict checks in one keydown handler.
- Risk: Popup and main window focus race conditions on rapid toggles.
  - Mitigation: single-window manager with idempotent open/close guards and visibility checks.
- Risk: Navigation triggers without active tab.
  - Mitigation: main-process fallback creates a tab before navigate and returns deterministic state.

## Deliverables Expected from Planning
- Plan for typed quick-search contracts and main-window lifecycle integration.
- Plan for popup UI and keyboard interaction behavior.
- Plan for routing selected results into active tab with close-on-success semantics.
- Threat-model entries for keyboard trigger abuse, navigation payload tampering, and renderer-main trust boundary.

## Confidence
Medium-high. Existing architecture already supports typed IPC and tab navigation; Phase 5 is mostly additive window lifecycle + routing work, with moderate integration complexity around focus and shortcut behavior.

---
*Research completed: 2026-04-15*
