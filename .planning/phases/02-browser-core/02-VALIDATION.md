---
phase: 2
slug: browser-core
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 2 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compile and lint gates |
| **Config file** | tsconfig.base.json, eslint.config.js |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~55 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck; npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BROW-03 | T-02-03 | Fixed allowlisted IPC channel constants for browser actions | static | `npm run typecheck` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | BROW-03 | T-02-01 | Omnibox routing normalizes input to url/search intent | static | `npm run typecheck` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | BROW-01,BROW-02 | T-02-05/T-02-06 | Main runtime validates tab ids and channel handlers before execution | integration | `npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | BROW-01,BROW-02,BROW-03 | T-02-08 | Renderer states and controls remain explicit and safe through typed API | integration | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 3 | BROW-05 | T-02-10 | Download lifecycle events emit bounded progress and terminal states | integration | `npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 3 | BROW-04 | T-02-09/T-02-12 | Session restore validates persisted snapshot before runtime restore | integration | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending, ✅ green, ❌ red, ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Unexpected renderer crash and restart restores prior tab set | BROW-04 | Requires live runtime crash simulation | Run app, open 3 tabs, force-kill renderer process, relaunch app, verify restored order and active tab |
| Download save dialog prompt behavior with optional default path | BROW-05 | Depends on Electron native save dialog UX | Trigger a download twice, verify first prompt appears and configured default path behavior remains consistent |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
