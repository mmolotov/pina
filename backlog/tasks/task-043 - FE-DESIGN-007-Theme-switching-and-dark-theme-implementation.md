---
id: TASK-043
title: FE-DESIGN-007 Theme switching and dark theme implementation
status: Done
assignee:
  - codex
created_date: "2026-04-06 20:18"
labels:
  - frontend
  - design
  - theming
milestone: m-2
dependencies:
  - TASK-037
  - TASK-038
references:
  - MILESTONES.md
  - frontend/README.md
  - frontend/docs/ui-ux-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Implement first-class theme switching for the frontend so PINA supports both light and dark themes through the same semantic token system. The feature should include an explicit user-facing theme switcher and persisted preference handling.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 The frontend supports both light and dark themes through semantic tokens rather than route-local overrides
- [x] #2 Users can switch themes explicitly from the UI, and the preference persists across reloads
- [x] #3 Key Phase 3 routes render correctly in both themes without contrast or readability regressions
- [x] #4 Frontend tests cover theme switching behavior and theme-aware route rendering where practical

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Theme switching now uses a shared provider in `app/lib/theme.tsx`, a root bootstrap script to apply the persisted theme before hydration, and shell-level controls that toggle and persist light/dark preference across reloads.
<!-- SECTION:NOTES:END -->
<!-- AC:END -->
