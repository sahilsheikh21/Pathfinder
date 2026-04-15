---
phase: 08
slug: automation-playback
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compile + ESLint + electron-vite build |
| **Config file** | tsconfig.main.json, tsconfig.preload.json, tsconfig.renderer.json, eslint.config.js |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~50-80 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck; npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 80 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | AUTO-03 | T-08-01 | Playback contract rejects unsupported policy/action values by type boundary | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 08-01-02 | 01 | 1 | AUTO-03 | T-08-02 | Playback IPC surface remains narrow and typed (`start/status/cancel`) | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 08-02-01 | 02 | 2 | AUTO-03 | T-08-03 | Preflight blocks malformed JSON and missing required variables before execution | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 08-02-02 | 02 | 2 | AUTO-03 | T-08-04 | Runner executes `seq`-ordered steps with deterministic timeout and stop/continue policy | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 08-02-03 | 02 | 2 | AUTO-03 | T-08-05 | CDP lock + tab binding prevent concurrent ownership and target spoofing | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 08-03-01 | 03 | 3 | AUTO-03 | T-08-06 | Command entry points expose run/cancel without bypassing typed preflight | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 08-03-02 | 03 | 3 | AUTO-03 | T-08-07 | Secret variable prompts are masked and transmitted only for active run request | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 08-03-03 | 03 | 3 | AUTO-03 | T-08-08 | Playback status/failure context stays actionable without exposing secret values | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preflight variable prompt flow for secret and text variables | AUTO-03 | Requires interactive renderer prompt and masked-input behavior verification | Start playback with workflow containing required variables and no values, confirm prompt appears, confirm secret input is masked, submit and verify run starts |
| Stop-on-error vs continue-on-error execution policy behavior | AUTO-03 | Requires realistic page-state failures mid-run | Run a workflow with one guaranteed bad selector under both policies and verify halt-vs-continue behavior + final summary |
| Target-loss cancellation semantics | AUTO-03 | Requires active playback on a real tab and tab-close event timing | Start playback on active tab and close tab during run; verify typed failure reason and deterministic run termination |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 80s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
