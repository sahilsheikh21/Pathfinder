# Phase 6 Research: CDP Integration

## Objective
Research implementation approach for Phase 6 CDP integration so plans can deliver AUTO-01 while honoring locked decisions D-01 through D-14 from the phase context.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/STATE.md
- .planning/phases/06-cdp-integration/06-CONTEXT.md
- implementation_plan.md
- package.json
- src/main/main.ts
- src/main/browserRuntime.ts
- src/shared/ipc.ts
- src/shared/browser.ts
- src/preload/index.ts
- copilot-instructions.md

## Decision Fidelity Constraints
- D-01 to D-03 require single-target session attachment with active-tab default resolution.
- D-04 to D-06 require single-owner lock semantics and deterministic ownership release conditions.
- D-07 to D-09 require dedicated bridge service with narrow typed IPC surface and no raw CDP exposure to renderer.
- D-10 to D-12 require fail-fast behavior and stable typed failure/disconnect reason categories.
- D-13 and D-14 require `playwright-core` dependency and strict substrate-only scope in this phase.

## Existing Architecture Findings

### 1. Main process is the correct boundary for CDP ownership and Playwright lifecycle
- `src/main/main.ts` already owns privileged runtime managers and `ipcMain.handle` registration.
- Renderer currently interacts through preload-only API boundaries, so CDP internals belong in main.
- A dedicated bridge manager module matches existing manager-based architecture patterns.

### 2. Active-tab runtime already provides the right substrate for target resolution
- `src/main/browserRuntime.ts` owns tab identity and active-tab transitions.
- Phase 6 can avoid renderer authority over CDP target selection by resolving target tab from runtime state in main.
- Small accessor methods on runtime are sufficient to support bridge target lookup.

### 3. Typed IPC contract pattern is already stable and reusable
- `src/shared/ipc.ts` and `src/preload/index.ts` provide established request/response patterns.
- Phase 6 can introduce explicit channels for `automation:connect`, `automation:disconnect`, and `automation:getStatus` with strict payload typing.
- No event-stream bus is required yet; polling status via typed method is adequate for substrate phase.

### 4. Dependency and build posture supports Playwright Core addition
- `package.json` currently has no automation dependency installed.
- Adding `playwright-core` (without bundled browsers) aligns with implementation plan constraints and keeps install size controlled.
- Existing verification commands (`npm run lint; npm run typecheck; npm run build`) remain applicable.

## Recommended Technical Approach

### A. CDP endpoint strategy
- Configure Electron to expose a local CDP endpoint through fixed configurable port: `PATHFINDER_CDP_PORT` default `9222`.
- Initialize endpoint switch in main process startup path before app ready.
- Bridge connects through `chromium.connectOverCDP("http://127.0.0.1:${port}")`.

### B. Dedicated automation bridge service
- Create `src/main/cdpBridge.ts` with one exported factory/class managing:
  - connect (owner + optional tab target)
  - disconnect (session)
  - getStatus
  - shutdown
- Keep single-owner lock in memory with explicit states: `idle`, `connecting`, `connected`, `disconnected`, `error`.

### C. Deterministic concurrency policy
- Reject concurrent connect when lock held with typed `busy` reason.
- Never auto-queue or force preempt in Phase 6.
- Release lock only on explicit disconnect, target teardown, fatal bridge error, or app shutdown.

### D. Typed API contracts for controlled execution boundary
- Add shared request/response/status types in `src/shared/browser.ts`.
- Add typed IPC channels and preload methods only for connect/disconnect/status.
- Return stable error categories: `busy`, `missing-target`, `attach-failed`, `disconnected`, `invalid-session`.

## Security Considerations
- Maintain renderer isolation: no raw CDP sockets, targets, or debugger calls exposed outside main process.
- Require typed owner identity in connect requests for auditability and collision diagnostics.
- Validate resolved target tab exists before attach; return typed failure instead of fallback attach to arbitrary page.
- Ensure bridge shutdown is called on app quit to prevent lingering CDP connection handles.

## Validation Architecture
- Quick checks per task: `npm run typecheck`
- Wave gate checks: `npm run lint; npm run typecheck; npm run build`
- Focus checks for Phase 6:
  - connect succeeds when active tab exists and lock is free
  - second concurrent connect returns typed busy error
  - disconnect releases lock and status returns idle/disconnected
  - target-missing path returns typed missing-target error

## Risks and Mitigations
- Risk: CDP endpoint configuration mismatch in dev/prod startup paths.
  - Mitigation: centralize endpoint and port construction in main startup and bridge factory input.
- Risk: session lock leaks on unexpected failures.
  - Mitigation: guarded state transitions + finalizers in disconnect/shutdown paths.
- Risk: over-scoping Phase 6 into recording/playback concerns.
  - Mitigation: keep API limited to connect/disconnect/status and defer automation actions to later phases.

## Deliverables Expected from Planning
- Plan for dependency + typed contract additions.
- Plan for runtime target-access helpers and bridge service implementation.
- Plan for main-process wiring, lifecycle cleanup, and verification path.
- Threat-model entries covering ownership spoofing, collision handling, and boundary exposure.

## Confidence
Medium-high. Phase 6 is additive and aligns with existing typed IPC/main-runtime architecture, with moderate risk centered on CDP endpoint lifecycle and lock-state correctness.

---
*Research completed: 2026-04-15*