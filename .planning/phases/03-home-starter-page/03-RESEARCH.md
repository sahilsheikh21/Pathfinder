# Phase 3 Research: Home Starter Page

## Objective
Research implementation approach for Phase 3 home starter page so plans can deliver HOME-01, HOME-02, and HOME-03 while honoring locked decisions D-01 through D-19.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/STATE.md
- .planning/phases/03-home-starter-page/03-CONTEXT.md
- implementation_plan.md
- src/main/main.ts
- src/main/browserRuntime.ts
- src/preload/index.ts
- src/shared/browser.ts
- src/shared/ipc.ts
- src/renderer/App.tsx
- src/renderer/components/NavigationBar.tsx
- src/renderer/styles/global.css
- copilot-instructions.md

## Decision Fidelity Constraints
- D-01 to D-03 require a centered hero with compact greeting/date and balanced density (6 quick links, 3 recent automations slots).
- D-04 to D-11 require home search to read shared local preference at submit-time, be query-only, and open results in a newly active tab.
- D-12 to D-15 require locally persisted quick links with fallback defaults plus inline add/remove/pin editing.
- D-16 to D-19 require explicit recent-automation empty handling now with future recency contract defined.

## Recommended Architecture

### 1. Internal home route token with runtime integration
- Use a stable internal tab URL token that `BrowserRuntime` already accepts, e.g. `about:pathfinder-home`.
- Route all new blank tabs to this token.
- Keep renderer-driven "is home tab" detection by checking active tab URL against shared constant.
- Preserve existing tab/session behavior by serializing token like any other URL.

### 2. Typed home IPC contract (no renderer direct storage)
- Extend shared contracts with:
  - `HomePreferences` containing `searchTemplate`
  - `QuickLink` containing `id`, `title`, `url`, `pinned`, `order`
  - `RecentAutomationPreview` containing `id`, `name`, `lastRunAt`, `status`
- Extend IPC with explicit allowlisted channels:
  - `home:getPreferences`
  - `home:savePreferences`
  - `home:listQuickLinks`
  - `home:upsertQuickLink`
  - `home:removeQuickLink`
  - `home:listRecentAutomations`
- Expose typed preload methods only.

### 3. Local home store in main process
- Create `src/main/homeStore.ts` using JSON file under userData (`home-starter.json`).
- Persist:
  - search template preference
  - quick links list
- Provide deterministic fallback when file missing/corrupt:
  - search template fallback `https://duckduckgo.com/?q={query}`
  - curated 6 quick links fallback set
- Keep recent automation response read-only empty for this phase (future source from automation history).

### 4. Renderer home page composition
- Add `HomeStarterPage` component rendered in viewport when active tab URL equals internal home token.
- Component sections:
  - compact greeting + current date
  - centered search form with visible submit button
  - quick links grid (2x3) with inline add/remove/pin controls
  - recent automations section with explicit empty-state text and 3 reserved slots
- Search behavior:
  - query-only submission
  - submit-time preference read (`getHomePreferences` on submit)
  - empty query shows inline hint and no navigation
  - search opens via `createTab(target)` so result tab becomes active

### 5. Home input state persistence by tab id
- Keep draft input at App-level keyed by tab id (`Record<string, string>`) so home draft survives tab switches and remains unchanged after submit.
- Do not auto-clear draft on successful submit.

## Data Shape Recommendations
- `HOME_STARTER_URL = 'about:pathfinder-home'`
- `DEFAULT_HOME_SEARCH_TEMPLATE = 'https://duckduckgo.com/?q={query}'`
- `QuickLink` URLs should be normalized to http/https only.
- `RecentAutomationPreview[]` returns empty array now; semantics set to "most recently executed" for future phases.

## Security Considerations
- Treat quick-link URL edits as untrusted input; reject non-http/https schemes before persistence.
- Keep all persistence in main process; renderer interacts only through preload allowlist.
- Validate and sanitize JSON-loaded data before use (shape checks + fallback defaults).
- Prevent renderer from passing arbitrary file paths or IPC channel names.

## Validation Architecture
- Quick command after each task: `npm run typecheck`
- Full command after each plan wave: `npm run lint; npm run typecheck; npm run build`
- Focus validations:
  - Home route token detection in renderer and runtime
  - Submit-time search template lookup and fallback behavior
  - Quick-link persistence and ordering behavior
  - Empty-query no-op + inline hint behavior

## Risks and Mitigations
- Risk: Search preference fetch latency on submit can create UX jitter.
  - Mitigation: optimistic local cache with submit-time refresh fallback.
- Risk: Draft input state lost when switching away from home tab.
  - Mitigation: App-level draft map keyed by tab id.
- Risk: Corrupt home store file causes runtime exceptions.
  - Mitigation: parse guard, shape validation, and deterministic fallback payload.
- Risk: Quick-link editing introduces malformed URLs.
  - Mitigation: normalize and validate URLs before save; reject invalid values with inline errors.

## Deliverables Expected from Planning
- Plan set with explicit coverage for HOME-01, HOME-02, HOME-03.
- Home route/runtime and renderer work split into sequential waves to avoid file conflicts.
- Concrete task-level acceptance criteria for search behavior, quick links, and empty states.
- Threat-model section in each plan with IPC/persistence mitigations.

## Confidence
Medium-high. Existing browser runtime and typed IPC architecture already support this phase; main complexity is disciplined state wiring across home tabs and persistence boundaries.

---
*Research completed: 2026-04-15*
