---
id: TASK-033.01
title: BE-SEARCH-005 Preserve space-backed result context for owner-visible photos
status: Done
assignee:
  - '@codex'
created_date: '2026-04-20 14:29'
updated_date: '2026-04-20 14:38'
labels:
  - backend
  - search
  - bug
milestone: m-2
dependencies: []
references:
  - >-
    /Users/mama/dev/pina/backend/src/main/java/dev/pina/backend/service/SearchService.java
  - >-
    /Users/mama/dev/pina/backlog/tasks/task-033 -
    BE-SEARCH-001-Search-API-foundation-and-result-model.md
documentation:
  - docs/product-requirements.adoc
  - backend/README.md
  - frontend/README.md
parent_task_id: TASK-033
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the search result-classification regression where a user-owned photo that is visible through a Space album loses its Space context in the result model. Results should preserve the context that made the hit visible so the frontend can navigate back through the shared Space or album when the active search scope expects that behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Search results that are visible through a Space album preserve Space or album context in the response even when the current user is also the uploader
- [x] #2 Space-scoped and favorites-scoped search results classify owner-visible shared photos in a way that does not collapse them into personal-library-only navigation
- [x] #3 Backend tests cover owner-uploaded photos that are also visible through accessible Space albums and verify the emitted scope or context fields
- [x] #4 The result-model behavior is documented clearly enough that frontend routing can rely on it without guessing between library and Space destinations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review how `SearchService` accumulates Space context for photo hits and where `entryScopeFor()` discards that context for owner-uploaded photos.
2. Change result-scope selection so Space-backed hits preserve shared-album navigation context when the result already carries Space or album metadata.
3. Add backend tests for owner-uploaded photos that are searchable through accessible Space albums and favorites scope.
4. Keep the response model stable for the frontend while documenting the clarified routing expectation in task notes or implementation notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed `SearchService` result-scope selection so photo hits preserve `SPACES` scope whenever the accumulated hit already carries Space context, even for owner-uploaded photos.

Added API coverage for owner-visible shared photos in both `scope=spaces` and `scope=favorites` so the shared-album navigation context remains stable for the frontend.

Validated the backend change with `./gradlew spotlessCheck test --tests dev.pina.backend.api.SearchResourceTest` in `backend/`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserved shared Space context for owner-uploaded photos returned by search. `SearchService` now emits `entryScope=SPACES` for photo hits that already carry Space or album context, instead of collapsing them back to personal-library scope solely because the current user is the uploader.

Added `SearchResourceTest` coverage for owner-visible shared photos in both spaces and favorites scopes so the frontend can rely on Space-backed routing when the hit was surfaced through a shared album. Validation: `./gradlew spotlessCheck test --tests dev.pina.backend.api.SearchResourceTest` in `backend/`.
<!-- SECTION:FINAL_SUMMARY:END -->
