---
id: TASK-036
title: BE-SEARCH-004 Search filters, sort, and query validation
status: To Do
assignee:
  - codex
created_date: '2026-04-03 17:09'
labels:
  - backend
  - search
milestone: m-2
dependencies:
  - TASK-033
  - TASK-034
  - TASK-035
references:
  - MILESTONES.md
  - docs/product-requirements.adoc
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the Phase 3 backend query layer around search: filter combinations, supported sort options, parameter validation, and consistent paging semantics across text, tag, and face-driven result sets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Backend search endpoints support the current Phase 3 filter and sort subset that the frontend can expose without placeholders
- [ ] #2 Invalid combinations or malformed query parameters return clear 400-level API errors instead of silent fallback behavior
- [ ] #3 Search filters and sorting respect the same access-control boundaries as the rest of the media API
- [ ] #4 Backend tests cover filter combination behavior, sort stability, and validation failures
<!-- AC:END -->
