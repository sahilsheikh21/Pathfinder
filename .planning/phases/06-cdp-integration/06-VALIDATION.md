---
phase: 06
slug: cdp-integration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compile + ESLint + electron-vite build |
| **Config file** | tsconfig.main.json, tsconfig.preload.json, tsconfig.renderer.json, eslint.config.js |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~30-45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck; npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AUTO-01 | T-06-01 | Typed automation channels prevent ad-hoc IPC command injection | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | AUTO-01 | T-06-02 | Preload exposes only narrow bridge methods and typed payloads | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 2 | AUTO-01 | T-06-03 | Target resolution uses active-tab runtime metadata and rejects missing targets | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 2 | AUTO-01 | T-06-04 | Single-owner lock rejects concurrent attach with typed busy response | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 06-03-01 | 03 | 3 | AUTO-01 | T-06-05 | Main-process handlers preserve lock lifecycle and typed disconnect semantics | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 06-03-02 | 03 | 3 | AUTO-01 | T-06-06 | Shutdown cleanup tears down active bridge and clears ownership state | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Connect/disconnect lifecycle against live BrowserWindow tab | AUTO-01 | Requires running Electron app with live tab state and CDP endpoint | Start app via `npm run dev`, call connect through typed API path, confirm status transitions to connected then disconnected |
| Collision prevention under concurrent requests | AUTO-01 | Needs live overlapping attach attempts against same runtime process | Trigger two near-simultaneous connect calls, verify first succeeds and second returns typed `busy` response |
| Target disappearance handling | AUTO-01 | Requires runtime tab closure during active bridge session | Connect session, close target tab, verify bridge status transitions with typed disconnect/missing-target reason |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
