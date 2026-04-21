---
id: TASK-034
title: BE-SEARCH-002 Text and tag search API
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
references:
  - MILESTONES.md
  - docs/product-requirements.adoc
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement backend support for text and tag search so the frontend search route can move beyond a shell. This task covers the query endpoint, relevance or deterministic ranking strategy, and the initial searchable fields available before the full ML stack is complete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `/api/v1/search?q=` returns real backend results for text or tag queries within the authenticated user's accessible scope
- [x] #2 Search matching strategy and ranking behavior are explicitly documented for the current phase, including what fields are searched before full ML semantic search exists
- [x] #3 Empty queries, no-result queries, invalid query parameters, and pagination are handled consistently
- [x] #4 Backend tests cover positive text and tag matches, ranking or ordering behavior, and access-control enforcement
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build real Phase 3 backend matching on top of the /api/v1/search foundation without pretending semantic search already exists.
2. Support real text queries against currently available textual fields only: photo original filenames plus album names and descriptions.
3. Treat tag-like queries as plain text matching for now and document that dedicated ML tag indexing is not available in Phase 3 yet.
4. Keep result visibility aligned with existing access control for personal-library media, Space-visible media, and favorites scope.
5. Define and document the temporary ranking strategy so relevance ordering is predictable before ML search lands.
6. Extend backend tests to cover positive matches, favorites/space visibility, and relevance behavior for current-phase text search.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
If full CLIP-based semantic search is not yet available in the backend, document the temporary Phase 3 matching strategy clearly instead of pretending it is semantic.

Enabled real Phase 3 backend text search on /api/v1/search over photo original filenames and album names/descriptions within the authenticated user's accessible scope.

Documented the temporary non-semantic matching strategy in backend/README.md, including scope, kind, sort, relevance rules, empty-query behavior, and the current handling of tag-like queries before ML indexing exists.

Extended SearchResourceTest to cover positive mixed-result matches, relevance behavior, favorites scope behavior, empty/no-result handling, and access control through Space albums.
<!-- SECTION:NOTES:END -->
