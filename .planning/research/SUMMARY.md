# Project Research Summary

**Project:** Pathfinder
**Domain:** Windows-first Electron AI automation browser
**Researched:** 2026-04-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

Pathfinder is best built as a secure, local-first Electron browser shell with deterministic automation and guarded AI assistance layered on top. The strongest pattern across research is strict process isolation: main process owns privileged capabilities (tabs, CDP/Playwright, storage, secrets), renderer stays UI-only, and all cross-boundary traffic goes through typed and validated preload contracts.

The recommended delivery strategy is dependency-first: ship a credible browser baseline (tabs, navigation, permissions, settings/privacy essentials), then add command-driven interaction, then deterministic record/replay automation, and finally AI-assisted generation behind approval gates. This sequencing lowers architecture churn and avoids coupling AI uncertainty to core runtime behavior.

The major risks are security boundary breakage, unsafe LLM actioning, CDP session instability, and release-pipeline trust failures (secrets, signing, updates). Mitigations are clear and testable: secure Electron defaults + IPC sender validation, policy/validator gates and human approval for risky actions, single CDP ownership with soak testing, and signed-update CI gates with staged rollout.

## Key Findings

### Recommended Stack

Electron 41 with electron-vite is the recommended shell/build baseline because it combines modern Chromium security updates with practical desktop packaging/update tooling. React 19 + TypeScript provide a stable renderer foundation, while typed IPC + schema validation (Zod) protect process boundaries.

Automation should use playwright-core with a CDP bridge and strict version pinning discipline. Local-first persistence should use better-sqlite3 + Drizzle, with append-only run history and versioned workflow definitions. Secrets should be managed in main using safeStorage; logs should be structured and redacted via Pino.

**Core technologies:**
- Electron + electron-vite: app shell and secure process model with fast developer workflow.
- playwright-core + CDP bridge: deterministic browser automation aligned to Electron embedding.
- better-sqlite3 + Drizzle: fast local persistence with type-safe access and migration control.
- Zod + typed preload IPC: contract safety for commands/events across trust boundaries.
- safeStorage + Pino: protected credentials and production-grade observability/redaction.

### Expected Features

V1 should focus on complete browser basics plus one reliable AI/automation loop. The strongest recommendation is to avoid broad platform ambitions (extensions marketplace, cloud sync, autonomous side-effecting agents) until core automation reliability and safety are proven.

**Must have (table stakes):**
- Multi-tab browsing and window controls.
- Address bar/navigation with URL vs search fallback.
- Command palette core and quick-search popup.
- Downloads/permission prompts.
- Core settings persistence and privacy/safety essentials.

**Should have (competitive):**
- Automation record and replay.
- Automation library and run history.
- Ask AI about current page with citation snippets.
- AI commands integrated into the command palette.

**Defer (v2+):**
- Extension marketplace parity.
- Cross-device sync/accounts.
- Fully autonomous high-impact agent execution.
- Visual no-code flow editor.

### Architecture Approach

Use a layered architecture with strict control-plane ownership in main, UI-only renderer, narrow preload API, and optional utility-process workers for heavy transforms. The most important boundary rules are: WebContentsView-based tab composition, single CDP ownership, ports-and-adapters for automation/LLM providers, append-only run telemetry, and schema-validated command/query/event IPC.

**Major components:**
1. Main control plane: lifecycle, tabs/navigation policy, IPC gateway, automation and LLM orchestrators.
2. Renderer presentation plane: workspace shell, tab strip, command palette, sidebar/history/settings modules.
3. Persistence/security plane: workflow/run repositories, settings store, secret store, structured telemetry.

### Critical Pitfalls

1. **Privilege breakout from web content** - enforce secure Electron defaults, sender validation, and narrow preload APIs.
2. **Prompt injection driving unsafe actions** - force structured plans, policy allowlists, and human approval for destructive/external actions.
3. **CDP detach/ownership collisions** - implement single session manager, bounded reconnect/backoff, and soak tests.
4. **Embedding instability under browser workload** - prefer WebContentsView, add crash-recovery and tab stability harness.
5. **Secret leakage and release trust failures** - safeStorage + redaction tests + signed artifact/update pipeline verification.

## Implications for Roadmap

Based on combined research, suggested phase structure:

