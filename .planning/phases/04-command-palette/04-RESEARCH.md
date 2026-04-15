# Phase 4 Research: Command Palette

## Objective
Research implementation approach for Phase 4 command palette so plans can deliver CMD-01 and CMD-02 while honoring locked decisions D-01 through D-14.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/STATE.md
- .planning/phases/04-command-palette/04-CONTEXT.md
- implementation_plan.md
- package.json
- src/renderer/App.tsx
- src/renderer/components/NavigationBar.tsx
- src/renderer/components/FrostedSurface.tsx
- src/renderer/lib/omnibox.ts
- src/renderer/styles/global.css
- src/shared/browser.ts
- src/shared/ipc.ts
- src/preload/index.ts
- src/main/main.ts
- copilot-instructions.md

## Decision Fidelity Constraints
- D-01 to D-04 require focused-window keyboard triggers, in-app modal overlay, and Escape-to-close behavior.
- D-05 to D-09 require browser-core command execution now, with future-safe extensible command registry.
- D-10 to D-14 require deterministic fuzzy matching, result metadata visibility, keyboard navigation, and query reset semantics.

## Existing Architecture Findings

### 1. Renderer is the correct host for phase-4 shortcut handling
- Current app shell already centralizes active tab state and action handlers in `src/renderer/App.tsx`.
- Existing command behavior can be composed from renderer handlers (`createTab`, `closeTab`, `navigate`, `back`, `forward`, `reload`, `stop`) without new IPC channels.
- App-window-scoped shortcuts (D-02) are naturally satisfied by renderer keydown listeners while focused.

### 2. Command registry can stay purely renderer-local for this phase
- No command execution path in Phase 4 requires new main-process side effects beyond already exposed `window.pathfinder` methods.
- Registry can be modeled as typed metadata + execute callback contract in renderer (`id`, `title`, `description`, `argumentHint`, `keywords`, `run`).
- Future automation/AI commands can be added as new registry entries without changing palette UI contract.

### 3. Fuzzy search should be implemented in-project (no new dependency)
- `package.json` currently has minimal dependencies (React only in runtime) and no fuzzy-match library.
- Deterministic policy in D-11 is straightforward with a small scorer:
  - score tier 0: prefix on title/id
  - score tier 1: token-word match on title/keywords
  - score tier 2: substring match on title/id/keywords
  - tie-breaker: alphabetical title
- Avoiding an external dependency keeps install/build stable for this phase and fits local deterministic requirement.

### 4. UI style should reuse existing token/frosted patterns
- Existing chrome and home surfaces already use tokenized frosted look in `src/renderer/styles/global.css` and `FrostedSurface`.
- Command palette should follow the same variables (`--pf-*`) and layered modal pattern (backdrop + elevated panel) to avoid visual drift.

## Recommended Implementation Structure

### A. Command model and fuzzy utility (new renderer lib)
- Create `src/renderer/lib/commandPalette.ts` with:
  - `CommandPaletteCommand` type
  - deterministic scorer and rank function
  - helper to build browser-core commands from active-tab context and callbacks
- Include command aliases/keywords for discoverability (`new`, `tab new`, `back`, `history back`, `goto`, `search`).

### B. Command palette component
- Create `src/renderer/components/CommandPalette.tsx`:
  - controlled query input
  - ranked result list with title/description/argument hint
  - highlighted selection index
  - keyboard controls: Up/Down/Enter/Escape
  - inline error surface when command execution fails

### C. App integration and shortcut lifecycle
- Extend `App.tsx` with:
  - palette open state + query reset on open
  - focused-window keydown listener for `Ctrl+Shift+P` and `Ctrl+K`
  - active-tab-aware command executor wiring
  - close-on-success / stay-open-on-failure behavior

### D. Styling additions
- Add `command-palette__*` classes in `src/renderer/styles/global.css` for:
  - backdrop, panel, input, result rows, active-row state, hint/error text
  - responsive width and max-height for desktop/laptop ranges

## Security Considerations
- Keep command execution within existing typed preload APIs; do not expose raw eval-like command execution paths.
- Validate active-tab presence before actions that require tab context.
- Ensure command arguments are treated as plain text and routed through existing resolver (`resolveOmniboxInput`) for `goto`/`search` semantics.

## Validation Architecture
- Per task quick check: `npm run typecheck`
- Per wave full check: `npm run lint; npm run typecheck; npm run build`
- Focus checks:
  - Shortcut open/close behavior (`Ctrl+Shift+P`, `Ctrl+K`, `Escape`)
  - Deterministic fuzzy ordering and keyboard selection
  - Command execution closes on success and shows inline error on failure

## Risks and Mitigations
- Risk: Shortcut collisions with input fields can trigger palette unexpectedly.
  - Mitigation: ignore global shortcut handling when focused element is editable unless explicitly desired.
- Risk: Fuzzy ranking ties feel unstable.
  - Mitigation: deterministic score tiers and stable alphabetical tie-break.
- Risk: Command handlers run without active tab context.
  - Mitigation: disable/guard tab-dependent commands and return explicit user-facing error.

## Deliverables Expected from Planning
- Plan wave for command registry and deterministic fuzzy engine.
- Plan wave for modal UI and keyboard navigation behaviors.
- Plan wave for App integration and execution/error semantics tied to CMD-01/CMD-02.
- Threat-model entries for shortcut handling, command argument routing, and API boundary trust.

## Confidence
High. Existing renderer/main boundaries and typed API surface already support this phase; required work is mainly renderer-level command modeling, interaction wiring, and token-aligned UI composition.

---
*Research completed: 2026-04-15*
