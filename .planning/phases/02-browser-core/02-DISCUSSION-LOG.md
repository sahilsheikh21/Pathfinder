# Phase 2: Browser Core - Discussion Log

> Audit trail only. Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md.

**Date:** 2026-04-14
**Phase:** 02-browser-core
**Areas discussed:** Tab model and switching, Address and navigation behavior, Download and recovery behavior

---

## Tab model and switching

| Option | Description | Selected |
|--------|-------------|----------|
| Top tab strip | Familiar desktop browser interaction with explicit tab switching | ✓ |
| Sidebar tab list | Vertical tab management with more room for labels | |
| Single-tab only | Minimal shell, no multi-tab lifecycle in this phase | |

**User's choice:** Top tab strip (recommended default)
**Notes:** Chosen to align with BROW-01 expectation and reduce UX friction.

---

## Address and navigation behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Omnibox auto-detect | URL detection with search fallback in one field | ✓ |
| URL-only input | Strict URL input, separate search control required | |
| Always-search | Treat all input as search query | |

**User's choice:** Omnibox auto-detect (recommended default)
**Notes:** Directly supports BROW-03 and common user expectations.

---

## Download and recovery behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt + persisted default | Prompt by default, then allow configured default path | ✓ |
| Silent default path | Always download to fixed path with no prompt | |
| Prompt every time only | Always force manual selection, no default path usage | |

**User's choice:** Prompt + persisted default (recommended default)
**Notes:** Balances visibility and convenience while meeting BROW-05.

---

## the agent's Discretion

- Detailed UI density and icon styling for navigation controls.
- Exact implementation details for tab-session persistence structure.

## Deferred Ideas

- Command palette behavior integration (Phase 4)
- Home starter page interactions (Phase 3)
- Multi-window tab migration and window manager semantics (future phase)
