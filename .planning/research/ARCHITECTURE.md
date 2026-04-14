# Architecture Patterns: Electron AI Automation Browser

**Domain:** Electron-based AI automation browser
**Researched:** 2026-04-14
**Confidence:** HIGH for Electron/Playwright/CDP boundaries, MEDIUM for some operational tuning choices

## Recommended Architecture

Use a **layered, event-driven desktop architecture** with strict process isolation:

1. Main process owns all privileged capabilities (window composition, tab/webContents lifecycle, CDP access, Playwright bridge, persistence, secrets).
2. Renderer process is UI-only (tab strip, command palette, sidebar, settings) and talks through a typed preload API.
3. Automation execution runs in a dedicated service boundary (main + utility process workers), never in renderer.
4. LLM adapters run behind a provider-neutral interface in main.
5. Persistence is local-first SQLite with append-only run history semantics.

This avoids coupling UI state to automation internals and keeps Electron security posture intact.

## Process and Component Boundaries

## 1) Main Process (Control Plane)

**Responsibility:** privileged orchestration and runtime authority.

### Components

- **AppLifecycleService**
  - Bootstraps app, windows, protocol/session policies, crash/restart hooks.
- **WindowCompositionService**
  - Creates primary BrowserWindow (app shell UI) and tab content container.
  - Uses WebContentsView for tab content composition (not BrowserView; BrowserView is deprecated).
- **TabRuntimeService**
  - Owns tab registry and active-tab pointer.
  - Owns each tab's WebContents lifecycle and navigation event subscriptions.
- **NavigationPolicyService**
  - Central allow/deny logic for navigation and window.open.
- **IpcGateway**
  - Single registration point for IPC handlers.
  - Enforces sender validation and payload schema validation.
- **AutomationOrchestrator**
  - Starts/stops recordings and runs workflows.
  - Schedules execution jobs, retries, cancellation, timeout policy.
- **CdpBridgeService**
  - Uses webContents.debugger attach/sendCommand for low-level CDP instrumentation.
  - Collects DOM/network/runtime signals used by recorder and LLM context builders.
- **PlaywrightBridgeService**
  - Provides playwright-core execution path for robust action playback.
  - Connects over CDP to Chromium endpoint when required for Playwright APIs.
- **LlmOrchestrator**
  - Tool-loop coordinator: prompt -> tool calls -> observation -> next action.
- **LlmProviderAdapters**
  - OpenAIAdapter, GeminiAdapter, AnthropicAdapter, OllamaAdapter (local).
  - Shared interface for completion/tool-calling/streaming.
- **WorkflowRepository / RunHistoryRepository / SettingsRepository**
  - SQLite access layer with migrations and typed DTO mapping.
- **SecretStoreService**
  - Stores API keys via OS-protected storage (safeStorage/keychain binding), not plain SQLite.
- **EventBus**
  - In-process domain events for decoupling orchestration from persistence/UI updates.

## 2) Renderer Process (Presentation Plane)

**Responsibility:** UI composition and user intent capture only.

### Components

- **WorkspaceShell**
  - App frame containing tab bar, command input trigger, sidebar layout.
- **TabStripViewModel**
  - Reflects tab metadata from main (title, favicon, loading state, audible, crashed).
- **CommandPaletteModule**
  - Command registry + fuzzy search + parameter parsing + execution dispatch.
- **SidebarModule**
  - Automation library, run history, AI chat panel, filter/sort UI.
- **SettingsModule**
  - Provider config, behavior toggles, shortcuts, automation defaults.
- **UiStateStore**
  - Local renderer state only (selection, panel visibility, active filters).

Renderer never receives raw Electron objects, only serialized DTOs via preload bridge.

## 3) Preload Layer (Boundary Contract)

**Responsibility:** least-privilege typed bridge between renderer and main.

Expose narrow methods only, for example:

- `tabs.create(input)`
- `tabs.navigate(tabId, url)`
- `automation.run(workflowId, inputs)`
- `automation.record.start(tabId)`
- `llm.generateWorkflow(prompt, scope)`
- `history.list(query)`
- `settings.get()` / `settings.update(patch)`
- `events.onRunUpdate(handler)`

Do not expose raw `ipcRenderer.on/send/invoke` directly.

## 4) Utility Process Workers (Execution Isolation)

Use utilityProcess workers for heavy or crash-prone tasks:

- HTML/DOM post-processing for selector generation.
- Long-running parse/transform tasks for workflow optimization.
- Optional local model-side pre/post transforms.

This keeps main responsive and isolates failure domains.

## Data Stores and Schemas

