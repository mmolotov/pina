---
---
id: TASK-042
title: FE-DESIGN-006 Style guide conformance guards and CI gates
status: Done
assignee:
  - codex
created_date: '2026-04-06 20:10'
labels:
  - frontend
  - design
  - qa
  - ci
milestone: m-2
dependencies:
  - TASK-037
  - TASK-038
  - TASK-039
  - TASK-040
  - TASK-041
references:
  - frontend/docs/ui-ux-implementation-plan.md
  - frontend/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add enforcement around the frontend style guide so design-system rules are not merely documented but mechanically protected in the build and CI pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Frontend checks prevent obvious style drift such as raw color usage outside the theme layer where practical
- [x] #2 Accessibility and responsive checks are integrated into the normal frontend CI workflow
- [x] #3 The frontend quality pipeline clearly documents which UI checks are blocking
- [x] #4 CI fails when the enforced design-system and UI-quality gates fail
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

The frontend now has a dedicated `guard:design` script that blocks raw color literals outside `app/app.css`, while GitHub Actions treats `npm run check`, Vitest coverage, and Playwright responsive/visual smoke as blocking gates. The README and design-system guide document which UI checks are enforced and how the browser-level screenshot baseline is validated.

<!-- SECTION:NOTES:END -->
