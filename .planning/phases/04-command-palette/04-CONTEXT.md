# Phase 4: Command Palette - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a keyboard-first command palette overlay for the existing browser shell. The phase covers opening/closing the palette through shortcuts, fuzzy command discovery with descriptions and argument hints, and execution of currently available browser actions.

</domain>

<decisions>
## Implementation Decisions

### Invocation and visibility
- **D-01:** Open the command palette from focused app windows with both `Ctrl+Shift+P` and `Ctrl+K`.
- **D-02:** Shortcuts are app-window scoped in this phase (no system-global shortcut while Pathfinder is unfocused).
- **D-03:** Palette appears as an in-app centered modal overlay above browser chrome and viewport.
- **D-04:** `Escape` closes the palette immediately without executing any command.

### Command registry and execution behavior
- **D-05:** Initial executable commands are browser-core actions available today: new tab, close active tab, back, forward, reload, stop, goto URL, and search query.
- **D-06:** Command execution must route through existing typed `window.pathfinder` APIs and existing navigation semantics.
- **D-07:** Successful command execution closes the palette and applies action to the active tab context.
- **D-08:** Failed command execution keeps the palette open and shows inline error feedback near results/input.
- **D-09:** Registry shape must be extensible for future automation and AI commands, but those commands remain out of execution scope in Phase 4.

### Fuzzy search and result rendering
- **D-10:** Fuzzy matching uses command label, command id, and keyword aliases.
- **D-11:** Ranking priority is deterministic: prefix match first, then token match, then substring match.
- **D-12:** Each result row shows command title, short description, and argument hint text when applicable.
- **D-13:** Keyboard interaction supports Up/Down selection and Enter execution.
- **D-14:** Palette query resets on reopen (no persisted query text across opens).

### the agent's Discretion
- Exact fuzzy scoring formula as long as ranking order and deterministic behavior are preserved.
- Exact visual motion timing (fade/scale) within existing tokenized style language.
- Whether command result list defaults to top 5 or top 7 visible entries before scroll.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 4 goal, CMD requirements mapping, and success criteria.
- `.planning/REQUIREMENTS.md` — CMD-01 and CMD-02 requirement definitions.
- `.planning/PROJECT.md` — command-first product direction and platform/security constraints.

### Product direction details
- `implementation_plan.md` — command palette command model and milestone breakdown.

### Existing implementation anchors
- `src/renderer/App.tsx` — active-tab state owner and renderer integration surface for overlays.
- `src/renderer/components/NavigationBar.tsx` — current navigation action semantics and omnibox behavior baseline.
- `src/renderer/lib/omnibox.ts` — existing input-to-target resolution utility for query/url flows.
- `src/shared/ipc.ts` — typed renderer API contract used by command actions.
- `src/preload/index.ts` — renderer-safe API exposure boundary.
- `src/main/main.ts` — main-process lifecycle and active browser runtime wiring.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/App.tsx`: already owns active tab identity and can host command-palette open state plus command dispatch integration.
- `src/renderer/components/FrostedSurface.tsx`: established frosted visual container pattern that fits palette modal treatment.
- `src/renderer/components/NavigationBar.tsx`: established browser action handlers that palette commands should reuse semantically.
- `src/renderer/lib/omnibox.ts`: reusable search/url resolution behavior for `search` and `goto` commands.

### Established Patterns
- Renderer uses typed preload API only (`window.pathfinder`), with no direct Electron API usage in renderer.
- Browser actions are tab-context-sensitive and always operate on active tab id.
- UI styling uses shared tokens and frosted surfaces with subtle depth, not heavy bespoke styling systems.

### Integration Points
- Palette overlay should mount in renderer app shell and consume active-tab context from `App.tsx`.
- Command executors should call existing navigation/tab APIs already wired through preload and IPC.
- Future automation/AI commands can be registered on the same command schema without changing palette interaction model.

</code_context>

<specifics>
## Specific Ideas

- Use a VS Code-style command palette interaction model with compact keyboard-first flow.
- Keep the visual direction aligned with existing frosted/tokenized browser UI rather than introducing a separate design language.
- Auto mode was used for this discussion pass; recommended defaults were selected to keep momentum.

</specifics>

<deferred>
## Deferred Ideas

- System-global hotkey behavior while app is unfocused (separate settings/hotkey phase concern).
- Executable automation and AI command actions (depends on later automation/AI phases).

</deferred>

---

*Phase: 04-command-palette*
*Context gathered: 2026-04-15*
