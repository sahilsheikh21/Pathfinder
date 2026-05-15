---
status: resolved
trigger: "the homepage need fixes"
created: "2026-04-17"
updated: "2026-04-17T17:42:27.5829986+04:00"
---

# Symptoms

- expected_behavior: Homepage should render correctly and be fully usable
- actual_behavior: Homepage needs fixes and appears broken or incomplete
- error_messages: Not provided
- timeline: Not provided
- reproduction: Open app and navigate to homepage

# Current Focus

- hypothesis: Homepage controls are partially non-functional due to guard clauses and omnibox/search handling drift.
- test: inspect HomeStarterPage submit/open flows and App-level navigation fallback behavior.
- expecting: identify concrete no-op paths and align behavior with homepage UI copy.
- next_action: fixed and verified with static checks

# Evidence

- timestamp: 2026-04-17T17:40:57.6401407+04:00
	checked: .planning/debug/knowledge-base.md pattern overlap
	found: Strong keyword overlap with browser-homepage-hidden-extra-space-ui-icons (homepage partially hidden/blank-space/UI icon inconsistency pattern).
	implication: Known-pattern hypothesis is a high-probability candidate but must be revalidated against current code for regression or residual defects.
- timestamp: 2026-04-17T17:42:27.5829986+04:00
	checked: src/renderer/components/HomeStarterPage.tsx submit/useEffect paths
	found: Home search always forced search-template URL even when user entered a direct address, despite UI copy saying address entry is supported; quick links/recent data load was unnecessarily gated on activeTabId.
	implication: Homepage appears incomplete/unreliable because key actions do not match user expectation and data can remain empty in null-active-tab fallback states.
- timestamp: 2026-04-17T17:42:27.5829986+04:00
	checked: src/renderer/App.tsx handleNavigate
	found: handleNavigate returned early when activeTabId was null, causing home quick-link open actions to no-op in null-active-tab fallback scenarios.
	implication: Homepage had a concrete unusable interaction path.

# Eliminated

- hypothesis: Current issue is a repeat of right-rail bounds mismatch from knowledge base entry browser-homepage-hidden-extra-space-ui-icons.
	reason: BrowserRuntime sidebar-position synchronization and viewport bounds logic are already present in current source.
	evidence_ref: src/main/browserRuntime.ts, src/main/main.ts

# Resolution

- root_cause: Homepage interaction logic had two usability regressions: no-op navigation when no active tab existed, and home search behavior that ignored direct URL/address input despite indicating support.
- fix: Added navigate fallback to create a new tab when activeTabId is missing; switched home search target resolution to resolveOmniboxInput so URLs/hostnames navigate directly while other input uses search; removed unnecessary activeTabId guard around quick-link/recent list loading.
- verification: npm run typecheck (pass); npm run lint (pass)
- files_changed: src/renderer/App.tsx, src/renderer/components/HomeStarterPage.tsx
