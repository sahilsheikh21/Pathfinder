# Phase 10: LLM Adapter Layer - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Normalize provider access for cloud and local LLM models behind one typed contract, including secure credential/config handling and pre-request validation. This phase does not implement page-QA UX, automation generation UX, or live agent execution behavior.

</domain>

<decisions>
## Implementation Decisions

### Provider baseline
- **D-01:** Phase 10 ships one cloud provider and one local provider: OpenAI (cloud) plus Ollama (local).
- **D-02:** Provider choice is explicit per request/config; no implicit provider switching.
- **D-03:** Keep adapter surface provider-neutral so Anthropic/Gemini can be added without breaking the contract.

### Adapter contract depth
- **D-04:** Define a typed provider-neutral request/response contract in shared types and IPC, with normalized outputs.
- **D-05:** Phase 10 contract is non-streaming completion-first with explicit capability flags for future streaming/tool features.
- **D-06:** Return typed error categories (`invalid-config`, `auth`, `network`, `timeout`, `quota`, `provider-error`, `unsupported-capability`) instead of provider-native raw errors.

### Credential and provider config storage
- **D-07:** Store API keys/secrets encrypted via Electron `safeStorage` in main process only.
- **D-08:** Store non-secret provider settings (selected provider, model, endpoint/base URL, timeout) in local app settings; never persist secrets in renderer state.
- **D-09:** Add provider config validation and a deterministic connection check path before first generation call.

### Failure and fallback policy
- **D-10:** Use fail-fast behavior in Phase 10; do not auto-fallback across providers.
- **D-11:** Surface redacted, actionable diagnostics with provider id, typed reason, retryable flag, and safe message.
- **D-12:** Apply one bounded timeout policy across adapters with sane defaults and clamped overrides.

### Capability normalization model
- **D-13:** Maintain a provider capability matrix in main process (for example: streaming support, JSON mode support, tool-call support, system-role support).
- **D-14:** Treat model identifiers as provider-scoped strings; no cross-provider alias layer in Phase 10.
- **D-15:** Keep AI sidebar/chat user actions non-executable in this phase; expose adapter through typed IPC/internal invocation only.

### the agent's Discretion
- Exact internal file/module split for adapter services (single module vs per-provider modules) as long as typed boundaries stay clear.
- Exact timeout default value and retry backoff constants within the selected fail-fast policy.
- Exact wording of redacted user-facing error messages.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and product constraints
- `.planning/ROADMAP.md` — Phase 10 goal, requirement mapping (`AI-01`), and success criteria.
- `.planning/REQUIREMENTS.md` — `AI-01` and `SET-04` requirement intent and traceability context.
- `.planning/PROJECT.md` — local-first, command-first, and main-process security constraints.
- `implementation_plan.md` — milestone definition for provider adapter layer and provider mix (cloud + local).

### Architecture and security guidance
- `.planning/research/ARCHITECTURE.md` — provider-neutral adapter pattern in main process, typed preload boundary, and LLM orchestration direction.
- `.planning/research/STACK.md` — recommended SDK stack (`openai`, `ollama`) and safeStorage guidance.
- `.planning/research/PITFALLS.md` — Phase 10 secret leakage and provider-key risk mitigations.

### Existing implementation anchors
- `src/shared/browser.ts` — shared contract style and extension point for new LLM request/response types.
- `src/shared/ipc.ts` — typed channel naming and Pathfinder API expansion pattern.
- `src/preload/index.ts` — renderer-safe invoke wrapper pattern.
- `src/main/main.ts` — centralized IPC registration and privileged service wiring model.
- `src/renderer/components/AutomationSidebar.tsx` — AI section currently placeholder-only, confirming no chat execution in this phase.
- `package.json` — current dependency baseline (LLM SDKs not yet present).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/ipc.ts`: established typed channel/API contract pattern for adding LLM adapter endpoints.
- `src/preload/index.ts`: stable contextBridge wrappers for extending renderer-safe API access.
- `src/main/main.ts`: centralized handler wiring where adapter services can be registered and guarded.
- `src/main/homeStore.ts` and phase-9 main stores: local file-backed persistence and validation patterns reusable for non-secret LLM preferences.

### Established Patterns
- Privileged operations run in main process only; renderer accesses capabilities through typed preload APIs.
- The project is local-first and command-first, with strict typed boundaries across process edges.
- Sidebar AI area is intentionally non-executable today, which supports backend-first adapter delivery in this phase.

### Integration Points
- Add new shared LLM adapter types and IPC channels in `src/shared`.
- Add provider adapter services and secret/config handling modules under `src/main`.
- Register new LLM adapter IPC handlers in `src/main/main.ts` and expose wrappers in `src/preload/index.ts`.
- Keep renderer integration minimal for Phase 10 (config/testing invocation surfaces only, no full chat workflow).

</code_context>

<specifics>
## Specific Ideas

- Use OpenAI as the first cloud baseline and Ollama as the first local baseline to satisfy `AI-01` while minimizing first-pass complexity.
- Keep provider failures explicit and typed rather than hidden by automatic fallback so debugging and safety posture stay deterministic.
- Preserve the existing process-isolation model: keys/secrets never cross into renderer state.

</specifics>

<deferred>
## Deferred Ideas

- Automatic cross-provider fallback routing.
- Streaming token/event UX and full tool-calling loop behavior.
- Executable AI chat actions in sidebar (beyond placeholder).

None of the deferred items change Phase 10 boundary; they remain candidates for later AI phases (11-13).

</deferred>

---

*Phase: 10-llm-adapter-layer*
*Context gathered: 2026-04-15*
