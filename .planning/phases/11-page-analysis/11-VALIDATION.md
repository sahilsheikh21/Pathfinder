---
phase: 11
slug: page-analysis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 11 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none yet (phase currently uses lint/typecheck/build gates) |
| **Config file** | none - Wave 0 can add test harness later if needed |
| **Quick run command** | npm run typecheck |
| **Full suite command** | npm run lint && npm run typecheck && npm run build |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run npm run typecheck
- **After every plan wave:** Run npm run lint && npm run typecheck && npm run build
- **Before /gsd-verify-work:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | AI-02 | T-11-01 | Typed contracts prevent unvalidated payload shapes | type | npm run typecheck | ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | AI-02 | T-11-02 | Extraction pipeline enforces redaction defaults | build | npm run lint && npm run typecheck && npm run build | ✅ | ⬜ pending |
| 11-02-01 | 02 | 2 | AI-02 | T-11-03 | Main handlers clamp inputs and return typed failures | build | npm run lint && npm run typecheck && npm run build | ✅ | ⬜ pending |
| 11-03-01 | 03 | 2 | AI-02 | T-11-04 | Renderer/UI actions preserve explicit user control and cancellation | build | npm run lint && npm run typecheck && npm run build | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] none required for this phase (existing lint/typecheck/build infrastructure is already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Citation relevance quality on arbitrary real-world pages | AI-02 | Automated static checks do not prove semantic grounding quality | Run summary/ask on at least two real pages, confirm claims map to shown snippets |
| Stale warning UX timing on dynamic pages | AI-02 | Requires interaction timing and dynamic page behavior | Ask follow-up after TTL window and verify stale warning + refresh action appear |

---

## Validation Sign-Off

- [ ] All tasks have automated verify commands
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] nyquist_compliant: true set in frontmatter

**Approval:** pending
