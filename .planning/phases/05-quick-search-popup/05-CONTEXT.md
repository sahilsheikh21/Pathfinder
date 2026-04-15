# Phase 5: Quick Search Popup - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a secondary quick-search popup flow for fast lookups: toggle open/close by hotkey, keep the popup always-on-top with draggable/resizable behavior, and route selected results into the active main-browser tab.

</domain>

<decisions>
## Implementation Decisions

### Hotkey and invocation scope
- **D-01:** Use `Ctrl+Shift+S` as the quick-search toggle shortcut for this phase.
- **D-02:** Keep shortcut capture app-window scoped (not system-global) in this phase.
- **D-03:** The same shortcut acts as a toggle: open when closed, close when open.

### Popup lifecycle and window behavior
- **D-04:** Use one reusable quick-search `BrowserWindow` instance and show/hide it instead of creating/destroying per toggle.
- **D-05:** Configure the popup as always-on-top and focused on open.
- **D-06:** Keep popup draggable and resizable using native window behavior, and restore last bounds while the app session is active.

### Search input and result handling
- **D-07:** Resolve quick-search queries using the existing home search-template preference with DuckDuckGo fallback behavior.
- **D-08:** Present a compact keyboard-first result list that supports selection via Arrow keys and Enter.
- **D-09:** Selecting a result navigates the active main-browser tab and then closes the popup.
- **D-10:** If no active main tab is available at execution time, create a new tab before navigation.

### Dismissal and reset behavior
- **D-11:** `Escape` always closes the popup without triggering navigation.
- **D-12:** Reopening starts with a fresh query and result state (no persisted query text).

### the agent's Discretion
- Exact result ranking formula as long as keyboard-first selection stays deterministic.
- Exact visual styling of popup content within existing tokenized UI patterns.
- Whether provider-specific result metadata (favicon/domain chips) is shown in v1 popup rows.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 5 goal, QSR requirement mapping, and success criteria.
- `.planning/REQUIREMENTS.md` — QSR-01 and QSR-02 requirement definitions.
- `.planning/PROJECT.md` — command-driven product behavior and Electron platform constraints.

### Product direction details
- `implementation_plan.md` — section 5.2 quick-search popup behavior and UX intent.

### Existing implementation anchors
- `src/main/main.ts` — BrowserWindow lifecycle bootstrap and IPC handler registration.
- `src/main/browserRuntime.ts` — active tab runtime operations and navigation execution hooks.
- `src/preload/index.ts` — renderer-safe API exposure pattern.
- `src/shared/ipc.ts` — typed IPC channel and API contract extension points.
- `src/shared/browser.ts` — shared browser/home preference types and constants.
- `src/renderer/App.tsx` — existing keyboard shortcut and command palette integration baseline.
- `src/renderer/lib/omnibox.ts` — URL/query resolution utility pattern for search routing.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/App.tsx`: already centralizes app-level shortcut handling and can coordinate quick-search toggle semantics.
- `src/renderer/lib/omnibox.ts`: existing query-versus-url resolution behavior can be reused for quick-search interpretation.
- `src/main/main.ts`: existing BrowserWindow management and IPC registration structure is ready for quick-search window channels.
- `src/main/browserRuntime.ts`: provides active-tab navigation primitives needed for result-to-tab routing.

### Established Patterns
- Renderer must use typed `window.pathfinder` APIs exposed through preload; no direct Electron access in renderer.
- Navigation actions are active-tab scoped and update shared tab state through runtime snapshot emission.
- Existing command palette uses app-scoped keyboard capture, with collision-sensitive shortcut choices.

### Integration Points
- Add quick-search window lifecycle and command routing in main process near existing main-window bootstrap.
- Extend typed IPC contract and preload bridge for popup open/close/query/select operations.
- Reuse renderer shell shortcut patterns while preventing conflicts with command palette bindings.

</code_context>

<specifics>
## Specific Ideas

- Discussion proceeded with recommended defaults after no explicit area selections were provided in this session.
- Prior command-palette interaction model informed decisions: keyboard-first flow, deterministic behavior, clear dismissal semantics.

</specifics>

<deferred>
## Deferred Ideas

- System-global quick-search hotkey while Pathfinder is unfocused.
- Persisted quick-search history, provider-level filtering, and advanced ranking controls.

</deferred>

---

*Phase: 05-quick-search-popup*
*Context gathered: 2026-04-15*
