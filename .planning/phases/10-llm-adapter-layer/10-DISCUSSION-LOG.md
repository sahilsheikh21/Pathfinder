# Phase 10: LLM Adapter Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves alternatives considered.

**Date:** 2026-04-15
**Phase:** 10-llm-adapter-layer
**Areas discussed:** Provider baseline, Adapter contract depth, Credential and provider config storage, Failure and fallback policy, Capability normalization model

---

## Provider baseline

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI + Ollama | One cloud plus one local provider, aligns with roadmap requirement and minimal coupling | ✓ |
| Anthropic + Ollama | Cloud/local baseline with different cloud vendor tradeoffs | |
| Gemini + Ollama | Cloud/local baseline with Google model ecosystem | |

**User's choice:** OpenAI + Ollama (recommended default applied autonomously)
**Notes:** Chosen to satisfy AI-01 quickly while keeping adapter interface extensible for additional cloud providers.

---

## Adapter contract depth

| Option | Description | Selected |
|--------|-------------|----------|
| Non-streaming core + capability flags | Stabilize base contract first, leave streaming/tools as explicit future capabilities | ✓ |
| Full streaming + tool-calls now | Broader immediate surface, higher implementation risk in first adapter phase | |
| Opaque provider passthrough | Fast start but weak normalization and harder downstream planning | |

**User's choice:** Non-streaming core + capability flags (recommended default applied autonomously)
**Notes:** Keeps Phase 10 focused on normalization and safe contract boundaries.

---

## Credential and provider config storage

| Option | Description | Selected |
|--------|-------------|----------|
| safeStorage secrets + local non-secret settings | Main-process encrypted keys, clear split between secret and non-secret config | ✓ |
| Plain local JSON for all config | Simpler but violates security expectations for API keys | |
| Renderer-local storage | Easiest UI path but breaks process boundary and secret safety model | |

**User's choice:** safeStorage secrets + local non-secret settings (recommended default applied autonomously)
**Notes:** Aligns with architecture and pitfalls guidance for secret leakage prevention.

---

## Failure and fallback policy

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-fast with typed errors | Deterministic behavior and easier diagnostics during adapter bring-up | ✓ |
| Auto-fallback across providers | Higher resilience but can hide root cause and complicate semantics | |
| Hybrid fallback policy | Flexible but increases policy complexity in first phase | |

**User's choice:** Fail-fast with typed errors (recommended default applied autonomously)
**Notes:** Auto-fallback deferred to later AI phases after baseline reliability is established.

---

## Capability normalization model

| Option | Description | Selected |
|--------|-------------|----------|
| Capability matrix in main | Explicit support flags per provider for downstream feature gating | ✓ |
| Ad-hoc branching in handlers | Quick but increases drift and coupling over time | |
| Least-common-denominator only | Simplifies shape but blocks provider-specific advantages | |

**User's choice:** Capability matrix in main (recommended default applied autonomously)
**Notes:** Supports incremental additions without breaking typed contracts.

---

## the agent's Discretion

- Internal adapter module decomposition under `src/main`.
- Timeout default and clamp constants.
- Exact redacted error wording.

## Deferred Ideas

- Cross-provider automatic fallback routing.
- Streaming output UI and tool-calling runtime.
- Executable AI sidebar chat behavior.

---

**Discussion mode note:** User did not provide interactive selections in this run; recommended defaults were applied autonomously to keep phase flow unblocked.
