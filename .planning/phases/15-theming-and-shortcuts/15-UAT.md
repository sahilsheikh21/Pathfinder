---
status: testing
phase: 15-theming-and-shortcuts
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md]
started: 2026-04-17T11:19:41Z
updated: 2026-04-17T11:19:41Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cold Start Smoke Test
expected: |
  Fully close Pathfinder. Start it again from a fresh launch. App should boot without startup errors,
  Settings should open successfully, and core shell UI should render with tabs and navigation responsive.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Fully close Pathfinder. Start it again from a fresh launch. App should boot without startup errors, Settings should open successfully, and core shell UI should render with tabs and navigation responsive.
result: [pending]

### 2. Appearance Settings Surface Is Available
expected: Opening Settings shows Appearance and Shortcuts sections. Appearance contains controls for Theme Mode, Font Size, and Tab Sidebar Position.
result: [pending]

### 3. Theme Mode Applies Immediately And Persists
expected: Changing Theme Mode updates the UI immediately. Choosing System follows OS color-scheme updates while app stays open. After restart, selected mode remains in effect.
result: [pending]

### 4. Font Size And Tab Sidebar Position Apply At Runtime
expected: Changing Font Size updates text scale without restart. Changing Tab Sidebar Position moves the tab strip left/right in supported layouts and remains after restart.
result: [pending]

### 5. Shortcut Editing Updates Runtime Behavior And Hint Text
expected: Editing a shortcut (for example command palette open) saves successfully. The new key combo triggers the action, old combo no longer does, and tab-strip hint reflects the updated binding.
result: [pending]

### 6. Shortcut Conflict Handling Blocks Duplicate Bindings
expected: Assigning the same key combo to two shortcut commands is blocked with clear conflict feedback, and conflicting bindings are not saved.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

[none yet]
