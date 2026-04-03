---
id: TASK-033
title: BE-SEARCH-001 Search API foundation and result model
status: To Do
assignee:
  - codex
created_date: '2026-04-03 17:09'
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
- [ ] #1 Backend exposes stable search route contracts under `/api/v1/search` for Phase 3 search integration
- [ ] #2 Search result DTOs are documented and support the frontend's current route needs, including mixed scopes or explicit result kinds where applicable
- [ ] #3 Search endpoints use the existing access-control model so only media visible to the authenticated user can appear in results
- [ ] #4 Backend tests cover route shape, pagination envelope, and access-control behavior for the new search surface
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Keep the current phase explicitly photo-first. Do not invent video-specific result requirements before Phase 7 lands.
<!-- SECTION:NOTES:END -->
