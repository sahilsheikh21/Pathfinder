# Phase 8: Automation Playback - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves alternatives considered.

**Date:** 2026-04-15
**Phase:** 08-automation-playback
**Areas discussed:** Playback session and target binding, Variable prompt and secret handling, Runtime validation and timeout controls, Failure policy and run semantics

---

## Playback session and target binding

| Option | Description | Selected |
|--------|-------------|----------|
| Active-tab default + optional explicit tab id | Reuses current browser targeting model and keeps invocation simple. | ✓ |
| Always require explicit tab id | Strong explicitness but adds friction to command usage. | |
| Multi-tab fanout execution | Higher complexity and out of current phase scope. | |

**User's choice:** Active-tab default + optional explicit tab id.
**Notes:** Chosen to align with existing runtime and command-first flow.

---

## Variable prompt and secret handling

| Option | Description | Selected |
|--------|-------------|----------|
| Preflight collect all variables, secrets in-memory only | Deterministic start and avoids mid-run blocking prompts. | ✓ |
| Prompt lazily at each step | Simpler runner internals but creates run interruptions. | |
| Persist resolved values for reuse | Faster reruns but higher security risk for secret handling. | |

**User's choice:** Preflight collect all variables with in-memory-only secret handling.
**Notes:** Preserves security and deterministic execution.

---

## Runtime validation and timeout controls

| Option | Description | Selected |
|--------|-------------|----------|
| Start-of-run schema validation plus per-step runtime validation | Strong guardrails and clear failure boundaries. | ✓ |
| Start-of-run validation only | Lower overhead but less protection against malformed runtime state. | |
| Trust inputs from recorder without validation | Fastest path but unsafe and brittle. | |

**User's choice:** Start-of-run schema validation plus per-step runtime validation.
**Notes:** Matches AUTO-03 reliability target.

---

## Failure policy and run semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Stop on first error only | Simplest behavior and easy debugging. | |
| Support stop and continue policies, default stop | Meets requirement for policy-based stop/continue behavior. | ✓ |
| Continue on error always | Higher completion rate but hides critical failures by default. | |

**User's choice:** Support stop and continue policies with stop as default.
**Notes:** Return partial-failure result when continue policy is used and one or more steps fail.

---

## the agent's Discretion

- Exact command argument grammar for selecting workflow and policy values.
- Exact playback progress UI copy and formatting in command palette feedback.
- Internal module split for playback runner internals.

## Deferred Ideas

- Sidebar run-history and automation library management UX (Phase 9).
- Visual workflow editor and advanced recovery presets.

---

*Non-interactive run note:* No explicit interactive selections were provided in this invocation; recommended defaults were applied to keep phase flow moving.
