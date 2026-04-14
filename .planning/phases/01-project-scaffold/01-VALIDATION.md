---
phase: 01
slug: project-scaffold
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + tsc + eslint |
| **Config file** | package.json scripts (created in this phase) |
| **Quick run command** | npm run typecheck |
| **Full suite command** | npm run lint; npm run typecheck; npm run build |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run npm run typecheck
- **After every plan wave:** Run npm run lint; npm run typecheck; npm run build
- **Before /gsd-verify-work:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUNDATION-01 | T-01-01 | Electron shell uses isolated preload bridge only | integration | npm run build | ❌ W0 | pending |
| 01-01-02 | 01 | 1 | FOUNDATION-02 | T-01-02 | Main and preload process entrypoints compile with strict TS settings | static | npm run typecheck | ❌ W0 | pending |
| 01-01-03 | 01 | 1 | FOUNDATION-03 | T-01-03 | Packaging config disallows unsafe defaults and builds installer target | integration | npm run package -- --dir | ❌ W0 | pending |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [ ] package.json with scripts: dev, build, lint, typecheck, package
- [ ] tsconfig.base.json and project references for main/preload/renderer
- [ ] eslint.config.js baseline for TypeScript + React renderer

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App window renders initial shell on launch | FOUNDATION-01 | Visual shell correctness | Run npm run dev and confirm one browser window opens with renderer shell |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] nyquist_compliant: true set in frontmatter

**Approval:** pending
