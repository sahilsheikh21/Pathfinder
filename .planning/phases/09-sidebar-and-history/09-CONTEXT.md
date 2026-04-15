# Phase 9: Sidebar and History - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide operational automation UX in a collapsible sidebar: saved automation library management (create/rename/delete/tag/filter), execution history visibility (status/duration/failure context), and section structure for Automations/History/AI Chat shell. This phase clarifies implementation within that boundary and does not implement new AI chat capabilities.

</domain>

<decisions>
## Implementation Decisions

### Sidebar structure and collapse behavior
- **D-01:** Use a left-docked persistent sidebar by default.
- **D-02:** Collapsed mode becomes an icon rail with section shortcuts.
- **D-03:** Persist sidebar collapse state, width, and active section across restarts.
- **D-04:** Preserve active section, search/filter input, and panel scroll position when collapsing/restoring.
- **D-05:** Default section on first launch is Saved Automations.
- **D-06:** Support draggable width in expanded mode with min/max clamps.
- **D-07:** Toggle supports both a visible UI button and a command palette command.
- **D-08:** In collapsed icon mode, show lightweight section badges (including failure cues).
- **D-09:** On narrow windows, switch to overlay drawer behavior below a width threshold.
- **D-10:** Use short collapse/expand motion (~150ms) with stable layout transition (no abrupt reflow jumps).
- **D-11:** Sidebar sections support keyboard navigation (Tab/Arrow traversal and Enter activate).
- **D-12:** Sidebar state persistence is stored as a global app preference.
- **D-13:** Empty sections use actionable empty-state cards with CTA actions.
- **D-14:** Sidebar content uses an independent scroll container.
- **D-15:** AI Chat section is visible but uses a structured "coming soon" panel in Phase 9.

### Automation library CRUD, tagging, and filtering
- **D-16:** Store automation library in a dedicated local userData-backed library store (local-first).
- **D-17:** Create supports two entry paths: save latest recording and import workflow JSON.
- **D-18:** Tag model uses free-form multi-tags.
- **D-19:** Library filtering supports text search plus tag OR filtering.
- **D-20:** Delete uses explicit confirmation and hard delete semantics.
- **D-21:** Create/rename requires non-empty names; duplicates are auto-suffixed for uniqueness.
- **D-22:** Default library sort is most recently run first, fallback to updatedAt.
- **D-23:** Tag editing is inline (chip-style) in library item details.
- **D-24:** Run action from library starts playback immediately via existing prompt/status pipeline.

### Execution history semantics and operations
- **D-25:** History entries display workflow name, status badge, duration, finished time, and failure reason snippet.
- **D-26:** Default ordering is newest-first chronological.
- **D-27:** Retention cap is 500 runs; prune oldest entries immediately on new writes.
- **D-28:** History supports per-entry remove and clear-all (with confirmation).
- **D-29:** Failure details use expandable drill-down with action + seq + full message.
- **D-30:** In-progress runs are inserted immediately and update to terminal status on completion.
- **D-31:** History supports quick Re-run action using current variable prompt flow.
- **D-32:** History filtering supports status (all/success/failed/running/cancelled) plus text search.
- **D-33:** Duration is shown as human-readable text with exact milliseconds available in detail/tooltip.
- **D-34:** Time uses relative display in list and exact local timestamp in details/hover.
- **D-35:** Failed row snippet uses the first failing step message (with action/seq context).
- **D-36:** Never persist variable values/secrets in history records.
- **D-37:** Store runs from all trigger surfaces (sidebar + command palette), not one surface only.
- **D-38:** Include run source metadata (for example sidebar/command) in entries.
- **D-39:** Keep snapshot of workflow name/tags at run-time for historical accuracy.
- **D-40:** Store target tab URL metadata at run start for troubleshooting context.
- **D-41:** Include workflow origin badge (recorded vs imported).
- **D-42:** Pin active running entries at top until completion.
- **D-43:** On clear-all with active runs, clear only completed/failed/cancelled entries and keep running entries.
- **D-44:** History rows are compact (one-line failure snippet with ellipsis); full diagnostics live in details.
- **D-45:** If a workflow is later deleted, preserve history entries with a "workflow deleted" marker.
- **D-46:** Use list virtualization for history rendering at scale.