## SQLite (better-sqlite3)

Use WAL mode and explicit migration pipeline.

### Core tables

- `workflows`
  - id, name, description, created_at, updated_at, current_version
- `workflow_versions`
  - id, workflow_id, version, definition_json, created_at, created_by
- `runs`
  - id, workflow_id, workflow_version, trigger_type, status, started_at, ended_at, error
- `run_steps`
  - id, run_id, step_index, action, input_json, output_json, status, started_at, ended_at
- `settings`
  - key, value_json, updated_at
- `llm_profiles`
  - provider, model, temperature, tool_mode, updated_at
- `tab_snapshots` (optional for resume)
  - tab_id, url, title, serialized_state, captured_at

### Storage rules

- Workflow definitions are immutable per version.
- Run history is append-only.
- Secrets are references only; secret values stay in SecretStoreService.

## Event and IPC Contract Model

Use command/query/event separation.

### Commands (renderer -> main)

- mutate state or trigger side effects
- return command result envelope `{ ok, data?, error? }`

### Queries (renderer -> main)

- read-only and cacheable when possible

### Events (main -> renderer)

- push-only updates with stable event names and versioned payloads
- examples:
  - `tab.updated`
  - `automation.run.updated`
  - `automation.recording.event`
  - `llm.stream.chunk`

## Canonical Data Flows

## Flow A: Command palette action -> automation run

1. User executes command in renderer (e.g. `automation.run checkout-flow`).
2. Renderer sends typed IPC command `automation.run` with workflowId and inputs.
3. AutomationOrchestrator creates run record in SQLite (`runs` status=queued/running).
4. Orchestrator resolves execution engine:
   - CDP-only micro actions via CdpBridgeService, or
   - Playwright-powered actions via PlaywrightBridgeService.
5. Step-level progress emitted on EventBus and forwarded to renderer as `automation.run.updated`.
6. Step results persisted in `run_steps`.
7. Final run status persisted and pushed to sidebar/history UI.

## Flow B: Recording user actions -> workflow version

1. Renderer requests `automation.record.start(tabId)`.
2. CdpBridgeService attaches debugger to tab webContents and enables relevant CDP domains.
3. CDP events normalized into canonical action events (goto/click/fill/wait/assert).
4. Recorder deduplicates/noise-filters and builds intermediate action graph.
5. On stop, graph compiled to workflow JSON and persisted as new `workflow_versions` row.
6. Renderer receives summary with generated workflow id/version and preview.

## Flow C: LLM-assisted workflow generation

1. User prompt submitted from sidebar/chat.
2. LlmOrchestrator builds context package:
   - user prompt
   - active tab summary from CDP snapshot/accessibility data
   - command/tool schema
3. Selected provider adapter executes request (cloud or local).
4. Tool-calling loop drives actions through AutomationOrchestrator (bounded iterations).
5. Candidate workflow returned as structured JSON.
6. Validator checks schema, selector sanity, and forbidden actions.
7. If valid, persist as draft workflow version; emit to UI for review/run.

## Flow D: Startup hydration

1. Main boots services and loads settings/last state from SQLite.
2. WindowCompositionService initializes UI shell.
3. Renderer requests initial snapshots (tabs, settings, recent runs).
4. TabRuntimeService restores sessions/tabs if enabled.
5. Event subscriptions established before first user action.

## Security and Trust Boundaries

- Keep `contextIsolation: true`, sandbox on, nodeIntegration off for remote content.
- Validate every IPC sender frame origin where relevant.
- Restrict navigation and new-window creation with explicit allowlists.
- Treat all remote page content as untrusted.
- Never execute LLM-produced code directly; only allow declarative workflow JSON through validator.
- Keep API tokens out of renderer and out of plaintext DB.

## Architecture Patterns to Follow

## Pattern 1: Ports and Adapters for Automation + LLM

Define stable interfaces:

- `AutomationEnginePort.runStep(step, ctx)`
- `AutomationEnginePort.captureState(tabId)`
- `LlmProviderPort.generate(request)`

Implement adapters:

- `CdpAutomationAdapter`
- `PlaywrightAutomationAdapter`
- `OpenAiAdapter`, `GeminiAdapter`, `AnthropicAdapter`, `OllamaAdapter`

Result: provider/tool changes do not force UI or repository rewrites.

## Pattern 2: Event-sourced run telemetry (lightweight)

Persist each step transition as immutable run-step row.

Result: reliable debugging, replay, and analytics without reconstructing state from logs.

## Pattern 3: View composition with WebContentsView per tab

Main process owns tab content views and explicit bounds/layout updates.

