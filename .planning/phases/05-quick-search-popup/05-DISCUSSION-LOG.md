# Phase 5: Quick Search Popup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 05-quick-search-popup
**Areas discussed:** Hotkey and conflict policy, Popup window lifecycle, Results model and routing, Dismissal and reset behavior

---

## Hotkey and conflict policy

| Option | Description | Selected |
|--------|-------------|----------|
| Ctrl+Shift+S toggle | Avoids conflict with existing command palette shortcuts and remains mnemonic for search | ✓ |
| Ctrl+Space toggle | Familiar launcher pattern but can conflict with OS/editor behaviors | |
| Ctrl+Alt+K toggle | Distinct from command palette but less discoverable and less ergonomic | |

**User's choice:** Ctrl+Shift+S toggle
**Notes:** Chosen to avoid collisions with existing Ctrl+K and Ctrl+Shift+P bindings in renderer shell.

---

## Popup window lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Single reusable window | Fast reopen, stable state handling, less process churn | ✓ |
| Create/destroy on each invocation | Simplifies stale-state cleanup but adds open latency and lifecycle churn | |

**User's choice:** Single reusable window
**Notes:** Keep always-on-top behavior and focus input on open; drag/resize should use reliable native window behavior.

---

## Results model and routing

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate active tab and close popup | Fastest handoff to browser flow; clean one-shot interaction | ✓ |
| Open in new tab and keep popup open | Supports batch exploration but adds complexity and state overhead | |
| Keep popup open after navigation | Useful for repeated searches but increases focus-management complexity | |

**User's choice:** Navigate active tab and close popup
**Notes:** If no active tab exists, create one first so routing remains deterministic.

---

## Dismissal and reset behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Escape closes and resets query/results | Predictable quick-open experience and low stale-state risk | ✓ |
| Escape closes but preserves last query | Supports iterative reuse but can feel sticky/noisy for quick lookups | |

**User's choice:** Escape closes and resets query/results
**Notes:** Reopen should start clean for consistent quick-search expectations.

---

## the agent's Discretion

- Exact popup list row UI and micro-interaction polish.
- Exact ranking weight values if deterministic ordering is maintained.
- Optional provider metadata display in result rows.

## Deferred Ideas

- System-global quick-search toggle when Pathfinder is unfocused.
- Persisted quick-search history and advanced provider filters.
