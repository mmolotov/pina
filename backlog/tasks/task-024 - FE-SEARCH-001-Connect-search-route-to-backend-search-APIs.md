---
id: TASK-024
title: FE-SEARCH-001 Connect search route to backend search APIs
status: To Do
assignee:
  - codex
created_date: '2026-04-03 17:05'
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
- [ ] #1 The `/app/search` route loads real backend search results instead of local preview-only placeholder data
- [ ] #2 The UI supports the documented Phase 3 search scopes and filters that the backend exposes, including empty, loading, and error states
- [ ] #3 Search route tests cover successful result rendering, backend error handling, and URL-driven query state
- [ ] #4 Frontend docs are updated so Phase 3 no longer describes search as a shell-only route
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This task intentionally starts from the existing search shell instead of replacing the route structure. Keep the URL contract stable and layer backend integration into the current route when the search APIs are ready.
<!-- SECTION:NOTES:END -->
