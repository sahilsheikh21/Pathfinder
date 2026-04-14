# Phase 01 UI Specification - Project Scaffold

**Phase:** 01 - Project Scaffold
**Date:** 2026-04-14
**Status:** Ready for planning

## Objective
Define the base UI contract for scaffold work so later browser phases inherit consistent Apple-inspired visual primitives without redesigning foundations.

## Visual Direction
- Platform: Windows desktop app shell
- Aesthetic: Apple-inspired translucency, rounded geometry, restrained depth
- Motion: minimal at scaffold stage; only foundational transition tokens
- Tone: clean, high-contrast, productivity-first

## Design Tokens Required in Phase 1
- Color tokens:
  - bg/base, bg/elevated, bg/frosted
  - text/primary, text/secondary
  - accent/primary, accent/hover
  - border/subtle
- Radius tokens:
  - sm, md, lg, xl, pill
- Spacing tokens:
  - 4, 8, 12, 16, 24, 32
- Shadow tokens:
  - sm, md, lg for floating/frosted surfaces
- Typography tokens:
  - font family, scale steps for caption/body/title

## Core Scaffold UI Elements
- App root container
- Placeholder top chrome strip
- Placeholder content viewport region
- Global command-hotkey hint zone (non-functional visual placeholder)

## Interaction and Accessibility Baseline
- Keyboard focus rings visible on all interactive demo elements
- Color contrast target at least WCAG AA for text on primary surfaces
- Reduced-motion compatibility token path present

## Deliverables
- Global token stylesheet and theme variable map
- Base renderer shell component applying tokens
- One frosted card primitive demonstrating blur/elevation/radius tokens
- Light and dark theme token sets with system-mode fallback

## Acceptance Targets
- Tokens are centralized and referenced by shell UI, not hardcoded values
- Shell renders correctly at 100%, 125%, and 150% display scaling
- Theme switch between light/dark/system updates shell without reload

---
*Generated for phase planning gate compliance*
