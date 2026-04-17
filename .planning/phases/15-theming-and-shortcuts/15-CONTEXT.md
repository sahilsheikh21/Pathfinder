# Phase 15: Theming and Shortcuts - Context

**Gathered:** 2026-04-17T10:34:08.059Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver appearance personalization and keyboard shortcut customization for Pathfinder. This phase covers configurable theme and visual preferences plus editable core shortcut bindings with conflict handling, without adding unrelated new browser capabilities.

</domain>

<decisions>
## Implementation Decisions

### Theme behavior model
- **D-01:** Default theme mode is `system` for new users.
- **D-02:** In `system` mode, Pathfinder should live-sync when OS theme changes while the app is open.
- **D-03:** Theme changes use a subtle transition (~120-180ms), not a hard instant switch.
- **D-04:** Theme preference control moves to Settings (Appearance) as canonical source of truth.

### the agent's Discretion
- Font-size personalization model details (preset choices and exact scaling strategy) were not explicitly discussed; choose a standards-aligned approach that satisfies `SET-02` and is consistent with existing tokenized CSS patterns.
- Sidebar position configuration details (left/right behavior across breakpoints) were not explicitly discussed; choose a deterministic responsive behavior aligned with existing sidebar architecture.
- Shortcut customization scope and exact conflict-resolution UX were not explicitly discussed; implement for core browser and automation commands with clear conflict detection/resolution to satisfy `SET-05`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements and constraints
- `.planning/ROADMAP.md` - Phase 15 goal, requirement IDs (`SET-02`, `SET-05`), and success criteria.
- `.planning/REQUIREMENTS.md` - settings and shortcuts requirement definitions.
- `.planning/PROJECT.md` - command-first, local-first, secure Electron constraints.

### Prior decisions to carry forward
- `.planning/phases/14-settings-system/14-CONTEXT.md` - settings architecture and canonical settings ownership in main process.
- `.planning/phases/09-sidebar-and-history/09-CONTEXT.md` - sidebar default behavior and persisted sidebar preference patterns.
- `.planning/phases/04-command-palette/04-CONTEXT.md` - command-first keyboard interaction expectations.
- `.planning/phases/05-quick-search-popup/05-CONTEXT.md` - app-scoped shortcut precedent and keybinding behavior.

### Existing code anchors
- `src/renderer/theme.ts` - current theme mode model and localStorage persistence baseline.
- `src/renderer/styles/tokens.css` - theme token variables and dark-mode root class handling.
- `src/renderer/styles/global.css` - font-size and shell visual styling baseline.
- `src/renderer/App.tsx` - current keyboard event handling and fixed shortcut wiring.
- `src/renderer/components/SettingsPanel.tsx` - existing settings surface where Appearance controls should be integrated.
- `src/renderer/lib/commandPalette.ts` - command catalog for shortcut-customizable command targets.
- `src/renderer/components/BrowserTabStrip.tsx` - visible shortcut hint strings that must remain consistent with user-configured shortcuts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/theme.ts`: already provides theme mode read/apply/persist primitives.
- `src/renderer/styles/tokens.css`: already maps theme classes to token sets.
- `src/renderer/components/SettingsPanel.tsx`: existing settings IA can host Appearance section additions.
- `src/renderer/lib/commandPalette.ts`: centralized command IDs useful for shortcut mapping targets.

### Established Patterns
- Current theme persistence is renderer-local (`localStorage`) and should be aligned with canonical settings architecture introduced in Phase 14.
- Shortcuts are currently app-window scoped and hardcoded in renderer `keydown` handlers.
- UI styling is tokenized CSS with frosted-shell conventions and many explicit font-size declarations in `global.css`.

### Integration Points
- Extend shared settings contracts and main-process settings store for appearance and shortcuts persistence.
- Wire preload + IPC APIs so renderer consumes typed appearance/shortcut settings via canonical settings snapshot.
- Refactor existing hardcoded shortcut handler in `App.tsx` to use configurable bindings and conflict-safe updates.

</code_context>

<specifics>
## Specific Ideas

No additional stylistic references were provided beyond the locked decisions above.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 15-theming-and-shortcuts*
*Context gathered: 2026-04-17T10:34:08.059Z*
