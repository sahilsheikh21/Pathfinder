---
phase: 05
slug: quick-search-popup
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compile + ESLint + electron-vite build |
| **Config file** | tsconfig.main.json, tsconfig.preload.json, tsconfig.renderer.json, eslint.config.js |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~25-35 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck; npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | QSR-01 | T-05-01 | Renderer shortcut trigger remains app-scoped and ignores editable inputs | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | QSR-01 | T-05-02 | Quick-search IPC channels expose only typed narrow operations | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | QSR-01 | T-05-03 | Popup lifecycle prevents duplicate windows and keeps always-on-top semantics | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 3 | QSR-02 | T-05-04 | Selection routing validates target and navigates active-or-new tab deterministically | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App-scoped quick-search toggle and Escape behavior | QSR-01 | Needs live window focus and keyboard interaction | Start app, press Ctrl+Shift+S to open popup, press Escape to close, press Ctrl+Shift+S again to reopen |
| Always-on-top + resize/drag interactions | QSR-01 | Requires desktop window interaction not fully covered by CLI tests | Open popup, drag and resize it, switch focus to main window, confirm popup remains above app windows per always-on-top policy |
| Selection routes destination to active main tab | QSR-02 | Requires multi-window runtime behavior check | Open popup, enter query, select result with Enter, verify active browser tab navigates and popup closes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
