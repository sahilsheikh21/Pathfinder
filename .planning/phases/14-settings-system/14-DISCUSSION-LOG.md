# Phase 14: Settings System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 14-settings-system
**Areas discussed:** Settings information architecture, General behavior settings, Privacy clear-data scope, Cookie preference model, Validation and corruption recovery

---

## Settings information architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Settings page | Unified, scalable sectioned UX; easier discoverability and long-term maintenance | ✓ |
| Sidebar section only | Fast to wire into existing shell but can over-crowd operational sidebar | |
| Modal dialog | Lightweight but limits complexity and future expansion | |

**User's choice:** Dedicated Settings page (auto-selected recommended default)
**Notes:** Chosen to avoid fragmented settings UX and to support future phases cleanly.

---

## General behavior settings

| Option | Description | Selected |
|--------|-------------|----------|
| Restore session + ask-before-download defaults | Preserves existing browsing continuity and safe download behavior | ✓ |
| Open home page always + fixed default download path | Simpler startup but less continuity and more implicit write behavior | |
| Custom startup URL list as default | Powerful but too opinionated as first-time default | |

**User's choice:** Restore session + ask-before-download defaults (auto-selected recommended default)
**Notes:** Matches established prior-phase decisions and minimizes behavior regressions.

---

## Privacy clear-data scope

| Option | Description | Selected |
|--------|-------------|----------|
| Bucketed clear-data with explicit scope and confirmation | Fine-grained, safer destructive flows, clear user intent | ✓ |
| Single one-click clear-all | Simple but high-risk and opaque | |
| No clear-data controls in Phase 14 | Avoids risk but violates `SET-03` | |

**User's choice:** Bucketed clear-data with explicit scope and confirmation (auto-selected recommended default)
**Notes:** Selected to satisfy privacy requirements with low accidental data-loss risk.

---

## Cookie preference model

| Option | Description | Selected |
|--------|-------------|----------|
| Global modes only (allow all / block third-party / block all) | Meets v1 requirement with manageable scope | ✓ |
| Global + per-site exceptions in same phase | Better control but significantly larger implementation surface | |
| Block all by default hard policy | Strong privacy posture but likely high site breakage and UX friction | |

**User's choice:** Global modes only (auto-selected recommended default)
**Notes:** Per-site exceptions deferred to avoid scope creep beyond Phase 14.

---

## Validation and corruption recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Main-process validation + auto-repair + non-blocking notice | Safe operation with transparent recovery | ✓ |
| Silent reset to defaults | Simpler but confusing when user values change unexpectedly | |
| Hard-fail settings load | Strict integrity but poor resilience/UX | |

**User's choice:** Main-process validation + auto-repair + non-blocking notice (auto-selected recommended default)
**Notes:** Aligns with existing store fallback patterns while improving transparency.

---

## the agent's Discretion

- Exact visual composition and copy for settings sections/forms.
- Internal store modularization details for settings persistence.
- Exact wording/placement of repair and clear-data result notices.

## Deferred Ideas

- Per-site cookie exceptions and richer permission controls.
- Dedicated browser-wide polish/debug sweep beyond settings scope.
- Global system-level shortcut remapping (Phase 15 concern).
