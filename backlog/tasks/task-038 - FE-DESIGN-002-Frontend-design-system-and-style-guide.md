---
id: TASK-038
title: FE-DESIGN-002 Frontend design system and style guide
status: Done
assignee:
  - codex
created_date: "2026-04-06 20:10"
labels:
  - frontend
  - design
  - docs
milestone: m-2
dependencies:
  - TASK-037
references:
  - MILESTONES.md
  - frontend/README.md
  - frontend/docs/ui-ux-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Create a practical frontend style guide that documents typography, spacing, radii, shadows, motion, panel rules, form conventions, and responsive expectations for the existing PINA UI. The guide must be short enough to maintain and concrete enough to enforce.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 The frontend module contains a design-system/style-guide document that engineers can follow directly
- [x] #2 The guide defines semantic token usage, typography, spacing, panel rules, button variants, and form rules
- [x] #3 The guide defines route-level responsive expectations and supported viewport classes
- [x] #4 Frontend README references the style guide as part of normal UI development workflow

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

The guide now lives in `frontend/docs/design-system.md` and is referenced directly from `frontend/README.md` as part of normal UI development workflow.

<!-- SECTION:NOTES:END -->
<!-- AC:END -->
