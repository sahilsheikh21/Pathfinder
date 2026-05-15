# Pathfinder — AI-Powered Lightweight Browser for Windows

## Research Summary

Extensive research was conducted on engine choices, existing open-source browsers, automation frameworks, and AI-agentic browser paradigms (like Perplexity's Comet). This plan synthesizes all findings.

---

## 1. Engine Choice: Chromium vs Firefox (Gecko)

> [!IMPORTANT]
> **Verdict: Chromium wins decisively.** Gecko (Firefox) has **no embeddable API** — Mozilla deprecated XULRunner years ago and never built a modern embedding story. Chromium has multiple mature embedding options.

| Criteria | Chromium | Firefox (Gecko) |
|----------|----------|-----------------|
| **Embeddable API** | ✅ WebView2, CEF, Electron | ❌ None (XULRunner deprecated) |
| **Automation Support** | ✅ CDP, Playwright, Puppeteer, Selenium | ⚠️ Limited (Firefox via Playwright uses CDP shim) |
| **Developer Ecosystem** | ✅ Massive (Electron, Tauri, CEF) | ❌ Virtually none for embedding |
| **Extension Support** | ✅ Chrome Extension API | ❌ WebExtensions only in Firefox proper |
| **LLM Tool Integration** | ✅ Playwright MCP, CDP tools | ❌ No standardized LLM tooling |
| **Windows Native** | ✅ WebView2 ships with Windows | ❌ Must bundle entire engine |

---

## 2. Framework Selection

Three approaches for building a Chromium-based custom browser:

### Option A: Electron (⭐ RECOMMENDED)

| Aspect | Detail |
|--------|--------|
| **What** | Bundles Chromium + Node.js; full control over browser chrome |
| **Pros** | Complete browser API access, `webContents` for tab management, `BrowserView`/`webview` tags, full Node.js backend, IPC system, massive ecosystem |
| **Cons** | ~150MB base size, higher memory than native |
| **Automation** | Native CDP access via `webContents.debugger`, Playwright connects directly |
| **Command Palette** | Easy — overlay `BrowserWindow` or DOM overlay in renderer |
| **Examples** | Min Browser, Brave (original), Beaker Browser |

### Option B: Tauri v2 + WebView2

| Aspect | Detail |
|--------|--------|
| **What** | Rust backend + system WebView2 on Windows |
| **Pros** | ~5MB base size, low memory, uses system browser engine |
| **Cons** | Limited `webview` control (no multi-tab natively), harder automation hooks, Rust learning curve |
| **Automation** | Must implement custom CDP bridge |
| **Why Not** | Cannot control the webview as deeply — no `webContents.debugger` equivalent, making Playwright integration much harder |

### Option C: CEF (Chromium Embedded Framework)

| Aspect | Detail |
|--------|--------|
| **What** | C/C++ framework wrapping Chromium with stable API |
| **Pros** | Maximum control, used in Spotify/Steam/Slack |
| **Cons** | C++ complexity, 200MB+ bundle, steep learning curve |
| **Why Not** | Overkill for our use case; Electron provides same browser control with JS |

> [!TIP]
> **Recommendation: Electron** — It gives us the deepest browser control (critical for automation + CDP), the largest ecosystem, and lets us build everything in JavaScript/TypeScript. The size tradeoff (~150MB) is acceptable for a desktop browser.

---

## 3. Existing Open-Source Browser Analysis

The user asked to find an existing fully open-source browser to **use without forking**.

### Min Browser (github.com/minbrowser/min)
- **Stack:** Electron-based, JavaScript
- **Features:** Tabs, address bar, ad blocking, reader mode, task grouping
- **Command-like Interface:** `!commands` in address bar (not a true command palette)
- **Stars:** ~8k+ on GitHub
- **Verdict:** Closest match BUT — to add our features (command palette, automation engine, LLM integration, sidebar), we'd essentially need to fork it. "Using without forking" isn't realistic for the level of customization needed.

### The Reality

> [!WARNING]
> **No existing open-source browser can be "used without forking" for this project.** The features you want (command palette, Playwright automation, LLM agentic control, automation save/replay, AI-generated automations) are so specific that they require a custom-built browser. However, we can:
> 
> 1. **Use Electron as the open-source base** (it IS the browser engine — MIT licensed)
> 2. **Reference Min Browser's architecture** for patterns (tabs, webview management)
> 3. **Use Playwright as an npm dependency** (not fork — `npm install playwright-core`)
> 4. **Use existing open-source command palette libraries** (`kbar`, `ninja-keys`)

---

## 4. Proposed Architecture

```
┌──────────────────────────────────────────────────────┐
│                    PATHFINDER BROWSER                  │
├──────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │   Tab Bar    │  │ Address Bar │  │  Side Panel  │ │
│  └─────────────┘  └─────────────┘  └──────────────┘ │
│  ┌──────────────────────────────────────────────────┐│
│  │              Browser Content Area                ││
│  │          (Electron webContents/webview)           ││
│  │                                                   ││
│  │  ┌─────────────────────────────────────────────┐ ││
│  │  │         Command Palette Overlay              │ ││
│  │  │  (Ctrl+K / Ctrl+Shift+P)                     │ ││
│  │  │  > quick_search batman                       │ ││
│  │  │  > automation run "login-bot"                 │ ││
│  │  │  > ai create automation "scrape prices"       │ ││
│  │  └─────────────────────────────────────────────┘ ││
│  └──────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────┤
│                   CORE SERVICES                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Automation│  │  LLM Engine  │  │  Quick Search │  │
│  │  Engine   │  │ (Cloud/Local)│  │   Popup       │  │
│  │(Playwright│  │              │  │               │  │
│  │  + CDP)   │  │  Ollama /    │  │  Small window │  │
│  │           │  │  OpenAI /    │  │  with results │  │
│  │  Record   │  │  Gemini /    │  │  + hotkey     │  │
│  │  Replay   │  │  Claude      │  │  dismiss      │  │
│  │  Save     │  │              │  │               │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
├──────────────────────────────────────────────────────┤
│                     DATA LAYER                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Automation│  │  Automation  │  │   Settings    │  │
│  │  Library  │  │   History    │  │   Store       │  │
│  │ (JSON/DB) │  │  (Logs/DB)   │  │  (JSON)       │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 5. Feature Breakdown

### 5.1 Command Palette (Ctrl+Shift+P / Ctrl+K)

A VS Code-style command palette overlay:

```
Commands:
  quick_search <query>     → Open mini search window
  search <query>           → Navigate to search in active tab
  goto <url>               → Navigate to URL
  tab new                  → New tab
  tab close                → Close current tab
  automation run <name>    → Execute saved automation
  automation record        → Start recording
  automation stop          → Stop recording
  automation list          → Show saved automations
  ai create <description>  → AI generates automation from prompt
  ai ask <question>        → Ask AI about current page
  settings                 → Open settings
  history                  → Show automation history
```

**Library:** Build custom or use `ninja-keys` web component

### 5.2 Quick Search Popup

- Triggered by command: `quick_search <query>` or dedicated hotkey (e.g., `Ctrl+Shift+S`)
- Opens a **small, always-on-top Electron BrowserWindow** (not a tab)
- Shows search results (Google/DuckDuckGo/custom)
- Dismiss with `Escape` or the same hotkey (toggle)
- Resizable, draggable, semi-transparent

### 5.3 Automation Engine (Playwright + CDP)

**Architecture:**
1. **Recording:** Use Electron's `webContents` CDP access to capture user actions (clicks, types, navigations)
2. **Playback:** Use `playwright-core` connecting to the browser's CDP endpoint
3. **Storage:** Save automations as JSON workflows (not raw Playwright scripts — more portable)

**Automation Format (JSON):**
```json
{
  "name": "Login to GitHub",
  "description": "Automated login flow",
  "steps": [
    { "action": "goto", "url": "https://github.com/login" },
    { "action": "fill", "selector": "#login_field", "value": "{{username}}" },
    { "action": "fill", "selector": "#password", "value": "{{password}}" },
    { "action": "click", "selector": "input[type=submit]" },
    { "action": "wait", "selector": ".dashboard" }
  ],
  "variables": {
    "username": { "type": "text", "prompt": "GitHub username" },
    "password": { "type": "secret", "prompt": "GitHub password" }
  },
  "created": "2026-04-14",
  "tags": ["login", "github"]
}
```

### 5.4 LLM Integration (Agentic Automation)

**Supported Providers:**
- **Cloud:** OpenAI, Gemini, Claude, Groq
- **Local:** Ollama (llama, mistral, etc.)

**Capabilities (Comet-inspired):**
1. **Page Analysis:** "Summarize this page", "Extract all prices"
2. **Automation Generation:** "Create an automation that logs into Gmail and checks for unread emails"
3. **Live Agent Mode:** AI takes control of the browser to perform multi-step tasks
4. **Automation Refinement:** AI can debug and fix failing automations

**Implementation:** 
- Use Playwright MCP server pattern — expose browser actions as tool calls to the LLM
- LLM receives accessibility tree snapshots (not screenshots — cheaper, faster)
- Agent loop: LLM plans → executes action → observes result → plans next

### 5.5 Sidebar Panel

- **Saved Automations:** List with run/edit/delete buttons
- **Automation History:** Recent runs with status (success/fail/partial)
- **AI Chat:** Conversational interface for automation creation
- Collapsible, resizable, dockable (left or right)

### 5.6 Settings

- **General:** Default search engine, homepage, startup behavior, downloads path
- **Appearance:** Theme (light/dark/system), font size, sidebar position
- **Privacy:** Clear data, cookie preferences, ad blocking toggle
- **LLM Configuration:** Provider selection, API keys, model selection, local Ollama URL
- **Automation:** Default timeout, screenshot on failure, variable management
- **Keyboard Shortcuts:** Customizable hotkeys for all commands
- **Advanced:** CDP port, proxy settings, user agent override

---

## 5.7 Home Starter Page (New Tab Page)

When the browser starts or a new tab is opened, a **custom home page** is displayed:

**Layout & Content:**
- **Greeting section:** Time-based greeting ("Good morning", "Good afternoon") with current date
- **Search bar:** Large, centered search bar (Apple-style with frosted glass effect)
- **Quick Links grid:** Frequently visited sites as icon cards (auto-populated from history + user pinned)
- **Recent Automations:** Quick-launch cards for the 3-5 most recently used automations
- **AI Quick Actions:** Pre-built prompt shortcuts ("Summarize clipboard", "Search for...", "Run automation...")
- **Ambient background:** Subtle gradient or dynamic wallpaper (user configurable)
- **Weather widget (optional):** Small weather card using free API
- **Keyboard shortcut hints:** Subtle reminder of key shortcuts at bottom

**Design:**
- Clean, minimal, Apple-inspired aesthetic (via `getdesign` Apple components)
- Smooth fade-in animations on load
- Fully responsive within the browser content area
- Respects light/dark mode from settings

---

## 6. UI Design System — Apple Design (`getdesign`)

> [!TIP]
> **UI Foundation:** `npx getdesign@latest add apple`
> 
> This scaffolds Apple-style design tokens, components, and patterns into the project. All browser UI (tabs, sidebars, settings, home page, command palette) will follow Apple's Human Interface Guidelines aesthetic.

**What this provides:**
- Apple-style color palette (system grays, accent colors, vibrant tints)
- SF Pro-inspired typography scale and spacing
- Frosted glass / vibrancy effects (backdrop-filter)
- Rounded, soft UI components (buttons, inputs, cards, modals)
- Native-feeling animations and transitions (spring curves)
- Light/dark mode tokens built-in

**How it integrates with Pathfinder:**

| UI Element | Apple Design Treatment |
|------------|------------------------|
| **Tab bar** | Compact, translucent header with subtle separator |
| **Address bar** | Rounded pill shape with frosted glass background |
| **Command palette** | Centered modal with backdrop blur, smooth scale animation |
| **Sidebar** | Translucent panel with grouped list sections (SF-style) |
| **Home page** | Widget-style cards with depth shadows, grid layout |
| **Settings** | Grouped form sections with toggle switches (iOS-style) |
| **Quick search** | Floating panel with rounded corners and drop shadow |
| **Buttons** | Filled/tinted variants with hover states |
| **Context menus** | Native-feeling popover menus with dividers |

**Setup Command (run during Phase 1 scaffold):**
```bash
npx getdesign@latest add apple
```

---

## 7. Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Electron 33+ | Full browser control, CDP access, Node.js backend |
| **Language** | TypeScript | Type safety for complex automation/LLM code |
| **UI Framework** | React 19 | Component-based UI, large ecosystem |
| **UI Design System** | `getdesign` (Apple) | Apple HIG-inspired components, tokens, and patterns |
| **Styling** | CSS Modules + CSS Variables + getdesign tokens | Apple-aesthetic, themeable design system |
| **Automation** | playwright-core (npm) | Industry-standard, CDP-based, no browser bundle needed |
| **LLM Client** | Custom adapter layer | Abstract over OpenAI/Gemini/Ollama APIs |
| **Data Storage** | SQLite (better-sqlite3) | Local DB for automations, history, settings |
| **IPC** | Electron IPC + contextBridge | Secure main↔renderer communication |
| **Build** | electron-builder | Windows installer (.exe / .msi) |

---

## 8. Proposed Milestone Roadmap

### Milestone 1: Core Browser Shell (Phases 1-5)
1. **Phase 1:** Project scaffold — Electron + TypeScript + React + `npx getdesign@latest add apple` + build pipeline
2. **Phase 2:** Browser core — Tab management, address bar, navigation, webview (Apple-styled)
3. **Phase 3:** Home starter page — New tab page with search bar, quick links, recent automations, AI shortcuts
4. **Phase 4:** Command palette — Hotkey trigger, fuzzy search, command registration system
5. **Phase 5:** Quick search popup — Mini window, search integration, toggle dismiss

### Milestone 2: Automation Engine (Phases 6-9)
6. **Phase 6:** CDP integration — Connect playwright-core to browser webContents
7. **Phase 7:** Action recording — Capture clicks, fills, navigations as JSON steps
8. **Phase 8:** Automation playback — Execute saved automations with variable injection
9. **Phase 9:** Sidebar panel — Automation library, run/edit/delete, history view

### Milestone 3: AI & LLM Integration (Phases 10-13)
10. **Phase 10:** LLM adapter layer — OpenAI, Gemini, Claude, Ollama support
11. **Phase 11:** Page analysis — AI reads current page, answers questions
12. **Phase 12:** AI automation generation — Natural language → automation JSON
13. **Phase 13:** Live agent mode — AI controls browser for multi-step tasks

### Milestone 4: Polish & Settings (Phases 14-16)
14. **Phase 14:** Settings system — Full configuration UI with all categories
15. **Phase 15:** Theming & appearance — Light/dark mode, custom Apple-style themes
16. **Phase 16:** Packaging & distribution — Windows installer, auto-updates

---

## User Review Required

> [!IMPORTANT]
> ### Decisions Needed:
> 
> 1. **Engine confirmed?** Chromium via Electron — are you OK with ~150MB app size? (Tauri would be ~5MB but much harder to add automation)
> 
> 2. **No existing browser can be used without forking** for this level of customization. Are you OK building from scratch using Electron + open-source npm packages?
> 
> 3. **UI Framework:** React is recommended. Any preference? (Vue, Svelte, vanilla JS?)
> 
> 4. **Default search engine:** Google, DuckDuckGo, or configurable?
> 
> 5. **LLM priority:** Which provider should we integrate first? (OpenAI, Gemini, Ollama?)
> 
> 6. **Project name:** "Pathfinder" (from repo name) — confirmed?
> 
> 7. **Home page widgets:** Should the home starter page include weather widget? Any other widgets you want (e.g., calendar, news, bookmarks, notes)?

---

## Next Steps

After you approve:
1. Run `/gsd-new-project` to initialize the GSD planning infrastructure
2. Set up the roadmap with the milestones above
3. Begin `/gsd-plan-phase 1` for the Electron scaffold

---

*Research completed: 2026-04-14*
*Sources: WebView2 docs, CEF project, Min Browser (GitHub), Perplexity Comet analysis, Playwright MCP documentation*
