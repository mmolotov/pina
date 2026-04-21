---
id: TASK-033
title: BE-SEARCH-001 Search API foundation and result model
status: Done
assignee:
  - '@codex'
created_date: '2026-04-03 17:09'
updated_date: '2026-04-20 13:45'
labels:
  - backend
  - search
milestone: m-2
dependencies: []
references:
  - MILESTONES.md
  - docs/product-requirements.adoc
  - frontend/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce the backend foundation for Phase 3 search: route structure, DTOs, pagination model, and a stable search result contract that the frontend can consume. The initial scope is photo-first and intentionally excludes video-specific search behavior until Phase 7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backend exposes stable search route contracts under `/api/v1/search` for Phase 3 search integration
- [x] #2 Search result DTOs are documented and support the frontend's current route needs, including mixed scopes or explicit result kinds where applicable
- [x] #3 Search endpoints use the existing access-control model so only media visible to the authenticated user can appear in results
- [x] #4 Backend tests cover route shape, pagination envelope, and access-control behavior for the new search surface
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a dedicated backend search foundation under /api/v1/search with SearchResource, SearchService, and explicit DTOs for paginated mixed search results.
2. Reuse the existing PageRequest/PageResponse envelope so the frontend gets a stable pagination contract from the first iteration.
3. Model Phase 3 search scopes as all, library, spaces, and favorites so the current /app/search URL contract can map to backend query params without a route redesign later.
4. Implement access-control-aware visibility loading for searchable media: personal-library photos and albums owned by the user, plus photos and albums exposed through accessible Space albums, plus favorites filtered through current visibility rules.
5. Keep the initial contract photo-first but allow explicit result kinds so later work can add richer result types without breaking the frontend.
6. Cover route shape, pagination envelope, empty responses, and access-control behavior with backend tests before moving to the real text/tag matching task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Keep the current phase explicitly photo-first. Do not invent video-specific result requirements before Phase 7 lands.

Implemented /api/v1/search with explicit mixed-result DTOs, stable PageResponse pagination, scope filtering for all/library/spaces/favorites, kind and sort parsing, and visibility-aware search over personal and Space-visible media.

Added SearchResourceTest coverage for route shape, pagination envelope, visibility through Space albums, favorites scope behavior, and invalid query parameter handling.
<!-- SECTION:NOTES:END -->
