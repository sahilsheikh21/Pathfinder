# Phase 11: Page Analysis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `11-CONTEXT.md`; this log preserves options considered.

**Date:** 2026-04-16
**Phase:** 11-page-analysis
**Areas discussed:** Entry surfaces and invocation, Grounding and citation format, Page content extraction scope, Failure guidance behavior, Privacy and redaction policy, Conversation invalidation rules, Snapshot refresh strategy, Answer style controls

---

## Entry Surfaces and Invocation

| Option | Description | Selected |
|--------|-------------|----------|
| Command palette plus AI sidebar action | Command-first plus discoverable UI entry | ✓ |
| Command palette only | Minimal-scope command flow | |
| AI sidebar action only | Mouse-first discoverability | |

**User choices captured:**
- Two commands: Summarize Page + Ask About Page.
- Responses rendered in AI sidebar panel; panel auto-focuses when command runs.
- Target resolved from active tab at execution time.
- Ask command supports optional inline query; in-panel prompt fallback.
- Summary defaults to concise bullets.
- Per-tab in-memory conversation retained for session.

---

## Grounding and Citation Format

| Option | Description | Selected |
|--------|-------------|----------|
| Inline markers + snippet cards | Answer readability with inspectable evidence | ✓ |
| Footnote list only | Minimal answer body | |
| Embedded quotes in each bullet | High visibility, verbose output | |

**User choices captured:**
- Citation density around 3-5 snippets.
- Citation cards include title, URL, snippet index, and extraction timestamp.
- Unsupported claims are refused with missing-context guidance.
- Snippets are lightly normalized and relevance-ranked.
- Non-page knowledge is allowed only when clearly labeled as non-page context.

---

## Page Content Extraction Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Selection-first -> readable main -> full fallback | Relevance-first with robust fallback | ✓ |
| Always full page extraction | Simplest, higher noise/cost | |
| Visible viewport only | Focused but potentially incomplete | |

**User choices captured:**
- Include structured context (title, URL, headings) with extracted text.
- Extract after load + short stability wait on dynamic pages.
- No hard extraction cap chosen in this phase.

---

## Failure Guidance Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Actionable failure + next step | Clear recovery guidance | ✓ |
| Generic toast only | Minimal implementation | |
| Silent failure | No actionable UX | |

**User choices captured:**
- Manual retry action for transient provider failures.
- Low-extractability pages return partial answer with low-context warning.
- In-flight analysis should be cancellable with visible status.

---

## Privacy and Redaction Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Default masking/redaction of sensitive data | Safe baseline for provider calls | ✓ |
| No redaction | Max context, high risk | |
| Prompt every request | Strong consent, high friction | |

**User choices captured:**
- Same redaction policy for cloud and local providers.
- Exclude form/input values by default.
- Allow one-time unredacted override with warning confirmation.

---

## Conversation Invalidation Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Reset on URL change/hard reload | Prevent stale grounded context | ✓ |
| Persist across navigation | Higher continuity, stale risk | |
| Manual reset only | User-controlled, risky default | |

**User choices captured:**
- Same-URL dynamic pages keep context but become stale after short window.
- Add explicit clear-context action.
- On stale follow-up, warn and offer quick re-extract.

---

## Snapshot Refresh Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse by default + conditional/manual refresh | Latency/freshness balance | ✓ |
| Re-extract every request | Freshness-first, slower | |
| Reuse until manual refresh only | Fastest, more staleness risk | |

**User choices captured:**
- Auto-refresh triggers: URL change, stale-warning acceptance, explicit refresh.
- Short freshness TTL (~1-2 minutes) before warning.
- Expose refresh action in both AI panel and command palette.

---

## Answer Style Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Direct answer then concise supporting bullets | Fast readability | ✓ |
| Long-form paragraph style | Narrative depth | |
| Bullet-only style | Compact but less nuanced | |

**User choices captured:**
- Provide concise/detailed verbosity toggle.
- Show light confidence label.
- Summary mode uses fixed sections: Key Points, Risks/Gaps, Next Actions.

---

## the agent's Discretion

- Exact copy for warnings, confidence labels, and retry prompts.
- Exact visual layout for citation cards and status affordances.
- Exact numeric constants within selected policy ranges (for example short TTL window).

## Deferred Ideas

- Persistent unredacted override in global settings.
- Persistent cross-session page-analysis conversation history.
