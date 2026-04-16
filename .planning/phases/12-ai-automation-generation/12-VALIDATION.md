---
phase: 12
slug: ai-automation-generation
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-16
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | npm scripts (eslint + tsc + electron-vite build) |
| **Config file** | package.json |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | AI-03 | T-12-01 | New generation payloads are typed and validated at process boundaries | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | AI-03 | T-12-02 | Model output is normalized and schema-validated before preview | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 12-01-03 | 01 | 1 | AI-03 | T-12-03 | IPC/preload APIs expose cancel/status without unsafe renderer access | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 12-02-01 | 02 | 2 | AI-03 | T-12-04 | Preview/edit requires explicit approval before persistence or run | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 2 | AI-05 | T-12-05 | Command palette generation/cancel shows deterministic progress and failure states | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 12-02-03 | 02 | 2 | AI-03, AI-05 | T-12-06 | Save and Run path revalidates draft before run dispatch | integration | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI sidebar draft review and structured edit flow feels coherent | AI-03 | UI interaction and usability quality require human validation | Run app, generate draft from prompt, edit step fields and JSON toggle, confirm explicit approval actions appear |
| Command-first generation and cancel flow communicates clear state | AI-05 | User-perceived command/feedback clarity is not fully captured by static checks | Trigger `ai.automation.generate`, then `ai.automation.cancel`, verify status transitions and actionable retry guidance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
