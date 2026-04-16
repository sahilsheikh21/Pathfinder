# Phase 14: Settings System - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the user-facing settings system for general browser and privacy behavior. This phase covers startup/homepage/download configuration persistence, clear-data controls, cookie preference controls, and validation/recovery for invalid or corrupted settings.

</domain>

<decisions>
## Implementation Decisions

### Settings information architecture
- **D-01:** Implement a dedicated Settings surface in renderer with sectioned navigation (General, Privacy, AI, Advanced), instead of scattering controls across existing panels.
- **D-02:** Keep AI provider controls available in Settings while preserving quick operational access from existing sidebar commands.
- **D-03:** Use one canonical settings data model in main process and typed preload IPC APIs for all settings reads/writes.

### General behavior settings
- **D-04:** Startup default is restore last session, with alternatives for open home page and open custom startup URL list.
- **D-05:** Homepage default remains Home Starter, with configurable custom homepage URL option.
- **D-06:** Downloads default to ask-every-time, with optional fixed default path and validation before persistence.
- **D-07:** General settings changes persist across restarts and apply on next relevant event (startup/navigation/download initiation).

### Privacy controls
- **D-08:** Provide bucketed clear-data flow with explicit selectable scopes: downloads/history metadata, cookies/site data, cache/storage, and app-local settings subsets.
- **D-09:** Clear-data actions require explicit confirmation and return a per-bucket result summary.
- **D-10:** Cookie control in v1 is global mode only: allow all, block third-party, block all.
- **D-11:** Per-site cookie exceptions are deferred beyond Phase 14.

### Validation and corruption recovery
- **D-12:** Validate all incoming settings in main process before persistence; reject invalid payloads with typed error details.
- **D-13:** On corrupted persisted config, auto-repair to safe defaults or last-known-good values and continue app operation.
- **D-14:** Surface non-blocking notification when repair/reset occurred so users understand why values changed.

### the agent's Discretion
- Exact layout details for Settings page sections and forms.
- Exact copywriting for confirmation dialogs and validation errors.
- Internal file/module split for settings stores, as long as typed IPC boundaries and recovery behavior remain consistent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements and boundary
- `.planning/ROADMAP.md` - Phase 14 goal, requirements (`SET-01`, `SET-03`), and success criteria.
- `.planning/REQUIREMENTS.md` - definitions for `SET-01` and `SET-03` and adjacent settings requirements.
- `.planning/PROJECT.md` - product constraints (local-first persistence, secure IPC boundary, Windows-first desktop behavior).

### Existing settings/persistence contracts
- `src/shared/browser.ts` - current preference-related types (`HomePreferences`, sidebar/LLM config contracts) and extension points for new settings types.
- `src/shared/ipc.ts` - typed IPC channel map and Pathfinder API surface where settings channels are added.
- `src/preload/index.ts` - renderer-safe settings API exposure pattern.

### Existing implementation anchors
- `src/main/main.ts` - current sidebar/home/LLM settings handlers and local preference read/write patterns in main process.
- `src/main/homeStore.ts` - validated local settings persistence with corruption fallback for home preferences and quick links.
- `src/main/llm/providerConfigStore.ts` - provider-scoped config normalization and persistent settings validation pattern.
- `src/renderer/App.tsx` - current settings-adjacent UI state flows (sidebar prefs, AI config) and integration point for Settings surface.

### Related behavior context
- `.planning/phases/02-browser-core/02-CONTEXT.md` - download prompt/default-path and session restore decisions to preserve.
- `.planning/phases/03-home-starter-page/03-CONTEXT.md` - home search template and homepage behavior expectations.
- `.planning/phases/09-sidebar-and-history/09-CONTEXT.md` - existing preference persistence model and local storage conventions.
- `.planning/phases/10-llm-adapter-layer/10-CONTEXT.md` - existing AI configuration and secure storage expectations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/homeStore.ts`: robust local JSON store with validation and corruption fallback semantics.
- `src/main/llm/providerConfigStore.ts`: normalized config patch/merge logic and update timestamp model.
- `src/main/main.ts`: existing IPC registration and preference persistence helpers for sidebar/home/LLM.
- `src/shared/ipc.ts` + `src/preload/index.ts`: typed contract + bridge pattern for extending settings APIs safely.

### Established Patterns
- Main process owns persistence and validation; renderer consumes typed preload APIs only.
- Invalid persisted data currently falls back to defaults rather than crashing.
- Preferences are local-first and stored under userData-backed JSON files.

### Integration Points
- Add a dedicated settings store/service in main and wire channels into existing IPC registration.
- Extend shared contracts with settings schemas and typed validation errors.
- Add renderer Settings surface and connect to preload APIs for fetch/save/repair status.
- Connect privacy clear-data actions to Electron session/data APIs while preserving current app lifecycle behavior.

</code_context>

<specifics>
## Specific Ideas

- User intent implies browser-wide quality expectations; this phase should provide a coherent, trustworthy settings UX rather than fragmented controls.
- Preserve existing defaults where already established (restore session, ask-before-download, Home Starter baseline) unless user explicitly changes them.
- Keep privacy actions explicit and auditable (scope selection + result summary), not silent one-click destructive operations.

</specifics>

<deferred>
## Deferred Ideas

- Per-site cookie exceptions and advanced site-permission matrices.
- Full browser-wide visual/interaction polish sweep beyond settings scope (belongs to dedicated polish/debug phase).
- Global system-wide shortcut remapping (covered primarily in Phase 15).

</deferred>

---

*Phase: 14-settings-system*
*Context gathered: 2026-04-16*
