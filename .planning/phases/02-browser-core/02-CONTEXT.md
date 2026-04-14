# Phase 2: Browser Core - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver baseline browser behavior in a single window: multi-tab lifecycle, address-bar navigation behavior, back/forward/reload/stop controls, download flow with visible progress, and crash-session recovery.

</domain>

<decisions>
## Implementation Decisions

### Tab model and switching
- **D-01:** Use a top tab-strip model with explicit New Tab, Close Tab, and Active Tab affordances.
- **D-02:** New tabs open to a neutral blank/new-tab state (no forced external homepage).
- **D-03:** Keep tabs in in-memory order with persisted snapshot for crash restore.

### Address and navigation behavior
- **D-04:** Use one omnibox input that routes valid URLs directly and all other input to default search.
- **D-05:** Navigation controls are always visible: Back, Forward, Reload, Stop.
- **D-06:** Disable Back/Forward when history is unavailable for the active tab.

### Download and recovery behavior
- **D-07:** Prompt for download location by default, while honoring a configurable default path once set.
- **D-08:** Show per-download progress and completion/failure state in UI.
- **D-09:** On unexpected crash, restore previously open tabs and their last URLs on next launch.

### the agent's Discretion
- Exact visual style of tab strip controls and iconography.
- Internal session snapshot format and persistence storage shape.
- Download progress component layout details, as long as progress/status visibility is clear.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 2 goal, requirement mapping, and success criteria.
- `.planning/REQUIREMENTS.md` — BROW-01 through BROW-05 requirement definitions.
- `.planning/PROJECT.md` — product constraints (Windows-first, Electron, security boundary rules).

### Existing baseline implementation
- `src/main/main.ts` — current Electron window bootstrap and lifecycle baseline.
- `src/shared/ipc.ts` — typed IPC channel contract pattern.
- `src/preload/index.ts` — preload bridge pattern for renderer-to-main calls.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/main.ts`: existing BrowserWindow lifecycle and secure webPreferences setup.
- `src/shared/ipc.ts`: established typed IPC contract module for channel definitions.
- `src/preload/index.ts`: contextBridge + invoke pattern ready for extension with browser-core channels.
- `src/renderer/components/FrostedSurface.tsx`: reusable shell primitive for browser chrome panels.

### Established Patterns
- Secure Electron defaults are already in place (contextIsolation true, nodeIntegration false, sandbox true).
- Renderer consumes only preload-exposed API; no direct Electron access in renderer.
- TypeScript strict mode with multi-project tsconfig layout is already active.

### Integration Points
- Tab and navigation state should connect main-process window/webview management to renderer controls via typed IPC.
- Download events should surface from Electron session/download APIs to renderer status UI through preload bridge.
- Crash recovery should hook app startup/shutdown lifecycle around existing `app.whenReady()` flow.

</code_context>

<specifics>
## Specific Ideas

- Defaulted to standards-aligned browser UX (tab strip + omnibox + nav controls) to minimize user learning friction.
- Decisions were auto-selected using recommended defaults because no explicit area selections were provided in this session.

</specifics>

<deferred>
## Deferred Ideas

- Command palette integration details remain in Phase 4 scope.
- Home starter page behavior remains in Phase 3 scope.
- Multi-window behavior is deferred; current phase focuses on single-window browser core.

</deferred>

---

*Phase: 02-browser-core*
*Context gathered: 2026-04-14*
