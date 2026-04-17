# Phase 15 UI Specification - Theming and Shortcuts

**Phase:** 15 - Theming and Shortcuts
**Date:** 2026-04-17
**Status:** Ready for planning

## Objective
Define the UI contract for appearance personalization and keyboard customization so users can change theme/font/sidebar preferences and core shortcut bindings with clear conflict handling.

## Visual Direction
- Platform: Windows desktop browser shell
- Aesthetic: existing tokenized frosted style, but user-personalizable
- Layout: settings-driven appearance controls integrated in Settings panel
- Tone: low-friction productivity UI with explicit validation feedback

## Required Surfaces
- Appearance section in Settings for:
  - Theme mode (`light`, `dark`, `system`)
  - Font-size personalization control
  - Sidebar position preference
- Shortcut section in Settings for:
  - Editable bindings for core browser/command actions
  - Inline conflict and invalid-binding feedback
  - Reset-to-default shortcut action

## Interaction Contract
- Appearance changes apply immediately in renderer and persist.
- System theme mode updates live when OS appearance changes.
- Font-size preference updates shell typography without restart.
- Sidebar position preference updates layout where responsive mode allows docking.
- Shortcut edits are validated before save.
- Duplicate/conflicting shortcut assignments are blocked with clear error messaging.

## Accessibility Baseline
- Appearance and shortcut controls are keyboard reachable and focus-visible.
- Validation errors are text-visible and not color-only.
- Theme transition remains subtle and should not impair readability.
- Shortcut editor labels and states are screen-reader friendly.

## Motion and Feedback
- Theme transitions use subtle color changes (~120-180ms).
- Validation feedback is immediate and non-modal.
- No large layout-shift animations when switching sidebar position.

## Deliverables
- Appearance controls integrated into Settings panel.
- Shortcut editor UI with conflict detection states.
- Updated shell styling hooks for font-size and sidebar position preference.
- Command hints and labels updated to reflect user-configured shortcuts.

## Acceptance Targets
- Theme mode and font-size updates apply immediately and persist.
- Sidebar position and visual preferences are configurable from Settings.
- Core shortcut bindings are editable and conflicts are prevented at save time.

---
*Generated for phase planning gate compliance*
