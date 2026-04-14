# Domain Pitfalls

**Domain:** AI-powered Electron browser with CDP automation and LLM control
**Project:** Pathfinder
**Researched:** 2026-04-14

## Critical Pitfalls (Prioritized)

### P0-1: Privilege breakout from untrusted web content into Electron capabilities
**What goes wrong:**
Remote page content (or XSS on a visited page) can reach privileged IPC/preload surfaces and execute local actions.

**Warning signs:**
- Any renderer/webview uses `nodeIntegration: true` for remote URLs.
- `contextIsolation` is off, or `webSecurity` is disabled in production.
- IPC handlers do not validate sender origin/frame.
- Raw Electron APIs are exposed to page JS.

**Prevention strategy (concrete + testable):**
1. Enforce secure defaults in one central window factory: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`.
2. Add allowlist checks for navigation and window creation (`will-navigate`, `setWindowOpenHandler`).
3. Validate sender on every privileged IPC call using parsed URL origin allowlist.
4. Expose only narrow preload APIs via `contextBridge` (no raw `ipcRenderer`).
5. Add an automated security smoke test that fails if any BrowserWindow/WebContentsView/webview violates these defaults.

**Likely roadmap phase(s):** 1, 2, 6, 10, 13, 16

---

### P0-2: LLM indirect prompt injection causing unsafe browser/tool actions
**What goes wrong:**
A web page (or file) injects hidden instructions that cause the agent to ignore user intent and execute high-risk automation.

**Warning signs:**
- Agent proposes actions unrelated to user request.
- Tool calls target new/untrusted domains not present in user request.
- Generated plans include exfiltration-like steps (copy cookies, export local files, send secrets).

**Prevention strategy (concrete + testable):**
1. Treat all page content as untrusted input; separate it from system policy text.
2. Force model output into a strict JSON action schema with deterministic validator.
3. Apply policy engine before execution: domain allowlist, action allowlist, argument validators.
4. Require explicit human approval for destructive/externalized actions (submit, purchase, delete, credential entry).
5. Add adversarial regression set: pages with hidden prompt-injection strings must never trigger blocked actions.

**Likely roadmap phase(s):** 10, 11, 12, 13

---

### P0-3: CDP ownership collisions and detach storms
**What goes wrong:**
Automation loses control mid-run because CDP/debugger ownership changes (for example, DevTools attach/detach behavior) or unstable reconnect handling.

**Warning signs:**
- Frequent `detach` events in automation logs.
- Runs fail only when developers open DevTools.
- Intermittent "target closed" / missing CDP events during long flows.

**Prevention strategy (concrete + testable):**
1. Implement single CDP owner service (`AutomationSessionManager`) with explicit lease/lock semantics.
2. Block or pause user DevTools while an agent run is active (or pause agent when DevTools opens).
3. Add reconnect/backoff policy with bounded retries and idempotent step replay.
4. Capture Playwright trace + CDP event ring buffer per failed run.
5. Add soak test: 100+ mixed navigation/action runs while toggling DevTools; failure rate threshold < 1%.

**Likely roadmap phase(s):** 6, 7, 8, 13

---

### P0-4: Browser embedding choice instability (`<webview>` in browser-style workload)
**What goes wrong:**
Heavy tabbed browsing + automation on `<webview>` can create focus, navigation, event-routing, and crash/recovery edge cases.

**Warning signs:**
- Elevated `render-process-gone` events.
- Focus/input bugs between host UI and page surface.
- Non-deterministic navigation event ordering.

**Prevention strategy (concrete + testable):**
1. Default to `WebContentsView` architecture for browser surfaces; avoid `<webview>` unless required.
2. If `<webview>` is used, enforce `will-attach-webview` hardening (strip preload, force secure prefs, URL allowlist).
3. Add crash recovery path: restore tab state and automation state after renderer loss.
4. Build a stability harness: open/close 50 tabs, mixed media/pages, run scripted interactions, assert zero unrecovered crashes.

**Likely roadmap phase(s):** 2, 6, 8

---

### P0-5: Automation profile/data-dir mistakes (shared or default profile usage)
**What goes wrong:**
Using default/shared browser data directories causes profile lock conflicts, non-deterministic state bleed, startup failures, and potential credential exposure.

**Warning signs:**
- "Profile in use" / lock-file startup failures.
- Different results between fresh and repeat runs with same task.
- Automation unexpectedly inherits user cookies/sessions.

**Prevention strategy (concrete + testable):**
1. Use dedicated automation profile root per environment and per run class.
2. Never point automation at a user’s default Chrome profile.
3. Add profile lifecycle policy: create, lock, rotate, clean expired profiles.
4. Add deterministic replay test: same script against same fixture site on clean profile must produce same outcome across N runs.

**Likely roadmap phase(s):** 6, 8, 14

---

### P0-6: Secret leakage through logs, traces, and local settings
**What goes wrong:**
LLM/API keys, auth headers, cookies, or user data leak via plaintext config, logs, traces, or support bundles.

**Warning signs:**
- Keys present in JSON settings files.
- Authorization headers visible in trace artifacts.
- Crash reports include prompt/context with secrets.

**Prevention strategy (concrete + testable):**
1. Store credentials using Electron `safeStorage` and keep only encrypted blobs at rest.
2. Add mandatory redaction middleware for logs/traces (headers, cookies, tokens, PII patterns).
3. Separate sensitive and non-sensitive telemetry channels; disable raw prompt dumps in production.
4. Add CI secret-scan gate over artifacts and app-data fixtures.
5. Add unit tests for redaction rules with known token formats.

**Likely roadmap phase(s):** 10, 14, 16

## High-Impact Pitfalls

### P1-1: LLM-generated selectors and actions are brittle in dynamic UIs
**What goes wrong:**
Agent emits CSS/XPath or index-based selectors that break under minor DOM changes.

**Warning signs:**
- Spikes in Playwright strict mode violations.
- Frequent `TimeoutError` on click/fill despite visible target.
- Fixes require manual selector edits after small UI changes.

**Prevention strategy (concrete + testable):**
1. Enforce selector policy: role/label/test-id first; CSS/XPath only as fallback.
2. Require each generated step to include an assertion (`toBeVisible`, `toHaveText`, etc.) before high-impact actions.
3. Add selector linting for generated plans (reject long chained CSS/XPath by rule).
4. Measure and track per-site action success rate; gate releases on regression threshold.

**Likely roadmap phase(s):** 7, 8, 12, 13

---

### P1-2: Missing execution guardrails for irreversible actions
**What goes wrong:**
Agent performs real-world side effects (purchase, publish, delete, submit) without explicit user checkpoint.

**Warning signs:**
- Single-turn requests trigger multi-step external side effects.
- No clear distinction between "analyze" and "execute" modes.
- Incident reports mention accidental submissions.

**Prevention strategy (concrete + testable):**
1. Two-phase runtime: `plan` then `execute`.
2. Add risk classifier for planned steps; force confirmation for high-risk categories.
3. Add dry-run mode with DOM highlight and predicted side-effect summary.
4. Add integration tests ensuring high-risk commands fail without approval token.

**Likely roadmap phase(s):** 12, 13

---

### P1-3: Windows update pipeline misconfiguration (target/channel/metadata mismatch)
**What goes wrong:**
App ships but update checks fail or users get stuck on bad versions due to metadata/channel mistakes.

**Warning signs:**
- Missing or malformed `latest.yml` artifacts.
- Duplicate downloads or update loops.
- Rollback attempts reuse same broken version number.

**Prevention strategy (concrete + testable):**
1. Standardize on NSIS + `electron-updater` for Windows desktop updates.
2. Add CI artifact validation: installer + metadata + checksum presence per channel.
3. Use staged rollout and enforce rollback rule: fix must ship as higher version.
4. Run packaged-app update E2E in CI (not dev-mode only), including interrupted-download recovery.

**Likely roadmap phase(s):** 16

---

### P1-4: Code-signing trust failures degrade install/update adoption
**What goes wrong:**
Unsigned or inconsistently signed builds trigger warnings/blocks and damage update trust.

**Warning signs:**
- "Unknown publisher" installer warnings.
- Update downloads succeed but install/replace fails due to signature issues.
- Different signatures across release artifacts.

**Prevention strategy (concrete + testable):**
1. Configure signing in CI (EV cert or Azure Trusted Signing) and fail build on unsigned output.
2. Verify signature + timestamp on every produced artifact before publish.
3. Keep certificate identity/config as code; add preflight check for required env vars.
4. Add release checklist gate requiring successful install on clean Windows VM.

**Likely roadmap phase(s):** 16

## Moderate Pitfalls

### P2-1: Schema drift in local settings and automation JSON history
**What goes wrong:**
Version upgrades break previously saved automations/settings due to incompatible schema changes.

**Warning signs:**
- App starts but fails loading saved runs after upgrade.
- "Unknown field" / parse errors in migration logs.
- Support tickets tied to upgrade paths, not fresh installs.

**Prevention strategy (concrete + testable):**
1. Add explicit schema versioning for settings and automation definitions.
2. Implement forward-only migrations with backups and rollback fallback.
3. Add migration test matrix for N-2 -> N and N-1 -> N sample datasets.
4. Expose "repair + export diagnostics" flow in settings.

**Likely roadmap phase(s):** 14, 16

---

### P2-2: Weak observability for agent failures
**What goes wrong:**
Cannot diagnose whether failure came from model planning, selector mismatch, CDP transport, or page behavior.

**Warning signs:**
- Generic "automation failed" errors without actionable cause.
- Repro requires manual guesswork.
- Mean-time-to-fix grows with each new site integration.

**Prevention strategy (concrete + testable):**
1. Attach run ID to every model call, CDP command, and Playwright action.
2. Persist compact run timeline with typed failure codes.
3. Auto-collect trace on retry/failure and provide in-app "copy diagnostics" action.
4. Add SLO: at least 90% of failures auto-classified into known buckets.

**Likely roadmap phase(s):** 8, 9, 13

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| 1-2 Browser shell | Insecure defaults and unsafe navigation surface | Lock secure BrowserWindow defaults + navigation/window allowlists before feature work |
| 6 CDP integration | Debugger attach conflicts and lifecycle leaks | Single CDP owner service + reconnect policy + stress tests |
| 7-8 Recording/playback | Brittle selector capture/replay | Role/test-id locator strategy + strict assertions + replay quality metrics |
| 10 LLM adapter | Secret handling and provider key leakage | `safeStorage` + redaction middleware + secret-scan gates |
| 11-13 AI analysis/agent | Prompt injection and excessive agency | Policy engine + structured plans + human approval for risky actions |
| 14 Settings/storage | Schema migration breakage | Versioned schemas + tested migrations + backup/restore |
| 16 Distribution | Signing/update pipeline regressions | Signed artifact verification + staged rollout + packaged update E2E |

## Sources

- Electron Security Checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Electron `<webview>` API warning and behavior: https://www.electronjs.org/docs/latest/api/webview-tag
- Electron Debugger API (`detach` behavior): https://www.electronjs.org/docs/latest/api/debugger
- Electron safeStorage API: https://www.electronjs.org/docs/latest/api/safe-storage
- Electron autoUpdater API + Windows notes: https://www.electronjs.org/docs/latest/api/auto-updater
- Electron update tutorial: https://www.electronjs.org/docs/latest/tutorial/updates
- Playwright `connectOverCDP` fidelity note + context/profile constraints: https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp
- Playwright auto-waiting/actionability: https://playwright.dev/docs/actionability
- Playwright locator stability guidance: https://playwright.dev/docs/locators
- Playwright trace viewer debugging: https://playwright.dev/docs/trace-viewer
- Chrome remote debugging security changes (non-default user-data-dir): https://developer.chrome.com/blog/remote-debugging-port
- OWASP GenAI LLM01 Prompt Injection (2025): https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- electron-builder Windows code-signing: https://www.electron.build/code-signing-win
- electron-builder auto-update behavior (NSIS + staged rollout): https://www.electron.build/auto-update
