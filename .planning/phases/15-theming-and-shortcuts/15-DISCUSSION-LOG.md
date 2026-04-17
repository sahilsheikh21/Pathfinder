# Phase 15: Theming and Shortcuts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-17T10:34:08.059Z
**Phase:** 15-theming-and-shortcuts
**Areas discussed:** Theme behavior model

---

## Theme behavior model

### Q1. What should be the default theme mode for new users?

| Option | Description | Selected |
|--------|-------------|----------|
| System | Follow OS appearance by default (current behavior in theme helpers) | ✓ |
| Light | Always start light mode unless user changes it | |
| Dark | Always start dark mode unless user changes it | |

**User's choice:** System

### Q2. When user selects System mode, should Pathfinder live-update if OS theme changes while app is open?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, live-sync | Theme updates immediately on OS change without restart | ✓ |
| No, apply on next restart | Keep current look until relaunch | |

**User's choice:** Yes, live-sync

### Q3. How should theme changes be visually applied?

| Option | Description | Selected |
|--------|-------------|----------|
| Instant switch | No transition effects; fastest and simplest | |
| Subtle transition (~120-180ms) | Brief non-distracting color transition | ✓ |
| Respect reduced motion | Subtle transition normally, instant when reduced-motion is enabled | |

**User's choice:** Subtle transition (~120-180ms)

### Q4. Where should theme preference be controlled moving forward?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings panel is source of truth | Manage from Settings > Appearance and persist in canonical settings store | ✓ |
| Keep current local storage control | Retain renderer localStorage approach and do not migrate now | |
| Both, but Settings overrides | Allow legacy read, then normalize to Settings store | |

**User's choice:** Settings panel is source of truth

## the agent's Discretion

- Font-size personalization details were not explicitly discussed.
- Sidebar position preference details were not explicitly discussed.
- Shortcut customization conflict UX details were not explicitly discussed.

## Deferred Ideas

None.
