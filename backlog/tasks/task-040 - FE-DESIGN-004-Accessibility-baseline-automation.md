---
id: TASK-040
title: FE-DESIGN-004 Accessibility baseline automation
status: Done
assignee:
  - codex
created_date: '2026-04-06 20:10'
labels:
  - frontend
  - design
  - a11y
  - qa
milestone: m-2
dependencies:
  - TASK-038
  - TASK-039
references:
  - frontend/docs/ui-ux-implementation-plan.md
  - frontend/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add automated accessibility validation to the frontend so keyboard, labeling, focus, and structural issues are caught during normal development and CI, not only through manual review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Frontend static tooling includes accessibility-focused lint rules appropriate for React route modules
- [x] #2 Key routes have automated accessibility smoke checks
- [x] #3 Accessibility failures are visible in the frontend quality pipeline
- [x] #4 The style guide documents the enforced accessibility baseline
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Frontend ESLint now includes `eslint-plugin-jsx-a11y`, Vitest setup extends `jest-axe` matchers, and key routes (login, register, overview, library) have automated accessibility smoke coverage. The design-system guide and frontend README now document the enforced accessibility baseline and the fact that a11y failures surface through the normal lint and test pipeline.

<!-- SECTION:NOTES:END -->
