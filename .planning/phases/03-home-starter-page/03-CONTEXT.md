# Phase 3: Home Starter Page - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the custom new-tab home experience: greeting with current date, home search using default search engine behavior, and home sections for quick links and recent automations driven by local data.

</domain>

<decisions>
## Implementation Decisions

### Home layout and priority
- **D-01:** Use a centered hero plus stacked sections layout.
- **D-02:** Keep greeting/date as a compact top header so the search hero remains primary.
- **D-03:** Use balanced density: quick links in a 2x3 grid and recent automations section sized for 3 items.

### Home search behavior
- **D-04:** Source the default search template from one shared local preference with DuckDuckGo fallback.
- **D-05:** Home input is query-only; URL detection remains an omnibox responsibility.
- **D-06:** Trigger search via Enter and a visible Search button.
- **D-07:** Open search results in a newly created active tab.
- **D-08:** Keep the original home tab input state unchanged after submit.
- **D-09:** On empty input, do not navigate and show a subtle inline hint.
- **D-10:** If template read fails/corrupts, fallback to DuckDuckGo and continue.
- **D-11:** Resolve the search template at submit-time so future settings changes apply immediately.

### Quick links data and actions
- **D-12:** Populate quick links from a user-pinned local list with curated default fallback.
- **D-13:** Render 6 quick-link cards on first view.
- **D-14:** Quick-link click opens destination in the current active tab.
- **D-15:** Allow basic add/remove/pin editing directly on the home page in this phase.

### Recent automations data and empty state
- **D-16:** Show an explicit empty-text state before automation features are available.
- **D-17:** Reserve visual layout capacity for 3 recent automation slots.
- **D-18:** Placeholder automation interactions are non-interactive in this phase.
- **D-19:** Once automation history exists, define recency by most recently executed automations.

### the agent's Discretion
- Home internal route token strategy and tab lifecycle wiring were intentionally not discussed in this session.
- Exact copywriting for empty-state and hint text.
- Motion/animation details and final visual polish within the existing tokenized design system.
- Internal persistence shape for local quick-link preference data, as long as behavior above is preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and milestone boundary.
- `.planning/REQUIREMENTS.md` — HOME-01 through HOME-03 requirement definitions.
- `.planning/PROJECT.md` — product constraints and command-first UX principles.

### Product direction details
- `implementation_plan.md` — home starter page capability details and intended UX direction.

### Current implementation anchors
- `src/renderer/App.tsx` — renderer shell and browser viewport integration point.
- `src/renderer/components/NavigationBar.tsx` — current omnibox/search submission behavior.
- `src/renderer/lib/omnibox.ts` — existing query/url resolution utility pattern.
- `src/main/browserRuntime.ts` — tab creation/navigation/session snapshot behavior.
- `src/main/main.ts` — startup flow and default new-tab creation path.
- `src/shared/ipc.ts` — typed IPC contract extension point.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/App.tsx`: existing shell composition and state synchronization pattern.
- `src/renderer/components/NavigationBar.tsx`: reusable form submit and navigation dispatch pattern.
- `src/renderer/lib/omnibox.ts`: existing search template resolution utility that can inform home-search behavior.
- `src/main/browserRuntime.ts`: tab lifecycle and session snapshot engine already available.

### Established Patterns
- Renderer interaction is driven through typed preload IPC APIs, not direct Electron access.
- Default search behavior currently lives in renderer navigation code and is deterministic.
- Session restore relies on serialized tab snapshot state and active-tab restoration.

### Integration Points
- New-tab creation path in main runtime must route to home experience instead of blank start page.
- Home search behavior should integrate with existing tab creation/activation and navigation APIs.
- Home quick-link and recent-automation UI should live in renderer viewport layer without breaking fixed browser chrome layout.

</code_context>

<specifics>
## Specific Ideas

No specific external product clone references were required; decisions favored practical v1 behavior over speculative extras.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-home-starter-page*
*Context gathered: 2026-04-15*