### Phase 1: Secure Browser Foundation
**Rationale:** All later automation/AI work depends on trustworthy tab/navigation runtime.
**Delivers:** Electron shell, tab lifecycle, address/navigation, downloads/permissions, secure defaults, typed IPC skeleton.
**Addresses:** TS-01, TS-02, TS-06.
**Avoids:** P0-1, P0-4.

### Phase 2: Command UX + Core Product Controls
**Rationale:** Establish Pathfinder interaction model and release-minimum usability controls early.
**Delivers:** New tab surface, command palette, quick-search popup, settings baseline, privacy controls.
**Addresses:** TS-03, TS-04, TS-05, TS-07, TS-08.
**Avoids:** P2-1 via early schema/versioning discipline.

### Phase 3: Automation Substrate
**Rationale:** Deterministic automation is the primary differentiator and should precede generative AI drafting.
**Delivers:** CDP recorder, workflow schema/versioning, execution engine with retries/timeouts/cancel, run telemetry/history.
**Addresses:** DF-01, DF-02.
**Avoids:** P0-3, P1-1, P2-2, P0-5.

### Phase 4: Assisted AI Features (Guarded)
**Rationale:** Lower-risk AI value first, then constrained generation.
**Delivers:** Ask-AI on current page, provider adapter layer, AI palette commands, LLM-assisted workflow draft behind approval gate.
**Addresses:** DF-04, DF-05, DF-03.
**Avoids:** P0-2, P1-2, P0-6.

### Phase 5: Hardening, Distribution, and Operations
**Rationale:** Production quality depends on reliability, observability, and trusted update delivery.
**Delivers:** Utility-process offloading, crash recovery/resume, redaction and diagnostics tooling, signing + staged auto-update pipeline.
**Addresses:** Cross-cutting NFRs for release readiness.
**Avoids:** P1-3, P1-4, residual P2-1/P2-2.

### Phase Ordering Rationale

- Browser/runtime security and IPC contracts must be stable before recorder/executor work to prevent rework.
- Command UX and settings/privacy can progress before or alongside automation persistence because they have lower protocol coupling.
- AI generation is intentionally late in v1 so deterministic workflow execution, telemetry, and policy gates already exist.
- Distribution hardening is last to validate real packaged behavior (signing/update) and long-run stability.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** CDP ownership model, DevTools coexistence, replay reliability metrics.
- **Phase 4:** Prompt-injection defenses, action risk classifier thresholds, provider capability normalization.
- **Phase 5:** Windows signing strategy (EV vs trusted signing) and staged updater rollback policy.

Phases with standard patterns (can skip deep research-phase):
- **Phase 1:** Electron security defaults, typed IPC, tab/navigation baseline.
- **Phase 2:** Command palette UX, settings persistence, basic privacy controls.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Anchored in official Electron/Playwright/tooling docs and practical version guidance. |
| Features | MEDIUM-HIGH | Strong alignment to product intent; some market expectation assumptions remain. |
| Architecture | HIGH | Well-established Electron process-boundary and CDP/Playwright patterns. |
| Pitfalls | HIGH | Risks are concrete, testable, and mapped to specific mitigations and phases. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Final decision on automation isolation model (single-process vs more worker isolation under load) should be validated with soak benchmarks.
- Exact policy boundaries for high-risk actions need product/legal confirmation before full agent execution mode.
- Update channel strategy and certificate operations must be verified end-to-end in CI on packaged Windows artifacts.

## Planning Directives (Roadmap Input)

1. Freeze secure process and IPC contracts before starting automation or LLM work.
2. Treat deterministic record/replay reliability as the primary v1 differentiator; AI generation is secondary.
3. Enforce a strict action-policy gate and human approval checkpoint for any irreversible or externalized action.
4. Make run telemetry, failure classification, and redaction mandatory deliverables, not post-launch polish.
5. Ship v1 local-first; defer cloud sync/extensions/autonomous agent scope to post-validation milestones.

## Sources

### Primary (HIGH confidence)
- Electron official docs (security, IPC, process model, WebContentsView, debugger, safeStorage, updates).
- Playwright official docs (connectOverCDP limits, locators/actionability, tracing).
- SQLite and better-sqlite3 official documentation.
- electron-builder documentation for signing and auto-update behavior.

### Secondary (MEDIUM confidence)
- OWASP GenAI prompt injection guidance for LLM safety controls.
- Current product-category patterns for desktop AI utility browsers.

---
*Research completed: 2026-04-14*
*Ready for roadmap: yes*
