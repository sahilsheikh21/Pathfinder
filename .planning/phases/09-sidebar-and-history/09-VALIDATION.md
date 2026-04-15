---
phase: 09
slug: sidebar-and-history
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
---

# Phase 09 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compile + ESLint + electron-vite build |
| **Config file** | tsconfig.main.json, tsconfig.preload.json, tsconfig.renderer.json, eslint.config.js |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~60-90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint; npm run typecheck; npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | AUTO-04 | T-09-01 | Library/history contracts accept only typed validated payloads | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | AUTO-05 | T-09-02 | History contract excludes secret variable data fields | static+compile | `npm run typecheck` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 2 | AUTO-04 | T-09-03 | Library store enforces create/rename/delete and tag constraints in main process | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 09-02-02 | 02 | 2 | AUTO-05 | T-09-04 | History store writes run lifecycle states, prunes cap, and redacts sensitive data | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 09-02-03 | 02 | 2 | SIDE-01 | T-09-05 | Sidebar state persistence applies validated bounds and avoids unsafe renderer writes | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 09-03-01 | 03 | 3 | SIDE-01 | T-09-06 | Sidebar sections/collapse/restore behavior remains deterministic across sessions | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 09-03-02 | 03 | 3 | AUTO-04 | T-09-07 | Library filtering and run actions route through typed APIs only | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 09-03-03 | 03 | 3 | AUTO-05 | T-09-08 | History list virtualization and detail rendering avoid data leakage and UI lockups | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 09-04-01 | 04 | 4 | AUTO-05 | T-09-09 | Cross-surface updates keep Home recent automations and sidebar badges in sync from one source | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar collapse/restore persistence across restart | SIDE-01 | Requires interactive desktop behavior validation across app relaunch | Collapse sidebar, set width/section/filter/scroll state, restart app, confirm state restores correctly |
| Running-entry to final-status history transition | AUTO-05 | Requires real playback execution timing and UI observation | Trigger playback, confirm running row appears/pins, then completes/fails and updates status/duration/failure snippet |
| Delete and clear-all confirmations with active run exception | AUTO-04, AUTO-05 | Confirmation and active-run exclusion are UX-driven state transitions | Delete one item and clear-all while run is active; confirm running entry remains and others are removed as specified |
| Responsive overlay fallback under narrow width | SIDE-01 | Requires real window resize interactions not captured by static checks | Shrink window below threshold; verify sidebar switches to overlay drawer and remains keyboard accessible |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
