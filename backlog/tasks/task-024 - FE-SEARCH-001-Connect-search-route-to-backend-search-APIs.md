---
id: TASK-024
title: FE-SEARCH-001 Connect search route to backend search APIs
status: Done
assignee:
  - '@codex'
created_date: '2026-04-03 17:05'
updated_date: '2026-04-20 13:55'
labels:
  - frontend
  - search
milestone: m-2
dependencies:
  - TASK-033
  - TASK-034
  - TASK-035
  - TASK-036
references:
  - MILESTONES.md
  - frontend/README.md
  - docs/product-requirements.adoc
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current search placeholder with real route-level integration against backend search APIs for text, tags, and faces once those endpoints are available. This task closes the remaining Phase 3 search gap beyond the already-implemented shell and navigation contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The `/app/search` route loads real backend search results instead of local preview-only placeholder data
- [x] #2 The UI supports the documented Phase 3 search scopes and filters that the backend exposes, including empty, loading, and error states
- [x] #3 Search route tests cover successful result rendering, backend error handling, and URL-driven query state
- [x] #4 Frontend docs are updated so Phase 3 no longer describes search as a shell-only route
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the existing /app/search route and URL contract, but replace local preview-only behavior with real backend calls to /api/v1/search.
2. Add frontend API types and a typed client for the mixed search result contract, including scope and pagination params that match the new backend surface.
3. Update the route loader and UI state so all/library/spaces/favorites scopes drive backend search instead of local filtering, with loading, empty, and error states that reflect the request lifecycle.
4. Render mixed photo and album results in a way that preserves navigation context: personal-library hits should open personal routes, and Space-backed hits should expose their Space/album context in the card.
5. Keep the current route structure and query-string behavior stable so q and scope remain URL-driven, then wire tests around successful rendering, backend failure handling, and URL-driven query state.
6. Update frontend docs so search is no longer described as a shell-only route once the backend integration lands.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This task intentionally starts from the existing search shell instead of replacing the route structure. Keep the URL contract stable and layer backend integration into the current route when the search APIs are ready.

Replaced the local preview-only search route with real backend integration against /api/v1/search while keeping the existing /app/search route and URL-driven query behavior intact.

Added typed frontend search API contracts and route controls for backend scopes, kind filtering, sorting, and mixed photo/album result rendering with personal-library versus Space navigation context.

Updated app-search tests to cover successful backend result rendering, loading and backend error handling, and URL-restored search state.

Updated frontend/README.md so Phase 3 search is described as backend-connected text search rather than a shell-only route.
<!-- SECTION:NOTES:END -->
