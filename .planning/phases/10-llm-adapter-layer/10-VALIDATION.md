---
phase: 10
slug: llm-adapter-layer
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-15
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | npm script gates (eslint + tsc + electron-vite build) |
| **Config file** | eslint.config.js, tsconfig.main.json, tsconfig.preload.json, tsconfig.renderer.json |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint; npm run typecheck; npm run build` |
| **Estimated runtime** | ~45-90 seconds |

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
| 10-01-01 | 01 | 1 | AI-01 | T-10-01 | Typed contract rejects malformed provider payloads at IPC boundary | compile+build | `npm run typecheck` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 2 | AI-01 | T-10-02 | Provider secrets remain main-process only and redacted from errors | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |
| 10-03-01 | 03 | 3 | AI-01 | T-10-03 | OpenAI+Ollama adapters return normalized response/error envelope | compile+build | `npm run lint; npm run typecheck; npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/llm-adapter/` — optional adapter unit/integration scaffolds if full-suite confidence is insufficient
- [ ] `tests/redaction/` — optional redaction assertions for failure payload handling

*If none: Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Validate local-provider endpoint behavior on developer machine | AI-01 | Depends on local Ollama runtime availability | Start local Ollama service, run adapter config validation flow, confirm success/failure messaging is typed and redacted |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
