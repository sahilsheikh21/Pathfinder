# Technology Stack

Project: Pathfinder
Researched: 2026-04-14
Scope: Windows-first AI-powered Electron browser (Chromium shell, automation, LLM, local data)

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

1. Electron and native-adjacent packages (`electron`, `better-sqlite3`, `@electron/rebuild`): pin with `~` and upgrade deliberately.
2. SDK/tooling packages (`openai`, `@anthropic-ai/sdk`, `@google/genai`, `playwright-core`): pin minor, review changelog before each bump.
3. Pure UI libraries: allow same-major updates (`^`) after CI + smoke checks.
4. Keep Playwright and your automation protocol code in lockstep per release branch.

## Tradeoffs and Boundaries

- Electron + native modules gives maximum control, but increases release discipline (ABI rebuilds, signing, updater QA).
- `playwright-core` with CDP is ideal for your architecture, but `connectOverCDP` is lower fidelity than native Playwright protocol.
- `better-sqlite3` is very fast for local desktop usage, but synchronous calls can block if abused; move long queries to worker threads.
- Multi-provider SDK integration improves resilience and user choice, but requires strict adapter interfaces and model capability checks.

## What Not to Use (For This Project)

1. `playwright` (full package) in runtime: unnecessary browser bundle overhead for an Electron-embedded browser.
2. `puppeteer` as primary automation layer: weaker fit vs your existing Playwright-core + CDP direction.
3. Heavy agent orchestration frameworks as core runtime dependency (early stage): adds indirection and token/debug overhead; start with a thin in-house adapter.
4. `nodeIntegration: true` for remote content, disabled `contextIsolation`, or disabled `webSecurity`: direct security regression in browser-like apps.
5. Renderer-stored API keys/localStorage secrets: keep credentials in main process and encrypt with `safeStorage`.

## Roadmap-Oriented Stack Rollout

1. Foundation phase
- Electron 41 + electron-vite + React 19 + TS + secure IPC baseline.
- Add `electron-builder`, `electron-updater`, `@electron/rebuild` from day one.

2. Automation phase
- Introduce `playwright-core` + CDP bridge + automation schema validation (`zod`).
- Add structured logging (`pino`) for replay/debug traces.

3. Data and settings phase
- Add `better-sqlite3` + Drizzle for automations/history.
- Add `electron-store` for settings and `safeStorage` for encrypted credentials.

4. LLM integration phase
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
