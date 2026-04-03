---
id: TASK-034
title: BE-SEARCH-002 Text and tag search API
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
- [ ] #1 `/api/v1/search?q=` returns real backend results for text or tag queries within the authenticated user's accessible scope
- [ ] #2 Search matching strategy and ranking behavior are explicitly documented for the current phase, including what fields are searched before full ML semantic search exists
- [ ] #3 Empty queries, no-result queries, invalid query parameters, and pagination are handled consistently
- [ ] #4 Backend tests cover positive text and tag matches, ranking or ordering behavior, and access-control enforcement
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
If full CLIP-based semantic search is not yet available in the backend, document the temporary Phase 3 matching strategy clearly instead of pretending it is semantic.
<!-- SECTION:NOTES:END -->
