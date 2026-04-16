# Phase 11 Research: Page Analysis

## Objective
Research a practical implementation path for Phase 11 so planning can satisfy AI-02: users can run summary and Q&A on the active page with grounded responses, lightweight citations, and actionable failure guidance.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/STATE.md
- .planning/phases/11-page-analysis/11-CONTEXT.md
- .planning/phases/10-llm-adapter-layer/10-CONTEXT.md
- .planning/phases/10-llm-adapter-layer/10-01-SUMMARY.md
- .planning/phases/10-llm-adapter-layer/10-02-SUMMARY.md
- .planning/phases/10-llm-adapter-layer/10-03-SUMMARY.md
- .planning/research/STACK.md
- .planning/research/ARCHITECTURE.md
- implementation_plan.md
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/main/main.ts
- src/main/browserRuntime.ts
- src/main/llm/llmAdapterService.ts
- src/main/llm/providers/openaiAdapter.ts
- src/main/llm/providers/ollamaAdapter.ts
- src/renderer/lib/commandPalette.ts
- src/renderer/App.tsx
- src/renderer/components/AutomationSidebar.tsx

## Locked Decision Constraints
- Entry points are command palette plus AI sidebar surface.
- Output must render in AI sidebar and auto-focus from command execution.
- Active tab at execution time is the analysis target.
- Extraction precedence is selection-first, readable-main-content second, full-text fallback.
- Grounding requires inline markers plus snippet cards and actionable unsupported-claim behavior.
- Follow-up context is per-tab and session-memory only, with explicit invalidation and refresh rules.
- Redaction is on by default across cloud and local providers.

## Existing Architecture Findings

### 1) LLM runtime is already wired and usable
- Main process exposes llmGetConfig, llmSaveConfig, llmValidateConfig, llmGenerate handlers.
- Adapter layer already normalizes errors and keeps provider specifics isolated.
- Existing fail-fast policy matches phase decision for explicit retry instead of silent fallback.

### 2) No page analysis contracts or extraction pipeline exists yet
- Shared types and IPC channels do not include page-analysis request/result, citation models, or cancel/progress events.
- Renderer has an AI config panel but no analysis thread, result cards, or Q&A controls.

### 3) Browser runtime already provides target resolution signals
- Main can resolve active tab + URL/webContents id via browserRuntime.resolveAutomationTarget(tabId?).
- This supports deterministic active-tab targeting and URL-change invalidation hooks.

### 4) Command and sidebar integration points are established
- Command registry already contains AI config commands and pattern for command-driven sidebar focus.
- Sidebar section model includes ai-chat slot and command-driven section activation.

## Recommended Technical Approach

### A) Contract-first extension
- Add shared page-analysis contracts in src/shared/browser.ts:
  - extraction snapshot model
  - citation/snippet model
  - answer payload model (summary + ask variants)
  - progress, cancel, and error payloads
- Add typed IPC channels in src/shared/ipc.ts and preload wrappers in src/preload/index.ts.

### B) Main-process analysis orchestration service
- Create dedicated service in src/main/llm/pageAnalysisService.ts:
  - target resolution
  - extraction pipeline (selection -> readable main -> full fallback)
  - redaction pass
  - prompt composition
  - llmAdapterService invocation
  - grounding/citation assembly
- Keep all privileged extraction and redaction logic in main process.

### C) Extraction strategy details
- Use target webContents execution to gather DOM text blocks and metadata.
- Capture:
  - page title, URL, extractedAt timestamp
  - heading map
  - snippet candidates with stable index/order
- Apply lightweight normalization (whitespace cleanup, control-character stripping).
- Exclude form values and obvious secret patterns by default.

### D) Grounding/citation generation
- Build answer with inline citation ids ([1], [2], ...) and snippet cards under the answer.
- Rank snippets by relevance to answer clauses using lexical overlap + heading proximity scoring.
- If insufficient evidence for a claim, return supported-only answer plus explicit missing-context note.

### E) Conversation, staleness, refresh
- Keep in-memory per-tab session context store in renderer state keyed by tab id + snapshot fingerprint.
- Invalidate on URL change/hard reload; mark stale on short TTL and offer one-click re-extract.
- Expose explicit clear-context and refresh-context commands in palette and AI panel UI.

### F) UI integration
- Extend AI sidebar panel in App.tsx:
  - summarize and ask actions
  - concise/detailed toggle
  - confidence indicator
  - progress + cancel controls
  - citation cards and metadata surface
- Add command palette entries:
  - AI: Summarize Active Page
  - AI: Ask About Active Page
  - AI: Refresh Page Context
  - AI: Clear Analysis Context

## Security and Threat Notes
- Treat all extracted page content as untrusted input.
- Validate IPC payloads and clamp prompt/input sizes before llmGenerate.
- Default redaction should mask likely token/key/email/password patterns.
- Keep one-time unredacted override explicit and auditable in UX.
- Avoid leaking raw page secrets in logs or surfaced error text.

## Risks and Mitigations
- Risk: Huge pages causing long latency and token pressure.
  - Mitigation: staged extraction, relevance ranking, and bounded snippet cards.
- Risk: Dynamic pages returning stale answers.
  - Mitigation: snapshot TTL + invalidation on URL/reload + explicit refresh affordance.
- Risk: Weak grounding trust.
  - Mitigation: strict citation rendering, unsupported-claim refusal path, and confidence labels.
- Risk: UI complexity creep into full chat product.
  - Mitigation: keep scope to page summary/Q&A interactions only.

## Validation Architecture
- Quick checks after each task commit:
  - npm run typecheck
- Wave checks:
  - npm run lint
  - npm run typecheck
  - npm run build
- Phase checks:
  - Command and sidebar entry points both execute page analysis on active tab.
  - Summary and ask outputs include citation markers and snippet cards.
  - Extraction/LLM failures surface actionable guidance and retry path.
  - Cancellation, refresh, clear-context, and stale-warning flows work as specified.
  - Redaction policy excludes form values by default and supports one-time override confirmation.

## Planning Deliverables Expected
- Plan for contract and IPC/preload extension.
- Plan for main-process extraction/grounding/orchestration service.
- Plan for renderer AI panel + command palette integration and UX behavior.
- Plan for verification coverage of grounding, failures, cancellation, and staleness policies.

## Confidence
Medium-high. Current codebase already has LLM adapter and command/sidebar plumbing; the largest unknown is robust extraction quality across varied pages.

---
*Research completed: 2026-04-16*