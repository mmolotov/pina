---
id: TASK-033.02
title: BE-SEARCH-006 Make all-scope photo result context scope-aware
status: Done
assignee:
  - '@codex'
created_date: '2026-04-21 06:31'
updated_date: '2026-04-21 06:36'
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
  - backend/README.md
  - docs/product-requirements.adoc
  - frontend/README.md
parent_task_id: TASK-033
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the search result regression where owner-uploaded photos that are also visible through Space albums always collapse to Space navigation context once any Space context is accumulated. The backend should choose result context in a scope-aware way so all-scope search does not lose the personal-library path while spaces and favorites scopes still preserve shared-album navigation when that is the reason the hit is being shown.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In `scope=all`, owner-uploaded photos do not lose their personal-library result scope solely because the same asset also appears in a Space album
- [x] #2 In `scope=spaces` and `scope=favorites`, Space-backed photos still preserve shared Space or album navigation context when that context exists
- [x] #3 Backend tests cover owner-uploaded photos that appear in both personal-library and Space-backed search paths across all, spaces, and favorites scopes
- [x] #4 The result-model behavior is explicit enough that the frontend can distinguish between all-scope and shared-scope routing without guessing
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pass the requested search scope through result materialization so `SearchService` can choose `entryScope` with full context instead of inferring only from ownership and accumulated Space metadata.
2. Keep shared Space context for spaces and favorites scopes, but preserve personal-library result scope for owner-uploaded photos in all-scope search.
3. Extend backend API coverage with an all-scope owner-visible shared-photo case in addition to spaces and favorites expectations.
4. Keep the response shape stable for the frontend while tightening the documented routing semantics in task notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Made photo-hit `entryScope` selection depend on the requested search scope so all-scope owner results keep their personal-library path while spaces and favorites still preserve shared-album navigation.

Extended `SearchResourceTest` with an all-scope owner-visible shared-photo assertion alongside the existing spaces and favorites shared-context cases.

Validated the backend change with `./gradlew test --tests dev.pina.backend.api.SearchResourceTest` and `./gradlew spotlessCheck` in `backend/`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made search photo result context scope-aware in the backend. Owner-uploaded photos that also appear in Space albums now keep `LIBRARY` result scope during `scope=all`, while `scope=spaces` and `scope=favorites` still preserve shared Space/album routing when that context exists.

Added API coverage for the owner-visible shared-photo case across all, spaces, and favorites scopes so the frontend can rely on deterministic routing semantics from the result model. Validation: `./gradlew test --tests dev.pina.backend.api.SearchResourceTest` and `./gradlew spotlessCheck` in `backend/`.
<!-- SECTION:FINAL_SUMMARY:END -->
