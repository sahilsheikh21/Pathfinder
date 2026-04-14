# Phase 02 UI Specification - Browser Core

**Phase:** 02 - Browser Core
**Date:** 2026-04-14
**Status:** Ready for planning

## Objective
Define the browser chrome contract for tab lifecycle, omnibox navigation, and download visibility while preserving the existing Apple-inspired shell baseline.

## Visual Direction
- Platform: Windows desktop browser shell
- Aesthetic: compact, frosted top chrome with rounded controls
- Layout: top tab strip, navigation row, full-height content viewport
- Tone: utility-first, low-noise, clear state indicators

## Required Surfaces
- Tab strip with active tab emphasis and explicit new-tab affordance
- Navigation row with back, forward, reload, and stop controls
- Omnibox field with submit action and loading feedback
- Content viewport region for active tab web content
- Download shelf/panel with progress and terminal state labels

## Interaction Contract
- Keyboard and pointer can switch tabs.
- Back/forward controls visually disabled when unavailable.
- Omnibox submit accepts URL or search input.
- Loading state appears while active tab is navigating.
- Download states show in-progress, completed, failed, or cancelled.

## Accessibility Baseline
- Focus-visible outline on tab buttons, nav buttons, and omnibox.
- Touch target equivalent for desktop pointer controls (min 32px height).
- Text contrast remains AA-compliant on frosted and elevated surfaces.
- Status updates (download result/state) are text-visible, not color-only.

## Motion and Feedback
- Keep motion subtle: color/opacity transitions only for tab and button states.
- Avoid layout-shifting animations in tab close/switch flows.
- Loading indicators use lightweight spinner or textual loading marker.

## Deliverables
- Browser chrome components for tab strip and navigation bar
- Omnibox integrated with routing behavior
- Download status UI component integrated into shell
- Responsive shell behavior for 1024px+ desktop widths

## Acceptance Targets
- Users can discover tab and navigation controls without hidden gestures.
- Disabled and active states are visually distinct.
- Download progress is continuously visible for active downloads.
- Browser chrome preserves token-based styling (no hardcoded one-off colors).

---
*Generated for phase planning gate compliance*
