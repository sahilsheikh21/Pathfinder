# Phase 11: Page Analysis - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver AI summary and Q&A over the active page's content with grounded responses and lightweight citations. This phase includes entry points, extraction, grounding, and failure guidance for AI-02. It does not include automation generation, live agent execution, or persistent cross-session AI chat productization.

</domain>

<decisions>
## Implementation Decisions

### Entry Surfaces and Invocation
- **D-01:** Expose page analysis via both command palette and AI sidebar action.
- **D-02:** Provide two commands: `AI: Summarize Active Page` and `AI: Ask About Active Page`.
- **D-03:** Render answers in the AI sidebar panel (`ai-chat` section), and auto-open/focus that panel when command execution starts.
- **D-04:** Resolve target page from active tab at execution time.
- **D-05:** For Ask command input, allow optional inline query; if omitted, prompt in-panel before execution.
- **D-06:** Default summary mode is concise (5-8 bullets) with key takeaways first.
- **D-07:** Keep short in-memory context per active tab for follow-up Q&A during the current app session.

### Grounding and Citation Format
- **D-08:** Use inline citation markers in answer text and show snippet cards beneath the response.
- **D-09:** Target lightweight citation density (around 3-5 citations) with short snippets.
- **D-10:** Each citation card includes page title, URL, snippet index, and extraction snapshot timestamp.
- **D-11:** When grounding is insufficient, refuse unsupported claims and explain missing context.
- **D-12:** Snippets are lightly normalized for readability while preserving source meaning.
- **D-13:** Select snippets by semantic relevance to answer segments.
- **D-14:** Assistant may include extra non-page knowledge only when clearly labeled as non-page context.

### Page Content Extraction Scope
- **D-15:** Default extraction precedence: selected text first, then readable main content, then full-text fallback.
- **D-16:** Include structured context (title, URL, headings) alongside body text in extraction payload.
- **D-17:** Treat extraction as ready after load completion plus a short stability wait on dynamic pages.
- **D-18:** No hard extraction cap was chosen; send full extracted content in this phase.

### Failure Guidance Behavior
- **D-19:** Show actionable failures with cause and suggested next step.
- **D-20:** On transient provider failures, offer explicit manual retry (no silent auto-retry).
- **D-21:** For low-extractability pages, return partial answer plus explicit low-context warning.
- **D-22:** Support cancellable in-flight analysis with visible progress/cancel state.

### Privacy and Redaction Policy
- **D-23:** Apply automatic redaction/masking for likely secrets and sensitive values before provider requests.
- **D-24:** Use the same redaction policy for cloud and local providers.
- **D-25:** Exclude form/input values from extracted payload by default.
- **D-26:** Allow one-time unredacted override behind explicit warning confirmation.

### Conversation Invalidation Rules
- **D-27:** Reset per-tab analysis context on URL change or hard reload.
- **D-28:** For same-URL dynamic pages, keep context but mark snapshot potentially stale after a short window.
- **D-29:** Expose explicit clear-context action in both AI panel and command surface.
- **D-30:** On stale snapshot follow-ups, warn user and offer quick re-extract action.

### Snapshot Refresh Strategy
- **D-31:** Reuse snapshot by default for follow-up questions, with conditional/manual refresh.
- **D-32:** Auto-refresh triggers: URL change, stale-warning acceptance, or explicit user refresh action.
- **D-33:** Use short freshness TTL (about 1-2 minutes) before stale warning on dynamic pages.
- **D-34:** Expose `Refresh page context` in both AI panel and command palette.

### Answer Style Controls
- **D-35:** Ask-mode output defaults to direct answer first, then concise supporting bullets.
- **D-36:** Provide concise/detailed verbosity toggle.
- **D-37:** Include light confidence label in responses.
- **D-38:** Summary-mode output uses fixed sections: Key Points, Risks/Gaps, Next Actions.

### the agent's Discretion
- Exact UX copy for warnings, retry prompts, and confidence labels.
- Exact extraction TTL constant within the chosen short-window policy.
- Exact citation card visual layout and spacing within existing sidebar styles.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and Requirement Anchors
- `.planning/ROADMAP.md` - Phase 11 goal, AI-02 mapping, and success criteria.
- `.planning/REQUIREMENTS.md` - AI-02 requirement wording and traceability context.
- `.planning/PROJECT.md` - command-first UX and security/process boundary constraints.
- `.planning/STATE.md` - current phase sequencing and completed baseline through phase 10.

### Product Direction
- `implementation_plan.md` - original page-analysis intent and AI milestone framing.

### Prior Locked Decisions to Carry Forward
- `.planning/phases/10-llm-adapter-layer/10-CONTEXT.md` - explicit provider selection, typed fail-fast errors, and provider contract boundaries.
- `.planning/phases/04-command-palette/04-CONTEXT.md` - command-first invocation and command UX behavior.
- `.planning/phases/09-sidebar-and-history/09-CONTEXT.md` - sidebar section model and cross-surface command/UI behavior patterns.

### Existing Code Anchors
- `src/shared/browser.ts` - current LLM request/response contracts and shared types.
- `src/shared/ipc.ts` - typed IPC channels and API surface to extend.
- `src/preload/index.ts` - renderer-safe bridge exposure pattern.
- `src/main/main.ts` - LLM handler registration and runtime wiring point.
- `src/main/browserRuntime.ts` - active-tab targeting and URL/state lifecycle hooks.
- `src/main/cdpBridge.ts` - connected-page access pattern and failure semantics.
- `src/main/llm/llmAdapterService.ts` - provider-neutral generation flow.
- `src/main/llm/providers/openaiAdapter.ts` - OpenAI adapter behavior and error mapping.
- `src/main/llm/providers/ollamaAdapter.ts` - Ollama adapter behavior and error mapping.
- `src/renderer/lib/commandPalette.ts` - command definitions and execution model.
- `src/renderer/App.tsx` - AI sidebar state and command integration points.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing provider-neutral LLM pipeline is in place (`llmGenerate`, validate/config flows).
- Renderer already has AI sidebar state, command execution hooks, and busy-state patterns.
- Browser runtime exposes active tab resolution and tab lifecycle events needed for invalidation.
- CDP bridge exposes connected page access pattern that can inform robust extraction behavior.

### Established Patterns
- Privileged logic remains in main process; renderer uses typed preload APIs only.
- Command-first interaction model is primary, with sidebar/UI as complementary surface.
- Error contracts are typed and user-facing messages are redacted/actionable.
- Existing phase decisions favor deterministic behavior and explicit user control.

### Integration Points
- Extend shared contracts for page-analysis request/response, citations, progress, and cancellation.
- Add extraction and grounding orchestration service in main process near existing LLM service layer.
- Wire command palette actions to new analysis APIs and sidebar result rendering.
- Hook invalidation and refresh logic to tab URL lifecycle updates from browser runtime.

</code_context>

<specifics>
## Specific Ideas

- Keep response grounding strict by default, while allowing clearly labeled non-page additions when needed.
- Preserve fast command-driven flow by auto-focusing the AI panel on execution.
- Treat stale context as recoverable with one-click re-extract rather than hard-blocking normal usage.

</specifics>

<deferred>
## Deferred Ideas

- Persistent unredacted override in global settings (deferred to settings-focused phases).
- Persistent cross-session page-analysis conversation history beyond session memory (future AI UX phase).

</deferred>

---

*Phase: 11-page-analysis*
*Context gathered: 2026-04-16*
