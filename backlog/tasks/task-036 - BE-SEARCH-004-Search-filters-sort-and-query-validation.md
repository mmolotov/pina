---
id: TASK-036
title: 'BE-SEARCH-004 Search filters, sort, and query validation'
status: Done
assignee:
  - '@codex'
created_date: '2026-04-03 17:09'
updated_date: '2026-04-20 13:47'
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
- [x] #1 Backend search endpoints support the current Phase 3 filter and sort subset that the frontend can expose without placeholders
- [x] #2 Invalid combinations or malformed query parameters return clear 400-level API errors instead of silent fallback behavior
- [x] #3 Search filters and sorting respect the same access-control boundaries as the rest of the media API
- [x] #4 Backend tests cover filter combination behavior, sort stability, and validation failures
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the initial Phase 3 filter surface intentionally small and frontend-ready: scope, kind, sort, plus the standard pagination envelope.
2. Validate unsupported scope, kind, and sort values at the API boundary and return explicit 400 responses instead of silent fallback behavior.
3. Reuse the same visibility-aware backend search aggregation so filtering and sorting never bypass personal-library or Space access rules.
4. Add tests for filter combinations, sort ordering, pagination, and validation failures so the frontend can depend on stable query behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added frontend-ready search query controls for scope (all/library/spaces/favorites), kind (all/photo/album), sort (relevance/newest/oldest), and stable PageResponse pagination.

Validation now rejects unsupported scope, kind, and sort values with 400 Bad Request responses instead of silently falling back.

SearchResourceTest now covers kind filtering, favorites filtering, relevance ordering, newest/oldest sorting, pagination, and validation failures against the same access-control-aware search surface.
<!-- SECTION:NOTES:END -->
