<!-- GSD:project-start source:PROJECT.md -->
## Project

**Pathfinder**

Pathfinder is an AI-powered lightweight browser for Windows built on Electron and Chromium. It combines normal tabbed browsing with a command palette, automation recording/playback, and LLM-assisted agentic workflows so users can execute complex web tasks from natural-language intent. It is designed for users who want a browser that is both interactive and automatable.

**Core Value:** Users can reliably automate and delegate multi-step browser tasks from a single command-driven interface.

### Constraints

- **Platform**: Windows-first desktop delivery — target experience and packaging are prioritized for Windows
- **Engine**: Chromium via Electron — required for embeddability and CDP-based automation hooks
- **Language/Framework**: TypeScript and React — selected for maintainability and UI velocity
- **Architecture**: Local-first automation persistence — workflows, history, and settings stored on-device
- **Security**: Electron context isolation and safe IPC boundaries — required to reduce renderer risk
- **Usability**: Command-first interaction model — keyboard-driven control is a core product behavior
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack (Prescriptive)
| Layer | Package(s) | Version Guidance | Why This Choice |
|---|---|---|---|
| App shell | electron | 41.x (pin with `~`, e.g. `~41.2.0`) | Current Electron line with latest Chromium/Node security fixes; best control for browser-like UX. |
| Build/dev | electron-vite, vite, @vitejs/plugin-react | electron-vite 5.x, vite 8.x, plugin-react 6.x | Fast DX for React+TS in renderer and clear split for main/preload/renderer builds. |
| Packaging/update | electron-builder, electron-updater | builder 26.x, updater 6.x | Mature Windows installers + auto-update path; practical for Windows-first shipping. |
| Native module compatibility | @electron/rebuild | 4.x | Required safety net for Electron ABI rebuilds (critical for native deps on Windows). |
| UI runtime | react, react-dom, typescript | React 19.2.x, TS 6.0.x (fallback 5.9.x if plugin issues) | Stable modern React baseline and strong TS ergonomics for IPC/tooling-heavy app code. |
| Command + state | zustand, ninja-keys (or custom palette) | zustand 5.x, ninja-keys 1.2.x | Lightweight state and quick command-palette bootstrap; easy to replace with custom Apple-style UI later. |
| Automation engine | playwright-core | 1.59.x (pin exact minor across app) | Best fit for CDP attach to Chromium/Electron. Use `connectOverCDP` for in-app browser control. |
| LLM provider SDKs | openai, @anthropic-ai/sdk, @google/genai, ollama | openai 6.34.x, anthropic 0.88.x, google 1.50.x, ollama 0.6.x | Official SDKs reduce breakage risk vs wrappers. Supports cloud + local model routing from one adapter layer. |
| Schema/guardrails | zod | 4.3.x | Strict validation for tool calls, automation plans, and IPC payload contracts. |
| Local data | better-sqlite3, drizzle-orm | better-sqlite3 12.9.x, drizzle 0.45.x | Fast local-first SQLite path; Drizzle gives type-safe SQL without heavy ORM overhead. |
| Settings + secrets | electron-store + Electron safeStorage | store 11.x + built-in safeStorage | Keep preferences simple in JSON; encrypt API keys with OS-backed crypto (DPAPI on Windows). |
| Logging | pino | 10.x | Low-overhead structured logs for automation/LLM traceability. |
## Versioning Policy (Practical)
## Tradeoffs and Boundaries
- Electron + native modules gives maximum control, but increases release discipline (ABI rebuilds, signing, updater QA).
- `playwright-core` with CDP is ideal for your architecture, but `connectOverCDP` is lower fidelity than native Playwright protocol.
- `better-sqlite3` is very fast for local desktop usage, but synchronous calls can block if abused; move long queries to worker threads.
- Multi-provider SDK integration improves resilience and user choice, but requires strict adapter interfaces and model capability checks.
## What Not to Use (For This Project)
## Roadmap-Oriented Stack Rollout
- Electron 41 + electron-vite + React 19 + TS + secure IPC baseline.
- Add `electron-builder`, `electron-updater`, `@electron/rebuild` from day one.
- Introduce `playwright-core` + CDP bridge + automation schema validation (`zod`).
- Add structured logging (`pino`) for replay/debug traces.
- Add `better-sqlite3` + Drizzle for automations/history.
- Add `electron-store` for settings and `safeStorage` for encrypted credentials.
- Implement provider adapter over OpenAI/Anthropic/Google/Ollama SDKs.
- Enforce per-provider capability map and fallback routing.
## Confidence
| Area | Confidence | Notes |
|---|---|---|
| Electron shell + security posture | HIGH | Based on current Electron official docs and security checklist. |
| Automation stack (`playwright-core` + CDP) | HIGH | Official Playwright docs explicitly support CDP for Chromium. |
| Local data stack (`better-sqlite3`) | HIGH | Active project, current releases, widely used for local desktop SQLite. |
| Packaging path (`electron-builder`) | MEDIUM-HIGH | Mature and practical; still requires project-specific signing/update decisions. |
| Multi-provider LLM SDK set | MEDIUM | Official SDKs are strong, but model APIs evolve quickly; adapter must isolate churn. |
## Sources
- Electron docs (security, IPC, context isolation, native modules, safeStorage): https://www.electronjs.org/docs/latest/
- Playwright BrowserType/CDP docs: https://playwright.dev/docs/api/class-browsertype
- Electron Builder docs: https://www.electron.build/
- Electron Forge docs: https://www.electronforge.io/
- Official SDK repos: https://github.com/openai/openai-node, https://github.com/anthropics/anthropic-sdk-typescript, https://github.com/googleapis/js-genai
- SQLite library: https://github.com/WiseLibs/better-sqlite3
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.github/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
