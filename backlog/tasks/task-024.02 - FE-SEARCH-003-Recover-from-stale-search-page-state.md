---
id: TASK-024.02
title: FE-SEARCH-003 Recover from stale search page state
status: Done
assignee:
  - '@codex'
created_date: '2026-04-21 06:32'
updated_date: '2026-04-21 06:36'
labels:
  - frontend
  - search
  - bug
milestone: m-2
dependencies: []
references:
  - /Users/mama/dev/pina/frontend/app/routes/app-search.tsx
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-024 -
    FE-SEARCH-001-Connect-search-route-to-backend-search-APIs.md
documentation:
  - frontend/README.md
  - docs/product-requirements.adoc
parent_task_id: TASK-024
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the search-route regression where a stale or out-of-range `page` parameter can produce an empty state even though matching results still exist on earlier pages. The route should recover from invalid page state instead of presenting a false no-results message with no reachable way back.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The search route detects out-of-range page state when the backend reports existing results but the requested page is empty
- [x] #2 The UI recovers to a reachable page without losing the active query, scope, kind, or sort state
- [x] #3 Users do not see the generic no-results empty state for stale page values when earlier pages still contain matches
- [x] #4 Route tests cover stale page restoration from URL state and verify that real results become reachable again
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Detect the stale-page condition when the backend returns an empty page for a nonzero `page` while still reporting total results or total pages.
2. Repair the URL state by clamping to the last reachable page and immediately re-request the corrected page without clearing the active query or filters.
3. Prevent the generic no-results empty state from rendering during stale-page recovery.
4. Extend route tests to cover recovery from an out-of-range page value restored from the URL.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added stale-page recovery in the search route: when the backend reports an empty nonzero page while total results still exist, the route clamps the URL to the last reachable page and re-requests results instead of showing a false empty state.

Covered the recovery path with a route test that starts from an out-of-range `page` query param and verifies that the route lands on the last valid page with real results.

Validated the frontend change with `npm run test -- app/routes/app-search.test.tsx` and `npm run check` in `frontend/`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed stale search page recovery in the frontend route. When `/app/search` is opened with an out-of-range `page` query parameter but the backend still reports existing results, the route now repairs the URL to the last reachable page and reloads that page instead of rendering a misleading no-results state.

Added route coverage for stale URL page restoration alongside the existing pagination tests, and kept query, scope, kind, and sort state intact during recovery. Validation: `npm run test -- app/routes/app-search.test.tsx` and `npm run check` in `frontend/`.
<!-- SECTION:FINAL_SUMMARY:END -->
