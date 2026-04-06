---
id: TASK-039
title: FE-DESIGN-003 Shared UI primitives and route adoption
status: Done
assignee:
  - codex
created_date: '2026-04-06 20:10'
labels:
  - frontend
  - design
  - ui
milestone: m-2
dependencies:
  - TASK-037
  - TASK-038
references:
  - frontend/README.md
  - frontend/docs/ui-ux-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extract and adopt shared UI primitives so route modules stop duplicating panel, form, header, empty-state, and filter-bar patterns. The result should make the style guide enforceable through reusable code instead of manual discipline alone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared primitives exist for the most repeated UI patterns used across the current routes
- [x] #2 Key Phase 3 routes adopt the shared primitives instead of route-local styling copies
- [x] #3 Repeated route-level utility-class blocks are reduced materially in the codebase
- [x] #4 Route and component tests are updated to cover the adopted primitives where relevant
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Shared primitives now cover reusable cards, badges, inline feedback, filter toolbars, and subdued empty hints in `app/components/ui.tsx`, with adoption across auth, overview, search, favorites, library, Spaces, settings, and detail routes. Route-level tests and component tests were updated to exercise the adopted primitives and keep the shared patterns stable.

<!-- SECTION:NOTES:END -->
