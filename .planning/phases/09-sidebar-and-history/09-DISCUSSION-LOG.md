# Phase 9: Sidebar and History - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Locked decisions are captured in 09-CONTEXT.md.

**Date:** 2026-04-15
**Phase:** 09-sidebar-and-history
**Areas discussed:** Sidebar structure and collapse behavior; Automation library CRUD + tags/filtering; Execution history semantics

---

## Sidebar structure and collapse behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Left-docked persistent rail | Sidebar stays available as an operational surface | ✓ |
| Right-docked panel | Alternative dock side | |
| Overlay-only drawer | On-demand panel only | |

**Captured decisions (highlights):**
- Collapsed mode is icon rail, not fully hidden.
- Persist collapse state, width, active section, filters, and scroll.
- Default section is Saved Automations.
- Sidebar is resizable with clamps.
- Toggle supports UI button plus command entry.
- Narrow window behavior falls back to overlay drawer.
- Keyboard navigation and badge signaling are required.
- AI Chat section is visible as structured "coming soon" placeholder.
- Empty states are actionable and sidebar scrolling is independent.

---

## Automation library CRUD + tags/filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated local userData-backed store | Local-first, typed persistence model | ✓ |
| User-managed JSON folder only | File-oriented model | |
| Hybrid index + external refs | Mixed storage model | |

**Captured decisions (highlights):**
- Create supports save-from-recording and import JSON.
- Non-empty names with auto-suffix uniqueness.
- Free-form multi-tags with text + tag OR filtering.
- Inline tag chip editing.
- Default sort is most-recent-run first (fallback updatedAt).
- Delete requires confirmation and is hard-delete in v1.
- Run from library reuses existing playback prompt/status pipeline.

---

## Execution history semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Rich operational row fields | name + status + duration + finished time + failure snippet | ✓ |
| Minimal rows | name + status only | |
| Raw payload-heavy rows | full failure payload in list | |

**Captured decisions (highlights):**
- Newest-first ordering with retention cap 500.
- Immediate write-time pruning of oldest entries.
- Per-entry remove + clear-all (confirm required).
- Running runs appear immediately and are pinned while active.
- Re-run action from history uses same playback safeguards.
- Filters include status and text search; filter state persists.
- Failure details are expandable; list snippet remains compact.
- Secrets/variable values are never stored.
- History aggregates runs from all trigger surfaces.
- Source labels, workflow origin badges, run-start URL, and run-time name/tag snapshot are captured.
- If linked workflow is deleted, history entry remains with marker.
- Virtualized history rendering required for scale.

---

## Cross-surface behavior

**Discussion mode note:** The user became unavailable and requested autonomous continuation.

**Autonomous decisions applied:**
- Sidebar run and history interactions must share the same playback/status truth as command palette flows.
- Home recent-automations view updates immediately from history-backed data.
- Failure badges update immediately even in collapsed mode.
- History entries provide open-in-library linkage when corresponding automation exists.

---

## the agent's Discretion

- Exact microcopy and iconography.
- Exact animation easing details within tokenized UI style.
- Non-essential shortcut bindings beyond core toggle/navigation behavior.

## Deferred Ideas

- History export actions (JSON/CSV).
- Library soft-delete/archive restore model.
- History bulk multi-select delete.
- Configurable retention cap in settings.
- Full workflow JSON snapshot retention in history.
