# Phase 14 Research: Settings System

## Objective
Research a concrete implementation path for Phase 14 (`SET-01`, `SET-03`): a coherent settings surface with persistent general settings, privacy clear-data controls, global cookie-mode controls, and resilient validation/corruption recovery.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/STATE.md
- .planning/phases/14-settings-system/14-CONTEXT.md
- .planning/phases/14-settings-system/14-DISCUSSION-LOG.md
- .planning/phases/02-browser-core/02-CONTEXT.md
- .planning/phases/03-home-starter-page/03-CONTEXT.md
- .planning/phases/09-sidebar-and-history/09-CONTEXT.md
- .planning/phases/10-llm-adapter-layer/10-CONTEXT.md
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/main/main.ts
- src/main/homeStore.ts
- src/main/llm/providerConfigStore.ts
- src/renderer/App.tsx

## Locked Decision Constraints
- Implement one dedicated Settings surface with section navigation (General, Privacy, AI, Advanced).
- Keep one canonical settings model in main process and expose typed preload IPC APIs only.
- General defaults must remain stable with existing behavior: restore session, Home Starter homepage, ask-before-download.
- Clear-data must be bucketed, explicitly selectable, confirmed, and return per-bucket results.
- Cookie controls for v1 are global-only modes: allow all, block third-party, block all.
- Main process must validate before persistence and auto-repair corrupted persisted settings with a non-blocking user notice.

## Existing Architecture Findings

### 1) Persistence and corruption fallback patterns already exist and are production-ready
- `src/main/homeStore.ts` and `src/main/llm/providerConfigStore.ts` already implement robust read/validate/fallback/write cycles.
- This should be reused for a dedicated settings store rather than adding ad-hoc JSON handling in `main.ts`.

### 2) Typed IPC and preload boundary is established and consistent
- `src/shared/ipc.ts` + `src/preload/index.ts` are the canonical contract path for privileged capabilities.
- Adding settings APIs should follow the same pattern as home/LLM/sidebar preferences.

### 3) Main-process handler registration is centralized
- `src/main/main.ts` contains all IPC handler wiring and service lifecycle bootstrapping.
- Settings services should be instantiated in `createWindow()` and attached through explicit handlers.

### 4) Current settings are fragmented across domains
- Existing settings-like functionality is split across home preferences, sidebar preferences, and LLM provider settings.
- Phase 14 should add a canonical browser/privacy settings domain while preserving existing domain stores.

### 5) Renderer already has an AI/sidebar panel but no dedicated settings route/surface
- `src/renderer/App.tsx` is the best integration point for a first-pass Settings surface and command entry.
- Phase 14 can add a dedicated settings panel/modal without redesigning unrelated browser shell components.

## Recommended Technical Approach

### A) Contract-first settings domain model
- Add shared types in `src/shared/browser.ts` for:
  - `BrowserSettingsGeneral` (startup mode, homepage mode/value, downloads behavior/path)
  - `BrowserSettingsPrivacy` (cookie mode, clear-data bucket request/result)
  - `BrowserSettingsSnapshot`, `BrowserSettingsUpdateRequest`, and typed validation/repair metadata.
- Add typed IPC channels in `src/shared/ipc.ts`:
  - get settings snapshot
  - save general settings
  - save privacy settings
  - clear selected privacy buckets
  - get last repair/reset notice (if any)

### B) Dedicated main-process settings store/service
- Add `src/main/settingsStore.ts` with:
  - userData JSON file for canonical Phase 14 settings
  - strict validation and normalization for all incoming updates
  - corruption fallback to safe defaults and persisted repair metadata
  - helper methods returning deterministic typed error payloads
- Keep this store focused on `SET-01` and `SET-03`; do not absorb LLM config or theme shortcuts (Phase 15 scope).

### C) Privacy clear-data executor with deterministic per-bucket result map
- Add `src/main/privacyDataService.ts` (or equivalent helper) to execute clear-data requests via Electron session APIs.
- Map buckets to explicit clear operations:
  - history/download metadata (local app stores)
  - cookies/site data
  - cache/storage
  - app-local settings subsets
- Return per-bucket result with success/failure and redacted error message; no partial silent failures.

### D) Main/preload integration
- Wire settings service in `src/main/main.ts` and register typed IPC handlers with fallback responses when services are unavailable.
- Extend preload with typed wrappers to avoid renderer direct access to Electron/session internals.

### E) Renderer settings surface
- Add a dedicated settings panel/page component (for example `src/renderer/components/SettingsPanel.tsx`) and integrate in `App.tsx`.
- Implement sectioned navigation and forms for:
  - General: startup/homepage/download behavior
  - Privacy: cookie mode + clear-data bucket chooser and confirmation
- Show non-blocking repair notice when settings were auto-repaired.

## Security and Threat Notes
- All settings writes and clear-data actions are privileged and must remain in main process.
- Renderer-originating payloads are untrusted; validate and clamp before persistence.
- Clear-data actions are destructive: require explicit confirmation and scoped selection; no hidden one-click wipe.
- Return redacted errors over IPC to avoid leaking sensitive internal details.

## Risks and Mitigations
- Risk: Settings corruption causes startup regressions.
  - Mitigation: resilient read-path with defaults + last-known-good fallback and repair metadata.
- Risk: Destructive privacy operations clear more than intended.
  - Mitigation: strict bucket mapping and per-bucket confirmation/result reporting.
- Risk: Cookie mode changes unexpectedly break browsing.
  - Mitigation: global-only v1 cookie modes and explicit UI explanation before apply.
- Risk: Settings sprawl reintroduces fragmented state ownership.
  - Mitigation: maintain canonical Phase 14 settings store and typed boundary contracts.

## Validation Architecture
- Quick checks after each task commit:
  - `npm run typecheck`
- Wave checks:
  - `npm run lint; npm run typecheck`
- Phase checks:
  - `npm run build`
  - general settings persist and reload deterministically after restart
  - clear-data returns per-bucket success/failure summary
  - invalid payloads are rejected with typed validation errors
  - corrupted settings file auto-recovers with non-blocking repair notice

## Planning Deliverables Expected
- Plan for shared settings contracts and typed IPC/preload APIs.
- Plan for canonical settings store with validation and corruption recovery.
- Plan for privacy clear-data execution and global cookie mode controls.
- Plan for renderer settings surface and repair/confirmation UX.

## Confidence
Medium-high. Existing persistence and typed IPC patterns are strong; Phase 14 is mainly integration and product-surface consolidation with deterministic validation semantics.

---
*Research completed: 2026-04-16*