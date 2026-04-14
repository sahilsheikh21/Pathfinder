# Phase 2 Research: Browser Core

## Objective
Research implementation approach for Phase 2 browser runtime: tab lifecycle, omnibox routing, navigation controls, download progress, and crash-session recovery.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/STATE.md
- .planning/phases/02-browser-core/02-CONTEXT.md
- src/main/main.ts
- src/preload/index.ts
- src/shared/ipc.ts
- src/renderer/App.tsx
- copilot-instructions.md

## Decision Fidelity Constraints
- D-01 to D-03 require explicit tab strip controls and persisted tab ordering.
- D-04 to D-06 require one omnibox with URL-or-search routing and live nav state.
- D-07 to D-09 require interactive download path behavior plus crash recovery.

## Recommended Architecture

### 1. Main-process tab runtime
- Keep authoritative tab state in main process, keyed by tab id.
- Represent each tab using Electron `WebContentsView` attached to the main window content area.
- Manage active tab by setting visible view bounds and hiding inactive views.
- Publish compact tab snapshots to renderer via typed IPC payloads.

### 2. Typed IPC expansion
- Extend shared contracts with browser-core channels for:
  - tab create/list/activate/close
  - navigate, back, forward, reload, stop
  - state subscriptions (URL, title, loading, canGoBack, canGoForward)
  - download state events
  - session restore trigger and snapshot persistence
- Keep renderer restricted to preload API calls only.

### 3. Omnibox routing
- Add deterministic resolver utility:
  - If input parses as URL with protocol: navigate directly.
  - If input lacks protocol but has hostname-like pattern: prepend `https://`.
  - Otherwise route to configured search template query.
- Return resolved target and type (`url` or `search`) for observability and testing.

### 4. Download handling
- Hook `session.defaultSession.on('will-download', ...)` in main process.
- Use `item.setSaveDialogOptions(...)` for prompt behavior and optional default path.
- Emit download lifecycle updates (`in_progress`, `completed`, `failed`, `cancelled`) to renderer.
- Include byte progress (`receivedBytes`, `totalBytes`) for visible progress bars.

### 5. Crash/session restore
- Persist tab snapshots to a JSON file under userData, e.g. `browser-session.json`.
- Snapshot includes ordered tabs, active tab id, and last URL per tab.
- On startup, read snapshot and rebuild tabs before showing ready state.
- Guard restore with fallback when snapshot is invalid/corrupt.

## Data Shape Recommendations
- `BrowserTab`: `id`, `url`, `title`, `isActive`, `isLoading`, `canGoBack`, `canGoForward`.
- `DownloadItemState`: `id`, `fileName`, `state`, `receivedBytes`, `totalBytes`, `savePath`.
- `BrowserSessionSnapshot`: `tabs[]`, `activeTabId`, `savedAt`.

## Security Considerations
- Treat all renderer navigation requests as untrusted input and normalize before use.
- Allowlist exposed preload methods; do not pass raw Electron objects through IPC.
- Validate restored session payload shape before creating tabs.
- Normalize download paths and reject path traversal-like segments in persisted defaults.

## Validation Architecture
- Quick command after each task: `npm run typecheck`
- Full command after each plan wave: `npm run lint; npm run typecheck; npm run build`
- Focus tests for deterministic logic:
  - Omnibox resolver input/output cases
  - Session snapshot read/write validation
  - Tab state reducer/transforms (if extracted into pure functions)

## Risks and Mitigations
- Risk: `WebContentsView` layout synchronization bugs on resize.
  - Mitigation: central resize handler that recalculates active view bounds.
- Risk: Tab/event race conditions when closing active tab.
  - Mitigation: deterministic close policy (activate adjacent tab before destroy).
- Risk: Download events emitted before renderer subscription.
  - Mitigation: keep latest download state in main cache and return on initial query.
- Risk: Corrupt session file blocks startup.
  - Mitigation: parse with try/catch and fallback to one blank tab.

## Deliverables Expected from Planning
- Plan set that covers BROW-01 through BROW-05 with no deferred placeholders.
- Explicit file ownership per plan to avoid merge conflicts in parallel execution.
- Task-level automated verification commands on every task.
- Threat-model blocks with concrete mitigations for IPC, downloads, and persistence.

## Confidence
Medium-high. Architecture aligns with Electron security constraints and phase requirements; complexity is mainly in event synchronization and tab lifecycle edge cases.

---
*Research completed: 2026-04-14*