### Cross-surface behavior (autonomous defaults)
- **D-47:** Sidebar run/re-run actions call the same playback manager APIs used by command palette commands.
- **D-48:** Home "recent automations" derives from history data and updates immediately after history changes.
- **D-49:** Failure badge updates immediately in sidebar sections, while keeping status-row indicators in App chrome.
- **D-50:** History entries link back to corresponding library item when available.

### the agent's Discretion
- Exact UI microcopy for empty-state and coming-soon text.
- Exact keyboard shortcut keymap beyond documented command palette/sidebar toggle commands.
- Exact badge color/icon style and animation details as long as tokenized UI style is preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirement anchors
- `.planning/ROADMAP.md` - Phase 9 goal and success criteria (AUTO-04, AUTO-05, SIDE-01).
- `.planning/REQUIREMENTS.md` - automation library, run history, and sidebar section requirements.
- `.planning/PROJECT.md` - local-first architecture, command-first interaction principles, Electron constraints.
- `.planning/STATE.md` - current execution baseline and phase sequencing context.
- `implementation_plan.md` - milestone-level product direction for automation operations.

### Existing contract and runtime anchors
- `src/shared/browser.ts` - recorder/playback contracts, run summary/failure payload types, recent automation preview type.
- `src/shared/ipc.ts` - typed IPC channels and API expansion surface for library/history/sidebar actions.
- `src/preload/index.ts` - renderer-safe API bridge pattern for new sidebar/history operations.
- `src/main/main.ts` - manager lifecycle wiring and IPC registration model.
- `src/main/automationPlayback.ts` - run status lifecycle, failure semantics, and run summary shape.
- `src/main/actionRecorder.ts` - recording output contract and handoff source for library create flow.
- `src/main/homeStore.ts` - existing local store pattern and current recent-automations placeholder integration point.

### Existing renderer integration anchors
- `src/renderer/App.tsx` - command palette, playback/recording status, shell composition, and keyboard handling baseline.
- `src/renderer/lib/commandPalette.ts` - existing automation commands and command-first interaction model.
- `src/renderer/components/HomeStarterPage.tsx` - recent automation surface that should align with new history data.
- `src/renderer/styles/global.css` - current shell/chrome layout patterns, breakpoints, and overlay conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/automationPlayback.ts`: already emits deterministic run status, summary, and failure structures that map directly into history entries.
- `src/main/actionRecorder.ts`: provides deterministic workflow output and a natural "save to library" create path.
- `src/main/homeStore.ts`: shows validated local JSON store pattern suitable for library/history persistence modules.
- `src/shared/browser.ts` + `src/shared/ipc.ts`: established shared typing and IPC contract extension points.
- `src/renderer/App.tsx`: central shell owner where sidebar mount, badges, and cross-surface state sync can be integrated.

### Established Patterns
- Main process owns privileged automation operations; renderer consumes typed preload APIs only.
- Product interaction remains command-first with visible UI affordances as complements.
- Local-first persistence is the default architecture for user-facing state.
- Existing UI uses tokenized, frosted components and compact status indicators.

### Integration Points
- Add new main-process store/service modules for automation library and execution history.
- Extend IPC + preload with library/history CRUD/filter actions and run-history events.
- Wire App-level state so command palette runs, sidebar runs, and home recent automations share one source of truth.
- Integrate responsive sidebar behavior into existing browser shell layout and breakpoints.

</code_context>

<specifics>
## Specific Ideas

- Keep command palette as primary power surface while making sidebar a practical operational hub.
- Preserve deterministic automation semantics from phases 6-8 (single source of run truth, typed failures, explicit statuses).
- During late-stage discuss interaction, user became unavailable and requested autonomous continuation; unresolved areas were completed using recommended defaults aligned with existing project patterns.

</specifics>

<deferred>
## Deferred Ideas

- History export (JSON/CSV) deferred to a later phase.
- Library soft-delete/archive and restore flow deferred.
- History bulk-select delete deferred.
- Configurable history retention cap deferred to settings-focused phase.
- Full workflow JSON snapshot storage in history deferred.

</deferred>

---

*Phase: 09-sidebar-and-history*
*Context gathered: 2026-04-15*
