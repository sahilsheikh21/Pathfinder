---
phase: 15
slug: theming-and-shortcuts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none yet - lint/typecheck/build gates are available |
| **Config file** | none - Wave 0 may add UI/unit test tooling if needed |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | SET-02 | T-15-01 | Validate appearance payloads in main process before persistence | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | SET-05 | T-15-02 | Reject shortcut conflicts and invalid bindings through typed validation errors | integration | `npm run typecheck` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | SET-02 | T-15-03 | Renderer consumes typed settings APIs only; no direct privileged calls | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | SET-05 | T-15-04 | Editable shortcuts apply only to allowlisted commands | integration | `npm run lint; npm run typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/settings/appearance-shortcuts.spec.ts` - shortcut conflict and appearance persistence tests
- [ ] `vitest.config.ts` - test runner configuration for renderer-safe tests
- [ ] `npm install -D vitest` - if test framework introduction is required by plan tasks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System-theme live sync while app is open | SET-02 | Depends on host OS theme change signal | Set theme mode to system, toggle Windows appearance while app stays open, confirm live switch without restart |
| Shortcut remap collision UX | SET-05 | Requires keyboard interaction across live shell | Assign duplicate shortcut to two core commands, confirm save is blocked with clear conflict message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
