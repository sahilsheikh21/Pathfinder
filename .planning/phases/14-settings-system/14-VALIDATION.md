---
phase: 14
slug: settings-system
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-16
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | npm scripts (eslint + tsc + electron-vite build) |
| **Config file** | package.json |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~150 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 150 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | SET-01 | T-14-01 | Shared settings contracts constrain renderer-to-main payloads with typed schemas | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | SET-01 | T-14-02 | Main settings store validates input and auto-recovers corrupted persisted config | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 14-01-03 | 01 | 1 | SET-01 | T-14-03 | IPC/preload surface exposes only typed settings methods and redacted failures | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 14-02-01 | 02 | 2 | SET-03 | T-14-04 | Clear-data buckets execute only selected scopes with explicit result summaries | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 14-02-02 | 02 | 2 | SET-03 | T-14-05 | Global cookie mode applies safely through main-process policy wiring | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 14-02-03 | 02 | 2 | SET-01, SET-03 | T-14-06 | Save/get/repair handlers return deterministic typed envelopes for all settings paths | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 14-03-01 | 03 | 3 | SET-01 | T-14-07 | Settings UI writes validated general settings and reflects persisted values | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 14-03-02 | 03 | 3 | SET-03 | T-14-08 | Privacy UI requires confirmation before destructive clear-data operations | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 14-03-03 | 03 | 3 | SET-01, SET-03 | T-14-09 | Repair/reset notice is surfaced non-blockingly without breaking settings interactions | integration | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clear-data scope selection and confirmation UX are explicit and understandable | SET-03 | Destructive intent clarity is UX-dependent | Open Settings -> Privacy, select mixed buckets, confirm clear, verify result summary reports each bucket outcome |
| Auto-repair notification is visible but non-blocking | SET-01 | User trust and intrusiveness balance is visual/interaction quality | Corrupt settings file, relaunch app, verify settings load succeeds and notice appears without blocking navigation |
| Cookie mode changes communicate expected tradeoffs | SET-03 | Behavioral expectation messaging requires human judgment | Switch cookie mode across all three options and verify explanatory copy plus applied state are coherent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 150s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending