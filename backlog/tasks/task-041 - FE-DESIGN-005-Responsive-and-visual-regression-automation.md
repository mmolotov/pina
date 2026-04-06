---
id: TASK-041
title: FE-DESIGN-005 Responsive and visual regression automation
status: Done
assignee:
  - codex
created_date: '2026-04-06 20:10'
labels:
  - frontend
  - design
  - qa
  - responsive
milestone: m-2
dependencies:
  - TASK-037
  - TASK-039
references:
  - frontend/docs/ui-ux-implementation-plan.md
  - frontend/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add route-level responsive smoke coverage and screenshot regression checks so key Phase 3 screens are automatically validated across the supported viewport matrix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The frontend test stack includes route-level responsive smoke coverage for the agreed critical routes
- [x] #2 Screenshot or visual regression checks exist for the supported viewport matrix
- [x] #3 The responsive test suite catches layout breakage such as horizontal overflow and unreachable key actions
- [x] #4 The viewport matrix and covered routes are documented in the frontend module
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Playwright is now configured for route-first browser checks with a desktop/tablet/mobile viewport matrix, mocked SPA API traffic, and committed screenshot baselines for `/login`, `/app`, and `/app/library`. The frontend README documents the covered routes, viewport sizes, and the `test:e2e` / `test:e2e:update` workflow, while the current suite explicitly checks horizontal overflow and key action reachability before taking screenshots.

<!-- SECTION:NOTES:END -->
