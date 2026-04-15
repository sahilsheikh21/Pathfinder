# Phase 6: CDP Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves alternatives considered.

**Date:** 2026-04-15
**Phase:** 06-cdp-integration
**Areas discussed:** CDP attachment scope, session ownership and concurrency policy, bridge surface and layering, failure and recovery semantics, dependency footprint strategy

---

## CDP attachment scope

| Option | Description | Selected |
|--------|-------------|----------|
| Active-tab scoped target | Resolve to active tab and attach one target per session | ✓ |
| Explicit-tab required | Caller must always pass tab id before attach | |
| Broad attachment model | Attach across multiple tabs/targets in Phase 6 | |

**User's choice:** Active-tab scoped target
**Notes:** Recommended default applied to minimize ambiguity and align with current active-tab runtime model.

---

## Session ownership and concurrency policy

| Option | Description | Selected |
|--------|-------------|----------|
| Single-owner lock + reject-on-busy | Deterministic ownership, concurrent requests return busy response | ✓ |
| Queue pending sessions | Serialize requests with wait state and delayed start | |
| Force takeover | New request preempts existing owner | |

**User's choice:** Single-owner lock + reject-on-busy
**Notes:** Recommended default applied to satisfy collision-prevention success criteria with lowest implementation risk.

---

## Bridge surface and layering

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated bridge service + minimal typed IPC | Isolate CDP internals in main process and expose connect/disconnect/status only | ✓ |
| Inline handlers in main bootstrap | Keep all CDP logic directly in main.ts | |
| Broad raw-control IPC | Expose low-level CDP operations to renderer | |

**User's choice:** Dedicated bridge service + minimal typed IPC
**Notes:** Recommended default applied to match existing manager architecture and renderer safety boundaries.

---

## Failure and recovery semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-fast + typed disconnect reasons | No retries in Phase 6, explicit reason codes | ✓ |
| Retry-once then fail | Attempt one reconnect before disconnecting | |
| Auto-reconnect loop | Keep reconnecting until transport stabilizes | |

**User's choice:** Fail-fast + typed disconnect reasons
**Notes:** Recommended default applied to keep substrate deterministic before adding higher-level retry policies.

---

## Dependency footprint strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Add playwright-core only | Minimal dependency footprint for CDP bridge substrate | ✓ |
| Add full playwright package | Include bundled browser tooling now | |
| Defer dependency install | Design-only phase without package addition | |

**User's choice:** Add playwright-core only
**Notes:** Recommended default applied to align with project architecture direction and Phase 6 scope.

---

## the agent's Discretion

- Session id format and internal lifecycle telemetry format.
- Exact naming for bridge-private helper types.

## Deferred Ideas

- Concurrent automation queueing and priority arbitration.
- Automatic reconnect/backoff behavior.
- Recording/playback orchestration and workflow persistence details.
