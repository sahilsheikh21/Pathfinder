# Requirements: Pathfinder

**Defined:** 2026-04-14
**Core Value:** Users can reliably automate and delegate multi-step browser tasks from a single command-driven interface.

## v1 Requirements

### Browser Core

- [x] **BROW-01**: User can open, close, and switch between multiple tabs in one window.
- [x] **BROW-02**: User can navigate with back, forward, reload, and stop controls.
- [x] **BROW-03**: User can enter either a URL or search query in one address bar with correct routing.
- [x] **BROW-04**: User can recover active browsing session state after an unexpected crash.
- [x] **BROW-05**: User can download files with visible progress and configurable download path.

### Home and Command UX

- [x] **HOME-01**: User sees a custom home starter page on new tab with greeting and current date.
- [x] **HOME-02**: User can search the web from the home page using the configured default search engine.
- [x] **HOME-03**: User can launch quick links and recently used automations directly from the home page.
- [x] **CMD-01**: User can open a command palette via keyboard shortcuts and execute browser commands.
- [x] **CMD-02**: User can find commands using fuzzy search with command descriptions and argument hints.
- [x] **QSR-01**: User can toggle a quick-search popup window with a hotkey and dismiss it with Escape.
- [x] **QSR-02**: User can open quick-search results in the active browser tab.

### Automation Engine

- [x] **AUTO-01**: System can connect Playwright Core to Electron via CDP for controlled automation execution.
- [x] **AUTO-02**: User can record navigation, click, type, and wait actions into a structured JSON workflow.
- [ ] **AUTO-03**: User can replay saved automation workflows with variable prompts and runtime validation.
- [ ] **AUTO-04**: User can create, rename, delete, and tag saved automations in a local library.
- [ ] **AUTO-05**: User can view automation run history with status, duration, and failure reason.

### AI and Agentic Features

- [ ] **AI-01**: User can configure at least one cloud provider and one local provider for AI features.
- [ ] **AI-02**: User can ask AI about the current page and receive answers grounded in extracted page content.
- [ ] **AI-03**: User can request AI-generated automation drafts from natural-language prompts.
- [ ] **AI-04**: System requires explicit user approval before AI executes high-impact or irreversible actions.
- [ ] **AI-05**: User can run AI commands from the command palette with visible progress and cancellation.

### Sidebar, Settings, Privacy, and Delivery

- [ ] **SIDE-01**: User can open a sidebar with sections for saved automations, run history, and AI chat.
- [ ] **SET-01**: User can configure general browser settings (homepage, startup behavior, downloads path).
- [ ] **SET-02**: User can configure appearance settings (theme mode, font size, sidebar position).
- [ ] **SET-03**: User can configure privacy settings including clear-data controls and cookie preferences.
- [ ] **SET-04**: User can configure LLM settings (provider, model, endpoint, key management).
- [ ] **SET-05**: User can configure keyboard shortcuts for key browser and automation commands.
- [ ] **REL-01**: User can install Pathfinder on Windows via signed installer package.
- [ ] **REL-02**: Installed app can receive controlled updates with rollback-safe behavior.

## v2 Requirements

### Deferred Scope

- **V2-01**: User can sync browser state and automations across devices with account-based cloud sync.
- **V2-02**: User can install third-party extensions through a managed extension compatibility model.
- **V2-03**: User can design automations in a visual no-code workflow editor.
- **V2-04**: User can run autonomous long-horizon agent tasks without step-level confirmation.
- **V2-05**: User can use Pathfinder companion experiences on mobile platforms.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Gecko/Firefox embedding path | Not viable for required embedding + automation control model |
| CEF-based implementation for v1 | Added complexity and bundle overhead versus Electron path |
| Existing OSS browser reuse without deep fork/customization | Required command/automation/AI behavior needs architecture-level ownership |
| Full extension marketplace in v1 | High security and compatibility burden before core validation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BROW-01 | Phase 2 | Complete |
| BROW-02 | Phase 2 | Complete |
| BROW-03 | Phase 2 | Complete |
| BROW-04 | Phase 2 | Complete |
| BROW-05 | Phase 2 | Complete |
| HOME-01 | Phase 3 | Complete |
| HOME-02 | Phase 3 | Complete |
| HOME-03 | Phase 3 | Complete |
| CMD-01 | Phase 4 | Complete |
| CMD-02 | Phase 4 | Complete |
| QSR-01 | Phase 5 | Complete |
| QSR-02 | Phase 5 | Complete |
| AUTO-01 | Phase 6 | Complete |
| AUTO-02 | Phase 7 | Complete |
| AUTO-03 | Phase 8 | Pending |
| AUTO-04 | Phase 9 | Pending |
| AUTO-05 | Phase 9 | Pending |
| AI-01 | Phase 10 | Pending |
| AI-02 | Phase 11 | Pending |
| AI-03 | Phase 12 | Pending |
| AI-04 | Phase 13 | Pending |
| AI-05 | Phase 12 | Pending |
| SIDE-01 | Phase 9 | Pending |
| SET-01 | Phase 14 | Pending |
| SET-02 | Phase 15 | Pending |
| SET-03 | Phase 14 | Pending |
| SET-04 | Phase 10 | Pending |
| SET-05 | Phase 15 | Pending |
| REL-01 | Phase 16 | Pending |
| REL-02 | Phase 16 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-14*
*Last updated: 2026-04-15 after phase 7 execution*
