# Phase 1 Research: Project Scaffold

## Objective
Research implementation approach for Phase 1 scaffold of Pathfinder: Electron + TypeScript + React + build pipeline + Apple-style design foundation.

## Inputs Reviewed
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/STATE.md
- copilot-instructions.md
- implementation_plan.md
- .planning/research/SUMMARY.md
- .planning/research/STACK.md

## Recommended Scaffold Stack
- Electron 41.x
- electron-vite 5.x with Vite 8 and React plugin
- React 19 + TypeScript 6 (or 5.9 fallback)
- electron-builder 26 + electron-updater 6
- @electron/rebuild for native compatibility
- CSS variables and token-first styling setup compatible with Apple-style component scaffolding

## Project Layout
- src/main: Electron main process (window lifecycle, updater bootstrap, app events)
- src/preload: contextBridge API surface and typed IPC contracts
- src/renderer: React app shell, global styles, tokenized theme primitives
- scripts: helper scripts for dev/build/check/package
- resources: app icons and packaging assets placeholders

## Security Baseline in Phase 1
- BrowserWindow with contextIsolation true
- nodeIntegration false
- sandbox true where compatible
- preload-only bridge and no direct renderer Node access
- Typed and validated IPC channel definitions from start

## Build and Quality Baseline
- npm scripts: dev, build, typecheck, lint, package
- TS project references for main/preload/renderer
- Minimal CI command chain: npm run typecheck; npm run lint; npm run build

## Apple-style UI Foundation Guidance
- Introduce design tokens (colors, radii, spacing, blur layers) as CSS variables in renderer root
- Add base primitives for frosted surfaces, rounded controls, typography scale
- Keep phase 1 focused on foundation only; full component implementation starts later phases

## Risks and Mitigations
- Native module ABI mismatch on Windows -> include @electron/rebuild in postinstall and package flow
- Insecure preload API growth -> establish typed API module and channel whitelist now
- Tooling churn on TS 6 + plugins -> pin known-good versions and document fallback path

## Deliverables Expected from Planning
- Plan files that create scaffold config and process structure
- Explicit verification commands for build/typecheck/lint/package smoke
- Frontmatter with dependencies/waves and must_haves aligned to phase goal

## Confidence
High for stack and structure decisions, medium-high for exact package version pinning depending on current registry drift.

---
*Research completed: 2026-04-14*
