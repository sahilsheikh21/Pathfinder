---
phase: 13
slug: live-agent-mode
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-16
---

# Phase 13 — Validation Strategy

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
| 13-01-01 | 01 | 1 | AI-04 | T-13-01 | Live-agent shared types and IPC contracts enforce explicit control and approval semantics | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | AI-04 | T-13-02 | Main orchestrator enforces high-impact gating before execution | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 13-01-03 | 01 | 1 | AI-04 | T-13-03 | Preload bridge exposes only typed control methods with no unsafe direct execution hooks | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | AI-04 | T-13-04 | Batch approval flow blocks high-impact steps until explicit approval | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 2 | AI-04 | T-13-05 | Step-level audit events persist redacted planned action/result/rationale | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 13-02-03 | 02 | 2 | AI-04 | T-13-06 | Pause boundary, immediate cancel, and guarded resume transitions remain deterministic | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 3 | AI-04 | T-13-07 | Sidebar exposes approval/pause/resume/cancel controls tied to orchestrator state | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 13-03-02 | 03 | 3 | AI-04 | T-13-08 | Command palette live-agent actions route to the same controlled state machine | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 13-03-03 | 03 | 3 | AI-04 | T-13-09 | Timeline renders per-step audit data including risk and approval decisions | integration | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Batch approval prompts clearly communicate step intent and risk before execution | AI-04 | Human judgment needed for clarity and safety UX | Start live-agent run, inspect approval batch card, verify each step shows intent, target, risk tier, and expected side effect |
| Pause/resume behavior feels predictable under real browsing conditions | AI-04 | Timing and interaction quality cannot be fully inferred from static checks | Trigger run, pause during multi-step execution, verify pause at boundary and resume from next unexecuted step only |
| Audit timeline is understandable and useful for user trust | AI-04 | Explainability quality is UX-dependent | Complete one run and one cancelled run, verify timeline shows planned action, approval decision, observed result, and next rationale for each step |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