Result: deterministic tab lifecycle, no renderer ownership confusion, cleaner crash recovery.

## Pattern 4: Typed IPC facade with schema validation

Use one API module in preload and one handler registry in main.

Result: predictable contracts and safer refactors.

## Build Order Implications (Phased Roadmap)

Build in dependency order. Do not start LLM or advanced automation until tab runtime + persistence + IPC contracts are stable.

## Phase 1: Foundations and safety rails

- Electron skeleton with strict webPreferences
- Preload typed bridge scaffold
- IpcGateway with schema validation and sender checks
- BaseWindow/BrowserWindow shell and empty UI renderer

**Exit criteria:** secure IPC round-trips and deterministic app boot.

## Phase 2: Tab runtime and view composition

- TabRuntimeService + tab registry
- WebContentsView-based tab content lifecycle
- Navigation events, title/favicon/loading synchronization
- New-window/navigation policy guards

**Exit criteria:** reliable create/close/switch tab operations with state events.

## Phase 3: Persistence substrate

- SQLite integration (better-sqlite3)
- migrations, repositories, WAL config
- settings and run-history persistence

**Exit criteria:** restart-safe state and query/update correctness tests.

## Phase 4: Command system and sidebar shell

- Command registry, parser, and palette UI
- Sidebar modules for workflows/history placeholders
- UI wired only through typed IPC endpoints

**Exit criteria:** command dispatch executes deterministic mock actions.

## Phase 5: CDP recorder core

- CdpBridgeService attach/detach lifecycle
- Recording pipeline normalize -> dedupe -> workflow JSON
- Persist workflow + versioning

**Exit criteria:** record basic user journeys into replayable workflow JSON.

## Phase 6: Execution engine with Playwright-core

- PlaywrightBridgeService connectOverCDP path
- Step executor, timeout/retry/cancel policy
- Run telemetry stream + persistence

**Exit criteria:** replay stored workflows with observable step outcomes.

## Phase 7: LLM adapter layer and guarded tool loop

- Provider adapters (cloud first + local Ollama)
- LlmOrchestrator with tool budget/guardrails
- Prompt-to-workflow draft generation + validation

**Exit criteria:** generate and run draft workflows with human approval gate.

## Phase 8: Hardening and operations

- utilityProcess offload for heavy transforms
- crash recovery, run resume strategy, backpressure controls
- observability (structured logs, metrics)
- packaging and update path

**Exit criteria:** stable long-running sessions and recoverable failures.

## Risks and Mitigations by Boundary

- **Risk:** UI blocks on heavy automation transforms.
  - **Mitigation:** move heavy transforms to utilityProcess workers.
- **Risk:** automation engine tightly coupled to one protocol.
  - **Mitigation:** maintain engine port interface with CDP and Playwright adapters.
- **Risk:** token leakage through renderer or logs.
  - **Mitigation:** secrets only in main-side secret store; structured log redaction.
- **Risk:** renderer/main contract drift.
  - **Mitigation:** versioned IPC schemas and contract tests.

## Implementation Notes for Immediate Execution

- Prefer WebContentsView composition over BrowserView/webview for tab surfaces.
- Keep TabRuntimeService authoritative for tab identity mapping (`tabId -> webContentsId`).
- Start with deterministic JSON workflow DSL before adding natural-language generation.
- Make run telemetry first-class early; it unlocks debugging and trust in automation.

## Sources

- Electron process model: https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron IPC and context isolation patterns: https://www.electronjs.org/docs/latest/tutorial/ipc
- Electron contextBridge API: https://www.electronjs.org/docs/latest/api/context-bridge
- Electron BrowserView deprecation note: https://www.electronjs.org/docs/latest/api/browser-view
- Electron WebContentsView API: https://www.electronjs.org/docs/latest/api/web-contents-view
- Electron BaseWindow/View composition and lifecycle: https://www.electronjs.org/docs/latest/api/base-window and https://www.electronjs.org/docs/latest/api/view
- Electron webview warning and alternatives: https://www.electronjs.org/docs/latest/api/webview-tag
- Electron Debugger API (CDP transport): https://www.electronjs.org/docs/latest/api/debugger
- Electron utilityProcess API: https://www.electronjs.org/docs/latest/api/utility-process
- Electron security checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Playwright connectOverCDP constraints: https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp
- Playwright CDPSession API: https://playwright.dev/docs/api/class-cdpsession
- SQLite WAL behavior and tradeoffs: https://www.sqlite.org/wal.html
- better-sqlite3 usage and WAL recommendation: https://github.com/WiseLibs/better-sqlite3
