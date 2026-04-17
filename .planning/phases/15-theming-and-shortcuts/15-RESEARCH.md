# Phase 15 Research: Theming and Shortcuts

## Objective
Research a concrete implementation path for Phase 15 (`SET-02`, `SET-05`): appearance personalization (theme mode, font size, sidebar position/visual preferences) and editable shortcut bindings with conflict handling.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/STATE.md
- .planning/phases/15-theming-and-shortcuts/15-CONTEXT.md
- .planning/phases/14-settings-system/14-CONTEXT.md
- .planning/phases/09-sidebar-and-history/09-CONTEXT.md
- .planning/phases/04-command-palette/04-CONTEXT.md
- .planning/phases/05-quick-search-popup/05-CONTEXT.md
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/main/settingsStore.ts
- src/renderer/App.tsx
- src/renderer/theme.ts
- src/renderer/styles/tokens.css
- src/renderer/styles/global.css
- src/renderer/components/SettingsPanel.tsx
- src/renderer/lib/commandPalette.ts
- src/renderer/components/BrowserTabStrip.tsx

## Locked Decision Constraints
- Default theme mode is `system`.
- In `system` mode, theme must live-sync with OS theme changes while app is open.
- Theme mode changes should apply with subtle transition (~120-180ms).
- Theme preference should move to Settings as canonical source of truth (not renderer-only localStorage).
- Phase scope includes appearance + shortcut customization only; do not introduce unrelated capability expansion.

## Existing Architecture Findings

### 1) Canonical settings ownership already exists in main process
- `src/main/settingsStore.ts` already provides validated persistence, corruption recovery, and typed save flows for general/privacy settings.
- Phase 15 should extend this canonical model with appearance + shortcut settings, rather than introducing separate renderer-local stores.

### 2) Typed IPC/preload settings contract is established and extensible
- `src/shared/ipc.ts` + `src/preload/index.ts` already define and expose typed `settings*` operations.
- Phase 15 can safely add appearance/shortcut settings endpoints in this same contract path.

### 3) Theme primitives exist but are currently renderer-local
- `src/renderer/theme.ts` already supports `light|dark|system`, root-class toggling, and persistence to localStorage.
- This is a strong migration base: keep `applyTheme` as renderer utility, but source the mode from canonical settings snapshot.

### 4) Shortcuts are hardcoded in renderer keydown flow
- `src/renderer/App.tsx` currently handles fixed `Ctrl+Shift+S`, `Ctrl+Shift+P`, and `Ctrl+K` bindings.
- Editable shortcuts require replacing hardcoded key checks with a normalized binding map and conflict validator.

### 5) Sidebar preference infrastructure exists but lacks side/visual personalization
- Existing `AutomationSidebarPreferences` supports collapsed/width/section state, but no sidebar side/position or appearance tuning fields.
- Phase 15 should extend this preference contract while preserving backward compatibility and defaults.

### 6) Font sizing is mostly static CSS values today
- `src/renderer/styles/global.css` contains many fixed `font-size` declarations.
- A global scale token strategy (CSS custom property multiplier or semantic text-size variables) is needed for immediate + persistent user-controlled font-size updates.

## Recommended Technical Approach

### A) Contract-first extension for appearance + shortcuts
- Extend shared settings domain types in `src/shared/browser.ts` with:
  - appearance settings: `themeMode`, `fontScalePreset`, `sidebarPosition`, visual density/tone flags as needed for `SET-02`.
  - shortcut settings: command-to-binding map for core commands in `SET-05`.
- Keep explicit validation error types for invalid bindings and conflicts.

### B) Main-process canonical persistence and validation
- Extend `src/main/settingsStore.ts` normalization/validation logic with appearance + shortcut sections.
- Add migration-safe defaults so existing settings files upgrade without breaking.
- Keep corruption recovery behavior consistent with Phase 14 (safe defaults + repair notice).

### C) Settings IPC/preload expansion
- Add typed IPC channels for save/get of appearance + shortcuts or expand existing snapshot/save methods to include these fields.
- Keep renderer behind preload boundary; no direct Electron access for settings.

### D) Renderer integration path
- Add Appearance and Shortcuts subsections in `src/renderer/components/SettingsPanel.tsx`.
- In `src/renderer/App.tsx`, hydrate appearance + shortcuts from canonical settings snapshot at open/load and app bootstrap.
- Use `src/renderer/theme.ts` as renderer application utility only (apply classes, not source-of-truth persistence).

### E) Shortcut conflict handling model
- Build normalized accelerator representation (case-insensitive, order-normalized modifiers).
- Enforce uniqueness among editable core commands.
- Reject save when duplicate/conflicting bindings detected; return typed validation errors for inline UX display.
- Keep app-window-scoped shortcuts in Phase 15 (consistent with prior decisions and current runtime).

### F) Font-size implementation model
- Prefer preset scale steps (for example small/medium/large) mapped to CSS variables for deterministic behavior and easier testing.
- Apply scale immediately on change via root variables and persist through canonical settings.

## Security and Threat Notes
- Shortcut and settings payloads are untrusted renderer input; validate entirely in main process.
- Never execute arbitrary command IDs from shortcut payloads; allowlist supported core command targets.
- Avoid leaking sensitive internal details in validation errors sent over IPC.

## Risks and Mitigations
- Risk: Theme migration breaks existing localStorage behavior.
  - Mitigation: one-time migration read from renderer localStorage fallback, then canonicalize into settings store.
- Risk: Shortcut conflicts create unusable command flows.
  - Mitigation: conflict detection before persistence + reset-to-defaults option.
- Risk: Font scaling causes layout overflow/regressions.
  - Mitigation: bounded preset scales and shell-level regression checks at each preset.
- Risk: Sidebar position changes conflict with existing narrow-window overlay behavior.
  - Mitigation: preserve existing responsive thresholds; position preference applies in non-overlay states only.

## Validation Architecture
- Quick checks after each task commit:
  - `npm run typecheck`
- Wave checks:
  - `npm run lint; npm run typecheck`
- Phase checks:
  - `npm run build`
  - theme mode applies immediately and persists across relaunch
  - system mode reacts to OS theme change without restart
  - font-size preset changes apply immediately and persist
  - sidebar position preference updates layout in supported viewport states
  - shortcut edits persist and conflict handling blocks duplicates with clear validation errors

## Planning Deliverables Expected
- Plan for appearance/shortcut contract expansion in shared types + IPC/preload APIs.
- Plan for settings store validation/persistence extension with migration-safe defaults.
- Plan for settings UI sections (Appearance + Shortcuts) and immediate renderer application wiring.
- Plan for shortcut normalization/conflict engine and editable command binding coverage.

## Confidence
Medium-high. Existing typed settings and IPC foundations are mature; primary complexity is consistent shortcut conflict semantics and robust font-scale integration across existing CSS.

---
*Research completed: 2026-04-17*
