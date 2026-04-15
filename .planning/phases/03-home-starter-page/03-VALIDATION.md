---
phase: 03
slug: home-starter-page
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-15
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Existing npm script gates (eslint + tsc + electron-vite build) |
| **Config file** | eslint.config.js, tsconfig.base.json, electron.vite.config.ts |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~45-90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck; npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | HOME-01 | T-03-01 | Internal home route + allowlisted home IPC only | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | HOME-03 | T-03-02 | Home store validates persisted JSON and URL schemes | integration | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | HOME-01 | T-03-03 | Home UI only renders for `about:pathfinder-home` tab token | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | HOME-02 | T-03-04 | Query-only search with empty-query no-op and submit-time template fetch | integration | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 03-03-01 | 03 | 3 | HOME-03 | T-03-05 | Quick-link edit operations sanitize URL input before persistence | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 03-03-02 | 03 | 3 | HOME-03 | T-03-06 | Recent automations placeholder section remains non-interactive and explicit | integration | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Greeting/date visual placement and density | HOME-01 | Visual fidelity check | Open a new tab and verify compact header + centered search hero + balanced section spacing. |
| Quick-link editing UX clarity | HOME-03 | Interaction ergonomics | Add, pin, and remove quick links; confirm controls are discoverable and non-destructive. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
