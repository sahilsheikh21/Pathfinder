---
phase: 07
slug: action-recording
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compile + ESLint + electron-vite build |
| **Config file** | tsconfig.main.json, tsconfig.preload.json, tsconfig.renderer.json, eslint.config.js |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~45-70 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck; npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 70 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | AUTO-02 | T-07-01 | Recorder workflow schema rejects malformed payloads and enforces action vocabulary | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | AUTO-02 | T-07-02 | Typed recorder IPC/preload channels prevent ad-hoc renderer control of privileged recorder internals | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 2 | AUTO-02 | T-07-03 | Main-process recorder enforces single-session ownership and deterministic lifecycle transitions | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 07-02-02 | 02 | 2 | AUTO-02 | T-07-04 | Normalization pipeline emits deterministic `seq`-ordered steps with wait boundary injection | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 07-03-01 | 03 | 3 | AUTO-02 | T-07-05 | Command palette recorder controls return clear success/failure status and avoid ambiguous state | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 07-03-02 | 03 | 3 | AUTO-02 | T-07-06 | Renderer recording indicator reflects real recorder status without leaking privileged data | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab-bound capture and stop-on-target-loss behavior | AUTO-02 | Requires running Electron app and closing target tab during active recording | Run app via `npm run dev`, start recording through command palette, close bound tab, verify recorder transitions to stopped with explicit reason |
| Secret-field placeholder persistence | AUTO-02 | Requires interactive form entry path in a real webpage context | Start recording on login form page, type into password field, stop recording, inspect persisted workflow payload to confirm variable placeholder not raw secret |
| Command-driven lifecycle UX feedback | AUTO-02 | Requires end-to-end renderer interaction with command palette | Execute `automation record` and `automation stop` commands, verify indicator and command feedback for success and busy/not-recording cases |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 70s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
