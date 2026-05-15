# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## browser-homepage-hidden-extra-space-ui-icons — right-rail browser bounds mismatch and inconsistent icon coverage
- **Date:** 2026-04-17
- **Error patterns:** browser ui blank space, homepage partially hidden, clipped browser area, sidebar position right rail, icon button inconsistencies, placeholder section icons
- **Root cause:** Renderer/right-rail layout state was not synchronized with BrowserRuntime view-bounds calculations, leaving stale left-rail offsets and visible blank/clipped browser area in right-rail mode; icon/button consistency was degraded by placeholder icon labels.
- **Fix:** Synchronized BrowserRuntime bounds with appearance.sidebarPosition in startup and save flows, tightened viewport/home sizing CSS to avoid clipping/extra blank space, and replaced placeholder/sidebar letters plus key action buttons with consistent icon+label presentation.
- **Files changed:** src/main/browserRuntime.ts, src/main/main.ts, src/renderer/styles/global.css, src/renderer/components/AutomationSidebar.tsx, src/renderer/components/BrowserTabStrip.tsx, src/renderer/components/HomeStarterPage.tsx
---

## the-homepage-need-fixes — homepage navigation fallback and omnibox search/address alignment
- **Date:** 2026-04-17
- **Error patterns:** homepage quick links do nothing, homepage open action no-op, home search does not open typed URL, homepage appears incomplete when no active tab exists
- **Root cause:** Homepage interaction logic had two usability regressions: app-level navigate flow returned early when no active tab was selected, and home search forced search-template usage instead of honoring address input.
- **Fix:** Added navigate fallback to create a new tab when active tab is missing, switched home search resolution to omnibox parsing so URLs navigate directly while other text searches, and removed unnecessary active-tab gating from home quick-link/recent data loading.
- **Files changed:** src/renderer/App.tsx, src/renderer/components/HomeStarterPage.tsx
---
