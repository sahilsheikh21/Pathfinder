# Phase 6: CDP Integration - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce the automation substrate by connecting Playwright Core to Electron via a managed CDP bridge, with explicit session ownership rules and a safe typed IPC surface. This phase does not implement recording, playback, or automation library UX.

</domain>

<decisions>
## Implementation Decisions

### CDP attachment scope
- **D-01:** Phase 6 attaches automation to one resolved tab target per session, not to all tabs.
- **D-02:** Target resolution defaults to the current active tab when no explicit tab id is provided.
- **D-03:** The resolved target is locked at connect time for that session to keep ownership deterministic.

### Session ownership and collision policy
- **D-04:** Use a single-owner lock for CDP automation sessions in the main process.
- **D-05:** When a second connect request arrives while locked, reject it with a structured busy response instead of queueing or force-taking ownership.
- **D-06:** Ownership is released only on explicit disconnect, target destruction, fatal bridge loss, or app shutdown cleanup.

### Bridge layering and typed surface
- **D-07:** Implement a dedicated main-process CDP bridge service module to encapsulate attach/detach/status behavior.
- **D-08:** Expose a minimal typed IPC contract for CDP connect/disconnect/status only in Phase 6.
- **D-09:** Keep raw debugger and endpoint internals in main process only; renderer receives status and error metadata, never low-level CDP control.

### Failure and recovery semantics
- **D-10:** Connection and attach failures are fail-fast in Phase 6 (no automatic retry loop).
- **D-11:** If the attached target is destroyed or unavailable, the bridge transitions to disconnected with a typed reason code.
- **D-12:** Return stable typed error categories for collision, missing target, attach failure, and unexpected disconnect.

### Dependency footprint and phase limits
- **D-13:** Add `playwright-core` as the automation dependency for this phase, without browser-bundle dependencies.
- **D-14:** Keep Phase 6 scope to substrate only; recording/playback features remain in Phases 7 and 8.

### the agent's Discretion
- Exact internal session id format and clock source for ownership tracking.
- Internal logging verbosity and log message wording for bridge lifecycle transitions.
- Minor naming choices for bridge helper types, as long as typed contract boundaries stay explicit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 6 goal, AUTO-01 mapping, and success criteria.
- `.planning/REQUIREMENTS.md` — AUTO-01 requirement definition and traceability target.
- `.planning/PROJECT.md` — platform constraints, Electron architecture, and security baseline.
- `implementation_plan.md` — automation architecture direction for Playwright + CDP integration.

### Existing runtime and contract anchors
- `src/main/main.ts` — main-process lifecycle, IPC registration style, and managed singleton wiring pattern.
- `src/main/browserRuntime.ts` — active-tab targeting model and tab lifecycle events relevant to CDP ownership.
- `src/shared/ipc.ts` — typed IPC channel naming and API contract extension point.
- `src/preload/index.ts` — renderer-safe bridge exposure pattern.
- `src/shared/browser.ts` — shared type location for new CDP status and error payload contracts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/main.ts`: centralizes singleton manager creation and `ipcMain.handle` registration, suitable for adding a CDP bridge service.
- `src/main/browserRuntime.ts`: already owns active-tab semantics and tab lifecycle state that CDP targeting should reuse.
- `src/shared/ipc.ts`: current typed contract model for request/response APIs.
- `src/preload/index.ts`: existing pattern to expose safe typed methods to renderer via `window.pathfinder`.

### Established Patterns
- Renderer is isolated from Electron internals and only uses preload-exposed APIs.
- Main process owns privileged runtime control and long-lived managers.
- IPC contracts are explicit and shared through `src/shared` types.

### Integration Points
- Add CDP bridge manager initialization and teardown in `src/main/main.ts` alongside other managers.
- Extend shared IPC contracts and preload bridge with CDP connect/disconnect/status methods.
- Resolve active tab identity through existing browser runtime state when no explicit target is provided.

</code_context>

<specifics>
## Specific Ideas

- Keep the first CDP bridge intentionally strict and deterministic so later recording/playback layers build on a stable substrate.
- Prior phases established an app-scoped control model; Phase 6 continues that pattern by keeping CDP ownership in main process only.
- No explicit area selections were provided in this session, so recommended defaults were applied to keep phase flow moving.

</specifics>

<deferred>
## Deferred Ideas

- Multi-owner session queueing or preemption policy.
- Automatic reconnect/backoff behavior for transient transport failures.
- Recording and playback semantics, variable prompts, and workflow persistence.

</deferred>

---

*Phase: 06-cdp-integration*
*Context gathered: 2026-04-15*
