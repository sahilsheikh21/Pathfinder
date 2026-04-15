# Phase 10 Research: LLM Adapter Layer

## Objective
Research implementation approach for Phase 10 so planning can satisfy AI-01 by delivering a provider-neutral adapter that supports one cloud and one local provider, with secure credential handling and typed IPC boundaries.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/STATE.md
- .planning/phases/10-llm-adapter-layer/10-CONTEXT.md
- .planning/research/ARCHITECTURE.md
- .planning/research/STACK.md
- .planning/research/PITFALLS.md
- implementation_plan.md
- package.json
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/main/main.ts
- src/renderer/components/AutomationSidebar.tsx

## Locked Decision Constraints
- Provider baseline is fixed for this phase: OpenAI (cloud) + Ollama (local).
- Contract must be provider-neutral, non-streaming first, and return typed normalized errors.
- Secrets must remain in main process and be protected with safeStorage.
- Auto-fallback across providers is explicitly out of scope; fail-fast behavior is required.
- AI sidebar/chat remains non-executable placeholder in this phase.

## Existing Architecture Findings

### 1. No active LLM adapter implementation exists yet
- Current source tree has no provider service modules and no LLM channels in `src/shared/ipc.ts`.
- `src/renderer/components/AutomationSidebar.tsx` confirms AI section is placeholder-only.

### 2. IPC/preload patterns are stable and reusable
- `src/shared/ipc.ts` and `src/preload/index.ts` already provide a consistent typed request/response invocation model.
- `src/main/main.ts` centralizes handler registration, which is suitable for injecting LLM adapter endpoints.

### 3. Main-process ownership and local-first constraints are explicit
- Project constraints and prior phases reinforce that privileged operations belong in main process only.
- Existing stores (home/library/history) demonstrate local persistence and validation patterns we can reuse for non-secret provider settings.

### 4. Stack guidance and risk guidance are already documented
- `.planning/research/STACK.md` recommends official SDKs and safeStorage handling.
- `.planning/research/PITFALLS.md` identifies secret leakage for Phase 10 as a critical risk and prescribes redaction + safeStorage.

## Recommended Technical Approach

### A. Add typed adapter contracts first
- Extend shared contracts with provider-neutral request/response types, capability metadata, and typed error categories.
- Extend IPC surface with minimal LLM adapter methods: get/save config, validate config, and generate completion.

### B. Implement main-process provider adapter layer
- Introduce provider-specific adapter modules (OpenAI and Ollama) behind one internal interface.
- Add adapter router/orchestrator that resolves provider, validates capability, and normalizes provider output.

### C. Implement secure credential/config split
- Keep secret key material encrypted with safeStorage in main process.
- Persist non-secret provider metadata (provider id, model, endpoint, timeout) in local settings store.
- Add deterministic config-validation command before generation requests.

### D. Implement normalized failure semantics
- Map provider-specific failures to typed categories (`invalid-config`, `auth`, `network`, `timeout`, `quota`, `provider-error`, `unsupported-capability`).
- Return redacted diagnostics safe for renderer display and logs.

### E. Keep phase boundary strict
- Do not implement streaming UX, tool-calling loops, auto-fallback routing, or executable AI sidebar actions.
- Provide backend adapter foundation that later phases (11-13) can consume.

## Security and Threat Notes
- Treat all renderer-originating LLM config and request payloads as untrusted; validate in main process.
- Never persist API keys in plaintext settings files or renderer state.
- Add redaction at adapter error/log boundary to avoid key/header leakage.
- Keep provider endpoint overrides validated (scheme/host sanity + timeout clamps) to reduce abuse/misconfiguration.

## Risks and Mitigations
- Risk: SDK/version churn causing unstable provider behavior.
  - Mitigation: isolate SDK usage in adapter modules and pin versions in package.json.
- Risk: secret leakage through logs/errors.
  - Mitigation: safeStorage encryption, redaction middleware, typed safe diagnostics.
- Risk: over-scoping into chat UX and agent loops.
  - Mitigation: keep this phase contract/backend-focused per locked decisions.
- Risk: contract drift across main/preload/shared.
  - Mitigation: define shared types first, then wire main/preload against those types.

## Validation Architecture
- Quick checks after each task commit: `npm run typecheck`
- Wave checks: `npm run lint; npm run typecheck; npm run build`
- Phase checks:
  - LLM adapter supports one cloud (OpenAI) and one local (Ollama) provider via one normalized contract.
  - Secret credentials are stored/retrieved via safeStorage-backed path and are never exposed in renderer payloads.
  - Adapter returns typed normalized success/error shapes independent of provider.
  - AI sidebar remains non-executable in this phase.

## Planning Deliverables Expected
- Plan for shared LLM contracts and IPC/preload API extension.
- Plan for secure main-process provider config + secret handling service.
- Plan for provider adapters and normalized orchestration/error mapping.
- Plan for integration verification gates (lint/typecheck/build + targeted adapter checks).

## Confidence
Medium-high. Architecture and phase constraints are clear; main risk is initial SDK integration and secure secret lifecycle handling.

---
*Research completed: 2026-04-15*