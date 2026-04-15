# Phase 3: Home Starter Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 3-home-starter-page
**Areas discussed:** Home layout and priority, Search behavior and default engine source, Quick links data and actions, Recent automations data and empty state

---

## Home layout and priority

| Option | Description | Selected |
|--------|-------------|----------|
| Centered hero + stacked sections | Top greeting/date, large centered search, then quick links and recents sections | ✓ |
| Dashboard grid | Everything in equal widgets | |
| Split pane | Utility cards and search pane split | |

**User's choice:** Centered hero + stacked sections.
**Notes:** Greeting/date should remain compact; balanced density selected with 2x3 quick links and 3 recent slots.

---

## Search behavior and default engine source

### Search template source
| Option | Description | Selected |
|--------|-------------|----------|
| Shared local preference with fallback | One shared template source with DuckDuckGo fallback | ✓ |
| Hardcoded constant only | Static provider for phase 3 | |
| Environment variable | Runtime-configured template | |

### Result opening behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Open in current active tab | Reuse current tab for results | |
| Always open in new tab | Preserve home page tab | ✓ |
| User modifier behavior | Current tab default, modifier for new tab | |

### Additional search decisions
- Empty query: no-op with subtle inline hint.
- Input mode: query-only (no URL detection on home input).
- Template refresh behavior: read at submit-time.
- Trigger mode: Enter plus visible Search button.
- Fallback on template errors: DuckDuckGo fallback and continue.
- New-tab focus: activate new results tab immediately.
- Home-tab state after submit: keep input state as-is.

---

## Quick links data and actions

### Source strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Pinned local list with default fallback | User-pinned local links, defaults if empty | ✓ |
| Defaults only | Fixed links only | |
| Derived from browsing history | Auto-computed list | |

### Click behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Open in current active tab | Standard bookmark-style behavior | ✓ |
| Always open in new tab | Keep home tab untouched | |
| Current tab with modifier | Optional new tab via modifier | |

### Additional quick-link decisions
- First render count: 6 cards.
- Editing in phase 3: yes, basic add/remove/pin on home page.

---

## Recent automations data and empty state

### Pre-automation rendering
| Option | Description | Selected |
|--------|-------------|----------|
| Show section with placeholder cards | Coming-soon cards | |
| Show empty text only | Explicit empty-state message | ✓ |
| Hide section entirely | Do not render section yet | |

### Placeholder interaction
| Option | Description | Selected |
|--------|-------------|----------|
| Open command palette with guidance | Action bridge | |
| No action | Non-interactive in phase 3 | ✓ |
| Show coming-soon toast only | Temporary feedback | |

### Additional recent-automation decisions
- Reserve 3 recent automation slots in layout.
- Future recency basis: most recently executed automations.

---

## the agent's Discretion

- Home routing and tab lifecycle area was offered and skipped for this session.
- Internal implementation details that do not conflict with captured decisions remain flexible.

## Deferred Ideas

None.
