# Pathfinder

## What This Is

Pathfinder is an AI-powered lightweight browser for Windows built on Electron and Chromium. It combines normal tabbed browsing with a command palette, automation recording/playback, and LLM-assisted agentic workflows so users can execute complex web tasks from natural-language intent. It is designed for users who want a browser that is both interactive and automatable.

## Core Value

Users can reliably automate and delegate multi-step browser tasks from a single command-driven interface.

## Requirements

### Validated

- ✓ Electron + React + TypeScript scaffold with secure preload IPC baseline — Phase 1
- ✓ Tokenized Apple-style renderer shell foundation with theme mode switching — Phase 1
- ✓ CI quality gate baseline (lint, typecheck, build) and packaging config scaffold — Phase 1

### Active

- [ ] Chromium-based desktop browser shell with tabs, address bar, and navigation
- [ ] Command palette for browser actions, automation commands, and AI commands
- [ ] Quick search popup window with hotkey toggle and dismiss behavior
- [ ] Automation engine with record, save, and replay using structured JSON workflows
- [ ] Sidebar for saved automations, run history, and AI chat operations
- [ ] LLM integration layer supporting cloud and local providers
- [ ] Home starter page with search, quick links, and automation shortcuts
- [ ] Settings system for browser behavior, appearance, privacy, LLM, and automation defaults
- [ ] Windows packaging and distribution pipeline

### Out of Scope

- Gecko/Firefox embedding — no viable modern embeddable API compared to Chromium pathways
- Building on an existing browser without deep customization — required feature set demands custom implementation
- CEF/C++ implementation for v1 — complexity is disproportionate to current goals
- Mobile app clients in initial release — focus is Windows desktop browser first

## Context

The project is based on prior research comparing browser engine and framework options. Chromium was selected for embeddability and automation compatibility, with Electron chosen for deep browser control, CDP access, and ecosystem maturity. The product direction includes Comet-style agentic browsing, but implemented as explicit capabilities phased over milestones (core shell, automation, AI integration, polish/distribution).

Current state: Phase 1 is complete. The project now has a runnable Electron app scaffold, typed IPC bridge, tokenized UI baseline, and CI checks. The next focus is implementing Browser Core behavior in Phase 2.

## Constraints

- **Platform**: Windows-first desktop delivery — target experience and packaging are prioritized for Windows
- **Engine**: Chromium via Electron — required for embeddability and CDP-based automation hooks
- **Language/Framework**: TypeScript and React — selected for maintainability and UI velocity
- **Architecture**: Local-first automation persistence — workflows, history, and settings stored on-device
- **Security**: Electron context isolation and safe IPC boundaries — required to reduce renderer risk
- **Usability**: Command-first interaction model — keyboard-driven control is a core product behavior

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Chromium instead of Gecko | Chromium has mature embedding and automation pathways; Gecko embedding is not practical | — Pending |
| Use Electron as primary shell | Deep browser control, CDP integration, and JavaScript ecosystem fit product scope | — Pending |
| Build custom browser rather than adapting existing OSS browser as-is | Required AI + automation features need architecture-level control | — Pending |
| Stage delivery by milestone (Core, Automation, AI, Polish) | Reduces integration risk and enables incremental validation | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via /gsd-transition):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via /gsd-complete-milestone):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-14 after Phase 1 completion*
