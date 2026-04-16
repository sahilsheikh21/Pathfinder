# Phase 12: AI Automation Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 12-ai-automation-generation
**Areas discussed:** Generation output shape and strictness, Preview and editing experience before approval, Command palette generation flow and cancellation UX, Approve actions and post-approval routing, Prompt input model for generation

---

## Generation output shape and strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Single strict candidate | Generate one primary draft and enforce strict schema validation pre-preview. | ✓ |
| Multi-candidate loose mode | Generate multiple alternatives with lighter upfront validation. | |
| Raw generation output | Show model output directly and validate only on approval. | |

**User's choice:** Single strict candidate with pre-preview schema conformance.
**Notes:** Chosen to align with existing strict playback validation and reduce invalid draft exposure.

---

## Preview and editing experience before approval

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar structured editor + optional JSON | Step-focused editor in AI sidebar with optional advanced raw view. | ✓ |
| Modal JSON-only editor | Dedicated modal showing only workflow JSON. | |
| Read-only preview | No editing before save/run. | |

**User's choice:** Sidebar structured editor with optional raw JSON view.
**Notes:** Keeps interaction in existing AI surface and supports both guided and advanced users.

---

## Command palette generation flow and cancellation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Command-first with explicit progress/cancel | Add generate/cancel commands with visible runtime states and retry path. | ✓ |
| Sidebar-only generation | Generation starts only from panel controls. | |
| Background generation with toast updates | Silent background run with minimal direct controls. | |

**User's choice:** Command-first flow with explicit progress and cancellation.
**Notes:** Preserves command-first product direction and existing AI command behavior patterns.

---

## Approve actions and post-approval routing

| Option | Description | Selected |
|--------|-------------|----------|
| Save Draft / Save and Run / Discard | Explicit triage actions after review. | ✓ |
| Auto-save draft | Persist generated draft immediately before review. | |
| Run now only | Skip persistent draft path. | |

**User's choice:** Explicit approval triad (Save Draft, Save and Run, Discard).
**Notes:** Maintains human-controlled execution boundary and clean post-approval routing.

---

## Prompt input model for generation

| Option | Description | Selected |
|--------|-------------|----------|
| Freeform + optional constraints | Natural-language prompt with optional structured hints. | ✓ |
| Strict template only | Force structured field entry before generation. | |
| Freeform only | Single text box without constraint fields. | |

**User's choice:** Freeform primary input plus optional structured constraints.
**Notes:** Balances ease of use with improved determinism for complex workflows.

---

## the agent's Discretion

- Exact UI microcopy for status/error messaging and clarification prompts.
- Exact layout implementation details for sidebar step editor and JSON advanced mode.
- Internal prompt-to-step heuristic strategy, constrained by strict schema and approval rules.

## Deferred Ideas

- Fully autonomous live execution without explicit user approval (Phase 13).
- Multi-candidate ranking/simulation workflow generation.

---

*Phase: 12-ai-automation-generation*
*Discussion logged: 2026-04-16*
